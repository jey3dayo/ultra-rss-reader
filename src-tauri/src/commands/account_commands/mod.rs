use tauri::State;

use crate::commands::dto::{AccountDto, AppError};
use crate::commands::sync_providers::{GReaderSession, SessionError};
use crate::commands::AppState;
use crate::domain::account::{Account, ConnectionVerificationStatus};
use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::repository::account::AccountRepository;

mod credentials;
mod validation;

#[cfg(test)]
pub(crate) use credentials::{
    delete_account_then_password, delete_account_with_sync_boundary_with_keyring,
    save_account_after_optional_password_with_keyring,
    update_account_credentials_after_optional_password_with_keyring,
};
pub(crate) use credentials::{
    delete_account_with_sync_boundary, save_account_after_optional_password,
    update_account_credentials_after_optional_password,
};
pub(crate) use validation::{
    normalize_new_freshrss_server_url, normalize_updated_account_server_url, validate_account_name,
    validate_account_name_with_excluded_id, validate_account_sync_settings,
    validate_add_account_args,
};

#[cfg(test)]
mod tests;

#[tauri::command]
pub fn list_accounts(state: State<'_, AppState>) -> Result<Vec<AccountDto>, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteAccountRepository::new(db.reader());
    let accounts = repo.find_all()?;
    Ok(accounts.into_iter().map(AccountDto::from).collect())
}

#[tauri::command]
pub async fn add_account(
    state: State<'_, AppState>,
    kind: String,
    name: String,
    server_url: Option<String>,
    username: Option<String>,
    password: Option<String>,
) -> Result<AccountDto, AppError> {
    let provider_kind = validate_add_account_args(
        &kind,
        server_url.as_deref(),
        username.as_deref(),
        password.as_deref(),
    )?;

    let name = {
        let db = crate::commands::lock_db(&state.db)?;
        let repo = SqliteAccountRepository::new(db.reader());
        let accounts = repo.find_all()?;
        validate_account_name(&name, &accounts)?
    };

    let normalized_server_url = match provider_kind {
        ProviderKind::FreshRss => Some(normalize_new_freshrss_server_url(
            server_url.as_deref().unwrap_or_default(),
        )?),
        ProviderKind::Local => server_url,
        ProviderKind::Quarantined => None,
    };

    let account = Account {
        id: AccountId::new(),
        kind: provider_kind,
        name,
        server_url: normalized_server_url,
        username,
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    };

    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteAccountRepository::new(db.writer());
    save_account_after_optional_password(&account, password.as_deref(), |account| {
        repo.save(account).map_err(AppError::from)
    })?;

    Ok(AccountDto::from(account))
}

#[tauri::command]
pub fn update_account_sync(
    state: State<'_, AppState>,
    account_id: String,
    sync_interval_secs: i64,
    sync_on_startup: bool,
    sync_on_wake: bool,
    keep_read_items_days: i64,
) -> Result<AccountDto, AppError> {
    validate_account_sync_settings(sync_interval_secs, keep_read_items_days)?;
    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteAccountRepository::new(db.writer());
    let id = AccountId(account_id);
    repo.update_sync_settings(
        &id,
        sync_interval_secs,
        sync_on_startup,
        sync_on_wake,
        keep_read_items_days,
    )?;
    let account = repo.find_by_id(&id)?.ok_or_else(|| AppError::UserVisible {
        message: "Account not found".into(),
    })?;
    Ok(AccountDto::from(account))
}

#[tauri::command]
pub fn update_account_credentials(
    state: State<'_, AppState>,
    account_id: String,
    server_url: Option<String>,
    username: Option<String>,
    password: Option<String>,
) -> Result<AccountDto, AppError> {
    let id = AccountId(account_id);

    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteAccountRepository::new(db.writer());
    let current_account = repo.find_by_id(&id)?.ok_or_else(|| AppError::UserVisible {
        message: "Account not found".into(),
    })?;
    let server_url = normalize_updated_account_server_url(&current_account, server_url.as_deref())?;
    let account = update_account_credentials_after_optional_password(
        &id,
        password.as_deref(),
        |id| repo.find_by_id(id).map_err(AppError::from),
        |id| {
            repo.update_credentials(id, server_url.as_deref(), username.as_deref())
                .map_err(AppError::from)
        },
    )?;
    Ok(AccountDto::from(account))
}

#[tauri::command]
pub fn rename_account(
    state: State<'_, AppState>,
    account_id: String,
    name: String,
) -> Result<AccountDto, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteAccountRepository::new(db.writer());
    let id = AccountId(account_id);
    let all_accounts = repo.find_all()?;
    let name = validate_account_name_with_excluded_id(&name, &all_accounts, Some(&id))?;
    repo.rename(&id, &name)?;
    let account = repo.find_by_id(&id)?.ok_or_else(|| AppError::UserVisible {
        message: "Account not found".into(),
    })?;
    Ok(AccountDto::from(account))
}

#[tauri::command]
pub async fn test_account_connection(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<AccountDto, AppError> {
    let id = AccountId(account_id);

    let account = {
        let db = crate::commands::lock_db(&state.db)?;
        let repo = SqliteAccountRepository::new(db.reader());
        repo.find_by_id(&id)?.ok_or_else(|| AppError::UserVisible {
            message: "Account not found".into(),
        })?
    }; // DB lock dropped

    if !matches!(account.kind, ProviderKind::FreshRss) {
        return Ok(AccountDto::from(account));
    }

    match GReaderSession::establish(&account).await {
        Ok(_) => {}
        Err(SessionError::Auth(error)) => {
            let error_message = error.to_string();
            let db = crate::commands::lock_db(&state.db)?;
            let repo = SqliteAccountRepository::new(db.writer());
            repo.update_connection_verification(
                &id,
                ConnectionVerificationStatus::Error,
                None,
                Some(&error_message),
            )?;
            return Err(error);
        }
        Err(error) => return Err(error.into_user_visible()),
    }

    let verified_at = chrono::Utc::now().to_rfc3339();
    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteAccountRepository::new(db.writer());
    repo.update_connection_verification(
        &id,
        ConnectionVerificationStatus::Verified,
        Some(&verified_at),
        None,
    )?;
    let updated = repo.find_by_id(&id)?.ok_or_else(|| AppError::UserVisible {
        message: "Account not found".into(),
    })?;

    Ok(AccountDto::from(updated))
}

#[tauri::command]
pub fn delete_account(state: State<'_, AppState>, account_id: String) -> Result<(), AppError> {
    delete_account_with_sync_boundary(&state.db, state.syncing.as_ref(), AccountId(account_id))
}
