use crate::domain::error::{DomainError, DomainResult};
use dev_store_file::{read_dev_store, validate_dev_credential_account_id, write_dev_store};
use dev_store_lock::{delete_dev_password_at_path, with_dev_store_lock};
use dev_store_path::dev_credentials_path;

mod dev_store_file;
mod dev_store_lock;
mod dev_store_path;
mod macos_security_cli;
mod redaction;
#[cfg(test)]
mod tests;

pub(super) const SERVICE: &str = "ultra-rss-reader";
pub(super) const DEV_CREDENTIALS_RECOVERY_HINT: &str =
    "Dev credential store may be corrupted or inaccessible. Close Ultra RSS Reader, remove the dev credentials store and adjacent temporary/lock files, then restart the application.";

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
    let actual_password = read_password(account_id)
        .map_err(|e| DomainError::Keychain(format!("Failed to verify saved password: {e}")))?;

    if actual_password == expected_password {
        Ok(())
    } else {
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
    if let Some(path) = dev_credentials_path() {
        validate_dev_credential_account_id(account_id)?;
        with_dev_store_lock(&path, || {
            let mut store = read_dev_store(&path)?;
            store.insert(account_id.to_string(), password.to_string());
            write_dev_store(&path, &store)
        })?;
        return verify_saved_password(account_id, password);
    }

    let entry = keyring::Entry::new(SERVICE, account_id)
        .map_err(|e| DomainError::Keychain(format!("Failed to access credential store: {e}")))?;
    match entry.set_password(password) {
        Ok(()) => {}
        Err(_) => {
            // ACL mismatch from re-signed dev builds: force-delete via CLI, then retry
            macos_security_cli::force_delete_keychain_entry(account_id);
            entry
                .set_password(password)
                .map_err(|e| DomainError::Keychain(format!("Failed to save password: {e}")))?;
        }
    }

    verify_saved_password(account_id, password)
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

    let entry = keyring::Entry::new(SERVICE, account_id)
        .map_err(|e| DomainError::Keychain(format!("Failed to access credential store: {e}")))?;
    match entry.get_password() {
        Ok(password) => Ok(password),
        Err(keyring::Error::NoEntry) => Err(missing_password_error()),
        Err(e) => Err(DomainError::Keychain(format!(
            "Failed to retrieve password: {e}"
        ))),
    }
}

pub fn get_password_for_sync(account_id: &str) -> DomainResult<String> {
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
        macos_security_cli::get_password_from_security_cli(account_id)
    }

    #[cfg(not(target_os = "macos"))]
    {
        get_password(account_id)
    }
}

pub fn delete_password(account_id: &str) -> DomainResult<()> {
    if let Some(path) = dev_credentials_path() {
        return with_dev_store_lock(&path, || delete_dev_password_at_path(&path, account_id));
    }

    let entry = keyring::Entry::new(SERVICE, account_id)
        .map_err(|e| DomainError::Keychain(format!("Failed to access credential store: {e}")))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already gone, not an error
        Err(e) => Err(DomainError::Keychain(format!(
            "Failed to delete password: {e}"
        ))),
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
