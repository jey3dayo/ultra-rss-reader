use super::redaction::redacted_dev_store_path;
use super::DEV_CREDENTIALS_RECOVERY_HINT;
use crate::domain::error::{DomainError, DomainResult};
use std::collections::HashMap;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

pub(super) const DEV_CREDENTIALS_MAX_BYTES: u64 = 64 * 1024;
const DEV_CREDENTIALS_ACCOUNT_ID_MAX_BYTES: usize = 128;

pub(super) fn read_dev_store(path: &Path) -> DomainResult<HashMap<String, String>> {
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

pub(super) fn dev_store_is_oversized(path: &Path) -> DomainResult<bool> {
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

pub(super) fn validate_dev_credential_account_id(account_id: &str) -> DomainResult<()> {
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

pub(super) fn write_dev_store(path: &Path, store: &HashMap<String, String>) -> DomainResult<()> {
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
    if let Err(error) = super::dev_store_lock::set_dev_store_owner_only_permissions(&temp_path) {
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

pub(super) fn dev_store_recovery_error(message: impl Into<String>) -> DomainError {
    DomainError::Keychain(format!(
        "{} {DEV_CREDENTIALS_RECOVERY_HINT}",
        message.into()
    ))
}

fn cleanup_failed_dev_store_temp_file(path: &Path) {
    if let Err(error) = std::fs::remove_file(path) {
        tracing::warn!(
            "Failed to clean up dev credentials temp file {}: {error}",
            redacted_dev_store_path(path)
        );
    }
}

pub(super) fn dev_store_temp_path(path: &Path) -> PathBuf {
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

pub(super) fn dev_store_lock_path(path: &Path) -> PathBuf {
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("dev-credentials.json");
    path.with_file_name(format!(".{file_name}.lock"))
}

pub(super) fn dev_store_recovery_backup_dir(path: &Path) -> PathBuf {
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

pub(super) fn move_dev_store_recovery_artifacts(
    path: &Path,
    backup_dir: &Path,
) -> DomainResult<bool> {
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
