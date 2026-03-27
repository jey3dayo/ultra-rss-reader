use crate::domain::error::{DomainError, DomainResult};

const SERVICE: &str = "ultra-rss-reader";

pub fn set_password(account_id: &str, password: &str) -> DomainResult<()> {
    let entry = keyring::Entry::new(SERVICE, account_id)
        .map_err(|e| DomainError::Keychain(format!("Failed to access credential store: {e}")))?;
    entry
        .set_password(password)
        .map_err(|e| DomainError::Keychain(format!("Failed to save password: {e}")))
}

pub fn get_password(account_id: &str) -> DomainResult<String> {
    let entry = keyring::Entry::new(SERVICE, account_id)
        .map_err(|e| DomainError::Keychain(format!("Failed to access credential store: {e}")))?;
    entry
        .get_password()
        .map_err(|e| DomainError::Keychain(format!("Failed to retrieve password: {e}")))
}

pub fn delete_password(account_id: &str) -> DomainResult<()> {
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
