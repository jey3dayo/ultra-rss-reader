use std::sync::{atomic::AtomicBool, Mutex};

use super::access_credentials::{
    delete_account_credentials, AccountCredentialStore, OsAccountCredentialStore,
};
use crate::commands::dto::AppError;
use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::repository::account::AccountRepository;

const MISSING_PASSWORD_ERROR_MARKER: &str = "Password is not configured";

pub(crate) fn is_missing_password_error(error: &AppError) -> bool {
    matches!(error, AppError::UserVisible { message } if message.contains(MISSING_PASSWORD_ERROR_MARKER))
}

pub(crate) fn delete_account_with_sync_boundary(
    db: &Mutex<crate::infra::db::connection::DbManager>,
    syncing: &AtomicBool,
    id: AccountId,
) -> Result<(), AppError> {
    delete_account_with_sync_boundary_with_store(db, syncing, id, &OsAccountCredentialStore)
}

pub(super) fn delete_account_with_sync_boundary_with_store(
    db: &Mutex<crate::infra::db::connection::DbManager>,
    syncing: &AtomicBool,
    id: AccountId,
    store: &impl AccountCredentialStore,
) -> Result<(), AppError> {
    let _guard = crate::commands::start_database_maintenance(syncing)?;
    let db = crate::commands::lock_db(db)?;
    let repo = SqliteAccountRepository::new(db.writer());
    let account = repo.find_by_id(&id)?.ok_or_else(|| AppError::UserVisible {
        message: "Account not found".into(),
    })?;
    if account.kind != ProviderKind::FreshRss {
        repo.delete(&id)?;
        if store.delete_password(id.as_ref()).is_err() {
            tracing::warn!("Password cleanup failed after account deletion");
        }
        return Ok(());
    }
    delete_account_credentials(id.as_ref(), store, || {
        repo.delete(&id).map_err(AppError::from)
    })
}

#[cfg(test)]
mod test_adapters;
#[cfg(test)]
pub(crate) use test_adapters::{
    delete_account_then_password, delete_account_with_sync_boundary_with_keyring,
    save_account_after_optional_password_with_keyring,
    update_account_credentials_after_optional_password_with_keyring,
};
