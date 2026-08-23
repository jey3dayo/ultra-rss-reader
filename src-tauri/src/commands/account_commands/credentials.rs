use std::sync::{atomic::AtomicBool, Mutex};

use tracing::warn;

use crate::commands::dto::AppError;
use crate::domain::account::Account;
use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::keyring_store;
use crate::repository::account::AccountRepository;

const MISSING_PASSWORD_ERROR_MARKER: &str = "Password is not configured";

pub(crate) fn save_account_after_optional_password<S>(
    account: &Account,
    password: Option<&str>,
    save_account: S,
) -> Result<(), AppError>
where
    S: FnOnce(&Account) -> Result<(), AppError>,
{
    save_account_after_optional_password_with_keyring(
        account,
        password,
        |account_id, password| {
            keyring_store::set_password(account_id, password).map_err(AppError::from)
        },
        save_account,
        |account_id| keyring_store::delete_password(account_id).map_err(AppError::from),
    )
}

pub(crate) fn save_account_after_optional_password_with_keyring<F, S, D>(
    account: &Account,
    password: Option<&str>,
    set_password: F,
    save_account: S,
    delete_password: D,
) -> Result<(), AppError>
where
    F: FnOnce(&str, &str) -> Result<(), AppError>,
    S: FnOnce(&Account) -> Result<(), AppError>,
    D: FnOnce(&str) -> Result<(), AppError>,
{
    let credential_account_id = if matches!(account.kind, ProviderKind::FreshRss) {
        if let Some(pw) = password {
            set_password(account.id.as_ref(), pw)?;
            Some(account.id.as_ref().to_string())
        } else {
            None
        }
    } else {
        None
    };

    match save_account(account) {
        Ok(()) => Ok(()),
        Err(error) => {
            if let Some(account_id) = credential_account_id {
                if let Err(rollback_error) = delete_password(&account_id) {
                    warn!(
                        "Failed to roll back keyring entry for account {} after DB save failure: {:?}",
                        account_id, rollback_error
                    );
                }
            }
            Err(error)
        }
    }
}

pub(crate) fn is_missing_password_error(error: &AppError) -> bool {
    matches!(error, AppError::UserVisible { message } if message.contains(MISSING_PASSWORD_ERROR_MARKER))
}

pub(crate) fn update_account_credentials_after_optional_password_with_keyring<F, U, G, S, D>(
    id: &AccountId,
    password: Option<&str>,
    mut find_account: F,
    update_credentials: U,
    get_password: G,
    mut set_password: S,
    mut delete_password: D,
) -> Result<Account, AppError>
where
    F: FnMut(&AccountId) -> Result<Option<Account>, AppError>,
    U: FnOnce(&AccountId) -> Result<(), AppError>,
    G: FnOnce(&str) -> Result<String, AppError>,
    S: FnMut(&str, &str) -> Result<(), AppError>,
    D: FnMut(&str) -> Result<(), AppError>,
{
    find_account(id)?.ok_or_else(|| AppError::UserVisible {
        message: "Account not found".into(),
    })?;

    let saved_password = password.filter(|pw| !pw.is_empty());
    let previous_password = if saved_password.is_some() {
        match get_password(id.as_ref()) {
            Ok(password) => Some(password),
            Err(error) if is_missing_password_error(&error) => None,
            Err(error) => return Err(error),
        }
    } else {
        None
    };

    if let Some(pw) = saved_password {
        set_password(id.as_ref(), pw)?;
    }

    match update_credentials(id).and_then(|()| {
        find_account(id)?.ok_or_else(|| AppError::UserVisible {
            message: "Account not found".into(),
        })
    }) {
        Ok(account) => Ok(account),
        Err(error) => {
            if let Some(previous_password) = previous_password {
                if let Err(rollback_error) = set_password(id.as_ref(), &previous_password) {
                    warn!(
                        "Failed to restore previous keyring entry for account {} after credential update failure: {:?}",
                        id.as_ref(),
                        rollback_error
                    );
                }
            } else if saved_password.is_some() {
                if let Err(rollback_error) = delete_password(id.as_ref()) {
                    warn!(
                        "Failed to remove new keyring entry for account {} after credential update failure: {:?}",
                        id.as_ref(),
                        rollback_error
                    );
                }
            }
            Err(error)
        }
    }
}

pub(crate) fn update_account_credentials_after_optional_password<F, U>(
    id: &AccountId,
    password: Option<&str>,
    find_account: F,
    update_credentials: U,
) -> Result<Account, AppError>
where
    F: FnMut(&AccountId) -> Result<Option<Account>, AppError>,
    U: FnOnce(&AccountId) -> Result<(), AppError>,
{
    update_account_credentials_after_optional_password_with_keyring(
        id,
        password,
        find_account,
        update_credentials,
        |account_id| keyring_store::get_password(account_id).map_err(AppError::from),
        |account_id, password| {
            keyring_store::set_password(account_id, password).map_err(AppError::from)
        },
        |account_id| keyring_store::delete_password(account_id).map_err(AppError::from),
    )
}

pub(crate) fn delete_account_then_password<D, K>(
    id: &AccountId,
    delete_account: D,
    delete_password: K,
) -> Result<(), AppError>
where
    D: FnOnce(&AccountId) -> Result<(), AppError>,
    K: FnOnce(&str) -> Result<(), AppError>,
{
    delete_account(id)?;

    if let Err(error) = delete_password(id.as_ref()) {
        warn!(
            "Failed to clean up keyring for account {} after DB delete: {:?}",
            id.as_ref(),
            error
        );
    }

    Ok(())
}

pub(crate) fn delete_account_with_sync_boundary(
    db: &Mutex<crate::infra::db::connection::DbManager>,
    syncing: &AtomicBool,
    id: AccountId,
) -> Result<(), AppError> {
    delete_account_with_sync_boundary_with_keyring(db, syncing, id, |account_id| {
        keyring_store::delete_password(account_id).map_err(AppError::from)
    })
}

pub(crate) fn delete_account_with_sync_boundary_with_keyring<K>(
    db: &Mutex<crate::infra::db::connection::DbManager>,
    syncing: &AtomicBool,
    id: AccountId,
    delete_password: K,
) -> Result<(), AppError>
where
    K: FnOnce(&str) -> Result<(), AppError>,
{
    let _guard = crate::commands::start_database_maintenance(syncing)?;
    let db = crate::commands::lock_db(db)?;
    let repo = SqliteAccountRepository::new(db.writer());
    delete_account_then_password(
        &id,
        |id| repo.delete(id).map_err(AppError::from),
        delete_password,
    )
}
