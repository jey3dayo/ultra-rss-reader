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
use std::net::IpAddr;
use std::sync::{atomic::AtomicBool, Mutex};

const MISSING_PASSWORD_ERROR_MARKER: &str = "Password is not configured";

#[cfg(test)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AccountCredentialCleanupStep {
    DeleteDatabaseAccount,
    DeleteKeyringCredential,
}

#[cfg(test)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AccountCredentialCleanupFailurePolicy {
    WarnAfterDatabaseDelete,
}

#[cfg(test)]
#[derive(Debug, Clone, PartialEq, Eq)]
struct AccountCredentialCleanupContract {
    steps: Vec<AccountCredentialCleanupStep>,
    keyring_delete_failure_policy: AccountCredentialCleanupFailurePolicy,
    rename_deletes_keyring_credential: bool,
}

#[cfg(test)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AccountRecoveryAction {
    DeleteAccount,
    RecreateAccount,
    ContactSupport,
}

#[cfg(test)]
#[derive(Debug, Clone, PartialEq, Eq)]
struct InvalidAccountRowRecoveryContract {
    diagnostics_event: &'static str,
    recovery_actions: Vec<AccountRecoveryAction>,
    preserves_account_id: bool,
    exposes_displayable_row: bool,
}

#[cfg(test)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ProviderScaleGuidanceSurface {
    AccountSettingsAdvisory,
}

#[cfg(test)]
#[derive(Debug, Clone, PartialEq, Eq)]
struct ProviderAccountScaleGuidanceContract {
    surface: ProviderScaleGuidanceSurface,
    max_feeds_guidance: &'static str,
    max_articles_guidance: &'static str,
    warning_threshold_guidance: &'static str,
    performance_diagnostics: &'static str,
    no_hard_limit_copy: bool,
}

#[cfg(test)]
#[derive(Debug, Clone, PartialEq, Eq)]
struct ProviderCredentialVerificationRequestContract {
    create_requests_connection_test: bool,
    update_requests_connection_test: bool,
    explicit_verification_command: &'static str,
    mutation_status_after_create_or_update: ConnectionVerificationStatus,
}

#[cfg(test)]
fn account_credential_cleanup_contract() -> AccountCredentialCleanupContract {
    AccountCredentialCleanupContract {
        steps: vec![
            AccountCredentialCleanupStep::DeleteDatabaseAccount,
            AccountCredentialCleanupStep::DeleteKeyringCredential,
        ],
        keyring_delete_failure_policy:
            AccountCredentialCleanupFailurePolicy::WarnAfterDatabaseDelete,
        rename_deletes_keyring_credential: false,
    }
}

#[cfg(test)]
fn invalid_account_row_recovery_contract() -> InvalidAccountRowRecoveryContract {
    InvalidAccountRowRecoveryContract {
        diagnostics_event: "account.row.quarantined",
        recovery_actions: vec![
            AccountRecoveryAction::DeleteAccount,
            AccountRecoveryAction::RecreateAccount,
            AccountRecoveryAction::ContactSupport,
        ],
        preserves_account_id: true,
        exposes_displayable_row: true,
    }
}

#[cfg(test)]
fn provider_account_scale_guidance_contract() -> ProviderAccountScaleGuidanceContract {
    ProviderAccountScaleGuidanceContract {
        surface: ProviderScaleGuidanceSurface::AccountSettingsAdvisory,
        max_feeds_guidance: "provider_specific_advisory_not_enforced",
        max_articles_guidance: "provider_specific_advisory_not_enforced",
        warning_threshold_guidance: "warn_from_observed_performance_not_fixed_protocol_limit",
        performance_diagnostics:
            "record_account_kind_feed_count_article_count_and_sync_duration_class",
        no_hard_limit_copy: true,
    }
}

#[cfg(test)]
fn provider_credential_verification_request_contract(
) -> ProviderCredentialVerificationRequestContract {
    ProviderCredentialVerificationRequestContract {
        create_requests_connection_test: false,
        update_requests_connection_test: false,
        explicit_verification_command: "test_account_connection",
        mutation_status_after_create_or_update: ConnectionVerificationStatus::Unverified,
    }
}

fn is_private_freshrss_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            ip.is_private()
                || ip.is_loopback()
                || ip.is_link_local()
                || ip.is_broadcast()
                || ip.is_documentation()
                || ip.is_unspecified()
        }
        IpAddr::V6(ip) => {
            ip.is_loopback()
                || ip.is_unspecified()
                || ip.is_unique_local()
                || ip.is_unicast_link_local()
        }
    }
}

fn normalize_new_freshrss_server_url(server_url: &str) -> Result<String, AppError> {
    let trimmed = server_url.trim();
    let url = reqwest::Url::parse(trimmed).map_err(|_| AppError::UserVisible {
        message: "FreshRSS server URL must be a valid URL".into(),
    })?;

    if url.scheme() != "http" && url.scheme() != "https" {
        return Err(AppError::UserVisible {
            message: "FreshRSS server URL must use http or https".into(),
        });
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(AppError::UserVisible {
            message: "FreshRSS server URL must not include userinfo".into(),
        });
    }

    let host = url.host_str().ok_or_else(|| AppError::UserVisible {
        message: "FreshRSS server URL must include a host".into(),
    })?;
    let ip_host = host.trim_start_matches('[').trim_end_matches(']');
    if host.eq_ignore_ascii_case("localhost")
        || ip_host.parse::<IpAddr>().is_ok_and(is_private_freshrss_ip)
    {
        return Err(AppError::UserVisible {
            message: "FreshRSS server URL must not use a private host".into(),
        });
    }

    Ok(url.to_string())
}

fn validate_add_account_args(
    kind: &str,
    server_url: Option<&str>,
    username: Option<&str>,
    password: Option<&str>,
) -> Result<ProviderKind, AppError> {
    match kind {
        "Local" => Ok(ProviderKind::Local),
        "Quarantined" => Err(AppError::UserVisible {
            message: "Quarantined provider accounts cannot be created".into(),
        }),
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
            normalize_new_freshrss_server_url(server_url.unwrap())?;

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
    if !(0..=3650).contains(&keep_read_items_days) {
        return Err(AppError::UserVisible {
            message: "Keep read items days must be between 0 and 3650".into(),
        });
    }
    Ok(())
}

fn account_name_matches(left: &str, right: &str) -> bool {
    left.trim().eq_ignore_ascii_case(right.trim())
}

fn validate_account_name_with_excluded_id(
    name: &str,
    accounts: &[Account],
    excluded_id: Option<&AccountId>,
) -> Result<String, AppError> {
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
    if accounts.iter().any(|account| {
        excluded_id.is_none_or(|excluded_id| account.id != *excluded_id)
            && account_name_matches(&account.name, &name)
    }) {
        return Err(AppError::UserVisible {
            message: format!("Account name \"{name}\" is already in use"),
        });
    }
    Ok(name)
}

fn validate_account_name(name: &str, accounts: &[Account]) -> Result<String, AppError> {
    validate_account_name_with_excluded_id(name, accounts, None)
}

fn validate_freshrss_server_url(account: &Account) -> Result<&str, AppError> {
    account
        .server_url
        .as_deref()
        .map(str::trim)
        .filter(|server_url| !server_url.is_empty())
        .ok_or_else(|| AppError::UserVisible {
            message: "FreshRSS server URL is not configured".into(),
        })
}

fn normalize_updated_account_server_url(
    account: &Account,
    server_url: Option<&str>,
) -> Result<Option<String>, AppError> {
    match account.kind {
        ProviderKind::FreshRss => {
            let server_url = server_url.ok_or_else(|| AppError::UserVisible {
                message: "FreshRSS server URL is required".into(),
            })?;
            if server_url.trim().is_empty() {
                return Err(AppError::UserVisible {
                    message: "FreshRSS server URL is required".into(),
                });
            }
            Ok(Some(normalize_new_freshrss_server_url(server_url)?))
        }
        ProviderKind::Local => Ok(server_url.map(ToOwned::to_owned)),
        ProviderKind::Quarantined => Ok(None),
    }
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

fn is_missing_password_error(error: &AppError) -> bool {
    matches!(error, AppError::UserVisible { message } if message.contains(MISSING_PASSWORD_ERROR_MARKER))
}

fn update_account_credentials_after_optional_password<F, U, G, S, D>(
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

fn delete_account_then_password<D, K>(
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

fn delete_account_with_sync_boundary<K>(
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

#[cfg(test)]
mod tests {
    use super::{
        account_credential_cleanup_contract, delete_account_then_password,
        delete_account_with_sync_boundary, invalid_account_row_recovery_contract,
        normalize_new_freshrss_server_url, normalize_updated_account_server_url,
        provider_account_scale_guidance_contract,
        provider_credential_verification_request_contract, save_account_after_optional_password,
        update_account_credentials_after_optional_password, validate_account_name,
        validate_account_name_with_excluded_id, validate_account_sync_settings,
        validate_add_account_args, validate_freshrss_server_url,
        AccountCredentialCleanupFailurePolicy, AccountCredentialCleanupStep, AccountRecoveryAction,
        ProviderScaleGuidanceSurface,
    };
    use crate::commands::dto::AppError;
    use crate::domain::account::{Account, ConnectionVerificationStatus};
    use crate::domain::provider::ProviderKind;
    use crate::domain::types::AccountId;
    use crate::infra::db::connection::DbManager;
    use std::cell::RefCell;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Mutex;

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
    fn validates_new_freshrss_server_url_policy() {
        assert_eq!(
            normalize_new_freshrss_server_url(" https://rss.example.com/root ").unwrap(),
            "https://rss.example.com/root"
        );

        for server_url in [
            "ftp://rss.example.com",
            "https://alice:secret@rss.example.com",
            "https://localhost",
            "http://127.0.0.1:8080",
            "https://10.0.0.1",
            "https://172.16.0.1",
            "https://192.168.0.1",
            "https://[::1]",
            "https://[fd00::1]",
        ] {
            assert!(
                normalize_new_freshrss_server_url(server_url).is_err(),
                "{server_url} should be rejected"
            );
        }
    }

    #[test]
    fn validates_sync_settings_range() {
        assert!(validate_account_sync_settings(60, 1).is_ok());
        assert!(validate_account_sync_settings(3600, 0).is_ok());
        assert!(validate_account_sync_settings(86_400, 3650).is_ok());
        assert!(validate_account_sync_settings(59, 30).is_err());
        assert!(validate_account_sync_settings(86_401, 30).is_err());
        assert!(validate_account_sync_settings(3600, -1).is_err());
        assert!(validate_account_sync_settings(3600, 3651).is_err());
    }

    #[test]
    fn validate_account_name_trims_and_rejects_empty_or_duplicate_names() {
        let existing = vec![fresh_rss_account()];

        assert_eq!(
            validate_account_name("  Work FreshRSS  ", &existing).unwrap(),
            "Work FreshRSS"
        );
        assert!(validate_account_name("   ", &existing).is_err());
        assert!(validate_account_name(&"a".repeat(101), &existing).is_err());
        assert!(validate_account_name("FreshRSS", &existing).is_err());
        assert!(validate_account_name("  FreshRSS  ", &existing).is_err());
        assert!(validate_account_name("freshrss", &existing).is_err());
        assert!(validate_account_name("  FRESHRSS  ", &existing).is_err());
    }

    #[test]
    fn validate_account_name_rejects_case_insensitive_duplicates_except_current_account() {
        let mut existing = fresh_rss_account();
        existing.name = "Work".to_string();
        let accounts = vec![existing.clone()];

        assert_eq!(
            validate_account_name_with_excluded_id(" work ", &accounts, Some(&existing.id))
                .unwrap(),
            "work"
        );
        assert!(validate_account_name_with_excluded_id(
            " work ",
            &accounts,
            Some(&AccountId::new())
        )
        .is_err());
    }

    #[test]
    fn validate_freshrss_server_url_rejects_missing_or_blank_urls() {
        let mut account = fresh_rss_account();

        assert_eq!(
            validate_freshrss_server_url(&account).unwrap(),
            "https://rss.example.com"
        );

        account.server_url = None;
        assert!(validate_freshrss_server_url(&account).is_err());

        account.server_url = Some("   ".to_string());
        assert!(validate_freshrss_server_url(&account).is_err());
    }

    #[test]
    fn normalizes_updated_freshrss_server_url_with_new_account_policy() {
        let account = fresh_rss_account();

        assert_eq!(
            normalize_updated_account_server_url(&account, Some(" https://rss.example.com/root "))
                .unwrap(),
            Some("https://rss.example.com/root".to_string())
        );

        for server_url in [
            None,
            Some("   "),
            Some("ftp://rss.example.com"),
            Some("https://alice:secret@rss.example.com"),
            Some("http://localhost:8080"),
            Some("http://127.0.0.1"),
            Some("http://[::1]"),
            Some("not a url"),
        ] {
            assert!(
                normalize_updated_account_server_url(&account, server_url).is_err(),
                "{server_url:?} should be rejected"
            );
        }
    }

    #[test]
    fn normalize_updated_account_server_url_keeps_non_freshrss_policy() {
        let mut account = fresh_rss_account();

        account.kind = ProviderKind::Local;
        assert_eq!(
            normalize_updated_account_server_url(&account, Some(" local value ")).unwrap(),
            Some(" local value ".to_string())
        );

        account.kind = ProviderKind::Quarantined;
        assert_eq!(
            normalize_updated_account_server_url(&account, Some("https://rss.example.com"))
                .unwrap(),
            None
        );
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
    fn add_account_does_not_create_db_account_when_keyring_save_fails() {
        let account = fresh_rss_account();
        let saved_accounts = RefCell::new(Vec::new());
        let deleted_passwords = RefCell::new(Vec::new());

        let error = save_account_after_optional_password(
            &account,
            Some("secret"),
            |_, _| {
                Err(AppError::UserVisible {
                    message: "keyring failed".to_string(),
                })
            },
            |account| {
                saved_accounts
                    .borrow_mut()
                    .push(account.id.as_ref().to_string());
                Ok(())
            },
            |account_id| {
                deleted_passwords.borrow_mut().push(account_id.to_string());
                Ok(())
            },
        )
        .expect_err("keyring save failure should stop account creation before DB save");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "keyring failed"
        ));
        assert!(saved_accounts.borrow().is_empty());
        assert!(deleted_passwords.borrow().is_empty());
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
            AppError::Retryable { message } | AppError::RetryableWithMetadata { message, .. } => {
                panic!("unexpected retryable error: {message}");
            }
        }
    }

    #[test]
    fn update_account_credentials_does_not_save_password_before_account_exists() {
        let read_passwords = RefCell::new(Vec::new());
        let saved_passwords = RefCell::new(Vec::new());

        let error = update_account_credentials_after_optional_password(
            &AccountId("missing-account".to_string()),
            Some("secret"),
            |_| Ok(None),
            |_| Ok(()),
            |account_id| {
                read_passwords.borrow_mut().push(account_id.to_string());
                Ok("old-secret".to_string())
            },
            |account_id, password| {
                saved_passwords
                    .borrow_mut()
                    .push((account_id.to_string(), password.to_string()));
                Ok(())
            },
            |_| Ok(()),
        )
        .expect_err("missing account should be rejected before keyring save");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "Account not found"
        ));
        assert!(read_passwords.borrow().is_empty());
        assert!(saved_passwords.borrow().is_empty());
    }

    #[test]
    fn update_account_credentials_restores_previous_password_when_db_update_fails() {
        let account = fresh_rss_account();
        let read_passwords = RefCell::new(Vec::new());
        let saved_passwords = RefCell::new(Vec::new());

        let error = update_account_credentials_after_optional_password(
            &account.id,
            Some("new-secret"),
            |_| Ok(Some(account.clone())),
            |_| {
                Err(AppError::UserVisible {
                    message: "db failed".to_string(),
                })
            },
            |account_id| {
                read_passwords.borrow_mut().push(account_id.to_string());
                Ok("old-secret".to_string())
            },
            |account_id, password| {
                saved_passwords
                    .borrow_mut()
                    .push((account_id.to_string(), password.to_string()));
                Ok(())
            },
            |_| Ok(()),
        )
        .expect_err("DB update failure should be returned");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "db failed"
        ));
        assert_eq!(
            read_passwords.borrow().as_slice(),
            &[account.id.as_ref().to_string()]
        );
        assert_eq!(
            saved_passwords.borrow().as_slice(),
            &[
                (account.id.as_ref().to_string(), "new-secret".to_string()),
                (account.id.as_ref().to_string(), "old-secret".to_string()),
            ]
        );
    }

    #[test]
    fn update_account_credentials_keeps_new_password_when_db_update_succeeds() {
        let account = fresh_rss_account();
        let read_passwords = RefCell::new(Vec::new());
        let saved_passwords = RefCell::new(Vec::new());
        let updated_accounts = RefCell::new(Vec::new());

        let updated = update_account_credentials_after_optional_password(
            &account.id,
            Some("new-secret"),
            |_| Ok(Some(account.clone())),
            |account_id| {
                updated_accounts
                    .borrow_mut()
                    .push(account_id.as_ref().to_string());
                Ok(())
            },
            |account_id| {
                read_passwords.borrow_mut().push(account_id.to_string());
                Ok("old-secret".to_string())
            },
            |account_id, password| {
                saved_passwords
                    .borrow_mut()
                    .push((account_id.to_string(), password.to_string()));
                Ok(())
            },
            |_| Ok(()),
        )
        .expect("successful credential update should keep the new keyring password");

        assert_eq!(updated.id, account.id);
        assert_eq!(
            read_passwords.borrow().as_slice(),
            &[account.id.as_ref().to_string()]
        );
        assert_eq!(
            updated_accounts.borrow().as_slice(),
            &[account.id.as_ref().to_string()]
        );
        assert_eq!(
            saved_passwords.borrow().as_slice(),
            &[(account.id.as_ref().to_string(), "new-secret".to_string())]
        );
    }

    #[test]
    fn update_account_credentials_saves_password_when_previous_password_is_missing() {
        let account = fresh_rss_account();
        let read_passwords = RefCell::new(Vec::new());
        let saved_passwords = RefCell::new(Vec::new());
        let updated_accounts = RefCell::new(Vec::new());
        let deleted_passwords = RefCell::new(Vec::new());

        let updated = update_account_credentials_after_optional_password(
            &account.id,
            Some("new-secret"),
            |_| Ok(Some(account.clone())),
            |account_id| {
                updated_accounts
                    .borrow_mut()
                    .push(account_id.as_ref().to_string());
                Ok(())
            },
            |account_id| {
                read_passwords.borrow_mut().push(account_id.to_string());
                Err(AppError::UserVisible {
                    message: "Validation error: Password is not configured. Re-enter your password in account settings, save it, and try again.".to_string(),
                })
            },
            |account_id, password| {
                saved_passwords
                    .borrow_mut()
                    .push((account_id.to_string(), password.to_string()));
                Ok(())
            },
            |account_id| {
                deleted_passwords.borrow_mut().push(account_id.to_string());
                Ok(())
            },
        )
        .expect("missing previous password should allow saving a replacement password");

        assert_eq!(updated.id, account.id);
        assert_eq!(
            read_passwords.borrow().as_slice(),
            &[account.id.as_ref().to_string()]
        );
        assert_eq!(
            updated_accounts.borrow().as_slice(),
            &[account.id.as_ref().to_string()]
        );
        assert_eq!(
            saved_passwords.borrow().as_slice(),
            &[(account.id.as_ref().to_string(), "new-secret".to_string())]
        );
        assert!(deleted_passwords.borrow().is_empty());
    }

    #[test]
    fn update_account_credentials_deletes_new_password_when_db_update_fails_without_previous_password(
    ) {
        let account = fresh_rss_account();
        let saved_passwords = RefCell::new(Vec::new());
        let deleted_passwords = RefCell::new(Vec::new());

        let error = update_account_credentials_after_optional_password(
            &account.id,
            Some("new-secret"),
            |_| Ok(Some(account.clone())),
            |_| {
                Err(AppError::UserVisible {
                    message: "db failed".to_string(),
                })
            },
            |_| {
                Err(AppError::UserVisible {
                    message: "Validation error: Password is not configured. Re-enter your password in account settings, save it, and try again.".to_string(),
                })
            },
            |account_id, password| {
                saved_passwords
                    .borrow_mut()
                    .push((account_id.to_string(), password.to_string()));
                Ok(())
            },
            |account_id| {
                deleted_passwords.borrow_mut().push(account_id.to_string());
                Ok(())
            },
        )
        .expect_err("DB update failure should be returned after deleting the new password");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "db failed"
        ));
        assert_eq!(
            saved_passwords.borrow().as_slice(),
            &[(account.id.as_ref().to_string(), "new-secret".to_string())]
        );
        assert_eq!(
            deleted_passwords.borrow().as_slice(),
            &[account.id.as_ref().to_string()]
        );
    }

    #[test]
    fn update_account_credentials_keeps_existing_keyring_entry_for_empty_password() {
        let account = fresh_rss_account();
        let read_passwords = RefCell::new(Vec::new());
        let saved_passwords = RefCell::new(Vec::new());
        let updated_accounts = RefCell::new(Vec::new());

        let updated = update_account_credentials_after_optional_password(
            &account.id,
            Some(""),
            |_| Ok(Some(account.clone())),
            |account_id| {
                updated_accounts
                    .borrow_mut()
                    .push(account_id.as_ref().to_string());
                Ok(())
            },
            |account_id| {
                read_passwords.borrow_mut().push(account_id.to_string());
                Ok("old-secret".to_string())
            },
            |account_id, password| {
                saved_passwords
                    .borrow_mut()
                    .push((account_id.to_string(), password.to_string()));
                Ok(())
            },
            |_| Ok(()),
        )
        .expect("empty password draft should not block metadata credential updates");

        assert_eq!(updated.id, account.id);
        assert_eq!(
            updated_accounts.borrow().as_slice(),
            &[account.id.as_ref().to_string()]
        );
        assert!(read_passwords.borrow().is_empty());
        assert!(saved_passwords.borrow().is_empty());
    }

    #[test]
    fn update_account_credentials_does_not_mutate_db_or_password_when_old_password_read_fails() {
        let account = fresh_rss_account();
        let updated_accounts = RefCell::new(Vec::new());
        let saved_passwords = RefCell::new(Vec::new());

        let error = update_account_credentials_after_optional_password(
            &account.id,
            Some("new-secret"),
            |_| Ok(Some(account.clone())),
            |account_id| {
                updated_accounts
                    .borrow_mut()
                    .push(account_id.as_ref().to_string());
                Ok(())
            },
            |_| {
                Err(AppError::UserVisible {
                    message: "keyring read failed".to_string(),
                })
            },
            |account_id, password| {
                saved_passwords
                    .borrow_mut()
                    .push((account_id.to_string(), password.to_string()));
                Ok(())
            },
            |_| Ok(()),
        )
        .expect_err("old credential read failure should stop before mutation");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "keyring read failed"
        ));
        assert!(updated_accounts.borrow().is_empty());
        assert!(saved_passwords.borrow().is_empty());
    }

    #[test]
    fn update_account_credentials_keeps_db_error_when_previous_password_restore_fails() {
        let account = fresh_rss_account();
        let saved_passwords = RefCell::new(Vec::new());

        let error = update_account_credentials_after_optional_password(
            &account.id,
            Some("new-secret"),
            |_| Ok(Some(account.clone())),
            |_| {
                Err(AppError::UserVisible {
                    message: "db failed".to_string(),
                })
            },
            |_| Ok("old-secret".to_string()),
            |account_id, password| {
                saved_passwords
                    .borrow_mut()
                    .push((account_id.to_string(), password.to_string()));
                if password == "old-secret" {
                    return Err(AppError::UserVisible {
                        message: "restore failed".to_string(),
                    });
                }
                Ok(())
            },
            |_| Ok(()),
        )
        .expect_err("DB update failure should stay the returned error");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "db failed"
        ));
        assert_eq!(
            saved_passwords.borrow().as_slice(),
            &[
                (account.id.as_ref().to_string(), "new-secret".to_string()),
                (account.id.as_ref().to_string(), "old-secret".to_string()),
            ]
        );
    }

    #[test]
    fn delete_account_does_not_delete_password_when_db_delete_fails() {
        let account = fresh_rss_account();
        let deleted_accounts = RefCell::new(Vec::new());
        let deleted_passwords = RefCell::new(Vec::new());

        let error = delete_account_then_password(
            &account.id,
            |account_id| {
                deleted_accounts
                    .borrow_mut()
                    .push(account_id.as_ref().to_string());
                Err(AppError::UserVisible {
                    message: "db delete failed".to_string(),
                })
            },
            |account_id| {
                deleted_passwords.borrow_mut().push(account_id.to_string());
                Ok(())
            },
        )
        .expect_err("DB delete failure should be returned");

        assert!(matches!(
            error,
            AppError::UserVisible { message } if message == "db delete failed"
        ));
        assert_eq!(
            deleted_accounts.borrow().as_slice(),
            &[account.id.as_ref().to_string()]
        );
        assert!(deleted_passwords.borrow().is_empty());
    }

    #[test]
    fn delete_account_deletes_password_after_db_delete_success() {
        let account = fresh_rss_account();
        let deleted_accounts = RefCell::new(Vec::new());
        let deleted_passwords = RefCell::new(Vec::new());

        delete_account_then_password(
            &account.id,
            |account_id| {
                assert!(deleted_passwords.borrow().is_empty());
                deleted_accounts
                    .borrow_mut()
                    .push(account_id.as_ref().to_string());
                Ok(())
            },
            |account_id| {
                deleted_passwords.borrow_mut().push(account_id.to_string());
                Ok(())
            },
        )
        .expect("successful account delete should clean up the keyring entry");

        assert_eq!(
            deleted_accounts.borrow().as_slice(),
            &[account.id.as_ref().to_string()]
        );
        assert_eq!(
            deleted_passwords.borrow().as_slice(),
            &[account.id.as_ref().to_string()]
        );
    }

    #[test]
    fn delete_account_keeps_db_delete_when_password_delete_fails() {
        let account = fresh_rss_account();
        let deleted_accounts = RefCell::new(Vec::new());
        let deleted_passwords = RefCell::new(Vec::new());

        delete_account_then_password(
            &account.id,
            |account_id| {
                deleted_accounts
                    .borrow_mut()
                    .push(account_id.as_ref().to_string());
                Ok(())
            },
            |account_id| {
                deleted_passwords.borrow_mut().push(account_id.to_string());
                Err(AppError::UserVisible {
                    message: "keyring delete failed".to_string(),
                })
            },
        )
        .expect("keyring cleanup failure should not roll back DB account delete");

        assert_eq!(
            deleted_accounts.borrow().as_slice(),
            &[account.id.as_ref().to_string()]
        );
        assert_eq!(
            deleted_passwords.borrow().as_slice(),
            &[account.id.as_ref().to_string()]
        );
    }

    #[test]
    fn delete_account_command_rejects_while_sync_boundary_is_busy() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let syncing = AtomicBool::new(true);

        let error = delete_account_with_sync_boundary(
            &db,
            &syncing,
            AccountId("missing-account".to_string()),
            |_| Ok(()),
        )
        .expect_err("account delete should not run while sync boundary is busy");

        assert!(matches!(error, AppError::UserVisible { .. }));
        assert!(syncing.load(Ordering::SeqCst));
    }

    #[test]
    fn delete_account_command_releases_sync_boundary_after_delete() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let account_id = AccountId("account-delete-boundary".to_string());
        {
            let guard = db.lock().unwrap();
            guard
                .writer()
                .execute(
                    "INSERT INTO accounts (id, kind, name) VALUES (?1, 'Local', 'Local')",
                    [&account_id.0],
                )
                .unwrap();
        }
        let syncing = AtomicBool::new(false);

        delete_account_with_sync_boundary(&db, &syncing, account_id, |_| Ok(()))
            .expect("account delete should succeed");

        assert!(!syncing.load(Ordering::SeqCst));
    }

    #[test]
    fn account_delete_cleanup_contract_keeps_keyring_orphans_from_reappearing() {
        let contract = account_credential_cleanup_contract();

        assert_eq!(
            contract.steps,
            vec![
                AccountCredentialCleanupStep::DeleteDatabaseAccount,
                AccountCredentialCleanupStep::DeleteKeyringCredential,
            ]
        );
        assert_eq!(
            contract.keyring_delete_failure_policy,
            AccountCredentialCleanupFailurePolicy::WarnAfterDatabaseDelete
        );
        assert!(
            !contract.rename_deletes_keyring_credential,
            "account rename keeps the stable account id, so deleting the keyring entry would orphan the live account"
        );
    }

    #[test]
    fn quarantined_account_rows_have_diagnostics_and_recovery_actions() {
        let contract = invalid_account_row_recovery_contract();

        assert_eq!(contract.diagnostics_event, "account.row.quarantined");
        assert_eq!(
            contract.recovery_actions,
            vec![
                AccountRecoveryAction::DeleteAccount,
                AccountRecoveryAction::RecreateAccount,
                AccountRecoveryAction::ContactSupport,
            ]
        );
        assert!(contract.preserves_account_id);
        assert!(contract.exposes_displayable_row);
    }

    #[test]
    fn provider_account_scale_guidance_contract_is_advisory_smoke() {
        let contract = provider_account_scale_guidance_contract();

        assert_eq!(
            contract.surface,
            ProviderScaleGuidanceSurface::AccountSettingsAdvisory
        );
        assert_eq!(
            contract.max_feeds_guidance,
            "provider_specific_advisory_not_enforced"
        );
        assert_eq!(
            contract.max_articles_guidance,
            "provider_specific_advisory_not_enforced"
        );
        assert_eq!(
            contract.warning_threshold_guidance,
            "warn_from_observed_performance_not_fixed_protocol_limit"
        );
        assert_eq!(
            contract.performance_diagnostics,
            "record_account_kind_feed_count_article_count_and_sync_duration_class"
        );
        assert!(contract.no_hard_limit_copy);
    }

    #[test]
    fn account_create_update_do_not_request_provider_credential_verification() {
        let contract = provider_credential_verification_request_contract();

        assert!(!contract.create_requests_connection_test);
        assert!(!contract.update_requests_connection_test);
        assert_eq!(
            contract.explicit_verification_command,
            "test_account_connection"
        );
        assert_eq!(
            contract.mutation_status_after_create_or_update,
            ConnectionVerificationStatus::Unverified
        );
    }
}

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
        |account_id| keyring_store::get_password(account_id).map_err(AppError::from),
        |account_id, pw| keyring_store::set_password(account_id, pw).map_err(AppError::from),
        |account_id| keyring_store::delete_password(account_id).map_err(AppError::from),
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

    let server_url = validate_freshrss_server_url(&account)?;

    let username = account
        .username
        .as_deref()
        .ok_or_else(|| AppError::UserVisible {
            message: "Username is not configured".into(),
        })?;

    let password = keyring_store::get_password(id.as_ref())?;

    let mut provider = GReaderProvider::for_freshrss(server_url);

    if let Err(error) = provider
        .authenticate(&Credentials {
            token: Some(username.to_string()),
            password: Some(password),
        })
        .await
    {
        let error_message = error.to_string();
        let db = crate::commands::lock_db(&state.db)?;
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
    delete_account_with_sync_boundary(
        &state.db,
        state.syncing.as_ref(),
        AccountId(account_id),
        |account_id| keyring_store::delete_password(account_id).map_err(AppError::from),
    )
}
