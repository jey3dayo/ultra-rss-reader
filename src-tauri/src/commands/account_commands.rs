use tauri::State;

use crate::commands::dto::{AccountDto, AppError};
use crate::commands::AppState;
use crate::domain::account::Account;
use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
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
) -> Result<AccountDto, AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqliteAccountRepository::new(db.writer());
    let account = Account {
        id: AccountId::new(),
        kind: match kind.as_str() {
            "Local" => ProviderKind::Local,
            "FreshRss" => ProviderKind::FreshRss,
            _ => {
                return Err(AppError::UserVisible {
                    message: "Unknown provider kind".into(),
                })
            }
        },
        name,
        server_url,
        username,
        sync_interval_secs: 3600,
        sync_on_wake: false,
        keep_read_items_days: 30,
    };
    repo.save(&account)?;
    Ok(AccountDto::from(account))
}

#[tauri::command]
pub fn delete_account(state: State<'_, AppState>, account_id: String) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqliteAccountRepository::new(db.writer());
    repo.delete(&AccountId(account_id))?;
    Ok(())
}
