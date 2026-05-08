use tauri::State;
use tracing::warn;

use crate::commands::dto::{AccountDto, AppError};
use crate::commands::AppState;
use crate::domain::account::{Account, ConnectionVerificationStatus};
use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::keyring_store;
use crate::infra::provider::greader::GReaderProvider;
use crate::infra::provider::traits::{Credentials, FeedProvider};
use crate::repository::account::AccountRepository;

fn validate_add_account_args(
    kind: &str,
    server_url: Option<&str>,
    username: Option<&str>,
    password: Option<&str>,
) -> Result<ProviderKind, AppError> {
    match kind {
        "Local" => Ok(ProviderKind::Local),
        "FreshRss" => {
            if server_url.is_none_or(|value| value.trim().is_empty()) {
                return Err(AppError::UserVisible {
                    message: "FreshRSS server URL is required".into(),
                });
            }
            if username.is_none_or(|value| value.trim().is_empty()) {
                return Err(AppError::UserVisible {
                    message: "FreshRSS username is required".into(),
                });
            }
            if password.is_none_or(|value| value.trim().is_empty()) {
                return Err(AppError::UserVisible {
                    message: "FreshRSS password is required".into(),
                });
            }

            Ok(ProviderKind::FreshRss)
        }
        _ => Err(AppError::UserVisible {
            message: "Unknown provider kind".into(),
        }),
    }
}

fn validate_account_sync_settings(
    sync_interval_secs: i64,
    keep_read_items_days: i64,
) -> Result<(), AppError> {
    if !(60..=86_400).contains(&sync_interval_secs) {
        return Err(AppError::UserVisible {
            message: "Sync interval must be between 60 and 86400 seconds".into(),
        });
    }
    if !(1..=3650).contains(&keep_read_items_days) {
        return Err(AppError::UserVisible {
            message: "Keep read items days must be between 1 and 3650".into(),
        });
    }
    Ok(())
}

fn save_account_after_optional_password<F, S, D>(
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

#[cfg(test)]
mod tests {
    use super::{
        save_account_after_optional_password, validate_account_sync_settings,
        validate_add_account_args,
    };
    use crate::commands::dto::AppError;
    use crate::domain::account::{Account, ConnectionVerificationStatus};
    use crate::domain::provider::ProviderKind;
    use crate::domain::types::AccountId;
    use std::cell::RefCell;

    fn fresh_rss_account() -> Account {
        Account {
            id: AccountId::new(),
            kind: ProviderKind::FreshRss,
            name: "FreshRSS".to_string(),
            server_url: Some("https://rss.example.com".to_string()),
            username: Some("alice".to_string()),
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Unverified,
            connection_verified_at: None,
            connection_verification_error: None,
        }
    }

    #[test]
    fn validates_add_account_args_by_provider_kind() {
        assert_eq!(
            validate_add_account_args("Local", None, None, None).unwrap(),
            ProviderKind::Local
        );
        assert_eq!(
            validate_add_account_args(
                "FreshRss",
                Some("https://rss.example.com"),
                Some("alice"),
                Some("secret"),
            )
            .unwrap(),
            ProviderKind::FreshRss
        );

        assert!(
            validate_add_account_args("FreshRss", None, Some("alice"), Some("secret")).is_err()
        );
        assert!(
            validate_add_account_args("FreshRss", Some("   "), Some("alice"), Some("secret"))
                .is_err()
        );
        assert!(validate_add_account_args(
            "FreshRss",
            Some("https://rss.example.com"),
            None,
            Some("secret")
        )
        .is_err());
        assert!(validate_add_account_args(
            "FreshRss",
            Some("https://rss.example.com"),
            Some("   "),
            Some("secret")
        )
        .is_err());
        assert!(validate_add_account_args(
            "FreshRss",
            Some("https://rss.example.com"),
            Some("alice"),
            None
        )
        .is_err());
        assert!(validate_add_account_args("Unknown", None, None, None).is_err());
    }

    #[test]
    fn validates_sync_settings_range() {
        assert!(validate_account_sync_settings(60, 1).is_ok());
        assert!(validate_account_sync_settings(86_400, 3650).is_ok());
        assert!(validate_account_sync_settings(59, 30).is_err());
        assert!(validate_account_sync_settings(86_401, 30).is_err());
        assert!(validate_account_sync_settings(3600, 0).is_err());
        assert!(validate_account_sync_settings(3600, 3651).is_err());
    }

    #[test]
    fn add_account_rolls_back_keyring_entry_when_db_save_fails() {
        let account = fresh_rss_account();
        let saved_passwords = RefCell::new(Vec::new());
        let deleted_passwords = RefCell::new(Vec::new());

        let result = save_account_after_optional_password(
            &account,
            Some("secret"),
            |account_id, password| {
                saved_passwords
                    .borrow_mut()
                    .push((account_id.to_string(), password.to_string()));
                Ok(())
            },
            |_| {
                Err(AppError::UserVisible {
                    message: "db failed".to_string(),
                })
            },
            |account_id| {
                deleted_passwords.borrow_mut().push(account_id.to_string());
                Ok(())
            },
        );

        assert!(result.is_err());
        assert_eq!(
            saved_passwords.borrow().as_slice(),
            &[(account.id.as_ref().to_string(), "secret".to_string())]
        );
        assert_eq!(
            deleted_passwords.borrow().as_slice(),
            &[account.id.as_ref().to_string()]
        );
    }

    #[test]
    fn add_account_keeps_original_db_error_when_keyring_rollback_fails() {
        let account = fresh_rss_account();

        let error = save_account_after_optional_password(
            &account,
            Some("secret"),
            |_, _| Ok(()),
            |_| {
                Err(AppError::UserVisible {
                    message: "db failed".to_string(),
                })
            },
            |_| {
                Err(AppError::UserVisible {
                    message: "rollback failed".to_string(),
                })
            },
        )
        .expect_err("DB save failure should remain the returned error");

        match error {
            AppError::UserVisible { message } => assert_eq!(message, "db failed"),
            AppError::Retryable { message } => panic!("unexpected retryable error: {message}"),
        }
    }
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
    let provider_kind = validate_add_account_args(
        &kind,
        server_url.as_deref(),
        username.as_deref(),
        password.as_deref(),
    )?;

    let mut account = Account {
        id: AccountId::new(),
        kind: provider_kind,
        name,
        server_url,
        username,
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    };

    // Validate connection for remote providers (no DB lock held during .await)
    if matches!(account.kind, ProviderKind::FreshRss) {
        let mut provider =
            GReaderProvider::for_freshrss(account.server_url.as_deref().unwrap_or_default());

        provider
            .authenticate(&Credentials {
                token: account.username.clone(),
                password: password.clone(),
            })
            .await?;

        account.connection_verification_status = ConnectionVerificationStatus::Verified;
        account.connection_verified_at = Some(chrono::Utc::now().to_rfc3339());
    }

    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqliteAccountRepository::new(db.writer());
    save_account_after_optional_password(
        &account,
        password.as_deref(),
        |account_id, pw| keyring_store::set_password(account_id, pw).map_err(AppError::from),
        |account| repo.save(account).map_err(AppError::from),
        |account_id| keyring_store::delete_password(account_id).map_err(AppError::from),
    )?;

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
) -> Result<AccountDto, AppError> {
    let id = AccountId(account_id);

    let account = {
        let db = state.db.lock().map_err(|e| AppError::UserVisible {
            message: format!("Lock error: {e}"),
        })?;
        let repo = SqliteAccountRepository::new(db.reader());
        repo.find_by_id(&id)?.ok_or_else(|| AppError::UserVisible {
            message: "Account not found".into(),
        })?
    }; // DB lock dropped

    if !matches!(account.kind, ProviderKind::FreshRss) {
        return Ok(AccountDto::from(account));
    }

    let username = account
        .username
        .as_deref()
        .ok_or_else(|| AppError::UserVisible {
            message: "Username is not configured".into(),
        })?;

    let password = keyring_store::get_password(id.as_ref())?;

    let mut provider =
        GReaderProvider::for_freshrss(account.server_url.as_deref().unwrap_or_default());

    if let Err(error) = provider
        .authenticate(&Credentials {
            token: Some(username.to_string()),
            password: Some(password),
        })
        .await
    {
        let error_message = error.to_string();
        let db = state.db.lock().map_err(|e| AppError::UserVisible {
            message: format!("Lock error: {e}"),
        })?;
        let repo = SqliteAccountRepository::new(db.writer());
        repo.update_connection_verification(
            &id,
            ConnectionVerificationStatus::Error,
            None,
            Some(&error_message),
        )?;
        return Err(error.into());
    }

    let verified_at = chrono::Utc::now().to_rfc3339();
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
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
