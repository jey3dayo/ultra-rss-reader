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

fn is_private_freshrss_ipv4(ip: std::net::Ipv4Addr) -> bool {
    ip.is_private()
        || ip.is_loopback()
        || ip.is_link_local()
        || ip.is_broadcast()
        || ip.is_documentation()
        || ip.is_unspecified()
}

fn is_private_freshrss_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => is_private_freshrss_ipv4(ip),
        IpAddr::V6(ip) => {
            // IPv4-mapped IPv6 (::ffff:a.b.c.d) must be evaluated against the
            // same V4 policy as a bare IPv4 host, otherwise addresses like
            // ::ffff:127.0.0.1 or ::ffff:169.254.169.254 bypass the private-host
            // check that a plain IPv4 literal would fail.
            if let Some(v4) = ip.to_ipv4_mapped() {
                return is_private_freshrss_ipv4(v4);
            }

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
