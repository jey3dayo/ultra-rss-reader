use tauri::State;
use tracing::warn;

use crate::commands::dto::{AccountDto, AppError};
use crate::commands::AppState;
use crate::domain::account::Account;
use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_preference::SqlitePreferenceRepository;
use crate::infra::keyring_store;
use crate::infra::provider::greader::GReaderProvider;
use crate::infra::provider::traits::{Credentials, FeedProvider};
use crate::repository::account::AccountRepository;
use crate::repository::preference::PreferenceRepository;

fn load_inoreader_app_credentials(
    pref_repo: &SqlitePreferenceRepository<'_>,
) -> Result<(Option<String>, Option<String>), AppError> {
    let app_id = pref_repo.get("inoreader_app_id").unwrap_or(None);
    let app_key = pref_repo.get("inoreader_app_key").unwrap_or(None);

    let has_app_id = app_id
        .as_deref()
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    let has_app_key = app_key
        .as_deref()
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);

    if !has_app_id || !has_app_key {
        return Err(AppError::UserVisible {
            message: "Inoreader App ID and App Key are not configured".into(),
        });
    }

    Ok((app_id, app_key))
}

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
pub async fn add_account(
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
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
    };

    // Validate connection for remote providers (no DB lock held during .await)
    if matches!(
        account.kind,
        ProviderKind::FreshRss | ProviderKind::Inoreader
    ) {
        let mut provider = match account.kind {
            ProviderKind::FreshRss => {
                GReaderProvider::for_freshrss(account.server_url.as_deref().unwrap_or_default())
            }
            ProviderKind::Inoreader => {
                let (app_id, app_key) = {
                    let db_guard = state.db.lock().map_err(|e| AppError::UserVisible {
                        message: format!("Lock error: {e}"),
                    })?;
                    let pref_repo = SqlitePreferenceRepository::new(db_guard.reader());
                    load_inoreader_app_credentials(&pref_repo)?
                }; // DB lock dropped here before .await
                GReaderProvider::for_inoreader(app_id, app_key)
            }
            _ => unreachable!(),
        };

        provider
            .authenticate(&Credentials {
                token: account.username.clone(),
                password: password.clone(),
            })
            .await?;
    }

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
    sync_on_startup: bool,
    sync_on_wake: bool,
    keep_read_items_days: i64,
) -> Result<AccountDto, AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
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

    // Update password in keyring if provided
    if let Some(ref pw) = password {
        if !pw.is_empty() {
            keyring_store::set_password(id.as_ref(), pw)?;
        }
    }

    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqliteAccountRepository::new(db.writer());
    repo.update_credentials(&id, server_url.as_deref(), username.as_deref())?;
    let account = repo.find_by_id(&id)?.ok_or_else(|| AppError::UserVisible {
        message: "Account not found".into(),
    })?;
    Ok(AccountDto::from(account))
}

#[tauri::command]
pub fn rename_account(
    state: State<'_, AppState>,
    account_id: String,
    name: String,
) -> Result<AccountDto, AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::UserVisible {
            message: "Account name cannot be empty".into(),
        });
    }
    if name.chars().count() > 100 {
        return Err(AppError::UserVisible {
            message: "Account name must be 100 characters or less".into(),
        });
    }
    let repo = SqliteAccountRepository::new(db.writer());
    let id = AccountId(account_id);
    // Check for duplicate name
    let all_accounts = repo.find_all()?;
    if all_accounts.iter().any(|a| a.id != id && a.name == name) {
        return Err(AppError::UserVisible {
            message: format!("Account name \"{name}\" is already in use"),
        });
    }
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
) -> Result<bool, AppError> {
    let id = AccountId(account_id);

    let (account, inoreader_creds) = {
        let db = state.db.lock().map_err(|e| AppError::UserVisible {
            message: format!("Lock error: {e}"),
        })?;
        let repo = SqliteAccountRepository::new(db.reader());
        let account = repo.find_by_id(&id)?.ok_or_else(|| AppError::UserVisible {
            message: "Account not found".into(),
        })?;
        let creds = if account.kind == ProviderKind::Inoreader {
            let pref_repo = SqlitePreferenceRepository::new(db.reader());
            load_inoreader_app_credentials(&pref_repo)?
        } else {
            (None, None)
        };
        (account, creds)
    }; // DB lock dropped

    if !matches!(
        account.kind,
        ProviderKind::FreshRss | ProviderKind::Inoreader
    ) {
        return Ok(true);
    }

    let username = account
        .username
        .as_deref()
        .ok_or_else(|| AppError::UserVisible {
            message: "Username is not configured".into(),
        })?;

    let password = keyring_store::get_password(id.as_ref())?;

    let mut provider = match account.kind {
        ProviderKind::FreshRss => {
            GReaderProvider::for_freshrss(account.server_url.as_deref().unwrap_or_default())
        }
        ProviderKind::Inoreader => {
            GReaderProvider::for_inoreader(inoreader_creds.0, inoreader_creds.1)
        }
        _ => unreachable!(),
    };

    provider
        .authenticate(&Credentials {
            token: Some(username.to_string()),
            password: Some(password),
        })
        .await?;

    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::db::connection::DbManager;

    #[test]
    fn inoreader_app_credentials_require_both_values() {
        let db = DbManager::new_in_memory().unwrap();
        let repo = SqlitePreferenceRepository::new(db.writer());
        repo.set("inoreader_app_id", "app-id").unwrap();

        let error = load_inoreader_app_credentials(&repo).unwrap_err();
        match error {
            AppError::UserVisible { message } => {
                assert!(message.contains("Inoreader App ID and App Key"));
            }
            AppError::Retryable { message } => panic!("unexpected retryable error: {message}"),
        }
    }

    #[test]
    fn inoreader_app_credentials_return_values_when_present() {
        let db = DbManager::new_in_memory().unwrap();
        let repo = SqlitePreferenceRepository::new(db.writer());
        repo.set("inoreader_app_id", "app-id").unwrap();
        repo.set("inoreader_app_key", "app-key").unwrap();

        let creds = load_inoreader_app_credentials(&repo).unwrap();
        assert_eq!(creds, (Some("app-id".into()), Some("app-key".into())));
    }
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
