use super::*;
use crate::commands::sync_commands::account_sync::sync_greader_account_and_confirm_connection;
use crate::commands::sync_providers::GReaderSession;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::provider::greader::GReaderProvider;
use crate::infra::provider::traits::{Credentials, FeedProvider};
use crate::repository::account::AccountRepository;

const API: &str = "/api/greader.php";

fn errored_account(server_url: &str) -> Account {
    Account {
        server_url: Some(server_url.to_string()),
        connection_verification_status: ConnectionVerificationStatus::Error,
        connection_verification_error: Some("dummy earlier connection failure".to_string()),
        ..test_sync_command_account("sync-confirms-connection", ProviderKind::FreshRss, false)
    }
}

fn store_account(db: &Mutex<DbManager>, account: &Account) {
    let db_guard = db.lock().expect("test db lock should not be poisoned");
    SqliteAccountRepository::new(db_guard.writer())
        .save(account)
        .expect("account fixture should be saved");
}

fn stored_account(db: &Mutex<DbManager>, account: &Account) -> Account {
    let db_guard = db.lock().expect("test db lock should not be poisoned");
    SqliteAccountRepository::new(db_guard.reader())
        .find_by_id(&account.id)
        .expect("stored account should be readable")
        .expect("account fixture should still exist")
}

async fn login(server: &mut mockito::ServerGuard) -> GReaderSession {
    server
        .mock("POST", format!("{API}/accounts/ClientLogin").as_str())
        .with_body("Auth=dummy-auth\n")
        .create_async()
        .await;
    let mut provider = GReaderProvider::for_freshrss(&server.url());
    provider
        .authenticate(&Credentials {
            token: Some("user".to_string()),
            password: Some("dummy-password".to_string()),
        })
        .await
        .expect("mock login should authenticate");
    GReaderSession::from_provider_for_tests(provider)
}

async fn mock_empty_account(server: &mut mockito::ServerGuard) {
    for (path, body) in [
        ("reader/api/0/tag/list", r#"{"tags":[]}"#),
        ("reader/api/0/subscription/list", r#"{"subscriptions":[]}"#),
        (
            "reader/api/0/stream/contents/user%2F-%2Fstate%2Fcom.google%2Freading-list",
            r#"{"items":[]}"#,
        ),
        ("reader/api/0/stream/items/ids", r#"{"itemRefs":[]}"#),
        ("reader/api/0/unread-count", r#"{"unreadcounts":[]}"#),
    ] {
        server
            .mock("GET", format!("{API}/{path}").as_str())
            .match_query(mockito::Matcher::Any)
            .with_body(body)
            .create_async()
            .await;
    }
}

#[tokio::test]
async fn successful_freshrss_sync_promotes_an_errored_connection_to_verified() {
    let mut server = Server::new_async().await;
    let session = login(&mut server).await;
    mock_empty_account(&mut server).await;
    let db = Mutex::new(DbManager::new_in_memory().expect("in-memory db should open"));
    let account = errored_account(&server.url());
    store_account(&db, &account);

    sync_greader_account_and_confirm_connection(&db, &account, &session)
        .await
        .expect("sync against the mock server should succeed");

    let stored = stored_account(&db, &account);
    assert_eq!(
        stored.connection_verification_status,
        ConnectionVerificationStatus::Verified
    );
    assert_eq!(stored.connection_verification_error, None);
    assert!(stored.connection_verified_at.is_some());
}

#[tokio::test]
async fn successful_freshrss_sync_verifies_an_unverified_connection() {
    let mut server = Server::new_async().await;
    let session = login(&mut server).await;
    mock_empty_account(&mut server).await;
    let db = Mutex::new(DbManager::new_in_memory().expect("in-memory db should open"));
    let account = Account {
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verification_error: None,
        ..errored_account(&server.url())
    };
    store_account(&db, &account);

    sync_greader_account_and_confirm_connection(&db, &account, &session)
        .await
        .expect("sync against the mock server should succeed");

    let stored = stored_account(&db, &account);
    assert_eq!(
        stored.connection_verification_status,
        ConnectionVerificationStatus::Verified
    );
    assert!(stored.connection_verified_at.is_some());
}

#[tokio::test]
async fn successful_freshrss_sync_keeps_the_timestamp_of_an_already_verified_connection() {
    let mut server = Server::new_async().await;
    let session = login(&mut server).await;
    mock_empty_account(&mut server).await;
    let db = Mutex::new(DbManager::new_in_memory().expect("in-memory db should open"));
    let verified_at = "2026-01-02T03:04:05+00:00";
    let account = Account {
        connection_verification_status: ConnectionVerificationStatus::Verified,
        connection_verified_at: Some(verified_at.to_string()),
        connection_verification_error: None,
        ..errored_account(&server.url())
    };
    store_account(&db, &account);

    sync_greader_account_and_confirm_connection(&db, &account, &session)
        .await
        .expect("sync against the mock server should succeed");

    let stored = stored_account(&db, &account);
    assert_eq!(
        stored.connection_verification_status,
        ConnectionVerificationStatus::Verified
    );
    assert_eq!(stored.connection_verified_at.as_deref(), Some(verified_at));
}

#[tokio::test]
async fn failed_freshrss_sync_leaves_an_errored_connection_unchanged() {
    let mut server = Server::new_async().await;
    let session = login(&mut server).await;
    server
        .mock("GET", mockito::Matcher::Any)
        .with_status(403)
        .create_async()
        .await;
    let db = Mutex::new(DbManager::new_in_memory().expect("in-memory db should open"));
    let account = errored_account(&server.url());
    store_account(&db, &account);

    sync_greader_account_and_confirm_connection(&db, &account, &session)
        .await
        .expect_err("sync against an auth-rejecting server should fail");

    let stored = stored_account(&db, &account);
    assert_eq!(
        stored.connection_verification_status,
        ConnectionVerificationStatus::Error
    );
    assert_eq!(
        stored.connection_verification_error.as_deref(),
        Some("dummy earlier connection failure")
    );
    assert_eq!(stored.connection_verified_at, None);
}
