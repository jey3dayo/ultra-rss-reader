use crate::domain::error::{DomainError, DomainResult};
use dev_store_file::{read_dev_store, validate_dev_credential_account_id, write_dev_store};
use dev_store_lock::{delete_dev_password_at_path, with_dev_store_lock};
use dev_store_path::dev_credentials_path;
use diagnostics::{
    log_keyring_access_failed, log_keyring_error, log_sync_read_gate_failed, KeyringOp,
};
#[cfg(any(target_os = "macos", test))]
use std::sync::atomic::{AtomicBool, Ordering};
#[cfg(any(target_os = "macos", test))]
use std::sync::Arc;
use std::time::Duration;

pub(crate) mod cloudflare_access;
mod dev_store_file;
mod dev_store_lock;
mod dev_store_path;
mod diagnostics;
mod macos_security_cli;
mod redaction;
#[cfg(any(target_os = "macos", test))]
pub(crate) mod session_cache;
#[cfg(test)]
mod tests;

pub(crate) use diagnostics::CredentialKind;

#[cfg(not(target_os = "macos"))]
const CALLER_READ_TIMEOUT: Duration = Duration::from_secs(10);

pub(super) const SERVICE: &str = "ultra-rss-reader";
pub(super) const DEV_CREDENTIALS_RECOVERY_HINT: &str =
    "Dev credential store may be corrupted or inaccessible. Close Ultra RSS Reader, remove the dev credentials store and adjacent temporary/lock files, then restart the application.";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CredentialLookupMode {
    Background,
    Interactive,
}

impl CredentialLookupMode {
    pub(crate) fn for_user_sync() -> Self {
        if cfg!(target_os = "macos") {
            Self::Background
        } else {
            Self::Interactive
        }
    }

    #[cfg(target_os = "macos")]
    pub(crate) fn timeout(self) -> Duration {
        match self {
            Self::Background => Duration::from_secs(5),
            Self::Interactive => Duration::from_secs(60),
        }
    }
}

#[cfg(target_os = "macos")]
static SYNC_CREDENTIAL_LOOKUP_GATE: std::sync::LazyLock<Arc<tokio::sync::Semaphore>> =
    std::sync::LazyLock::new(|| Arc::new(tokio::sync::Semaphore::new(1)));

#[cfg(any(target_os = "macos", test))]
struct PendingLookup(Arc<AtomicBool>);

#[cfg(any(target_os = "macos", test))]
impl Drop for PendingLookup {
    fn drop(&mut self) {
        self.0.store(true, Ordering::SeqCst);
    }
}

pub(crate) async fn read_for_sync<T, F>(
    credential_kind: CredentialKind,
    mode: CredentialLookupMode,
    read: F,
) -> DomainResult<T>
where
    T: Send + 'static,
    F: FnOnce() -> DomainResult<T> + Send + 'static,
{
    #[cfg(target_os = "macos")]
    {
        match run_gated_read(Arc::clone(&SYNC_CREDENTIAL_LOOKUP_GATE), read).await {
            Ok(result) => result,
            Err(failure) => {
                log_sync_read_gate_failed(credential_kind, mode, failure.label());
                Err(failure.into_domain_error())
            }
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        read_with_caller_timeout(credential_kind, mode, CALLER_READ_TIMEOUT, read).await
    }
}

// The caller cutoff does not cancel the blocking read.
#[cfg(any(not(target_os = "macos"), test))]
async fn read_with_caller_timeout<T, F>(
    credential_kind: CredentialKind,
    mode: CredentialLookupMode,
    timeout: Duration,
    read: F,
) -> DomainResult<T>
where
    T: Send + 'static,
    F: FnOnce() -> DomainResult<T> + Send + 'static,
{
    match tokio::time::timeout(timeout, tokio::task::spawn_blocking(read)).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => {
            log_sync_read_gate_failed(credential_kind, mode, "join");
            Err(DomainError::Keychain("Credential lookup failed".into()))
        }
        Err(_) => {
            log_sync_read_gate_failed(credential_kind, mode, "caller-timeout");
            Err(DomainError::Keychain(
                "Timed out reading credentials from the OS credential store. Unlock it or re-enter the credentials, then try again.".into(),
            ))
        }
    }
}

#[cfg(any(target_os = "macos", test))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum GatedReadFailure {
    GateClosed,
    Cancelled,
    Join,
}

#[cfg(any(target_os = "macos", test))]
impl GatedReadFailure {
    fn label(self) -> &'static str {
        match self {
            Self::GateClosed => "gate-closed",
            Self::Cancelled => "cancelled",
            Self::Join => "join",
        }
    }

    fn into_domain_error(self) -> DomainError {
        DomainError::Keychain(
            match self {
                Self::GateClosed => "Credential lookup is unavailable",
                Self::Cancelled => "Credential lookup was cancelled",
                Self::Join => "Credential lookup failed",
            }
            .into(),
        )
    }
}

#[cfg(test)]
async fn read_for_sync_with_gate<T, F>(
    gate: Arc<tokio::sync::Semaphore>,
    read: F,
) -> DomainResult<T>
where
    T: Send + 'static,
    F: FnOnce() -> DomainResult<T> + Send + 'static,
{
    run_gated_read(gate, read)
        .await
        .unwrap_or_else(|failure| Err(failure.into_domain_error()))
}

#[cfg(any(target_os = "macos", test))]
async fn run_gated_read<T, F>(
    gate: Arc<tokio::sync::Semaphore>,
    read: F,
) -> Result<DomainResult<T>, GatedReadFailure>
where
    T: Send + 'static,
    F: FnOnce() -> DomainResult<T> + Send + 'static,
{
    // All callers wait cancellably for earlier reads; each child owns its deadline.
    let permit = gate
        .acquire_owned()
        .await
        .map_err(|_| GatedReadFailure::GateClosed)?;
    let cancelled = Arc::new(AtomicBool::new(false));
    let _pending = PendingLookup(Arc::clone(&cancelled));
    tokio::task::spawn_blocking(move || {
        // Retain serialization until the blocking read has cleaned up its child.
        let _permit = permit;
        if cancelled.load(Ordering::SeqCst) {
            return Err(GatedReadFailure::Cancelled);
        }
        Ok(read())
    })
    .await
    .map_err(|_| GatedReadFailure::Join)?
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

fn missing_password_error() -> DomainError {
    DomainError::Validation(
        "Password is not configured. Re-enter your password in account settings, save it, and try again.".to_string(),
    )
}

fn verify_saved_password_with_reader<F>(
    account_id: &str,
    expected_password: &str,
    read_password: F,
) -> DomainResult<()>
where
    F: Fn(&str) -> DomainResult<String>,
{
    let actual_password = read_password(account_id).map_err(|e| {
        if matches!(e, DomainError::Validation(_)) {
            log_keyring_access_failed(
                CredentialKind::FreshRssPassword,
                KeyringOp::Verify,
                "missing",
            );
        }
        DomainError::Keychain(format!("Failed to verify saved password: {e}"))
    })?;

    if actual_password == expected_password {
        Ok(())
    } else {
        log_keyring_access_failed(
            CredentialKind::FreshRssPassword,
            KeyringOp::Verify,
            "mismatch",
        );
        Err(DomainError::Keychain(
            "Failed to verify saved password: retrieved value did not match the saved credential"
                .to_string(),
        ))
    }
}

fn verify_saved_password(account_id: &str, expected_password: &str) -> DomainResult<()> {
    verify_saved_password_with_reader(account_id, expected_password, get_password)
}

pub fn set_password(account_id: &str, password: &str) -> DomainResult<()> {
    #[cfg(target_os = "macos")]
    session_cache::invalidate(account_id)?;
    if let Some(path) = dev_credentials_path() {
        validate_dev_credential_account_id(account_id)?;
        with_dev_store_lock(&path, || {
            let mut store = read_dev_store(&path)?;
            store.insert(account_id.to_string(), password.to_string());
            write_dev_store(&path, &store)
        })?;
        return verify_saved_password(account_id, password);
    }

    let entry = keyring::Entry::new(SERVICE, account_id).map_err(|e| {
        log_keyring_error(CredentialKind::FreshRssPassword, KeyringOp::Save, &e);
        DomainError::Keychain(format!("Failed to access credential store: {e}"))
    })?;
    set_password_with_entry(account_id, password, &entry, get_password)
}

fn set_password_with_entry<F>(
    account_id: &str,
    password: &str,
    entry: &keyring::Entry,
    read_password: F,
) -> DomainResult<()>
where
    F: Fn(&str) -> DomainResult<String>,
{
    entry.set_password(password).map_err(|e| {
        log_keyring_error(CredentialKind::FreshRssPassword, KeyringOp::Save, &e);
        DomainError::Keychain(format!("Failed to save password: {e}"))
    })?;
    verify_saved_password_with_reader(account_id, password, read_password)
}

pub fn get_password(account_id: &str) -> DomainResult<String> {
    if let Some(path) = dev_credentials_path() {
        validate_dev_credential_account_id(account_id)?;
        let store = read_dev_store(&path)?;
        return store
            .get(account_id)
            .cloned()
            .ok_or_else(missing_password_error);
    }

    let entry = keyring::Entry::new(SERVICE, account_id).map_err(|e| {
        log_keyring_error(CredentialKind::FreshRssPassword, KeyringOp::Load, &e);
        DomainError::Keychain(format!("Failed to access credential store: {e}"))
    })?;
    match entry.get_password() {
        Ok(password) => Ok(password),
        Err(keyring::Error::NoEntry) => Err(missing_password_error()),
        Err(e) => {
            log_keyring_error(CredentialKind::FreshRssPassword, KeyringOp::Load, &e);
            Err(DomainError::Keychain(format!(
                "Failed to retrieve password: {e}"
            )))
        }
    }
}

pub fn get_password_for_sync(account_id: &str) -> DomainResult<String> {
    get_password_for_sync_with_mode(account_id, CredentialLookupMode::Background)
}

pub(crate) fn get_password_for_sync_with_mode(
    account_id: &str,
    mode: CredentialLookupMode,
) -> DomainResult<String> {
    if let Some(path) = dev_credentials_path() {
        validate_dev_credential_account_id(account_id)?;
        let store = read_dev_store(&path)?;
        return store
            .get(account_id)
            .cloned()
            .ok_or_else(missing_password_error);
    }

    #[cfg(target_os = "macos")]
    {
        macos_security_cli::get_password_from_security_cli(account_id, mode)
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = mode;
        get_password(account_id)
    }
}

pub fn delete_password(account_id: &str) -> DomainResult<()> {
    #[cfg(target_os = "macos")]
    session_cache::invalidate(account_id)?;
    if let Some(path) = dev_credentials_path() {
        return with_dev_store_lock(&path, || delete_dev_password_at_path(&path, account_id));
    }

    let entry = keyring::Entry::new(SERVICE, account_id).map_err(|e| {
        log_keyring_error(CredentialKind::FreshRssPassword, KeyringOp::Remove, &e);
        DomainError::Keychain(format!("Failed to access credential store: {e}"))
    })?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already gone, not an error
        Err(e) => {
            log_keyring_error(CredentialKind::FreshRssPassword, KeyringOp::Remove, &e);
            Err(DomainError::Keychain(format!(
                "Failed to delete password: {e}"
            )))
        }
    }
}

pub fn reset_oversized_dev_credentials_store() -> DomainResult<bool> {
    let Some(path) = dev_credentials_path() else {
        return Ok(false);
    };
    let _process_guard = dev_store_lock::DEV_CREDENTIALS_STORE_LOCK
        .lock()
        .map_err(|e| DomainError::Keychain(format!("Failed to lock dev store: {e}")))?;
    if !dev_store_file::dev_store_is_oversized(&path)? {
        return Ok(false);
    }
    let backup_dir = dev_store_file::dev_store_recovery_backup_dir(&path);
    dev_store_file::move_dev_store_recovery_artifacts(&path, &backup_dir)
}
