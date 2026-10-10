use std::fmt;

use reqwest::header::{HeaderMap, HeaderValue};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::url_policy::validate_user_provided_server_url;

use super::diagnostics::{
    log_credential_malformed, log_keyring_access_failed, log_keyring_error, CredentialKind,
    KeyringOp,
};

pub(super) const SERVICE: &str = "ultra-rss-reader-cloudflare-access";
pub(crate) const CLIENT_ID_HEADER: &str = "cf-access-client-id";
pub(crate) const CLIENT_SECRET_HEADER: &str = "cf-access-client-secret";

/// Stored only as one OS keyring entry, independently of the FreshRSS password.
#[derive(Clone, PartialEq, Eq)]
pub(crate) struct CloudflareAccess {
    client_id: String,
    client_secret: String,
    https_origin: String,
}

impl fmt::Debug for CloudflareAccess {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("CloudflareAccess([redacted])")
    }
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct StoredBundle {
    client_id: String,
    client_secret: String,
    https_origin: String,
}

#[derive(Debug, Clone, Copy, Error, PartialEq, Eq)]
pub(crate) enum AccessStoreError {
    #[error("Cloudflare Access OS keyring is unavailable. Allow keyring access and try again.")]
    Unavailable,
    #[error("Cloudflare Access OS keyring entry is malformed. Replace or remove the entry before reconnecting.")]
    Malformed,
    #[error("Cloudflare Access OS keyring write could not be verified. Try saving the credentials again.")]
    Verification,
}

impl From<AccessStoreError> for DomainError {
    fn from(error: AccessStoreError) -> Self {
        Self::Keychain(error.to_string())
    }
}

#[derive(Clone, PartialEq, Eq)]
pub(crate) enum AccessSnapshot {
    Missing,
    Configured(CloudflareAccess),
    Malformed(String),
}

impl fmt::Debug for AccessSnapshot {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Missing => "AccessSnapshot::Missing",
            Self::Configured(_) => "AccessSnapshot::Configured([redacted])",
            Self::Malformed(_) => "AccessSnapshot::Malformed([redacted])",
        })
    }
}

impl AccessSnapshot {
    pub(crate) fn configured(&self) -> Result<Option<&CloudflareAccess>, AccessStoreError> {
        match self {
            Self::Missing => Ok(None),
            Self::Configured(access) => Ok(Some(access)),
            Self::Malformed(_) => Err(AccessStoreError::Malformed),
        }
    }
}

pub(crate) trait CloudflareAccessStore {
    fn load(&self, account_id: &str) -> Result<Option<CloudflareAccess>, AccessStoreError>;
    fn save(&self, account_id: &str, access: &CloudflareAccess) -> Result<(), AccessStoreError>;
    fn remove(&self, account_id: &str) -> Result<(), AccessStoreError>;
    fn snapshot(&self, account_id: &str) -> Result<AccessSnapshot, AccessStoreError> {
        Ok(match self.load(account_id)? {
            Some(access) => AccessSnapshot::Configured(access),
            None => AccessSnapshot::Missing,
        })
    }
    fn restore(&self, account_id: &str, snapshot: &AccessSnapshot) -> Result<(), AccessStoreError> {
        match snapshot {
            AccessSnapshot::Missing => self.remove(account_id),
            AccessSnapshot::Configured(access) => self.save(account_id, access),
            AccessSnapshot::Malformed(_) => Err(AccessStoreError::Malformed),
        }
    }
}

pub(crate) struct OsCloudflareAccessStore;

impl OsCloudflareAccessStore {
    fn raw(&self, account_id: &str) -> Result<Option<String>, AccessStoreError> {
        match Self::entry(account_id, KeyringOp::Load)?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(unavailable(KeyringOp::Load, &error)),
        }
    }

    fn entry(account_id: &str, op: KeyringOp) -> Result<keyring::Entry, AccessStoreError> {
        keyring::Entry::new(SERVICE, account_id).map_err(|error| unavailable(op, &error))
    }
}

impl CloudflareAccessStore for OsCloudflareAccessStore {
    fn load(&self, account_id: &str) -> Result<Option<CloudflareAccess>, AccessStoreError> {
        self.raw(account_id)?
            .map(|value| decode_bundle(&value))
            .transpose()
    }

    fn save(&self, account_id: &str, access: &CloudflareAccess) -> Result<(), AccessStoreError> {
        let value = serde_json::to_string(&StoredBundle {
            client_id: access.client_id.clone(),
            client_secret: access.client_secret.clone(),
            https_origin: access.https_origin.clone(),
        })
        .map_err(|_| AccessStoreError::Malformed)?;
        Self::entry(account_id, KeyringOp::Save)?
            .set_password(&value)
            .map_err(|error| unavailable(KeyringOp::Save, &error))?;
        verify_saved_access(self, account_id, Some(access))
    }

    fn remove(&self, account_id: &str) -> Result<(), AccessStoreError> {
        match Self::entry(account_id, KeyringOp::Remove)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(error) => return Err(unavailable(KeyringOp::Remove, &error)),
        }
        verify_saved_access(self, account_id, None)
    }
    fn snapshot(&self, account_id: &str) -> Result<AccessSnapshot, AccessStoreError> {
        Ok(match self.raw(account_id)? {
            None => AccessSnapshot::Missing,
            Some(raw) => match decode_bundle(&raw) {
                Ok(access) => AccessSnapshot::Configured(access),
                Err(_) => AccessSnapshot::Malformed(raw),
            },
        })
    }

    fn restore(&self, account_id: &str, snapshot: &AccessSnapshot) -> Result<(), AccessStoreError> {
        match snapshot {
            AccessSnapshot::Missing => self.remove(account_id),
            AccessSnapshot::Configured(access) => self.save(account_id, access),
            AccessSnapshot::Malformed(raw) => {
                Self::entry(account_id, KeyringOp::Restore)?
                    .set_password(raw)
                    .map_err(|error| unavailable(KeyringOp::Restore, &error))?;
                if self.raw(account_id)?.as_ref() == Some(raw) {
                    Ok(())
                } else {
                    log_verification_mismatch();
                    Err(AccessStoreError::Verification)
                }
            }
        }
    }
}

pub(crate) fn load_for_sync(
    account_id: &str,
) -> Result<Option<CloudflareAccess>, AccessStoreError> {
    load_for_sync_with_mode(account_id, super::CredentialLookupMode::Background)
}

pub(crate) fn load_for_sync_with_mode(
    account_id: &str,
    mode: super::CredentialLookupMode,
) -> Result<Option<CloudflareAccess>, AccessStoreError> {
    #[cfg(test)]
    if let Some(result) = test_support::lookup(account_id) {
        return result;
    }
    #[cfg(target_os = "macos")]
    {
        let raw = super::macos_security_cli::get_credential_from_security_cli(
            CredentialKind::CloudflareAccess,
            SERVICE,
            account_id,
            mode,
        )
        .map_err(|_| AccessStoreError::Unavailable)?;
        raw.map(|raw| decode_bundle(&raw)).transpose()
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = mode;
        OsCloudflareAccessStore.load(account_id)
    }
}

pub(crate) fn verify_saved_access(
    store: &impl CloudflareAccessStore,
    account_id: &str,
    expected: Option<&CloudflareAccess>,
) -> Result<(), AccessStoreError> {
    let actual = store.load(account_id)?;
    if actual.as_ref() == expected {
        Ok(())
    } else {
        log_verification_mismatch();
        Err(AccessStoreError::Verification)
    }
}

fn log_verification_mismatch() {
    log_keyring_access_failed(
        CredentialKind::CloudflareAccess,
        KeyringOp::Verify,
        "mismatch",
    );
}

fn unavailable(op: KeyringOp, error: &keyring::Error) -> AccessStoreError {
    log_keyring_error(CredentialKind::CloudflareAccess, op, error);
    AccessStoreError::Unavailable
}

fn malformed(stage: &str) -> AccessStoreError {
    log_credential_malformed(CredentialKind::CloudflareAccess, stage);
    AccessStoreError::Malformed
}

impl CloudflareAccess {
    pub(crate) fn new(
        client_id: &str,
        client_secret: &str,
        server_url: &str,
    ) -> DomainResult<Self> {
        validate_header(client_id)?;
        validate_header(client_secret)?;
        Ok(Self {
            client_id: client_id.to_string(),
            client_secret: client_secret.to_string(),
            https_origin: https_origin(server_url)?,
        })
    }

    pub(crate) fn client_id(&self) -> &str {
        &self.client_id
    }

    pub(crate) fn ensure_origin(&self, server_url: &str) -> DomainResult<()> {
        if https_origin(server_url)? != self.https_origin {
            return Err(DomainError::Validation(
                "Cloudflare Access origin changed. Replace both Access credentials or turn Access off before connecting.".into(),
            ));
        }
        Ok(())
    }

    pub(crate) fn origin(&self) -> &str {
        &self.https_origin
    }

    pub(crate) fn headers(&self) -> DomainResult<HeaderMap> {
        let mut headers = HeaderMap::new();
        headers.insert(CLIENT_ID_HEADER, validate_header(&self.client_id)?);
        headers.insert(CLIENT_SECRET_HEADER, validate_header(&self.client_secret)?);
        Ok(headers)
    }
}

fn validate_header(value: &str) -> DomainResult<HeaderValue> {
    if value.trim().is_empty() {
        return Err(DomainError::Validation(
            "Cloudflare Access requires a nonblank Client ID and Client Secret.".into(),
        ));
    }
    let mut header = HeaderValue::from_str(value).map_err(|_| {
        DomainError::Validation(
            "Cloudflare Access credentials must be valid HTTP header values.".into(),
        )
    })?;
    header.set_sensitive(true);
    Ok(header)
}

pub(crate) fn https_origin(server_url: &str) -> DomainResult<String> {
    let url = reqwest::Url::parse(server_url.trim()).map_err(|_| {
        DomainError::Validation("Cloudflare Access requires a valid HTTPS server URL.".into())
    })?;
    validate_user_provided_server_url(&url)?;
    if url.scheme() != "https" {
        return Err(DomainError::Validation(
            "Cloudflare Access requires an HTTPS server URL.".into(),
        ));
    }
    Ok(url.origin().ascii_serialization())
}

fn decode_bundle(value: &str) -> Result<CloudflareAccess, AccessStoreError> {
    let stored: StoredBundle = serde_json::from_str(value).map_err(|_| malformed("json"))?;
    let access = CloudflareAccess::new(
        &stored.client_id,
        &stored.client_secret,
        &stored.https_origin,
    )
    .map_err(|_| {
        if validate_header(&stored.client_id).is_err()
            || validate_header(&stored.client_secret).is_err()
        {
            malformed("header")
        } else {
            malformed("origin")
        }
    })?;
    if access.https_origin != stored.https_origin {
        return Err(malformed("origin"));
    }
    Ok(access)
}

#[cfg(test)]
pub(crate) mod test_support {
    use std::collections::HashMap;
    use std::sync::{LazyLock, Mutex};

    use super::{AccessStoreError, CloudflareAccess};

    type SyncAccessResult = Result<Option<CloudflareAccess>, AccessStoreError>;

    static SYNC_ACCESS: LazyLock<Mutex<HashMap<String, SyncAccessResult>>> =
        LazyLock::new(|| Mutex::new(HashMap::new()));

    /// Same-account overrides must be dropped in reverse registration order.
    pub(crate) struct SyncAccessGuard {
        account_id: String,
        previous: Option<SyncAccessResult>,
    }

    impl SyncAccessGuard {
        pub(crate) fn new(account_id: &str, result: SyncAccessResult) -> Self {
            let previous = SYNC_ACCESS
                .lock()
                .expect("sync Access fixtures should lock")
                .insert(account_id.to_string(), result);
            Self {
                account_id: account_id.to_string(),
                previous,
            }
        }
    }

    impl Drop for SyncAccessGuard {
        fn drop(&mut self) {
            let mut overrides = SYNC_ACCESS
                .lock()
                .expect("sync Access fixtures should lock for cleanup");
            match self.previous.take() {
                Some(previous) => {
                    overrides.insert(self.account_id.clone(), previous);
                }
                None => {
                    overrides.remove(&self.account_id);
                }
            }
        }
    }

    pub(super) fn lookup(account_id: &str) -> Option<SyncAccessResult> {
        SYNC_ACCESS
            .lock()
            .expect("sync Access fixtures should lock for lookup")
            .get(account_id)
            .cloned()
    }
}

#[cfg(test)]
mod tests;
