use tauri::State;

use crate::commands::dto::{AccountDto, AppError};
use crate::commands::sync_providers::{GReaderSession, SessionError};
use crate::commands::AppState;
use crate::domain::account::{Account, ConnectionVerificationStatus};
use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::repository::account::AccountRepository;

mod access_credentials;
mod credentials;
use access_credentials::{
    persist_account_credentials, settings_access_metadata, OsAccountCredentialStore,
};
pub use access_credentials::{CloudflareAccessArg, CloudflareAccessMetadata};
mod validation;

pub(crate) use credentials::delete_account_with_sync_boundary;
#[cfg(test)]
pub(crate) use credentials::{
    delete_account_then_password, delete_account_with_sync_boundary_with_keyring,
    save_account_after_optional_password_with_keyring,
    update_account_credentials_after_optional_password_with_keyring,
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
    cloudflare_access: Option<CloudflareAccessArg>,
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
    persist_account_credentials(
        &account,
        password.as_deref(),
        &cloudflare_access.unwrap_or_default(),
        true,
        &OsAccountCredentialStore,
        || repo.save(&account).map_err(AppError::from),
    )?;

    Ok(AccountDto::from(account))
}

#[tauri::command]
pub fn get_account_cloudflare_access(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<CloudflareAccessMetadata, AppError> {
    let account = {
        let db = crate::commands::lock_db(&state.db)?;
        let repo = SqliteAccountRepository::new(db.reader());
        repo.find_by_id(&AccountId(account_id))?
            .ok_or_else(|| AppError::UserVisible {
                message: "Account not found".into(),
            })?
    };
    settings_access_metadata(&account, &OsAccountCredentialStore)
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
    cloudflare_access: Option<CloudflareAccessArg>,
) -> Result<AccountDto, AppError> {
    let id = AccountId(account_id);
    let _guard = crate::commands::start_database_maintenance(state.syncing.as_ref())?;

    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteAccountRepository::new(db.writer());
    let current_account = repo.find_by_id(&id)?.ok_or_else(|| AppError::UserVisible {
        message: "Account not found".into(),
    })?;
    let server_url = normalize_updated_account_server_url(&current_account, server_url.as_deref())?;
    let mut planned_account = current_account;
    planned_account.server_url = server_url.clone();
    planned_account.username = username.clone();
    let account = persist_account_credentials(
        &planned_account,
        password.as_deref(),
        &cloudflare_access.unwrap_or_default(),
        false,
        &OsAccountCredentialStore,
        || {
            let transaction = db
                .writer()
                .unchecked_transaction()
                .map_err(crate::domain::error::DomainError::from)?;
            let repo = SqliteAccountRepository::new(&transaction);
            repo.update_credentials(&id, server_url.as_deref(), username.as_deref())?;
            let account = repo.find_by_id(&id)?.ok_or_else(|| AppError::UserVisible {
                message: "Account not found".into(),
            })?;
            transaction
                .commit()
                .map_err(crate::domain::error::DomainError::from)?;
            Ok(account)
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

    let session = GReaderSession::establish_interactive(&account).await;
    let verification = verify_authenticated_freshrss_session(session).await;
    let verification = match verification {
        Err(error @ (SessionError::MissingUsername | SessionError::MissingServerUrl)) => {
            return Err(error.into_user_visible());
        }
        result => result,
    };
    #[cfg(target_os = "macos")]
    if verification.is_ok() {
        crate::commands::sync_commands::clear_credential_wait(&state.db, &id)?;
    }
    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqliteAccountRepository::new(db.writer());
    #[cfg(target_os = "macos")]
    if verification.is_err() {
        if let Err(error) = crate::infra::keyring_store::session_cache::invalidate(id.as_ref()) {
            tracing::warn!(%error, "Session credential lease could not be cleared after a failed connection test");
        }
    }
    persist_connection_verification_result(&repo, &id, verification)?;
    let updated = repo.find_by_id(&id)?.ok_or_else(|| AppError::UserVisible {
        message: "Account not found".into(),
    })?;

    Ok(AccountDto::from(updated))
}

async fn verify_authenticated_freshrss_session(
    session: Result<GReaderSession, SessionError>,
) -> Result<(), SessionError> {
    let session = session?;
    session
        .provider()
        .verify_api_access()
        .await
        .map_err(|error| SessionError::Auth(error.into()))
}

fn persist_connection_verification_result(
    repo: &impl AccountRepository,
    id: &AccountId,
    result: Result<(), SessionError>,
) -> Result<(), AppError> {
    match result {
        Ok(()) => {
            let verified_at = chrono::Utc::now().to_rfc3339();
            repo.update_connection_verification(
                id,
                ConnectionVerificationStatus::Verified,
                Some(&verified_at),
                None,
            )?;
            Ok(())
        }
        Err(SessionError::Auth(error)) => {
            let error_message = error.to_string();
            repo.update_connection_verification(
                id,
                ConnectionVerificationStatus::Error,
                None,
                Some(&error_message),
            )?;
            Err(error)
        }
        Err(error) => Err(error.into_user_visible()),
    }
}

#[tauri::command]
pub fn delete_account(state: State<'_, AppState>, account_id: String) -> Result<(), AppError> {
    delete_account_with_sync_boundary(&state.db, state.syncing.as_ref(), AccountId(account_id))
}

#[cfg(test)]
mod connection_probe_tests {
    use super::{persist_connection_verification_result, verify_authenticated_freshrss_session};
    use crate::commands::dto::AppError;
    use crate::commands::sync_providers::{GReaderSession, SessionError};
    use crate::domain::account::{Account, ConnectionVerificationStatus};
    use crate::domain::provider::ProviderKind;
    use crate::domain::types::AccountId;
    use crate::infra::db::connection::DbManager;
    use crate::infra::db::sqlite_account::SqliteAccountRepository;
    use crate::infra::provider::greader::GReaderProvider;
    use crate::infra::provider::traits::{Credentials, FeedProvider};
    use crate::repository::account::AccountRepository;

    fn account(server_url: &str, status: ConnectionVerificationStatus) -> Account {
        Account {
            id: AccountId("connection-probe-test".to_string()),
            kind: ProviderKind::FreshRss,
            name: "FreshRSS test".to_string(),
            server_url: Some(server_url.to_string()),
            username: Some("dummy-user".to_string()),
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: status,
            connection_verified_at: (status == ConnectionVerificationStatus::Verified)
                .then(|| "2026-10-08T00:00:00Z".to_string()),
            connection_verification_error: None,
        }
    }

    async fn establish_fake_session(account: &Account) -> Result<GReaderSession, SessionError> {
        let server_url = account
            .server_url
            .as_deref()
            .ok_or(SessionError::MissingServerUrl)?;
        let mut provider = GReaderProvider::try_for_freshrss(server_url)
            .map_err(|error| SessionError::Auth(error.into()))?;
        provider
            .authenticate(&Credentials {
                token: Some("dummy-user".to_string()),
                password: Some("dummy-password".to_string()),
            })
            .await
            .map_err(|error| SessionError::Auth(error.into()))?;
        Ok(GReaderSession::from_provider_for_tests(provider))
    }

    #[tokio::test]
    async fn protected_probe_failure_updates_error_and_clears_old_verified_badge() {
        let mut server = mockito::Server::new_async().await;
        let login = server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .match_body("Email=dummy-user&Passwd=dummy-password")
            .with_body("Auth=dummy-auth\n")
            .create_async()
            .await;
        let tag_list = server
            .mock("GET", "/api/greader.php/reader/api/0/tag/list")
            .match_query("output=json")
            .with_status(403)
            .with_body("dummy-auth sensitive response body")
            .create_async()
            .await;
        let account = account(&server.url(), ConnectionVerificationStatus::Verified);
        let db = DbManager::new_in_memory().expect("test database should initialize");
        let repo = SqliteAccountRepository::new(db.writer());
        repo.save(&account).expect("test account should save");

        let session = establish_fake_session(&account).await;
        let result = verify_authenticated_freshrss_session(session).await;
        let error = persist_connection_verification_result(&repo, &account.id, result)
            .expect_err("failed protected read must fail the Test verification flow");
        let updated = repo
            .find_by_id(&account.id)
            .expect("account query should succeed")
            .expect("account should remain persisted");

        assert!(matches!(error, AppError::UserVisible { .. }));
        assert!(error.to_string().contains("tag-list"));
        assert!(error.to_string().contains("HTTP 403"));
        assert!(!error.to_string().contains("dummy-auth"));
        assert!(!error.to_string().contains("sensitive response body"));
        assert_eq!(
            updated.connection_verification_status,
            ConnectionVerificationStatus::Error
        );
        assert_eq!(updated.connection_verified_at, None);
        assert_eq!(
            updated.connection_verification_error.as_deref(),
            Some("Auth error: tag-list HTTP 403 Forbidden")
        );
        login.assert_async().await;
        tag_list.assert_async().await;
    }

    #[tokio::test]
    async fn successful_protected_probe_is_the_result_persisted_as_verified() {
        let mut server = mockito::Server::new_async().await;
        let login = server
            .mock("POST", "/api/greader.php/accounts/ClientLogin")
            .match_body("Email=dummy-user&Passwd=dummy-password")
            .with_body("Auth=dummy-auth\n")
            .create_async()
            .await;
        let tag_list = server
            .mock("GET", "/api/greader.php/reader/api/0/tag/list")
            .match_query("output=json")
            .with_header("content-type", "application/json")
            .with_body(r#"{"tags":[]}"#)
            .create_async()
            .await;
        let account = account(&server.url(), ConnectionVerificationStatus::Unverified);
        let db = DbManager::new_in_memory().expect("test database should initialize");
        let repo = SqliteAccountRepository::new(db.writer());
        repo.save(&account).expect("test account should save");

        let session = establish_fake_session(&account).await;
        let result = verify_authenticated_freshrss_session(session).await;
        persist_connection_verification_result(&repo, &account.id, result)
            .expect("successful protected read should persist verification");
        let updated = repo
            .find_by_id(&account.id)
            .expect("account query should succeed")
            .expect("account should remain persisted");

        assert_eq!(
            updated.connection_verification_status,
            ConnectionVerificationStatus::Verified
        );
        assert!(updated.connection_verified_at.is_some());
        assert_eq!(updated.connection_verification_error, None);
        login.assert_async().await;
        tag_list.assert_async().await;
    }
}
