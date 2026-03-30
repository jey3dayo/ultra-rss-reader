use crate::domain::error::{DomainError, DomainResult};
use std::collections::HashMap;
use std::path::PathBuf;

const SERVICE: &str = "ultra-rss-reader";

// ---------------------------------------------------------------------------
// Dev file-based credential store (bypasses OS Keychain)
// ---------------------------------------------------------------------------

fn dev_credentials_path() -> Option<PathBuf> {
    if std::env::var("ULTRA_RSS_DEV_CREDENTIALS").is_err() {
        return None;
    }
    let home = std::env::var("HOME").ok()?;
    let dir = PathBuf::from(home).join(".local/share/ultra-rss-reader");
    Some(dir.join("dev-credentials.json"))
}

fn read_dev_store(path: &PathBuf) -> HashMap<String, String> {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_dev_store(path: &PathBuf, store: &HashMap<String, String>) -> DomainResult<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| DomainError::Keychain(format!("Failed to create dev store dir: {e}")))?;
    }
    let json = serde_json::to_string_pretty(store)
        .map_err(|e| DomainError::Keychain(format!("Failed to serialize dev store: {e}")))?;
    std::fs::write(path, json)
        .map_err(|e| DomainError::Keychain(format!("Failed to write dev store: {e}")))?;
    Ok(())
}

// ---------------------------------------------------------------------------
// OS Keychain helpers
// ---------------------------------------------------------------------------

/// Delete a keychain entry via the `security` CLI, bypassing ACL restrictions
/// that prevent the keyring crate from deleting entries created by a differently-signed binary.
#[cfg(target_os = "macos")]
fn force_delete_keychain_entry(account_id: &str) {
    let _ = std::process::Command::new("security")
        .args(["delete-generic-password", "-s", SERVICE, "-a", account_id])
        .output();
}

#[cfg(not(target_os = "macos"))]
fn force_delete_keychain_entry(_account_id: &str) {}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

pub fn set_password(account_id: &str, password: &str) -> DomainResult<()> {
    if let Some(path) = dev_credentials_path() {
        let mut store = read_dev_store(&path);
        store.insert(account_id.to_string(), password.to_string());
        return write_dev_store(&path, &store);
    }

    let entry = keyring::Entry::new(SERVICE, account_id)
        .map_err(|e| DomainError::Keychain(format!("Failed to access credential store: {e}")))?;
    match entry.set_password(password) {
        Ok(()) => Ok(()),
        Err(_) => {
            // ACL mismatch from re-signed dev builds: force-delete via CLI, then retry
            force_delete_keychain_entry(account_id);
            entry
                .set_password(password)
                .map_err(|e| DomainError::Keychain(format!("Failed to save password: {e}")))
        }
    }
}

pub fn get_password(account_id: &str) -> DomainResult<String> {
    if let Some(path) = dev_credentials_path() {
        let store = read_dev_store(&path);
        return store.get(account_id).cloned().ok_or_else(|| {
            DomainError::Keychain(format!("No dev credential found for {account_id}"))
        });
    }

    let entry = keyring::Entry::new(SERVICE, account_id)
        .map_err(|e| DomainError::Keychain(format!("Failed to access credential store: {e}")))?;
    entry
        .get_password()
        .map_err(|e| DomainError::Keychain(format!("Failed to retrieve password: {e}")))
}

pub fn delete_password(account_id: &str) -> DomainResult<()> {
    if let Some(path) = dev_credentials_path() {
        let mut store = read_dev_store(&path);
        store.remove(account_id);
        return write_dev_store(&path, &store);
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
