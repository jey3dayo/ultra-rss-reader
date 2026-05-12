use crate::domain::error::{DomainError, DomainResult};
use crate::platform::{PlatformInfo, PlatformKind};
use std::collections::HashMap;
use std::fs::{File, OpenOptions};
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const SERVICE: &str = "ultra-rss-reader";
const DEV_CREDENTIALS_MAX_BYTES: u64 = 64 * 1024;
const DEV_CREDENTIALS_LOCK_TIMEOUT: Duration = Duration::from_secs(10);
const DEV_CREDENTIALS_LOCK_RETRY_DELAY: Duration = Duration::from_millis(25);
const DEV_CREDENTIALS_STALE_LOCK_AFTER: Duration = Duration::from_secs(5 * 60);
const DEV_CREDENTIALS_ACCOUNT_ID_MAX_BYTES: usize = 128;
const DEV_CREDENTIALS_RECOVERY_HINT: &str =
    "Dev credential store may be corrupted or inaccessible. Close Ultra RSS Reader, remove the dev credentials store and adjacent .tmp/.lock files, then restart the application.";
static DEV_CREDENTIALS_STORE_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

// ---------------------------------------------------------------------------
// Dev file-based credential store (bypasses OS Keychain)
// ---------------------------------------------------------------------------

fn dev_credentials_path() -> Option<PathBuf> {
    let info = PlatformInfo::current();
    dev_credentials_path_for_platform(&info, |key| std::env::var(key).ok())
}

fn dev_credentials_path_for_platform<F>(info: &PlatformInfo, get_env: F) -> Option<PathBuf>
where
    F: Fn(&str) -> Option<String>,
{
    dev_credentials_path_for_platform_with_fs(info, get_env, Path::exists)
}

fn dev_credentials_path_for_platform_with_fs<F, E>(
    info: &PlatformInfo,
    get_env: F,
    file_exists: E,
) -> Option<PathBuf>
where
    F: Fn(&str) -> Option<String>,
    E: Fn(&Path) -> bool,
{
    if !info.capabilities.uses_dev_file_credentials {
        return None;
    }

    let preferred_dir = dev_credentials_dir_for_kind_from_env(info.kind, |key| get_env(key))?;
    let preferred_path = match info.kind {
        PlatformKind::Windows => join_platform_path(
            info.kind,
            preferred_dir.to_string_lossy().as_ref(),
            &["dev-credentials.json"],
        ),
        PlatformKind::Macos | PlatformKind::Linux | PlatformKind::Unknown => {
            preferred_dir.join("dev-credentials.json")
        }
    };
    if info.kind == PlatformKind::Windows {
        return Some(preferred_path);
    }

    let legacy_path = legacy_dev_credentials_path_from_env(|key| get_env(key));
    if let Some(legacy_path) = legacy_path {
        if legacy_path != preferred_path
            && file_exists(legacy_path.as_path())
            && !file_exists(preferred_path.as_path())
        {
            return Some(legacy_path);
        }
    }

    Some(preferred_path)
}

fn dev_credentials_dir_for_kind_from_env<F>(kind: PlatformKind, get_env: F) -> Option<PathBuf>
where
    F: Fn(&str) -> Option<String>,
{
    match kind {
        PlatformKind::Windows => {
            if let Some(local_app_data) = get_env("LOCALAPPDATA") {
                return Some(join_platform_path(
                    kind,
                    &local_app_data,
                    &["ultra-rss-reader"],
                ));
            }

            if let Some(user_profile) = get_env("USERPROFILE") {
                return Some(join_platform_path(
                    kind,
                    &user_profile,
                    &["AppData", "Local", "ultra-rss-reader"],
                ));
            }

            let home_drive = get_env("HOMEDRIVE");
            let home_path = get_env("HOMEPATH");
            if let (Some(home_drive), Some(home_path)) = (home_drive, home_path) {
                return Some(join_platform_path(
                    kind,
                    &format!("{home_drive}{home_path}"),
                    &["AppData", "Local", "ultra-rss-reader"],
                ));
            }
        }
        PlatformKind::Macos | PlatformKind::Linux | PlatformKind::Unknown => {
            if let Some(data_home) = get_env("XDG_DATA_HOME") {
                return Some(PathBuf::from(data_home).join("ultra-rss-reader"));
            }
        }
    }

    let home = get_env("HOME")?;
    Some(
        PathBuf::from(home)
            .join(".local")
            .join("share")
            .join("ultra-rss-reader"),
    )
}

fn join_platform_path(kind: PlatformKind, base: &str, segments: &[&str]) -> PathBuf {
    match kind {
        PlatformKind::Windows => {
            let mut path = base.trim_end_matches(['\\', '/']).to_string();
            for segment in segments {
                if !path.is_empty() && !path.ends_with(['\\', '/']) {
                    path.push('\\');
                }
                path.push_str(segment.trim_matches(['\\', '/']));
            }
            PathBuf::from(path)
        }
        PlatformKind::Macos | PlatformKind::Linux | PlatformKind::Unknown => {
            let mut path = PathBuf::from(base);
            for segment in segments {
                path.push(segment);
            }
            path
        }
    }
}

fn legacy_dev_credentials_path_from_env<F>(get_env: F) -> Option<PathBuf>
where
    F: Fn(&str) -> Option<String>,
{
    let home = get_env("HOME")?;
    Some(
        PathBuf::from(home)
            .join(".local")
            .join("share")
            .join("ultra-rss-reader")
            .join("dev-credentials.json"),
    )
}

fn read_dev_store(path: &Path) -> DomainResult<HashMap<String, String>> {
    match std::fs::metadata(path) {
        Ok(metadata) if metadata.len() > DEV_CREDENTIALS_MAX_BYTES => {
            return Err(dev_store_recovery_error(format!(
                "Dev store exceeds maximum size of {DEV_CREDENTIALS_MAX_BYTES} bytes"
            )));
        }
        Ok(_) => {}
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(HashMap::new()),
        Err(error) => {
            return Err(dev_store_recovery_error(format!(
                "Failed to read dev store metadata: {error}"
            )));
        }
    }

    match std::fs::read_to_string(path) {
        Ok(content) => parse_dev_store_json(&content),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(HashMap::new()),
        Err(error) => Err(dev_store_recovery_error(format!(
            "Failed to read dev store: {error}"
        ))),
    }
}

fn dev_store_is_oversized(path: &Path) -> DomainResult<bool> {
    match std::fs::metadata(path) {
        Ok(metadata) => Ok(metadata.len() > DEV_CREDENTIALS_MAX_BYTES),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(false),
        Err(error) => Err(dev_store_recovery_error(format!(
            "Failed to read dev store metadata: {error}"
        ))),
    }
}

fn parse_dev_store_json(content: &str) -> DomainResult<HashMap<String, String>> {
    let value: serde_json::Value = serde_json::from_str(content)
        .map_err(|e| dev_store_recovery_error(format!("Failed to parse dev store: {e}")))?;
    let object = value.as_object().ok_or_else(|| {
        dev_store_recovery_error("Failed to parse dev store: expected JSON object")
    })?;
    let mut store = HashMap::with_capacity(object.len());
    for (key, value) in object {
        validate_dev_credential_account_id(key)?;
        let password = value.as_str().ok_or_else(|| {
            dev_store_recovery_error(format!(
                "Failed to parse dev store: value for key '{key}' must be a string"
            ))
        })?;
        store.insert(key.clone(), password.to_string());
    }
    Ok(store)
}

fn validate_dev_credential_account_id(account_id: &str) -> DomainResult<()> {
    if account_id.is_empty() {
        return Err(dev_store_recovery_error(
            "Failed to validate dev store account id: account id cannot be empty",
        ));
    }
    if account_id.len() > DEV_CREDENTIALS_ACCOUNT_ID_MAX_BYTES {
        return Err(dev_store_recovery_error(format!(
            "Failed to validate dev store account id: account id must be {DEV_CREDENTIALS_ACCOUNT_ID_MAX_BYTES} bytes or less"
        )));
    }
    if account_id.chars().any(char::is_control) {
        return Err(dev_store_recovery_error(
            "Failed to validate dev store account id: account id cannot contain control characters",
        ));
    }
    Ok(())
}

fn write_dev_store(path: &Path, store: &HashMap<String, String>) -> DomainResult<()> {
    for account_id in store.keys() {
        validate_dev_credential_account_id(account_id)?;
    }
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| DomainError::Keychain(format!("Failed to create dev store dir: {e}")))?;
    }
    let json = serde_json::to_string_pretty(store)
        .map_err(|e| DomainError::Keychain(format!("Failed to serialize dev store: {e}")))?;
    if json.len() as u64 > DEV_CREDENTIALS_MAX_BYTES {
        return Err(dev_store_recovery_error(format!(
            "Dev store exceeds maximum size of {DEV_CREDENTIALS_MAX_BYTES} bytes"
        )));
    }
    let temp_path = dev_store_temp_path(path);
    std::fs::write(&temp_path, &json)
        .map_err(|e| dev_store_recovery_error(format!("Failed to write dev store: {e}")))?;
    #[cfg(unix)]
    if let Err(error) = set_dev_store_owner_only_permissions(&temp_path) {
        cleanup_failed_dev_store_temp_file(&temp_path);
        return Err(error);
    }
    if let Err(error) = std::fs::rename(&temp_path, path) {
        cleanup_failed_dev_store_temp_file(&temp_path);
        return Err(dev_store_recovery_error(format!(
            "Failed to replace dev store: {error}"
        )));
    }
    Ok(())
}

fn dev_store_recovery_error(message: impl Into<String>) -> DomainError {
    DomainError::Keychain(format!(
        "{} {DEV_CREDENTIALS_RECOVERY_HINT}",
        message.into()
    ))
}

fn cleanup_failed_dev_store_temp_file(path: &Path) {
    if let Err(error) = std::fs::remove_file(path) {
        tracing::warn!(
            "Failed to clean up dev credentials temp file {}: {error}",
            path.display()
        );
    }
}

fn dev_store_temp_path(path: &Path) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("dev-credentials.json");
    let thread_id = format!("{:?}", std::thread::current().id())
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .collect::<String>();
    path.with_file_name(format!(
        ".{file_name}.{}.{}.tmp",
        std::process::id(),
        thread_id
    ))
}

fn dev_store_lock_path(path: &Path) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("dev-credentials.json");
    path.with_file_name(format!(".{file_name}.lock"))
}

fn dev_store_recovery_backup_dir(path: &Path) -> PathBuf {
    let created_unix_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    path.with_file_name(format!("dev-credentials-recovery-{created_unix_ms}"))
}

fn is_dev_store_recovery_artifact(file_name: &str, store_file_name: &str) -> bool {
    file_name == store_file_name
        || file_name == format!(".{store_file_name}.lock")
        || (file_name.starts_with(&format!(".{store_file_name}.")) && file_name.ends_with(".tmp"))
}

fn move_dev_store_recovery_artifacts(path: &Path, backup_dir: &Path) -> DomainResult<bool> {
    let parent = path.parent().ok_or_else(|| {
        dev_store_recovery_error("Failed to reset dev store: store path has no parent directory")
    })?;
    let store_file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("dev-credentials.json");
    let entries = match std::fs::read_dir(parent) {
        Ok(entries) => entries,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(false),
        Err(error) => {
            return Err(dev_store_recovery_error(format!(
                "Failed to list dev store recovery artifacts: {error}"
            )));
        }
    };

    let mut moved_any = false;
    for entry in entries {
        let entry = entry.map_err(|error| {
            dev_store_recovery_error(format!(
                "Failed to inspect dev store recovery artifact: {error}"
            ))
        })?;
        let file_name = entry.file_name();
        let file_name = file_name.to_string_lossy();
        if !is_dev_store_recovery_artifact(&file_name, store_file_name) {
            continue;
        }
        if !moved_any {
            std::fs::create_dir_all(backup_dir).map_err(|error| {
                dev_store_recovery_error(format!(
                    "Failed to create dev store recovery backup: {error}"
                ))
            })?;
        }
        std::fs::rename(entry.path(), backup_dir.join(file_name.as_ref())).map_err(|error| {
            dev_store_recovery_error(format!(
                "Failed to move dev store recovery artifact: {error}"
            ))
        })?;
        moved_any = true;
    }

    Ok(moved_any)
}

#[derive(Debug)]
struct DevStoreFileLock {
    path: PathBuf,
    _file: File,
}

impl DevStoreFileLock {
    fn acquire(store_path: &Path) -> DomainResult<Self> {
        Self::acquire_with_timeout_and_stale_after(
            store_path,
            DEV_CREDENTIALS_LOCK_TIMEOUT,
            DEV_CREDENTIALS_LOCK_RETRY_DELAY,
            DEV_CREDENTIALS_STALE_LOCK_AFTER,
        )
    }

    #[cfg(test)]
    fn acquire_with_timeout(
        store_path: &Path,
        timeout: Duration,
        retry_delay: Duration,
    ) -> DomainResult<Self> {
        Self::acquire_with_timeout_and_stale_after(
            store_path,
            timeout,
            retry_delay,
            DEV_CREDENTIALS_STALE_LOCK_AFTER,
        )
    }

    fn acquire_with_timeout_and_stale_after(
        store_path: &Path,
        timeout: Duration,
        retry_delay: Duration,
        stale_after: Duration,
    ) -> DomainResult<Self> {
        let lock_path = dev_store_lock_path(store_path);
        if let Some(parent) = lock_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| {
                dev_store_recovery_error(format!("Failed to create dev store lock dir: {e}"))
            })?;
        }

        let deadline = Instant::now() + timeout;
        loop {
            match OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&lock_path)
            {
                Ok(mut file) => {
                    let owner = dev_store_lock_owner_diagnostics();
                    file.write_all(owner.as_bytes()).map_err(|error| {
                        dev_store_recovery_error(format!(
                            "Failed to write dev store lock diagnostics: {error}"
                        ))
                    })?;
                    return Ok(Self {
                        path: lock_path,
                        _file: file,
                    });
                }
                Err(error) if error.kind() == ErrorKind::AlreadyExists => {
                    if dev_store_lock_is_stale(&lock_path, stale_after)? {
                        tracing::warn!(
                            "Recovering stale dev credentials store lock {} owner={}",
                            redacted_dev_store_path(&lock_path),
                            read_redacted_dev_store_lock_owner(&lock_path)
                        );
                        match std::fs::remove_file(&lock_path) {
                            Ok(()) => continue,
                            Err(error) if error.kind() == ErrorKind::NotFound => continue,
                            Err(error) => {
                                return Err(dev_store_recovery_error(format!(
                                    "Failed to recover stale dev store lock {}: {error}",
                                    redacted_dev_store_path(&lock_path)
                                )));
                            }
                        }
                    }
                    if Instant::now() >= deadline {
                        return Err(dev_store_recovery_error(format!(
                            "Timed out waiting for dev store lock {} owner={}",
                            redacted_dev_store_path(&lock_path),
                            read_redacted_dev_store_lock_owner(&lock_path)
                        )));
                    }
                    std::thread::sleep(retry_delay);
                }
                Err(error) => {
                    return Err(dev_store_recovery_error(format!(
                        "Failed to acquire dev store lock: {error}"
                    )));
                }
            }
        }
    }
}

fn dev_store_lock_owner_diagnostics() -> String {
    let created_unix_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    format!(
        "pid={}\ncreated_unix_ms={created_unix_ms}\n",
        std::process::id()
    )
}

fn read_redacted_dev_store_lock_owner(path: &Path) -> String {
    match std::fs::read_to_string(path) {
        Ok(content) => redact_diagnostic_text(&content),
        Err(error) if error.kind() == ErrorKind::NotFound => "<missing>".to_string(),
        Err(error) => redact_diagnostic_text(&format!("unreadable:{error}")),
    }
}

fn dev_store_lock_is_stale(path: &Path, stale_after: Duration) -> DomainResult<bool> {
    let metadata = std::fs::metadata(path).map_err(|error| {
        dev_store_recovery_error(format!(
            "Failed to read dev store lock metadata {}: {error}",
            redacted_dev_store_path(path)
        ))
    })?;
    let modified = metadata.modified().map_err(|error| {
        dev_store_recovery_error(format!(
            "Failed to read dev store lock age {}: {error}",
            redacted_dev_store_path(path)
        ))
    })?;
    match modified.elapsed() {
        Ok(age) => Ok(age >= stale_after),
        Err(_) => Ok(false),
    }
}

impl Drop for DevStoreFileLock {
    fn drop(&mut self) {
        if let Err(error) = std::fs::remove_file(&self.path) {
            tracing::warn!(
                "Failed to release dev credentials store lock {}: {error}",
                self.path.display()
            );
        }
    }
}

#[cfg(unix)]
fn set_dev_store_owner_only_permissions(path: &Path) -> DomainResult<()> {
    set_dev_store_owner_only_permissions_with(path, |path, perms| {
        std::fs::set_permissions(path, perms)
    })
}

#[cfg(unix)]
fn set_dev_store_owner_only_permissions_with<F>(path: &Path, set_permissions: F) -> DomainResult<()>
where
    F: FnOnce(&Path, std::fs::Permissions) -> std::io::Result<()>,
{
    use std::os::unix::fs::PermissionsExt;

    let perms = std::fs::Permissions::from_mode(0o600);
    set_permissions(path, perms).map_err(|e| {
        dev_store_recovery_error(format!("Failed to restrict dev store permissions: {e}"))
    })
}

fn with_dev_store_lock<T, F>(path: &Path, operation: F) -> DomainResult<T>
where
    F: FnOnce() -> DomainResult<T>,
{
    let _process_guard = DEV_CREDENTIALS_STORE_LOCK
        .lock()
        .map_err(|e| DomainError::Keychain(format!("Failed to lock dev store: {e}")))?;
    let _file_guard = DevStoreFileLock::acquire(path)?;
    operation()
}

fn delete_dev_password_at_path(path: &Path, account_id: &str) -> DomainResult<()> {
    validate_dev_credential_account_id(account_id)?;
    let mut store = read_dev_store(path)?;
    store.remove(account_id);
    write_dev_store(path, &store)
}

fn redacted_dev_store_path(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("<dev-store-path>")
        .to_string()
}

fn redact_diagnostic_text(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return "<empty>".to_string();
    }
    trimmed
        .chars()
        .map(|c| match c {
            '\n' | '\r' | '\t' => ' ',
            '/' | '\\' => '?',
            c if c.is_ascii_graphic() || c == ' ' => c,
            _ => '?',
        })
        .collect()
}

#[cfg(any(target_os = "macos", test))]
fn redact_stderr_text(value: &str) -> String {
    format!("<redacted stderr bytes={}>", value.len())
}

// ---------------------------------------------------------------------------
// OS Keychain helpers
// ---------------------------------------------------------------------------

#[cfg(any(target_os = "macos", test))]
fn keyring_force_delete_fallback_warning(status: &str, stderr: &str) -> String {
    format!(
        "keyring force-delete fallback failed status={} stderr={}",
        redact_diagnostic_text(status),
        redact_stderr_text(stderr)
    )
}

/// Delete a keychain entry via the `security` CLI, bypassing ACL restrictions
/// that prevent the keyring crate from deleting entries created by a differently-signed binary.
#[cfg(target_os = "macos")]
fn force_delete_keychain_entry(account_id: &str) {
    match std::process::Command::new("security")
        .args(["delete-generic-password", "-s", SERVICE, "-a", account_id])
        .output()
    {
        Ok(output) if output.status.success() => {}
        Ok(output) => tracing::warn!(
            "{}",
            keyring_force_delete_fallback_warning(
                &output.status.to_string(),
                &String::from_utf8_lossy(&output.stderr)
            )
        ),
        Err(error) => tracing::warn!("keyring force-delete fallback failed to run: {error}"),
    }
}

#[cfg(not(target_os = "macos"))]
fn force_delete_keychain_entry(_account_id: &str) {}

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
            force_delete_keychain_entry(account_id);
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
    let _process_guard = DEV_CREDENTIALS_STORE_LOCK
        .lock()
        .map_err(|e| DomainError::Keychain(format!("Failed to lock dev store: {e}")))?;
    if !dev_store_is_oversized(&path)? {
        return Ok(false);
    }
    let backup_dir = dev_store_recovery_backup_dir(&path);
    move_dev_store_recovery_artifacts(&path, &backup_dir)
}

#[cfg(test)]
mod tests {
    use super::{
        dev_credentials_dir_for_kind_from_env, dev_credentials_path_for_platform,
        dev_credentials_path_for_platform_with_fs,
    };
    use crate::domain::error::DomainError;
    use crate::platform::{platform_info_for_kind, PlatformKind};
    use keyring::credential::CredentialPersistence;
    use std::collections::HashMap;
    use std::path::{Path, PathBuf};

    fn env_map(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs
            .iter()
            .map(|(key, value)| ((*key).to_string(), (*value).to_string()))
            .collect()
    }

    #[test]
    fn dev_credentials_dir_prefers_local_app_data_on_windows() {
        let env = env_map(&[
            ("LOCALAPPDATA", r"C:\Users\alice\AppData\Local"),
            ("USERPROFILE", r"C:\Users\alice"),
            ("HOME", r"C:\Users\alice"),
        ]);

        let path = dev_credentials_dir_for_kind_from_env(PlatformKind::Windows, |key| {
            env.get(key).cloned()
        });

        assert_eq!(
            path,
            Some(PathBuf::from(
                r"C:\Users\alice\AppData\Local\ultra-rss-reader"
            ))
        );
    }

    #[test]
    fn dev_credentials_dir_falls_back_to_user_profile_on_windows() {
        let env = env_map(&[
            ("USERPROFILE", r"C:\Users\alice"),
            ("HOME", r"C:\Users\alice"),
        ]);

        let path = dev_credentials_dir_for_kind_from_env(PlatformKind::Windows, |key| {
            env.get(key).cloned()
        });

        assert_eq!(
            path,
            Some(PathBuf::from(
                r"C:\Users\alice\AppData\Local\ultra-rss-reader"
            ))
        );
    }

    #[test]
    fn dev_credentials_dir_falls_back_to_home_drive_and_home_path_on_windows() {
        let env = env_map(&[
            ("HOMEDRIVE", "C:"),
            ("HOMEPATH", r"\Users\alice"),
            ("HOME", r"C:\Users\alice"),
        ]);

        let path = dev_credentials_dir_for_kind_from_env(PlatformKind::Windows, |key| {
            env.get(key).cloned()
        });

        assert_eq!(
            path,
            Some(PathBuf::from(
                r"C:\Users\alice\AppData\Local\ultra-rss-reader"
            ))
        );
    }

    #[test]
    fn dev_credentials_dir_prefers_xdg_data_home_on_linux() {
        let env = env_map(&[
            ("XDG_DATA_HOME", "/tmp/data-home"),
            ("HOME", "/Users/alice"),
        ]);

        let path =
            dev_credentials_dir_for_kind_from_env(PlatformKind::Linux, |key| env.get(key).cloned());

        assert_eq!(path, Some(PathBuf::from("/tmp/data-home/ultra-rss-reader")));
    }

    #[test]
    fn dev_credentials_dir_falls_back_to_home_on_unknown_platform() {
        let env = env_map(&[("HOME", "/Users/alice")]);

        let path = dev_credentials_dir_for_kind_from_env(PlatformKind::Unknown, |key| {
            env.get(key).cloned()
        });

        assert_eq!(
            path,
            Some(PathBuf::from("/Users/alice/.local/share/ultra-rss-reader"))
        );
    }

    #[test]
    fn dev_credentials_path_is_disabled_when_capability_is_off() {
        let info = platform_info_for_kind(PlatformKind::Windows);
        let env = env_map(&[
            ("DEV_CREDENTIALS", "1"),
            ("LOCALAPPDATA", r"C:\Users\alice\AppData\Local"),
        ]);

        let path = dev_credentials_path_for_platform(&info, |key| env.get(key).cloned());

        assert_eq!(path, None);
    }

    #[test]
    fn dev_credentials_path_uses_platform_dir_when_capability_is_on() {
        let mut info = platform_info_for_kind(PlatformKind::Linux);
        info.capabilities.uses_dev_file_credentials = true;
        let env = env_map(&[
            ("DEV_CREDENTIALS", "1"),
            ("XDG_DATA_HOME", "/tmp/data-home"),
            ("HOME", "/Users/alice"),
        ]);

        let path = dev_credentials_path_for_platform(&info, |key| env.get(key).cloned());

        assert_eq!(
            path,
            Some(PathBuf::from(
                "/tmp/data-home/ultra-rss-reader/dev-credentials.json"
            ))
        );
    }

    #[test]
    fn non_windows_uses_legacy_path_when_legacy_exists_and_preferred_is_missing() {
        let mut info = platform_info_for_kind(PlatformKind::Linux);
        info.capabilities.uses_dev_file_credentials = true;
        let env = env_map(&[
            ("DEV_CREDENTIALS", "1"),
            ("XDG_DATA_HOME", "/tmp/new-data-home"),
            ("HOME", "/Users/alice"),
        ]);
        let legacy = Path::new("/Users/alice/.local/share/ultra-rss-reader/dev-credentials.json");

        let path = dev_credentials_path_for_platform_with_fs(
            &info,
            |key| env.get(key).cloned(),
            |candidate| candidate == legacy,
        );

        assert_eq!(path, Some(legacy.to_path_buf()));
    }

    #[test]
    fn non_windows_keeps_preferred_path_when_preferred_exists() {
        let mut info = platform_info_for_kind(PlatformKind::Linux);
        info.capabilities.uses_dev_file_credentials = true;
        let env = env_map(&[
            ("DEV_CREDENTIALS", "1"),
            ("XDG_DATA_HOME", "/tmp/new-data-home"),
            ("HOME", "/Users/alice"),
        ]);
        let preferred = Path::new("/tmp/new-data-home/ultra-rss-reader/dev-credentials.json");
        let legacy = Path::new("/Users/alice/.local/share/ultra-rss-reader/dev-credentials.json");

        let path = dev_credentials_path_for_platform_with_fs(
            &info,
            |key| env.get(key).cloned(),
            |candidate| candidate == preferred || candidate == legacy,
        );

        assert_eq!(path, Some(preferred.to_path_buf()));
    }

    #[test]
    fn windows_keeps_preferred_path_even_if_legacy_file_exists() {
        let mut info = platform_info_for_kind(PlatformKind::Windows);
        info.capabilities.uses_dev_file_credentials = true;
        let env = env_map(&[
            ("DEV_CREDENTIALS", "1"),
            ("LOCALAPPDATA", r"C:\Users\alice\AppData\Local"),
            ("HOME", r"C:\Users\alice"),
        ]);

        let path = dev_credentials_path_for_platform_with_fs(
            &info,
            |key| env.get(key).cloned(),
            |_candidate| true,
        );

        assert_eq!(
            path,
            Some(PathBuf::from(
                r"C:\Users\alice\AppData\Local\ultra-rss-reader\dev-credentials.json"
            ))
        );
    }

    #[test]
    fn missing_password_error_guides_user_to_reenter_credentials() {
        let error = super::missing_password_error();

        assert!(matches!(error, DomainError::Validation(_)));
        assert_eq!(
            error.to_string(),
            "Validation error: Password is not configured. Re-enter your password in account settings, save it, and try again."
        );
    }

    #[test]
    fn verify_saved_password_rejects_missing_readback() {
        let error = super::verify_saved_password_with_reader("acc-1", "secret", |_| {
            Err(super::missing_password_error())
        })
        .expect_err("missing readback should fail verification");

        assert_eq!(
            error.to_string(),
            "Keychain error: Failed to verify saved password: Validation error: Password is not configured. Re-enter your password in account settings, save it, and try again."
        );
    }

    #[test]
    fn verify_saved_password_rejects_mismatched_readback() {
        let error =
            super::verify_saved_password_with_reader("acc-1", "secret", |_| Ok("different".into()))
                .expect_err("mismatched readback should fail verification");

        assert_eq!(
            error.to_string(),
            "Keychain error: Failed to verify saved password: retrieved value did not match the saved credential"
        );
    }

    #[test]
    fn keyring_force_delete_fallback_warning_includes_status_and_stderr() {
        let warning = super::keyring_force_delete_fallback_warning("exit status: 44", " denied\n");

        assert_eq!(
            warning,
            "keyring force-delete fallback failed status=exit status: 44 stderr=<redacted stderr bytes=8>"
        );
    }

    #[test]
    fn keyring_force_delete_fallback_warning_redacts_control_characters() {
        let warning =
            super::keyring_force_delete_fallback_warning("exit status: 44", " denied\u{7}\nsecret");

        assert_eq!(
            warning,
            "keyring force-delete fallback failed status=exit status: 44 stderr=<redacted stderr bytes=15>"
        );
    }

    #[test]
    fn delete_dev_password_at_path_is_idempotent_for_missing_entries() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("dev-credentials.json");
        let mut store = HashMap::new();
        store.insert("existing-account".to_string(), "secret".to_string());
        super::write_dev_store(&path, &store).expect("dev credential fixture should be writable");

        super::delete_dev_password_at_path(&path, "missing-account")
            .expect("missing dev credential cleanup should be a no-op");
        super::delete_dev_password_at_path(&path, "missing-account")
            .expect("repeated missing dev credential cleanup should stay a no-op");

        assert_eq!(super::read_dev_store(&path).unwrap(), store);
    }

    #[test]
    fn write_dev_store_replaces_via_temp_file_without_leaving_staging_copy() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("dev-credentials.json");
        let mut first_store = HashMap::new();
        first_store.insert("account-a".to_string(), "secret-a".to_string());
        let mut second_store = HashMap::new();
        second_store.insert("account-b".to_string(), "secret-b".to_string());

        super::write_dev_store(&path, &first_store)
            .expect("initial dev credential store write should succeed");
        super::write_dev_store(&path, &second_store)
            .expect("replacement dev credential store write should succeed");

        assert_eq!(super::read_dev_store(&path).unwrap(), second_store);
        assert!(
            dir.path().read_dir().unwrap().all(|entry| !entry
                .unwrap()
                .file_name()
                .to_string_lossy()
                .ends_with(".tmp")),
            "successful atomic replacement should not leave the staging file behind"
        );
    }

    #[test]
    fn dev_store_temp_path_stays_next_to_final_store() {
        let path = Path::new("/tmp/ultra-rss-reader/dev-credentials.json");
        let temp_path = super::dev_store_temp_path(path);

        assert_eq!(temp_path.parent(), path.parent());
        assert!(temp_path
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with(".dev-credentials.json."));
        assert!(temp_path
            .file_name()
            .unwrap()
            .to_string_lossy()
            .ends_with(".tmp"));
    }

    #[test]
    fn dev_store_lock_path_stays_next_to_final_store() {
        let path = Path::new("/tmp/ultra-rss-reader/dev-credentials.json");

        assert_eq!(
            super::dev_store_lock_path(path),
            PathBuf::from("/tmp/ultra-rss-reader/.dev-credentials.json.lock")
        );
    }

    #[test]
    fn dev_credentials_store_survives_restart_readback_by_account_id() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("dev-credentials.json");
        let mut first_process_store = HashMap::new();
        first_process_store.insert("account-a".to_string(), "secret-a".to_string());
        first_process_store.insert("account-b".to_string(), "secret-b".to_string());

        super::write_dev_store(&path, &first_process_store)
            .expect("dev credential fixture should be writable");

        let restarted_process_store = super::read_dev_store(&path)
            .expect("dev credential store should be readable after restart");

        assert_eq!(
            restarted_process_store.get("account-a"),
            Some(&"secret-a".to_string())
        );
        assert_eq!(
            restarted_process_store.get("account-b"),
            Some(&"secret-b".to_string())
        );
        assert_eq!(restarted_process_store.get("missing-account"), None);
    }

    #[test]
    fn dev_credentials_store_rejects_invalid_account_id_keys() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("dev-credentials.json");
        std::fs::write(&path, r#"{"": "secret"}"#).unwrap();

        let error =
            super::read_dev_store(&path).expect_err("empty account id key should be rejected");

        assert!(error.to_string().contains(
            "Keychain error: Failed to validate dev store account id: account id cannot be empty"
        ));
        assert!(error
            .to_string()
            .contains(super::DEV_CREDENTIALS_RECOVERY_HINT));

        let mut store = HashMap::new();
        store.insert("account\nid".to_string(), "secret".to_string());
        let error = super::write_dev_store(&path, &store)
            .expect_err("control characters should be rejected before writing");

        assert!(error.to_string().contains(
            "Keychain error: Failed to validate dev store account id: account id cannot contain control characters"
        ));
    }

    #[cfg(unix)]
    #[test]
    fn dev_credentials_permission_failure_is_keychain_error() {
        let path = Path::new("/tmp/dev-credentials.json");

        let error = super::set_dev_store_owner_only_permissions_with(path, |_path, _perms| {
            Err(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                "permission denied",
            ))
        })
        .expect_err("dev credential permission failure must be observable");

        assert!(matches!(error, DomainError::Keychain(_)));
        assert!(error.to_string().contains(
            "Keychain error: Failed to restrict dev store permissions: permission denied"
        ));
        assert!(error
            .to_string()
            .contains(super::DEV_CREDENTIALS_RECOVERY_HINT));
    }

    #[test]
    fn read_dev_store_ignores_stale_temp_file_next_to_valid_store() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("dev-credentials.json");
        let temp_path = super::dev_store_temp_path(&path);
        let mut store = HashMap::new();
        store.insert("account".to_string(), "secret".to_string());
        super::write_dev_store(&path, &store).expect("valid dev credential store should be saved");
        std::fs::write(&temp_path, "{not-json").unwrap();

        assert_eq!(super::read_dev_store(&path).unwrap(), store);
        assert_eq!(std::fs::read_to_string(&temp_path).unwrap(), "{not-json");
    }

    #[test]
    fn read_dev_store_rejects_corrupted_json_without_overwriting_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("dev-credentials.json");
        std::fs::write(&path, "{not-json").unwrap();

        let error =
            super::read_dev_store(&path).expect_err("corrupted dev credentials must fail closed");

        assert!(matches!(error, DomainError::Keychain(_)));
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "{not-json");
    }

    #[test]
    fn read_dev_store_rejects_non_object_json() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("dev-credentials.json");
        std::fs::write(&path, r#"["secret"]"#).unwrap();

        let error =
            super::read_dev_store(&path).expect_err("dev credentials must stay a JSON object");

        assert!(error
            .to_string()
            .contains("Keychain error: Failed to parse dev store: expected JSON object"));
        assert!(error
            .to_string()
            .contains(super::DEV_CREDENTIALS_RECOVERY_HINT));
    }

    #[test]
    fn read_dev_store_rejects_non_string_values() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("dev-credentials.json");
        std::fs::write(&path, r#"{"account":123}"#).unwrap();

        let error =
            super::read_dev_store(&path).expect_err("dev credential values must stay strings");

        assert!(error.to_string().contains(
            "Keychain error: Failed to parse dev store: value for key 'account' must be a string"
        ));
        assert!(error
            .to_string()
            .contains(super::DEV_CREDENTIALS_RECOVERY_HINT));
    }

    #[test]
    fn read_dev_store_rejects_oversized_json() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("dev-credentials.json");
        std::fs::write(
            &path,
            "x".repeat(super::DEV_CREDENTIALS_MAX_BYTES as usize + 1),
        )
        .unwrap();

        let error =
            super::read_dev_store(&path).expect_err("oversized dev credentials must fail closed");

        assert!(error
            .to_string()
            .contains("Keychain error: Dev store exceeds maximum size of 65536 bytes"));
        assert!(error
            .to_string()
            .contains(super::DEV_CREDENTIALS_RECOVERY_HINT));
    }

    #[test]
    fn dev_store_is_oversized_detects_only_files_above_limit() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("dev-credentials.json");

        std::fs::write(&path, "x".repeat(super::DEV_CREDENTIALS_MAX_BYTES as usize)).unwrap();
        assert!(!super::dev_store_is_oversized(&path).unwrap());

        std::fs::write(
            &path,
            "x".repeat(super::DEV_CREDENTIALS_MAX_BYTES as usize + 1),
        )
        .unwrap();
        assert!(super::dev_store_is_oversized(&path).unwrap());
    }

    #[test]
    fn move_dev_store_recovery_artifacts_moves_store_lock_and_tmp_only() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("dev-credentials.json");
        let lock_path = dir.path().join(".dev-credentials.json.lock");
        let temp_path = dir.path().join(".dev-credentials.json.123.thread.tmp");
        let unrelated_path = dir.path().join(".dev-credentials.json.notes");
        let backup_dir = dir.path().join("backup");
        std::fs::write(&path, "store").unwrap();
        std::fs::write(&lock_path, "lock").unwrap();
        std::fs::write(&temp_path, "tmp").unwrap();
        std::fs::write(&unrelated_path, "notes").unwrap();

        let moved =
            super::move_dev_store_recovery_artifacts(&path, &backup_dir).expect("artifacts move");

        assert!(moved);
        assert!(!path.exists());
        assert!(!lock_path.exists());
        assert!(!temp_path.exists());
        assert!(unrelated_path.exists());
        assert_eq!(
            std::fs::read_to_string(backup_dir.join("dev-credentials.json")).unwrap(),
            "store"
        );
        assert_eq!(
            std::fs::read_to_string(backup_dir.join(".dev-credentials.json.lock")).unwrap(),
            "lock"
        );
        assert_eq!(
            std::fs::read_to_string(backup_dir.join(".dev-credentials.json.123.thread.tmp"))
                .unwrap(),
            "tmp"
        );
    }

    #[test]
    fn valid_dev_store_does_not_trigger_oversized_recovery() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("dev-credentials.json");
        let backup_dir = dir.path().join("backup");
        let mut store = HashMap::new();
        store.insert("account".to_string(), "secret".to_string());
        super::write_dev_store(&path, &store).expect("valid store should be writable");

        if super::dev_store_is_oversized(&path).unwrap() {
            super::move_dev_store_recovery_artifacts(&path, &backup_dir).unwrap();
        }

        assert!(path.exists());
        assert!(!backup_dir.exists());
        assert_eq!(super::read_dev_store(&path).unwrap(), store);
    }

    #[test]
    fn write_dev_store_rejects_oversized_json() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("dev-credentials.json");
        let mut store = HashMap::new();
        store.insert(
            "account".to_string(),
            "x".repeat(super::DEV_CREDENTIALS_MAX_BYTES as usize),
        );

        let error = super::write_dev_store(&path, &store)
            .expect_err("oversized dev credentials must not be written");

        assert!(error
            .to_string()
            .contains("Keychain error: Dev store exceeds maximum size of 65536 bytes"));
        assert!(error
            .to_string()
            .contains(super::DEV_CREDENTIALS_RECOVERY_HINT));
        assert!(!path.exists());
    }

    #[test]
    fn dev_store_file_lock_blocks_concurrent_process_writers() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("dev-credentials.json");
        let first_lock = super::DevStoreFileLock::acquire(&path)
            .expect("first process should acquire the dev store lock");

        let error = super::DevStoreFileLock::acquire_with_timeout(
            &path,
            std::time::Duration::from_millis(5),
            std::time::Duration::from_millis(1),
        )
        .expect_err("second process should observe the existing lock");

        assert!(error.to_string().contains(
            "Keychain error: Timed out waiting for dev store lock .dev-credentials.json.lock owner=pid="
        ));
        assert!(
            !error
                .to_string()
                .contains(dir.path().to_string_lossy().as_ref()),
            "lock timeout diagnostics should not expose the store directory"
        );
        assert!(error
            .to_string()
            .contains(super::DEV_CREDENTIALS_RECOVERY_HINT));
        drop(first_lock);
        super::DevStoreFileLock::acquire(&path)
            .expect("dev store lock should be reusable after release");
    }

    #[test]
    fn dev_store_file_lock_recovers_stale_lock_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("dev-credentials.json");
        let lock_path = super::dev_store_lock_path(&path);
        std::fs::write(&lock_path, "pid=/Users/alice/secret\ncreated_unix_ms=1\n").unwrap();

        let lock = super::DevStoreFileLock::acquire_with_timeout_and_stale_after(
            &path,
            std::time::Duration::from_millis(5),
            std::time::Duration::from_millis(1),
            std::time::Duration::ZERO,
        )
        .expect("stale dev store lock should be recovered");

        assert!(lock_path.exists());
        let owner = std::fs::read_to_string(&lock_path).unwrap();
        assert!(owner.contains("pid="));
        assert!(!owner.contains("/Users/alice/secret"));
        drop(lock);
        assert!(!lock_path.exists());
    }

    #[test]
    fn delete_dev_password_at_path_rejects_corrupted_json_without_overwriting_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("dev-credentials.json");
        std::fs::write(&path, "{not-json").unwrap();

        let error = super::delete_dev_password_at_path(&path, "account")
            .expect_err("corrupted dev credentials should block writes");

        assert!(matches!(error, DomainError::Keychain(_)));
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "{not-json");
    }

    #[test]
    fn desktop_builds_use_persistent_keyring_backends() {
        let persistence = keyring::default::default_credential_builder().persistence();

        assert!(
            matches!(persistence, CredentialPersistence::UntilDelete),
            "desktop builds must use a persistent keyring backend; got non-persistent storage"
        );
    }
}
