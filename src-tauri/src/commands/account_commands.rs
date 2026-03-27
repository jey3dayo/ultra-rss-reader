use tauri::State;
use tracing::warn;

use crate::commands::dto::{AccountDto, AppError};
use crate::commands::AppState;
use crate::domain::account::Account;
use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::keyring_store;
use crate::repository::account::AccountRepository;

#[tauri::command]
pub fn list_accounts(state: State<'_, AppState>) -> Result<Vec<AccountDto>, AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqliteAccountRepository::new(db.reader());
    let accounts = repo.find_all()?;
    Ok(accounts.into_iter().map(AccountDto::from).collect())
}

#[tauri::command]
pub fn add_account(
    state: State<'_, AppState>,
    kind: String,
    name: String,
    server_url: Option<String>,
    username: Option<String>,
    password: Option<String>,
) -> Result<AccountDto, AppError> {
    let provider_kind = match kind.as_str() {
        "Local" => ProviderKind::Local,
        "FreshRss" => ProviderKind::FreshRss,
        "Inoreader" => ProviderKind::Inoreader,
        _ => {
            return Err(AppError::UserVisible {
                message: "Unknown provider kind".into(),
            })
        }
    };

    let account = Account {
        id: AccountId::new(),
        kind: provider_kind,
        name,
        server_url,
        username,
        sync_interval_secs: 3600,
        sync_on_wake: false,
        keep_read_items_days: 30,
    };

    // Store password in OS keyring BEFORE DB save (fail fast)
    if matches!(
        account.kind,
        ProviderKind::FreshRss | ProviderKind::Inoreader
    ) {
        if let Some(ref pw) = password {
            keyring_store::set_password(account.id.as_ref(), pw)?;
        }
    }

    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqliteAccountRepository::new(db.writer());
    repo.save(&account)?;

    Ok(AccountDto::from(account))
}

#[tauri::command]
pub fn update_account_sync(
    state: State<'_, AppState>,
    account_id: String,
    sync_interval_secs: i64,
    sync_on_wake: bool,
    keep_read_items_days: i64,
) -> Result<AccountDto, AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqliteAccountRepository::new(db.writer());
    let id = AccountId(account_id);
    repo.update_sync_settings(&id, sync_interval_secs, sync_on_wake, keep_read_items_days)?;
    let account = repo.find_by_id(&id)?.ok_or_else(|| AppError::UserVisible {
        message: "Account not found".into(),
    })?;
    Ok(AccountDto::from(account))
}

#[tauri::command]
pub fn delete_account(state: State<'_, AppState>, account_id: String) -> Result<(), AppError> {
    // Clean up keyring entry (log warning on unexpected errors)
    if let Err(e) = keyring_store::delete_password(&account_id) {
        warn!("Failed to clean up keyring for account {account_id}: {e}");
    }

    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqliteAccountRepository::new(db.writer());
    repo.delete(&AccountId(account_id))?;
    Ok(())
}
