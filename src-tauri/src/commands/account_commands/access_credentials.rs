use serde::{Deserialize, Serialize};
use std::fmt;

use crate::commands::dto::AppError;
use crate::domain::account::Account;
use crate::domain::error::DomainError;
use crate::domain::provider::ProviderKind;
use crate::infra::keyring_store::{
    self,
    cloudflare_access::{
        AccessSnapshot, AccessStoreError, CloudflareAccess, CloudflareAccessStore,
        OsCloudflareAccessStore,
    },
};

#[derive(Deserialize)]
#[serde(tag = "action", rename_all = "lowercase", deny_unknown_fields)]
pub enum CloudflareAccessArg {
    Keep {},
    Replace {
        #[serde(rename = "clientId")]
        client_id: String,
        #[serde(rename = "clientSecret")]
        client_secret: String,
    },
    Remove {},
}

impl Default for CloudflareAccessArg {
    fn default() -> Self {
        Self::Keep {}
    }
}

impl fmt::Debug for CloudflareAccessArg {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Self::Keep {} => "CloudflareAccessArg::Keep",
            Self::Replace { .. } => "CloudflareAccessArg::Replace([redacted])",
            Self::Remove {} => "CloudflareAccessArg::Remove",
        })
    }
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum CloudflareAccessMetadata {
    Loaded { client_id: Option<String> },
    AuthorizationRequired,
}

pub(super) trait AccountCredentialStore: CloudflareAccessStore {
    fn password(&self, id: &str) -> Result<Option<String>, AppError>;
    fn set_password(&self, id: &str, password: &str) -> Result<(), AppError>;
    fn delete_password(&self, id: &str) -> Result<(), AppError>;
}

pub(super) struct OsAccountCredentialStore;

impl CloudflareAccessStore for OsAccountCredentialStore {
    fn load(&self, id: &str) -> Result<Option<CloudflareAccess>, AccessStoreError> {
        OsCloudflareAccessStore.load(id)
    }
    fn save(&self, id: &str, access: &CloudflareAccess) -> Result<(), AccessStoreError> {
        OsCloudflareAccessStore.save(id, access)
    }
    fn remove(&self, id: &str) -> Result<(), AccessStoreError> {
        OsCloudflareAccessStore.remove(id)
    }
    fn snapshot(&self, id: &str) -> Result<AccessSnapshot, AccessStoreError> {
        OsCloudflareAccessStore.snapshot(id)
    }
    fn restore(&self, id: &str, snapshot: &AccessSnapshot) -> Result<(), AccessStoreError> {
        OsCloudflareAccessStore.restore(id, snapshot)
    }
}

impl AccountCredentialStore for OsAccountCredentialStore {
    fn password(&self, id: &str) -> Result<Option<String>, AppError> {
        match keyring_store::get_password(id).map_err(AppError::from) {
            Ok(password) => Ok(Some(password)),
            Err(error) if super::credentials::is_missing_password_error(&error) => Ok(None),
            Err(error) => Err(error),
        }
    }
    fn set_password(&self, id: &str, password: &str) -> Result<(), AppError> {
        keyring_store::set_password(id, password).map_err(AppError::from)
    }
    fn delete_password(&self, id: &str) -> Result<(), AppError> {
        keyring_store::delete_password(id).map_err(AppError::from)
    }
}

fn store_error(error: AccessStoreError) -> AppError {
    DomainError::from(error).into()
}

fn account_url(account: &Account) -> Result<&str, AppError> {
    account
        .server_url
        .as_deref()
        .ok_or_else(|| AppError::UserVisible {
            message: "Cloudflare Access requires an HTTPS FreshRSS server URL.".into(),
        })
}

#[cfg(any(target_os = "macos", test))]
fn cached_access_metadata(account: &Account) -> Result<CloudflareAccessMetadata, AppError> {
    match keyring_store::session_cache::get(account) {
        Ok(cached) => Ok(CloudflareAccessMetadata::Loaded {
            client_id: cached
                .access
                .as_ref()
                .map(|access| access.client_id().to_string()),
        }),
        Err(DomainError::Keychain(message)) if message == keyring_store::NEEDS_AUTH => {
            Ok(CloudflareAccessMetadata::AuthorizationRequired)
        }
        Err(error) => Err(error.into()),
    }
}

/// macOS reads only the in-memory lease so that opening settings never prompts for Keychain access.
pub(super) fn settings_access_metadata(
    account: &Account,
    store: &impl CloudflareAccessStore,
) -> Result<CloudflareAccessMetadata, AppError> {
    #[cfg(target_os = "macos")]
    {
        let _ = store;
        cached_access_metadata(account)
    }
    #[cfg(not(target_os = "macos"))]
    access_metadata(account, store)
}

#[cfg(any(not(target_os = "macos"), test))]
pub(super) fn access_metadata(
    account: &Account,
    store: &impl CloudflareAccessStore,
) -> Result<CloudflareAccessMetadata, AppError> {
    if account.kind != ProviderKind::FreshRss {
        return Err(AppError::UserVisible {
            message: "Cloudflare Access is only supported for FreshRSS accounts.".into(),
        });
    }
    let access = store.load(account.id.as_ref()).map_err(store_error)?;
    // Metadata permits settings recovery after a URL import changed the origin.
    Ok(CloudflareAccessMetadata::Loaded {
        client_id: access.map(|access| access.client_id().to_string()),
    })
}

fn planned_access(
    account: &Account,
    action: &CloudflareAccessArg,
    previous: Option<&CloudflareAccess>,
) -> Result<Option<CloudflareAccess>, AppError> {
    match action {
        CloudflareAccessArg::Keep {} => {
            if let Some(access) = previous {
                if account.kind != ProviderKind::FreshRss {
                    return Err(AppError::UserVisible {
                        message: "Remove Cloudflare Access before changing account provider."
                            .into(),
                    });
                }
                access.ensure_origin(account_url(account)?)?;
            }
            Ok(previous.cloned())
        }
        CloudflareAccessArg::Replace {
            client_id,
            client_secret,
        } => {
            if account.kind != ProviderKind::FreshRss {
                return Err(AppError::UserVisible {
                    message: "Cloudflare Access is only supported for FreshRSS accounts.".into(),
                });
            }
            Ok(Some(CloudflareAccess::new(
                client_id,
                client_secret,
                account_url(account)?,
            )?))
        }
        CloudflareAccessArg::Remove {} => Ok(None),
    }
}

fn write_access(
    store: &impl CloudflareAccessStore,
    id: &str,
    access: Option<&CloudflareAccess>,
) -> Result<(), AppError> {
    match access {
        Some(access) => store.save(id, access),
        None => store.remove(id),
    }
    .map_err(store_error)?;
    keyring_store::cloudflare_access::verify_saved_access(store, id, access).map_err(store_error)
}

fn restore_access(
    store: &impl CloudflareAccessStore,
    id: &str,
    snapshot: &AccessSnapshot,
) -> Result<(), AppError> {
    store.restore(id, snapshot).map_err(store_error)?;
    if &store.snapshot(id).map_err(store_error)? == snapshot {
        Ok(())
    } else {
        Err(store_error(AccessStoreError::Verification))
    }
}

fn rollback_error(original: AppError, password_failed: bool, access_failed: bool) -> AppError {
    if !password_failed && !access_failed {
        return original;
    }
    AppError::UserVisible { message: format!(
        "{original} Credential rollback failed (FreshRSS password: {}; Cloudflare Access: {}). Recovery required: re-enter credentials or remove Access in account settings before reconnecting.",
        if password_failed { "failed" } else { "restored" },
        if access_failed { "failed" } else { "restored" },
    ) }
}

/// Covers both failed writes and failed readback after a successful write.
pub(super) fn persist_account_credentials<T>(
    account: &Account,
    password: Option<&str>,
    action: &CloudflareAccessArg,
    creating: bool,
    store: &impl AccountCredentialStore,
    persist_account: impl FnOnce() -> Result<T, AppError>,
) -> Result<T, AppError> {
    let id = account.id.as_ref();
    #[cfg(target_os = "macos")]
    keyring_store::session_cache::invalidate(id)?;
    let validated_replacement = if matches!(action, CloudflareAccessArg::Keep {}) {
        None
    } else {
        planned_access(account, action, None)?
    };
    let previous_access = if creating {
        AccessSnapshot::Missing
    } else {
        store.snapshot(id).map_err(store_error)?
    };
    let previous_configured = if matches!(action, CloudflareAccessArg::Keep {}) {
        previous_access.configured().map_err(store_error)?
    } else {
        None
    };
    let next_access = if matches!(action, CloudflareAccessArg::Keep {}) {
        planned_access(account, action, previous_configured)?
    } else {
        validated_replacement
    };
    let change_access = !matches!(action, CloudflareAccessArg::Keep {});
    let password = password
        .filter(|value| !value.is_empty())
        .filter(|_| account.kind == ProviderKind::FreshRss);
    let previous_password = if password.is_some() && !creating {
        store.password(id)?
    } else {
        None
    };
    let mut password_attempted = false;
    let mut access_attempted = false;
    let result = (|| {
        if let Some(password) = password {
            password_attempted = true;
            store.set_password(id, password)?;
            if store.password(id)?.as_deref() != Some(password) {
                return Err(AppError::from(DomainError::Keychain(
                    "FreshRSS password write could not be verified.".into(),
                )));
            }
        }
        if change_access {
            access_attempted = true;
            write_access(store, id, next_access.as_ref())?;
        }
        persist_account()
    })();
    match result {
        Ok(value) => Ok(value),
        Err(error) => {
            let access_failed =
                access_attempted && restore_access(store, id, &previous_access).is_err();
            let password_failed = password_attempted
                && match previous_password.as_deref() {
                    Some(previous) => store
                        .set_password(id, previous)
                        .and_then(|()| {
                            if store.password(id)?.as_deref() == Some(previous) {
                                Ok(())
                            } else {
                                Err(AppError::from(DomainError::Keychain(
                                    "Password rollback could not be verified.".into(),
                                )))
                            }
                        })
                        .is_err(),
                    None => store
                        .delete_password(id)
                        .and_then(|()| {
                            if store.password(id)?.is_none() {
                                Ok(())
                            } else {
                                Err(AppError::from(DomainError::Keychain(
                                    "Password cleanup could not be verified.".into(),
                                )))
                            }
                        })
                        .is_err(),
                };
            Err(rollback_error(error, password_failed, access_failed))
        }
    }
}

pub(super) fn delete_account_credentials(
    id: &str,
    store: &impl AccountCredentialStore,
    delete_account: impl FnOnce() -> Result<(), AppError>,
) -> Result<(), AppError> {
    #[cfg(target_os = "macos")]
    keyring_store::session_cache::invalidate(id)?;
    let previous = store.snapshot(id).map_err(store_error)?;
    if let Err(error) = write_access(store, id, None) {
        let access_failed = restore_access(store, id, &previous).is_err();
        return Err(rollback_error(error, false, access_failed));
    }
    if let Err(error) = delete_account() {
        let access_failed = restore_access(store, id, &previous).is_err();
        return Err(rollback_error(error, false, access_failed));
    }
    if store.delete_password(id).is_err() {
        tracing::warn!("FreshRSS password cleanup failed after account deletion");
    }
    Ok(())
}

#[cfg(test)]
mod tests;
