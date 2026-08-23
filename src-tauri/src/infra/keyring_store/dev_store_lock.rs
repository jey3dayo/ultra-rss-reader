use super::dev_store_file::{
    dev_store_recovery_error, read_dev_store, validate_dev_credential_account_id, write_dev_store,
};
use super::redaction::{redact_diagnostic_text, redacted_dev_store_path};
use crate::domain::error::{DomainError, DomainResult};
use std::fs::{File, OpenOptions};
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const DEV_CREDENTIALS_LOCK_TIMEOUT: Duration = Duration::from_secs(10);
const DEV_CREDENTIALS_LOCK_RETRY_DELAY: Duration = Duration::from_millis(25);
const DEV_CREDENTIALS_STALE_LOCK_AFTER: Duration = Duration::from_secs(5 * 60);

pub(super) static DEV_CREDENTIALS_STORE_LOCK: LazyLock<Mutex<()>> =
    LazyLock::new(|| Mutex::new(()));

#[derive(Debug)]
pub(super) struct DevStoreFileLock {
    path: PathBuf,
    _file: File,
}

impl DevStoreFileLock {
    pub(super) fn acquire(store_path: &Path) -> DomainResult<Self> {
        Self::acquire_with_timeout_and_stale_after(
            store_path,
            DEV_CREDENTIALS_LOCK_TIMEOUT,
            DEV_CREDENTIALS_LOCK_RETRY_DELAY,
            DEV_CREDENTIALS_STALE_LOCK_AFTER,
        )
    }

    #[cfg(test)]
    pub(super) fn acquire_with_timeout(
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

    pub(super) fn acquire_with_timeout_and_stale_after(
        store_path: &Path,
        timeout: Duration,
        retry_delay: Duration,
        stale_after: Duration,
    ) -> DomainResult<Self> {
        let lock_path = super::dev_store_file::dev_store_lock_path(store_path);
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
pub(super) fn set_dev_store_owner_only_permissions(path: &Path) -> DomainResult<()> {
    set_dev_store_owner_only_permissions_with(path, |path, perms| {
        std::fs::set_permissions(path, perms)
    })
}

#[cfg(unix)]
pub(super) fn set_dev_store_owner_only_permissions_with<F>(
    path: &Path,
    set_permissions: F,
) -> DomainResult<()>
where
    F: FnOnce(&Path, std::fs::Permissions) -> std::io::Result<()>,
{
    use std::os::unix::fs::PermissionsExt;

    let perms = std::fs::Permissions::from_mode(0o600);
    set_permissions(path, perms).map_err(|e| {
        dev_store_recovery_error(format!("Failed to restrict dev store permissions: {e}"))
    })
}

pub(super) fn with_dev_store_lock<T, F>(path: &Path, operation: F) -> DomainResult<T>
where
    F: FnOnce() -> DomainResult<T>,
{
    let _process_guard = DEV_CREDENTIALS_STORE_LOCK
        .lock()
        .map_err(|e| DomainError::Keychain(format!("Failed to lock dev store: {e}")))?;
    let _file_guard = DevStoreFileLock::acquire(path)?;
    operation()
}

pub(super) fn delete_dev_password_at_path(path: &Path, account_id: &str) -> DomainResult<()> {
    validate_dev_credential_account_id(account_id)?;
    let mut store = read_dev_store(path)?;
    store.remove(account_id);
    write_dev_store(path, &store)
}
