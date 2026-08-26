use async_trait::async_trait;
use rusqlite::params;
use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Barrier, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use super::{
    add_local_feed_with_db, add_local_feed_with_provider, classify_update_feed_folder_error,
    create_folder_in_db, delete_feed_in_db, delete_feed_with_provider_sync_boundary,
    delete_feed_with_remote_sync_boundary, delete_feed_with_sync_boundary, lock_db,
    recalculate_feed_unread_count_in_db, rename_feed_in_db, rename_feed_with_remote_sync_boundary,
    update_feed_display_settings_in_db, update_feed_folder_in_db,
    update_feed_folder_with_remote_sync_boundary, validate_add_freshrss_feed_preflight_in_db,
    validate_add_freshrss_subscription_unique_in_db, validate_add_local_feed_account_in_db,
    validate_add_local_feed_duplicate_url_in_db, UPDATE_FEED_FOLDER_TARGET_VALIDATION_MESSAGE,
};
use crate::commands::dto::AppError;
use crate::domain::account::{Account, ConnectionVerificationStatus};
use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::{
    FeedIdentifier, Mutation, ProviderCapabilities, ProviderKind, PullResult, PullScope,
    RemoteFolder, RemoteState, RemoteSubscription, SyncCursor,
};
use crate::domain::types::{AccountId, FeedId, FolderId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_folder::SqliteFolderRepository;
use crate::infra::keyring_store;
use crate::infra::provider::local::LocalProvider;
use crate::infra::provider::traits::{Credentials, FeedProvider};
use crate::repository::account::AccountRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::folder::FolderRepository;
use mockito::Matcher;

const SAMPLE_RSS: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
 <rss version="2.0">
   <channel>
     <title>Local Feed</title>
     <item>
       <title>Local Article</title>
       <link>https://example.com/1</link>
       <guid>local-guid-1</guid>
     </item>
   </channel>
 </rss>"#;
static DEV_CREDENTIALS_ENV_LOCK: std::sync::LazyLock<tokio::sync::Mutex<()>> =
    std::sync::LazyLock::new(|| tokio::sync::Mutex::new(()));

struct DevCredentialsContext {
    _guard: tokio::sync::MutexGuard<'static, ()>,
    _dir: tempfile::TempDir,
    previous_home: Option<String>,
}

impl Drop for DevCredentialsContext {
    fn drop(&mut self) {
        std::env::remove_var("DEV_CREDENTIALS");
        std::env::remove_var("XDG_DATA_HOME");
        match self.previous_home.as_ref() {
            Some(home) => std::env::set_var("HOME", home),
            None => std::env::remove_var("HOME"),
        }
    }
}

fn test_db() -> DbManager {
    DbManager::new_in_memory().unwrap()
}

fn insert_test_account_with_kind(db: &DbManager, name: &str, kind: &str) -> AccountId {
    let id = AccountId::new();
    db.writer()
        .execute(
            "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
            params![id.0, kind, name],
        )
        .unwrap();
    id
}

fn insert_test_account(db: &DbManager, name: &str) -> AccountId {
    insert_test_account_with_kind(db, name, "Local")
}

fn insert_freshrss_account(db: &DbManager, server_url: &str) -> AccountId {
    let account = Account {
        id: AccountId::new(),
        kind: ProviderKind::FreshRss,
        name: "FreshRSS".to_string(),
        server_url: Some(server_url.to_string()),
        username: Some("u".to_string()),
        sync_interval_secs: 900,
        sync_on_startup: false,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Verified,
        connection_verified_at: None,
        connection_verification_error: None,
    };
    let id = account.id.clone();
    SqliteAccountRepository::new(db.writer())
        .save(&account)
        .unwrap();
    id
}

async fn configure_dev_credentials(account_id: &AccountId) -> DevCredentialsContext {
    let guard = DEV_CREDENTIALS_ENV_LOCK.lock().await;
    let previous_home = std::env::var("HOME").ok();
    std::env::set_var("DEV_CREDENTIALS", "1");
    let credentials_dir = tempfile::tempdir().unwrap();
    std::env::set_var("XDG_DATA_HOME", credentials_dir.path());
    std::env::set_var("HOME", credentials_dir.path());
    std::fs::create_dir_all(credentials_dir.path().join("ultra-rss-reader")).unwrap();
    std::fs::write(
        credentials_dir
            .path()
            .join("ultra-rss-reader")
            .join("dev-credentials.json"),
        "{}",
    )
    .unwrap();
    keyring_store::set_password(account_id.as_ref(), "p").unwrap();
    DevCredentialsContext {
        _guard: guard,
        _dir: credentials_dir,
        previous_home,
    }
}

fn insert_test_feed(db: &DbManager, account_id: &AccountId) -> FeedId {
    let id = FeedId::new();
    db.writer()
        .execute(
            "INSERT INTO feeds (id, account_id, title, url) VALUES (?1, ?2, ?3, ?4)",
            params![id.0, account_id.0, "Feed", "http://example.com/rss"],
        )
        .unwrap();
    id
}

fn insert_remote_test_feed(db: &DbManager, account_id: &AccountId, remote_id: &str) -> FeedId {
    let id = FeedId::new();
    db.writer()
        .execute(
            "INSERT INTO feeds (id, account_id, remote_id, title, url) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                id.0,
                account_id.0,
                remote_id,
                "Feed",
                "http://example.com/rss"
            ],
        )
        .unwrap();
    id
}

struct RecordingDeleteProvider {
    deleted_ids: Mutex<Vec<FeedIdentifier>>,
    subscriptions: Vec<RemoteSubscription>,
}

#[async_trait]
impl FeedProvider for RecordingDeleteProvider {
    fn kind(&self) -> ProviderKind {
        ProviderKind::FreshRss
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderKind::FreshRss.capabilities()
    }

    async fn authenticate(&mut self, _credentials: &Credentials) -> DomainResult<()> {
        Ok(())
    }

    async fn get_subscriptions(&self) -> DomainResult<Vec<RemoteSubscription>> {
        Ok(self.subscriptions.clone())
    }

    async fn get_folders(&self) -> DomainResult<Vec<RemoteFolder>> {
        Ok(Vec::new())
    }

    async fn pull_entries(
        &self,
        _scope: PullScope,
        _cursor: Option<SyncCursor>,
    ) -> DomainResult<PullResult> {
        Err(DomainError::Validation(
            "test provider does not pull entries".to_string(),
        ))
    }

    async fn pull_state(&self) -> DomainResult<RemoteState> {
        Ok(RemoteState::default())
    }

    async fn push_mutations(&self, _mutations: &[Mutation]) -> DomainResult<()> {
        Ok(())
    }

    async fn create_subscription(
        &self,
        _url: &str,
        _folder: Option<&str>,
    ) -> DomainResult<RemoteSubscription> {
        Err(DomainError::Validation(
            "test provider does not create subscriptions".to_string(),
        ))
    }

    async fn delete_subscription(&self, id: &FeedIdentifier) -> DomainResult<()> {
        self.deleted_ids.lock().unwrap().push(id.clone());
        Ok(())
    }

    async fn edit_subscription(
        &self,
        _remote_id: &str,
        _title: Option<&str>,
        _add_folder_label: Option<&str>,
        _remove_folder_label: Option<&str>,
    ) -> DomainResult<()> {
        Ok(())
    }
}

#[test]
fn update_feed_folder_command_rejects_folder_from_another_account() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    let other_account_id = insert_test_account(&db, "Other");
    let feed_id = insert_test_feed(&db, &account_id);
    let other_folder_id = FolderId::new();

    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![other_folder_id.0, other_account_id.0, "Other", 0],
        )
        .unwrap();

    let error = update_feed_folder_in_db(&db, feed_id.0.clone(), Some(other_folder_id.0))
        .expect_err("folder from another account should be returned as command error");

    let saved_folder_id: Option<String> = db
        .reader()
        .query_row(
            "SELECT folder_id FROM feeds WHERE id = ?1",
            params![feed_id.0],
            |row| row.get(0),
        )
        .unwrap();

    assert!(saved_folder_id.is_none());
    assert!(matches!(
        error,
        AppError::UserVisible { message }
            if message == "Folder belongs to another account"
    ));
}

#[test]
fn add_freshrss_feed_preflight_rejects_duplicate_before_remote_create() {
    let db = test_db();
    let account_id = insert_test_account_with_kind(&db, "FreshRSS", "FreshRss");
    insert_test_feed(&db, &account_id);

    let error =
        validate_add_freshrss_feed_preflight_in_db(&db, &account_id, "http://example.com/rss")
            .expect_err("duplicate FreshRSS feed should be rejected before remote create");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Feed URL is already subscribed"
    ));
}

#[test]
fn add_freshrss_feed_rejects_returned_remote_id_duplicate_before_local_save() {
    let db = test_db();
    let account_id = insert_test_account_with_kind(&db, "FreshRSS", "FreshRss");
    insert_remote_test_feed(&db, &account_id, "feed/remote-existing");

    let error = validate_add_freshrss_subscription_unique_in_db(
        &db,
        &account_id,
        "http://example.com/new-rss",
        "feed/remote-existing",
    )
    .expect_err("duplicate returned FreshRSS remote id should be rejected before local save");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Feed URL is already subscribed"
    ));

    let feed_count: i64 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM feeds", [], |row| row.get(0))
        .unwrap();
    assert_eq!(feed_count, 1);
}

#[tokio::test]
async fn add_freshrss_feed_keeps_local_feed_when_initial_sync_fails() {
    let mut server = mockito::Server::new_async().await;
    let auth_mock = server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .expect(1)
        .create_async()
        .await;
    server
        .mock(
            "POST",
            "/api/greader.php/reader/api/0/subscription/quickadd",
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                 "streamId": "feed/https://example.com/rss",
                 "query": "Example Feed"
             }"#,
        )
        .create_async()
        .await;
    server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/subscription/list?output=json",
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                 "subscriptions": [
                     {
                         "id": "feed/https://example.com/rss",
                         "title": "Example Feed",
                         "url": "https://example.com/rss",
                         "htmlUrl": "https://example.com",
                         "iconUrl": "https://example.com/icon.png"
                     }
                 ]
             }"#,
        )
        .create_async()
        .await;
    server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/stream/contents/feed%2Fhttps%3A%2F%2Fexample.com%2Frss",
        )
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("n".into(), "200".into()),
            Matcher::UrlEncoded("xt".into(), "user/-/state/com.google/read".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(500)
        .create_async()
        .await;

    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_freshrss_account(&guard, &server.url())
    };
    let _credentials = configure_dev_credentials(&account_id).await;

    let added_feed = add_local_feed_with_db(
        &db,
        account_id.0.clone(),
        "https://example.com/rss".to_string(),
    )
    .await
    .expect("initial article sync failure should not roll back a remote-created subscription");

    assert_eq!(
        added_feed.remote_id.as_deref(),
        Some("feed/https://example.com/rss")
    );
    assert_eq!(
        added_feed.icon_url.as_deref(),
        Some("https://example.com/icon.png")
    );
    auth_mock.assert_async().await;
    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    let persisted_feed = feed_repo
        .find_by_remote_id(&account_id, "feed/https://example.com/rss")
        .unwrap();
    assert!(persisted_feed.is_some());
}

#[test]
fn delete_feed_command_rejects_missing_feed() {
    let db = test_db();

    let error = delete_feed_in_db(&db, "missing-feed".to_string())
        .expect_err("missing feed delete should be returned as command error");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Validation error: feed not found"
    ));
}

#[test]
fn delete_feed_command_rejects_while_sync_boundary_is_busy() {
    let db = Mutex::new(test_db());
    let syncing = AtomicBool::new(true);

    let error = delete_feed_with_sync_boundary(&db, &syncing, "missing-feed".to_string())
        .expect_err("feed delete should not run while sync boundary is busy");

    assert!(matches!(error, AppError::UserVisible { .. }));
    assert!(syncing.load(Ordering::SeqCst));
}

#[test]
fn delete_feed_command_releases_sync_boundary_after_delete() {
    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_test_account(&guard, "Primary")
    };
    let feed_id = {
        let guard = db.lock().unwrap();
        insert_test_feed(&guard, &account_id)
    };
    let syncing = AtomicBool::new(false);

    delete_feed_with_sync_boundary(&db, &syncing, feed_id.0).expect("feed delete should succeed");

    assert!(!syncing.load(Ordering::SeqCst));
}

#[tokio::test]
async fn delete_feed_command_unsubscribes_remote_feed_before_local_delete() {
    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_test_account_with_kind(&guard, "Primary", "FreshRss")
    };
    let feed_id = {
        let guard = db.lock().unwrap();
        insert_remote_test_feed(&guard, &account_id, "feed/http://example.com/rss")
    };
    let syncing = AtomicBool::new(false);
    let provider = RecordingDeleteProvider {
        deleted_ids: Mutex::new(Vec::new()),
        subscriptions: Vec::new(),
    };

    delete_feed_with_provider_sync_boundary(&db, &syncing, feed_id.0.clone(), &provider)
        .await
        .expect("remote feed delete should succeed");

    let deleted_ids = provider.deleted_ids.lock().unwrap();
    assert_eq!(deleted_ids.len(), 1);
    assert!(matches!(
        &deleted_ids[0],
        FeedIdentifier::Remote { remote_id }
            if remote_id == "feed/http://example.com/rss"
    ));
    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    assert!(feed_repo.find_by_id(&feed_id).unwrap().is_none());
}

#[tokio::test]
async fn delete_feed_command_resolves_missing_remote_id_before_local_delete() {
    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_test_account_with_kind(&guard, "Primary", "FreshRss")
    };
    let feed_id = {
        let guard = db.lock().unwrap();
        insert_test_feed(&guard, &account_id)
    };
    let syncing = AtomicBool::new(false);
    let provider = RecordingDeleteProvider {
        deleted_ids: Mutex::new(Vec::new()),
        subscriptions: vec![RemoteSubscription {
            remote_id: "feed/http://example.com/rss".to_string(),
            title: "Feed".to_string(),
            url: "http://example.com/rss".to_string(),
            site_url: "http://example.com".to_string(),
            folder_remote_id: None,
            icon_url: None,
        }],
    };

    delete_feed_with_provider_sync_boundary(&db, &syncing, feed_id.0.clone(), &provider)
        .await
        .expect("remote id should be resolved before delete");

    let deleted_ids = provider.deleted_ids.lock().unwrap();
    assert_eq!(deleted_ids.len(), 1);
    assert!(matches!(
        &deleted_ids[0],
        FeedIdentifier::Remote { remote_id }
            if remote_id == "feed/http://example.com/rss"
    ));
    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    assert!(feed_repo.find_by_id(&feed_id).unwrap().is_none());
}

#[tokio::test]
async fn delete_feed_command_resolves_missing_remote_id_in_freshrss_path() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;
    server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/subscription/list?output=json",
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                 "subscriptions": [
                     {
                         "id": "feed/http://example.com/rss",
                         "title": "Feed",
                         "url": "http://example.com/rss",
                         "htmlUrl": "http://example.com"
                     }
                 ]
             }"#,
        )
        .create_async()
        .await;
    let unsubscribe_mock = server
        .mock("POST", "/api/greader.php/reader/api/0/subscription/edit")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .match_body(Matcher::AllOf(vec![
            Matcher::Regex("(^|&)ac=unsubscribe(&|$)".to_string()),
            Matcher::Regex("(^|&)s=feed%2Fhttp%3A%2F%2Fexample.com%2Frss(&|$)".to_string()),
        ]))
        .with_status(200)
        .create_async()
        .await;

    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_freshrss_account(&guard, &server.url())
    };
    let feed_id = {
        let guard = db.lock().unwrap();
        insert_test_feed(&guard, &account_id)
    };
    let _credentials = configure_dev_credentials(&account_id).await;
    let syncing = AtomicBool::new(false);

    delete_feed_with_remote_sync_boundary(&db, &syncing, feed_id.0.clone())
        .await
        .expect("FreshRSS delete should resolve missing remote id before local delete");

    unsubscribe_mock.assert_async().await;
    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    assert!(feed_repo.find_by_id(&feed_id).unwrap().is_none());
}

#[test]
fn rename_feed_command_rejects_missing_feed() {
    let db = test_db();

    let error = rename_feed_in_db(&db, "missing-feed".to_string(), "Renamed Feed".to_string())
        .expect_err("missing feed rename should be returned as command error");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Validation error: feed not found"
    ));
}

#[tokio::test]
async fn rename_feed_command_rejects_while_sync_boundary_is_busy() {
    let db = Mutex::new(test_db());
    let syncing = AtomicBool::new(true);

    let error = rename_feed_with_remote_sync_boundary(
        &db,
        &syncing,
        "missing-feed".to_string(),
        "Renamed Feed".to_string(),
    )
    .await
    .expect_err("feed rename should not run while sync boundary is busy");

    assert!(matches!(error, AppError::UserVisible { .. }));
    assert!(syncing.load(Ordering::SeqCst));
}

#[tokio::test]
async fn rename_feed_command_pushes_title_to_freshrss_before_local_write() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;
    let edit_mock = server
        .mock("POST", "/api/greader.php/reader/api/0/subscription/edit")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .match_body(mockito::Matcher::AllOf(vec![
            mockito::Matcher::Regex("(^|&)ac=edit(&|$)".to_string()),
            mockito::Matcher::Regex(
                "(^|&)s=feed%2Fhttp%3A%2F%2Fexample.com%2Frss(&|$)".to_string(),
            ),
            mockito::Matcher::Regex("(^|&)t=Renamed%20Feed(&|$)".to_string()),
        ]))
        .with_status(200)
        .create_async()
        .await;

    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_freshrss_account(&guard, &server.url())
    };
    let feed_id = {
        let guard = db.lock().unwrap();
        insert_remote_test_feed(&guard, &account_id, "feed/http://example.com/rss")
    };
    let _credentials = configure_dev_credentials(&account_id).await;
    let syncing = AtomicBool::new(false);

    rename_feed_with_remote_sync_boundary(
        &db,
        &syncing,
        feed_id.0.clone(),
        "Renamed Feed".to_string(),
    )
    .await
    .expect("FreshRSS rename should push the new title before the local write");

    edit_mock.assert_async().await;
    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    let feed = feed_repo.find_by_id(&feed_id).unwrap().unwrap();
    assert_eq!(feed.title, "Renamed Feed");
}

#[tokio::test]
async fn rename_feed_command_keeps_local_title_when_remote_push_fails() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;
    server
        .mock("POST", "/api/greader.php/reader/api/0/subscription/edit")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(500)
        .create_async()
        .await;

    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_freshrss_account(&guard, &server.url())
    };
    let feed_id = {
        let guard = db.lock().unwrap();
        insert_remote_test_feed(&guard, &account_id, "feed/http://example.com/rss")
    };
    let _credentials = configure_dev_credentials(&account_id).await;
    let syncing = AtomicBool::new(false);

    let error = rename_feed_with_remote_sync_boundary(
        &db,
        &syncing,
        feed_id.0.clone(),
        "Renamed Feed".to_string(),
    )
    .await
    .expect_err("a failed remote push should not update the local title");

    assert!(!matches!(error, AppError::UserVisible { message } if message == "Renamed Feed"));
    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    let feed = feed_repo.find_by_id(&feed_id).unwrap().unwrap();
    assert_eq!(feed.title, "Feed");
}

#[tokio::test]
async fn rename_feed_command_skips_remote_push_for_local_account() {
    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_test_account(&guard, "Primary")
    };
    let feed_id = {
        let guard = db.lock().unwrap();
        insert_test_feed(&guard, &account_id)
    };

    let syncing = AtomicBool::new(false);
    rename_feed_with_remote_sync_boundary(
        &db,
        &syncing,
        feed_id.0.clone(),
        "Renamed Feed".to_string(),
    )
    .await
    .expect("local account rename should not require a remote provider");

    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    let feed = feed_repo.find_by_id(&feed_id).unwrap().unwrap();
    assert_eq!(feed.title, "Renamed Feed");
}

#[test]
fn update_feed_folder_command_rejects_missing_feed() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    let folder_id = FolderId::new();
    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![folder_id.0, account_id.0, "Folder", 0],
        )
        .unwrap();

    let error = update_feed_folder_in_db(&db, "missing-feed".to_string(), Some(folder_id.0))
        .expect_err("missing feed folder mutation should be returned as command error");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Feed not found"
    ));
}

#[tokio::test]
async fn update_feed_folder_command_rejects_while_sync_boundary_is_busy() {
    let db = Mutex::new(test_db());
    let syncing = AtomicBool::new(true);

    let error = update_feed_folder_with_remote_sync_boundary(
        &db,
        &syncing,
        "missing-feed".to_string(),
        None,
    )
    .await
    .expect_err("feed folder move should not run while sync boundary is busy");

    assert!(matches!(error, AppError::UserVisible { .. }));
    assert!(syncing.load(Ordering::SeqCst));
}

#[test]
fn update_feed_folder_command_rejects_missing_folder() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    let feed_id = insert_test_feed(&db, &account_id);

    let error = update_feed_folder_in_db(&db, feed_id.0, Some("missing-folder".to_string()))
        .expect_err("missing folder mutation should be returned as command error");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Folder not found"
    ));
}

#[test]
fn update_feed_folder_command_classifies_concurrent_folder_delete() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    let feed_id = insert_test_feed(&db, &account_id);
    let folder_id = FolderId::new();
    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![folder_id.0, account_id.0, "Folder", 0],
        )
        .unwrap();
    db.writer()
        .execute("DELETE FROM folders WHERE id = ?1", params![folder_id.0])
        .unwrap();

    let error = classify_update_feed_folder_error(
        db.writer(),
        &feed_id.0,
        Some(&folder_id.0),
        DomainError::Validation(UPDATE_FEED_FOLDER_TARGET_VALIDATION_MESSAGE.to_string()),
    );

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Folder not found"
    ));
}

#[test]
fn update_feed_folder_command_rejects_folder_account_mismatch() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    let other_account_id = insert_test_account(&db, "Other");
    let feed_id = insert_test_feed(&db, &account_id);
    let other_folder_id = FolderId::new();
    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![other_folder_id.0, other_account_id.0, "Other", 0],
        )
        .unwrap();

    let error = update_feed_folder_in_db(&db, feed_id.0, Some(other_folder_id.0))
        .expect_err("folder account mismatch should be returned as command error");

    assert!(matches!(
        error,
        AppError::UserVisible { message }
            if message == "Folder belongs to another account"
    ));
}

#[tokio::test]
async fn update_feed_folder_command_pushes_folder_move_to_freshrss_before_local_write() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;
    let edit_mock = server
        .mock("POST", "/api/greader.php/reader/api/0/subscription/edit")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .match_body(mockito::Matcher::AllOf(vec![
            mockito::Matcher::Regex("(^|&)ac=edit(&|$)".to_string()),
            mockito::Matcher::Regex(
                "(^|&)s=feed%2Fhttp%3A%2F%2Fexample.com%2Frss(&|$)".to_string(),
            ),
            mockito::Matcher::Regex("(^|&)a=user%2F-%2Flabel%2FNew(&|$)".to_string()),
            mockito::Matcher::Regex("(^|&)r=user%2F-%2Flabel%2FOld(&|$)".to_string()),
        ]))
        .with_status(200)
        .create_async()
        .await;

    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_freshrss_account(&guard, &server.url())
    };
    let feed_id = {
        let guard = db.lock().unwrap();
        insert_remote_test_feed(&guard, &account_id, "feed/http://example.com/rss")
    };
    let old_folder_id = FolderId::new();
    let new_folder_id = FolderId::new();
    {
        let guard = db.lock().unwrap();
        guard
            .writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params![old_folder_id.0, account_id.0, "Old", 0],
            )
            .unwrap();
        guard
            .writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params![new_folder_id.0, account_id.0, "New", 1],
            )
            .unwrap();
        guard
            .writer()
            .execute(
                "UPDATE feeds SET folder_id = ?1 WHERE id = ?2",
                params![old_folder_id.0, feed_id.0],
            )
            .unwrap();
    }
    let _credentials = configure_dev_credentials(&account_id).await;
    let syncing = AtomicBool::new(false);

    update_feed_folder_with_remote_sync_boundary(
        &db,
        &syncing,
        feed_id.0.clone(),
        Some(new_folder_id.0.clone()),
    )
    .await
    .expect("FreshRSS folder move should push the label change before the local write");

    edit_mock.assert_async().await;
    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    let feed = feed_repo.find_by_id(&feed_id).unwrap().unwrap();
    assert_eq!(feed.folder_id, Some(new_folder_id));
}

#[tokio::test]
async fn update_feed_folder_command_keeps_local_folder_when_remote_push_fails() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;
    server
        .mock("POST", "/api/greader.php/reader/api/0/subscription/edit")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(500)
        .create_async()
        .await;

    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_freshrss_account(&guard, &server.url())
    };
    let feed_id = {
        let guard = db.lock().unwrap();
        insert_remote_test_feed(&guard, &account_id, "feed/http://example.com/rss")
    };
    let new_folder_id = FolderId::new();
    {
        let guard = db.lock().unwrap();
        guard
            .writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params![new_folder_id.0, account_id.0, "New", 0],
            )
            .unwrap();
    }
    let _credentials = configure_dev_credentials(&account_id).await;
    let syncing = AtomicBool::new(false);

    update_feed_folder_with_remote_sync_boundary(
        &db,
        &syncing,
        feed_id.0.clone(),
        Some(new_folder_id.0.clone()),
    )
    .await
    .expect_err("a failed remote push should not update the local folder assignment");

    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    let feed = feed_repo.find_by_id(&feed_id).unwrap().unwrap();
    assert_eq!(feed.folder_id, None);
}

#[tokio::test]
async fn update_feed_folder_command_skips_remote_push_for_local_account() {
    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_test_account(&guard, "Primary")
    };
    let feed_id = {
        let guard = db.lock().unwrap();
        insert_test_feed(&guard, &account_id)
    };
    let folder_id = FolderId::new();
    {
        let guard = db.lock().unwrap();
        guard
            .writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params![folder_id.0, account_id.0, "Folder", 0],
            )
            .unwrap();
    }

    let syncing = AtomicBool::new(false);
    update_feed_folder_with_remote_sync_boundary(
        &db,
        &syncing,
        feed_id.0.clone(),
        Some(folder_id.0.clone()),
    )
    .await
    .expect("local account folder move should not require a remote provider");

    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    let feed = feed_repo.find_by_id(&feed_id).unwrap().unwrap();
    assert_eq!(feed.folder_id, Some(folder_id));
}

#[test]
fn update_feed_display_settings_command_rejects_missing_feed() {
    let db = test_db();

    let error = update_feed_display_settings_in_db(
        &db,
        "missing-feed".to_string(),
        "on".to_string(),
        "off".to_string(),
    )
    .expect_err("missing feed display settings mutation should be returned as command error");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Validation error: feed not found"
    ));
}

#[test]
fn create_folder_rejects_missing_account_before_saving() {
    let db = test_db();

    let error = create_folder_in_db(&db, "missing".to_string(), "Inbox".to_string())
        .expect_err("missing account should be rejected before folder save");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Account not found"
    ));

    let folder_count: i64 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM folders", [], |row| row.get(0))
        .unwrap();
    assert_eq!(folder_count, 0);
}

#[test]
fn create_folder_compacts_existing_order_before_allocating_next_order() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");

    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params!["existing-low", account_id.0, "Low", 0],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params!["existing-high", account_id.0, "High", 7],
        )
        .unwrap();

    let first = create_folder_in_db(&db, account_id.0.clone(), "First".to_string()).unwrap();
    let second = create_folder_in_db(&db, account_id.0.clone(), "Second".to_string()).unwrap();

    assert_eq!(first.sort_order, 2);
    assert_eq!(second.sort_order, 3);

    let orders = db
        .reader()
        .prepare(
            "SELECT sort_order
              FROM folders
              WHERE account_id = ?1
              ORDER BY sort_order",
        )
        .unwrap()
        .query_map(params![account_id.0.clone()], |row| row.get::<_, i32>(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    assert_eq!(orders, vec![0, 1, 2, 3]);

    let duplicate_order_count: i64 = db
        .reader()
        .query_row(
            "SELECT COUNT(*)
              FROM (
                SELECT sort_order
                FROM folders
                WHERE account_id = ?1
                GROUP BY sort_order
                HAVING COUNT(*) > 1
              )",
            params![account_id.0],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(duplicate_order_count, 0);
}

#[test]
fn create_folder_allows_local_only_name_when_remote_folder_has_same_name() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, remote_id, name, sort_order)
              VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                "remote-tech",
                account_id.0.clone(),
                "user/-/label/Tech",
                "Tech",
                0
            ],
        )
        .unwrap();

    let created = create_folder_in_db(&db, account_id.0.clone(), "Tech".to_string())
        .expect("local-only folder should coexist with remote folder of same name");

    assert_eq!(created.name, "Tech");
    assert_eq!(created.sort_order, 1);
    let folders = SqliteFolderRepository::new(db.reader())
        .find_by_account(&account_id)
        .unwrap();
    assert_eq!(folders.len(), 2);
    assert!(folders
        .iter()
        .any(|folder| folder.remote_id.as_deref() == Some("user/-/label/Tech")));
    let local_folder = folders
        .iter()
        .find(|folder| folder.id.0 == created.id)
        .expect("created local-only folder should be present");
    assert!(local_folder.remote_id.is_none());
}

#[test]
fn create_folder_command_db_lock_serializes_sort_order_allocation() {
    let db = Arc::new(Mutex::new(test_db()));
    let account_id = {
        let db = lock_db(&db).unwrap();
        insert_test_account(&db, "Primary")
    };
    let start = Arc::new(Barrier::new(2));
    let handles = ["First", "Second"].map(|name| {
        let db = Arc::clone(&db);
        let account_id = account_id.0.clone();
        let start = Arc::clone(&start);

        thread::spawn(move || {
            start.wait();
            let db = lock_db(&db).unwrap();
            create_folder_in_db(&db, account_id, name.to_string()).unwrap()
        })
    });

    let mut created = handles
        .into_iter()
        .map(|handle| handle.join().unwrap())
        .collect::<Vec<_>>();
    created.sort_by_key(|folder| folder.sort_order);

    assert_eq!(
        created
            .iter()
            .map(|folder| folder.sort_order)
            .collect::<Vec<_>>(),
        vec![0, 1]
    );

    let db = lock_db(&db).unwrap();
    let duplicate_order_count: i64 = db
        .reader()
        .query_row(
            "SELECT COUNT(*)
              FROM (
                SELECT sort_order
                FROM folders
                WHERE account_id = ?1
                GROUP BY sort_order
                HAVING COUNT(*) > 1
              )",
            params![account_id.0],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(duplicate_order_count, 0);
}

#[test]
fn create_folder_classifies_concurrent_duplicate_name_constraint() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    db.writer()
        .execute_batch(
            "CREATE TRIGGER simulate_folder_name_race
              BEFORE INSERT ON folders
              WHEN NEW.name = 'Raced'
              BEGIN
                INSERT INTO folders (id, account_id, name, sort_order)
                VALUES ('raced-folder', NEW.account_id, 'raced', NEW.sort_order + 1);
              END;",
        )
        .unwrap();

    let error = create_folder_in_db(&db, account_id.0.clone(), "Raced".to_string())
        .expect_err("concurrent same-name insert should be returned as command error");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Folder name \"Raced\" is already in use"
    ));

    let folder_count: i64 = db
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM folders WHERE account_id = ?1",
            params![account_id.0],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(folder_count, 0);
}

#[test]
fn create_folder_classifies_concurrent_sort_order_constraint() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    db.writer()
        .execute_batch(
            "CREATE TRIGGER simulate_folder_sort_order_race
              BEFORE INSERT ON folders
              WHEN NEW.name = 'Raced'
              BEGIN
                INSERT INTO folders (id, account_id, name, sort_order)
                VALUES ('raced-folder', NEW.account_id, 'Other', NEW.sort_order);
              END;",
        )
        .unwrap();

    let error = create_folder_in_db(&db, account_id.0.clone(), "Raced".to_string())
        .expect_err("concurrent same-order insert should be returned as command error");

    assert!(matches!(
        error,
        AppError::UserVisible { message }
            if message == "Folder order changed while creating the folder. Please retry."
    ));

    let folder_count: i64 = db
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM folders WHERE account_id = ?1",
            params![account_id.0],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(folder_count, 0);
}

#[test]
fn update_feed_display_settings_command_persists_inherit_on_and_off_values() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    let feed_id = insert_test_feed(&db, &account_id);

    for (reader_mode, web_preview_mode) in [("inherit", "inherit"), ("on", "off"), ("off", "on")] {
        update_feed_display_settings_in_db(
            &db,
            feed_id.0.clone(),
            reader_mode.to_string(),
            web_preview_mode.to_string(),
        )
        .unwrap();

        let (saved_reader_mode, saved_web_preview_mode): (String, String) = db
            .reader()
            .query_row(
                "SELECT reader_mode, web_preview_mode FROM feeds WHERE id = ?1",
                params![feed_id.0],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();

        assert_eq!(saved_reader_mode, reader_mode);
        assert_eq!(saved_web_preview_mode, web_preview_mode);
    }
}

#[test]
fn update_feed_display_settings_command_rejects_unknown_reader_mode() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    let feed_id = insert_test_feed(&db, &account_id);

    let error = update_feed_display_settings_in_db(
        &db,
        feed_id.0,
        "enabled".to_string(),
        "inherit".to_string(),
    )
    .expect_err("unknown reader mode should be rejected");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Unknown reader mode: enabled"
    ));
}

#[test]
fn update_feed_display_settings_command_rejects_unknown_web_preview_mode() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    let feed_id = insert_test_feed(&db, &account_id);

    let error = update_feed_display_settings_in_db(
        &db,
        feed_id.0,
        "inherit".to_string(),
        "enabled".to_string(),
    )
    .expect_err("unknown web preview mode should be rejected");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Unknown web preview mode: enabled"
    ));
}

#[test]
fn add_local_feed_preflight_accepts_local_accounts() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");

    validate_add_local_feed_account_in_db(&db, &account_id).unwrap();
}

#[test]
fn add_local_feed_preflight_rejects_missing_accounts() {
    let db = test_db();
    let error = validate_add_local_feed_account_in_db(&db, &AccountId("missing".to_string()))
        .expect_err("missing account should be rejected");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Account not found"
    ));
}

#[test]
fn add_local_feed_preflight_accepts_freshrss_accounts() {
    let db = test_db();
    let account_id = insert_test_account_with_kind(&db, "FreshRSS", "FreshRss");

    validate_add_local_feed_account_in_db(&db, &account_id).unwrap();
}

#[test]
fn add_local_feed_preflight_rejects_quarantined_accounts() {
    let db = test_db();
    let account_id = insert_test_account_with_kind(&db, "Quarantined", "Quarantined");
    let error = validate_add_local_feed_account_in_db(&db, &account_id)
        .expect_err("quarantined account should be rejected");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Feed can only be added to a Local or FreshRSS account"
    ));
}

#[test]
fn add_local_feed_duplicate_url_preflight_rejects_existing_subscription() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    insert_test_feed(&db, &account_id);

    let error =
        validate_add_local_feed_duplicate_url_in_db(&db, &account_id, "http://example.com/rss")
            .expect_err("duplicate URL should be rejected before save");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Feed URL is already subscribed"
    ));
}

#[tokio::test]
async fn add_local_feed_rejects_missing_account_before_network_request() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    listener.set_nonblocking(true).unwrap();
    let url = format!("http://{}/feed.xml", listener.local_addr().unwrap());
    let (connection_tx, connection_rx) = mpsc::channel();
    let listener_thread = thread::spawn(move || {
        let deadline = Instant::now() + Duration::from_millis(250);
        while Instant::now() < deadline {
            match listener.accept() {
                Ok(_) => {
                    let _ = connection_tx.send(());
                    return;
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(10));
                }
                Err(_) => return,
            }
        }
    });

    let db = Mutex::new(test_db());
    let error = add_local_feed_with_db(&db, "missing".to_string(), url)
        .await
        .expect_err("missing account should be rejected before fetching");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Account not found"
    ));
    listener_thread.join().unwrap();
    assert!(
        connection_rx.try_recv().is_err(),
        "missing account must not trigger an HTTP request"
    );
}

#[tokio::test]
async fn add_local_feed_rejects_account_kind_drift_after_fetch() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}/feed.xml", listener.local_addr().unwrap());
    let (accepted_tx, accepted_rx) = mpsc::channel();
    let (respond_tx, respond_rx) = mpsc::channel();
    let listener_thread = thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        accepted_tx.send(()).unwrap();
        respond_rx.recv().unwrap();
        let response = format!(
             "HTTP/1.1 200 OK\r\nContent-Type: application/rss+xml\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
             SAMPLE_RSS.len(),
             SAMPLE_RSS
         );
        std::io::Write::write_all(&mut stream, response.as_bytes()).unwrap();
    });

    let db = Arc::new(Mutex::new(test_db()));
    let account_id = {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, "Primary")
    };

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    let add_db = Arc::clone(&db);
    let add_account_id = account_id.0.clone();
    let add_task = tokio::spawn(async move {
        add_local_feed_with_provider(&add_db, add_account_id, url, &provider).await
    });

    tokio::task::spawn_blocking(move || accepted_rx.recv().unwrap())
        .await
        .unwrap();
    {
        let db_guard = db.lock().unwrap();
        db_guard
            .writer()
            .execute(
                "UPDATE accounts SET kind = 'FreshRss' WHERE id = ?1",
                params![account_id.0.clone()],
            )
            .unwrap();
    }
    respond_tx.send(()).unwrap();

    let error = add_task
        .await
        .unwrap()
        .expect_err("account kind drift should reject add feed");
    listener_thread.join().unwrap();

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Feed can only be added to a Local account"
    ));

    let saved_feed_count: i64 = {
        let db_guard = db.lock().unwrap();
        db_guard
            .reader()
            .query_row("SELECT COUNT(*) FROM feeds", [], |row| row.get(0))
            .unwrap()
    };
    assert_eq!(saved_feed_count, 0);
}

#[tokio::test]
async fn add_local_feed_returns_unread_count_recalculation_errors() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_body(SAMPLE_RSS)
        .expect(2)
        .create_async()
        .await;

    let db = Mutex::new(test_db());
    let account_id = {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, "Primary")
    };
    {
        let db_guard = db.lock().unwrap();
        db_guard
            .writer()
            .execute("CREATE TABLE recalc_attempts (n INTEGER NOT NULL)", [])
            .unwrap();
        db_guard
            .writer()
            .execute("INSERT INTO recalc_attempts (n) VALUES (0)", [])
            .unwrap();
        db_guard
            .writer()
            .execute(
                "CREATE TRIGGER fail_second_unread_recalc
                  BEFORE UPDATE OF unread_count ON feeds
                  BEGIN
                    UPDATE recalc_attempts SET n = n + 1;
                    SELECT CASE
                      WHEN (SELECT n FROM recalc_attempts) > 1
                      THEN RAISE(FAIL, 'unread recalc failed')
                    END;
                  END",
                [],
            )
            .unwrap();
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    let error = add_local_feed_with_provider(&db, account_id.0, feed_url, &provider)
        .await
        .expect_err("final unread count recalculation failure should be returned");

    mock.assert_async().await;
    assert!(
        matches!(error, AppError::UserVisible { message } if message.contains("unread recalc failed"))
    );
}

#[tokio::test]
async fn add_local_feed_rolls_back_persisted_feed_when_initial_sync_fails() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_body(SAMPLE_RSS)
        .expect(2)
        .create_async()
        .await;

    let db = Mutex::new(test_db());
    let account_id = {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, "Primary")
    };
    {
        let db_guard = db.lock().unwrap();
        db_guard
            .writer()
            .execute(
                "CREATE TRIGGER fail_initial_article_sync
                  BEFORE INSERT ON articles
                  BEGIN
                    SELECT RAISE(FAIL, 'initial sync failed');
                  END",
                [],
            )
            .unwrap();
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    let error =
        add_local_feed_with_provider(&db, account_id.0.clone(), feed_url.clone(), &provider)
            .await
            .expect_err("initial sync failure should reject add feed");

    mock.assert_async().await;
    assert!(matches!(
        error,
        AppError::UserVisible { message } if message.contains("initial sync failed")
    ));

    let saved_feed_count: i64 = {
        let db_guard = db.lock().unwrap();
        db_guard
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM feeds WHERE account_id = ?1 AND url = ?2",
                params![account_id.0, feed_url],
                |row| row.get(0),
            )
            .unwrap()
    };
    assert_eq!(saved_feed_count, 0);
}

#[tokio::test]
async fn add_local_feed_uses_create_fetch_for_metadata_and_pull_fetch_for_articles() {
    let create_feed = r#"<?xml version="1.0" encoding="UTF-8"?>
 <feed xmlns="http://www.w3.org/2005/Atom">
   <title>Create Fetch Title</title>
   <id>https://example.com/create</id>
   <updated>2026-03-27T12:00:00Z</updated>
   <link rel="alternate" href="https://example.com/create" />
   <icon>https://example.com/icon.png</icon>
 </feed>"#;
    let pull_feed = r#"<?xml version="1.0" encoding="UTF-8"?>
 <rss version="2.0">
   <channel>
 <title>Pull Fetch Title</title>
 <link>https://example.com/pull</link>
 <item>
   <title>Pull Fetch Article</title>
   <link>https://example.com/articles/pull</link>
   <guid>pull-guid</guid>
 </item>
   </channel>
 </rss>"#;
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let create_mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_header("etag", "\"create-etag\"")
        .with_body(create_feed)
        .expect(1)
        .create_async()
        .await;
    let pull_mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_header("etag", "\"pull-etag\"")
        .with_body(pull_feed)
        .expect(1)
        .create_async()
        .await;

    let db = Mutex::new(test_db());
    let account_id = {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, "Primary")
    };

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    let feed = add_local_feed_with_provider(&db, account_id.0.clone(), feed_url.clone(), &provider)
        .await
        .unwrap();

    create_mock.assert_async().await;
    pull_mock.assert_async().await;
    assert_eq!(feed.title, "Create Fetch Title");
    assert_eq!(feed.site_url, "https://example.com/create");
    assert_eq!(
        feed.icon_url.as_deref(),
        Some("https://example.com/icon.png")
    );
    assert_eq!(feed.unread_count, 1);

    let (article_title, article_url, saved_etag): (String, String, String) = {
        let db_guard = db.lock().unwrap();
        let article = db_guard
            .reader()
            .query_row(
                "SELECT a.title, a.url
                  FROM articles a
                  JOIN feeds f ON f.id = a.feed_id
                  WHERE f.account_id = ?1 AND f.url = ?2",
                params![account_id.0.clone(), feed_url.clone()],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
            )
            .unwrap();
        let etag = db_guard
            .reader()
            .query_row(
                "SELECT etag FROM sync_state WHERE account_id = ?1 AND scope_key = ?2",
                params![account_id.0, format!("local_feed:{feed_url}")],
                |row| row.get::<_, String>(0),
            )
            .unwrap();
        (article.0, article.1, etag)
    };

    assert_eq!(article_title, "Pull Fetch Article");
    assert_eq!(article_url, "https://example.com/articles/pull");
    assert_eq!(saved_etag, "\"pull-etag\"");
}

#[tokio::test]
async fn add_local_feed_rejects_duplicate_url_without_deleting_existing_feed() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_body(SAMPLE_RSS)
        .expect(1)
        .create_async()
        .await;

    let db = Mutex::new(test_db());
    let account_id = {
        let db_guard = db.lock().unwrap();
        let account_id = insert_test_account(&db_guard, "Primary");
        db_guard
            .writer()
            .execute(
                "INSERT INTO feeds (id, account_id, title, url) VALUES (?1, ?2, ?3, ?4)",
                params!["existing-feed", account_id.0, "Existing", feed_url],
            )
            .unwrap();
        account_id
    };

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    let error =
        add_local_feed_with_provider(&db, account_id.0.clone(), feed_url.clone(), &provider)
            .await
            .expect_err("duplicate URL should reject add feed");

    mock.assert_async().await;
    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Feed URL is already subscribed"
    ));

    let saved_feed_count: i64 = {
        let db_guard = db.lock().unwrap();
        db_guard
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM feeds WHERE account_id = ?1 AND url = ?2",
                params![account_id.0, feed_url],
                |row| row.get(0),
            )
            .unwrap()
    };
    assert_eq!(saved_feed_count, 1);
}

#[tokio::test]
async fn add_local_feed_duplicate_race_does_not_roll_back_existing_feed() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_body(SAMPLE_RSS)
        .expect(1)
        .create_async()
        .await;

    let db = Mutex::new(test_db());
    let account_id = {
        let db_guard = db.lock().unwrap();
        let account_id = insert_test_account(&db_guard, "Primary");
        db_guard
            .writer()
            .execute(
                "CREATE TRIGGER simulate_duplicate_feed_race
                  BEFORE INSERT ON feeds
                  WHEN NEW.url LIKE 'http://127.0.0.1:%/feed.xml'
                  BEGIN
                    INSERT OR IGNORE INTO feeds (id, account_id, title, url)
                    VALUES ('race-existing-feed', NEW.account_id, 'Existing', NEW.url);
                  END",
                [],
            )
            .unwrap();
        db_guard
            .writer()
            .execute(
                "CREATE TRIGGER fail_if_duplicate_race_reaches_initial_sync
                  BEFORE INSERT ON articles
                  BEGIN
                    SELECT RAISE(FAIL, 'duplicate race reached initial sync');
                  END",
                [],
            )
            .unwrap();
        account_id
    };

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    let error =
        add_local_feed_with_provider(&db, account_id.0.clone(), feed_url.clone(), &provider)
            .await
            .expect_err("duplicate URL race should reject add feed");

    mock.assert_async().await;
    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Feed URL is already subscribed"
    ));

    let saved_feed_id: String = {
        let db_guard = db.lock().unwrap();
        db_guard
            .reader()
            .query_row(
                "SELECT id FROM feeds WHERE account_id = ?1 AND url = ?2",
                params![account_id.0, feed_url],
                |row| row.get(0),
            )
            .unwrap()
    };
    assert_eq!(saved_feed_id, "race-existing-feed");
}

#[test]
fn recalculate_feed_unread_count_command_returns_recalculation_errors() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    let feed_id = insert_test_feed(&db, &account_id);

    db.writer().execute("DROP TABLE articles", []).unwrap();

    let error = recalculate_feed_unread_count_in_db(&db, &feed_id)
        .expect_err("unread count recalculation failure should be returned");

    assert!(matches!(error, AppError::UserVisible { message } if message.contains("articles")));
}
