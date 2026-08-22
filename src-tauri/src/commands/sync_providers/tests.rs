use super::*;
use crate::domain::account::ConnectionVerificationStatus;
use crate::domain::provider::ProviderKind;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::repository::account::AccountRepository;
use crate::repository::article::{ArticleRepository, Pagination};
use crate::repository::pending_mutation::PendingMutation;
use mockito::Matcher;
use std::borrow::Cow;

const FEED_REMOTE_ID: &str = "feed/https://example.com/rss";
const LOCAL_ETAG_OLD: &str = "\"etag-old\"";
const LOCAL_ETAG_NEW: &str = "\"etag-new\"";
const LOCAL_LAST_MODIFIED_OLD: &str = "Wed, 01 Jan 2025 00:00:00 GMT";
const LOCAL_LAST_MODIFIED_NEW: &str = "Thu, 02 Jan 2025 00:00:00 GMT";
static DEV_CREDENTIALS_ENV_LOCK: std::sync::LazyLock<tokio::sync::Mutex<()>> =
    std::sync::LazyLock::new(|| tokio::sync::Mutex::new(()));

struct ProviderHttpResponseFixture<'a> {
    status: usize,
    headers: &'a [(&'a str, &'a str)],
    body: Cow<'a, str>,
}

impl<'a> ProviderHttpResponseFixture<'a> {
    fn status(status: usize) -> Self {
        Self {
            status,
            headers: &[],
            body: Cow::Borrowed(""),
        }
    }

    fn body(mut self, body: impl Into<Cow<'a, str>>) -> Self {
        self.body = body.into();
        self
    }

    fn headers(mut self, headers: &'a [(&'a str, &'a str)]) -> Self {
        self.headers = headers;
        self
    }

    fn ok(body: &'static str) -> ProviderHttpResponseFixture<'static> {
        ProviderHttpResponseFixture::status(200).body(body)
    }

    fn json(body: &'static str) -> ProviderHttpResponseFixture<'static> {
        Self::ok(body).headers(&[("content-type", "application/json")])
    }

    fn auth_token() -> ProviderHttpResponseFixture<'static> {
        Self::ok("Auth=tok\n")
    }

    fn empty_item_refs() -> ProviderHttpResponseFixture<'static> {
        Self::json(r#"{ "itemRefs": [] }"#)
    }
}

trait ProviderMockResponseExt {
    fn with_provider_response(self, response: ProviderHttpResponseFixture<'_>) -> Self;
}

impl ProviderMockResponseExt for mockito::Mock {
    fn with_provider_response(self, response: ProviderHttpResponseFixture<'_>) -> Self {
        response.headers.iter().fold(
            self.with_status(response.status)
                .with_body(response.body.as_ref()),
            |mock, (name, value)| mock.with_header(*name, value),
        )
    }
}

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
const LOCAL_RSS_INITIAL: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
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
const LOCAL_RSS_UPDATED: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
    <channel>
        <title>Local Feed</title>
        <item>
            <title>Local Article Updated</title>
            <link>https://example.com/1</link>
            <guid>local-guid-1</guid>
        </item>
    </channel>
    </rss>"#;

fn test_db() -> Mutex<DbManager> {
    Mutex::new(DbManager::new_in_memory().unwrap())
}

fn test_account(server_url: &str) -> Account {
    Account {
        id: AccountId::new(),
        kind: ProviderKind::FreshRss,
        name: "FreshRSS".to_string(),
        server_url: Some(server_url.to_string()),
        username: Some("u".to_string()),
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    }
}

#[tokio::test]
async fn greader_password_lookup_times_out_when_keychain_blocks() {
    let started_at = Instant::now();
    let error = get_greader_password_with_timeout(
        "acc-timeout",
        "FreshRSS",
        Duration::from_millis(10),
        |_| {
            std::thread::sleep(Duration::from_millis(250));
            Ok("password".to_string())
        },
    )
    .await
    .expect_err("blocking keychain lookup should time out");

    assert!(started_at.elapsed() < Duration::from_millis(200));
    match error {
        AppError::UserVisible { message } => {
            assert!(message.contains("Timed out reading password from macOS Keychain"));
        }
        other => panic!("expected user-visible keychain timeout, got {other:?}"),
    }
}

#[test]
fn delete_missing_greader_subscriptions_removes_only_remote_managed_feeds() {
    let db = test_db();
    let (account, feeds) = insert_account_and_feeds(
        &db,
        "https://rss.example.com",
        &[
            (
                "feed/https://example.com/present.xml",
                "Present",
                "https://example.com/present.xml",
                "https://example.com",
            ),
            (
                "feed/https://example.com/stale.xml",
                "Stale",
                "https://example.com/stale.xml",
                "https://example.com",
            ),
        ],
    );
    let local_feed = Feed {
        id: FeedId("feed-local".to_string()),
        account_id: account.id.clone(),
        folder_id: None,
        remote_id: None,
        title: "Local".to_string(),
        url: "https://example.com/local.xml".to_string(),
        site_url: "https://example.com".to_string(),
        icon: None,
        icon_url: None,
        unread_count: 0,
        reader_mode: "inherit".to_string(),
        web_preview_mode: "inherit".to_string(),
    };
    {
        let db_guard = db.lock().unwrap();
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        feed_repo.save(&local_feed).unwrap();
    }
    let remote_ids = HashSet::from(["feed/https://example.com/present.xml".to_string()]);

    let deleted_count = delete_missing_greader_subscriptions(&db, &account, &remote_ids).unwrap();

    assert_eq!(deleted_count, 1);
    let db_guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    assert!(feed_repo.find_by_id(&feeds[0].id).unwrap().is_some());
    assert!(feed_repo.find_by_id(&feeds[1].id).unwrap().is_none());
    assert!(feed_repo.find_by_id(&local_feed.id).unwrap().is_some());
}

#[test]
fn delete_missing_greader_folders_removes_stale_remote_folder_and_detaches_feeds() {
    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, "https://rss.example.com");
    let stale_folder = Folder {
        id: FolderId::new(),
        account_id: account.id.clone(),
        remote_id: Some("user/-/label/Stale".to_string()),
        name: "Stale".to_string(),
        sort_order: 0,
    };
    let local_only_folder = Folder {
        id: FolderId::new(),
        account_id: account.id.clone(),
        remote_id: None,
        name: "Local Only".to_string(),
        sort_order: 1,
    };
    {
        let db_guard = db.lock().unwrap();
        let folder_repo = SqliteFolderRepository::new(db_guard.writer());
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        folder_repo.save(&stale_folder).unwrap();
        folder_repo.save(&local_only_folder).unwrap();
        feed_repo
            .update_folder(&feed.id, Some(&stale_folder.id))
            .unwrap();
    }

    let deleted_count = delete_missing_greader_folders(&db, &account, &HashSet::new()).unwrap();

    assert_eq!(deleted_count, 1);
    let db_guard = db.lock().unwrap();
    let folder_repo = SqliteFolderRepository::new(db_guard.reader());
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    assert!(folder_repo
        .find_by_remote_id(&account.id, "user/-/label/Stale")
        .unwrap()
        .is_none());
    assert!(folder_repo
        .find_by_account(&account.id)
        .unwrap()
        .iter()
        .any(|folder| folder.id == local_only_folder.id));
    assert_eq!(
        feed_repo.find_by_id(&feed.id).unwrap().unwrap().folder_id,
        None
    );
}

#[test]
fn greader_folder_lifecycle_keeps_same_name_local_folder_when_remote_folder_appears_and_disappears()
{
    let db = test_db();
    let (account, _) = insert_account_and_feed(&db, "https://rss.example.com");
    let local_folder = Folder {
        id: FolderId::new(),
        account_id: account.id.clone(),
        remote_id: None,
        name: "Tech".to_string(),
        sort_order: 0,
    };
    {
        let db_guard = db.lock().unwrap();
        SqliteFolderRepository::new(db_guard.writer())
            .save(&local_folder)
            .unwrap();
    }

    let remote_folder = RemoteFolder {
        remote_id: "user/-/label/Tech".to_string(),
        name: "Tech".to_string(),
        sort_order: None,
    };
    let remote_folder_ids =
        save_greader_folders_snapshot(&db, &account, std::slice::from_ref(&remote_folder)).unwrap();

    {
        let db_guard = db.lock().unwrap();
        let folders = SqliteFolderRepository::new(db_guard.reader())
            .find_by_account(&account.id)
            .unwrap();
        assert_eq!(folders.len(), 2);
        assert!(folders
            .iter()
            .any(|folder| folder.id == local_folder.id && folder.remote_id.is_none()));
        assert!(folders.iter().any(|folder| {
            folder.remote_id.as_deref() == Some(remote_folder.remote_id.as_str())
        }));
    }

    assert_eq!(
        delete_missing_greader_folders(&db, &account, &HashSet::new()).unwrap(),
        1
    );
    let db_guard = db.lock().unwrap();
    let folders = SqliteFolderRepository::new(db_guard.reader())
        .find_by_account(&account.id)
        .unwrap();
    assert_eq!(folders.len(), 1);
    assert_eq!(folders[0].id, local_folder.id);
    assert!(folders[0].remote_id.is_none());
    assert!(remote_folder_ids.contains(&remote_folder.remote_id));
}

#[test]
fn delete_missing_greader_folders_rolls_back_all_detaches_when_batch_transaction_fails() {
    let db = test_db();
    let (account, feed_a) = insert_account_and_feed(&db, "https://rss.example.com");
    let feed_b = make_test_feed(
        &account.id,
        "feed/https://example.com/second.xml",
        "Second Feed",
        "https://example.com/second.xml",
        "https://example.com",
    );
    let stale_folder_a = Folder {
        id: FolderId("stale-folder-a".to_string()),
        account_id: account.id.clone(),
        remote_id: Some("user/-/label/Stale A".to_string()),
        name: "Stale A".to_string(),
        sort_order: 0,
    };
    let stale_folder_b = Folder {
        id: FolderId("stale-folder-b".to_string()),
        account_id: account.id.clone(),
        remote_id: Some("user/-/label/Stale B".to_string()),
        name: "Stale B".to_string(),
        sort_order: 1,
    };
    let keep_folder = Folder {
        id: FolderId("keep-folder".to_string()),
        account_id: account.id.clone(),
        remote_id: Some("user/-/label/Keep".to_string()),
        name: "Keep".to_string(),
        sort_order: 2,
    };
    {
        let db_guard = db.lock().unwrap();
        let folder_repo = SqliteFolderRepository::new(db_guard.writer());
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        feed_repo.save(&feed_b).unwrap();
        folder_repo.save(&stale_folder_a).unwrap();
        folder_repo.save(&stale_folder_b).unwrap();
        folder_repo.save(&keep_folder).unwrap();
        feed_repo
            .update_folder(&feed_a.id, Some(&stale_folder_a.id))
            .unwrap();
        feed_repo
            .update_folder(&feed_b.id, Some(&stale_folder_b.id))
            .unwrap();
        db_guard
            .writer()
            .execute_batch(
                "CREATE TRIGGER fail_folder_keep_renumber
                     BEFORE UPDATE OF sort_order ON folders
                     WHEN OLD.id = 'keep-folder'
                     BEGIN
                       SELECT RAISE(ABORT, 'renumber failed');
                     END;",
            )
            .unwrap();
    }

    let error = delete_missing_greader_folders(
        &db,
        &account,
        &HashSet::from([keep_folder.remote_id.clone().unwrap()]),
    )
    .expect_err("batch folder cleanup should roll back on renumber failure");

    assert!(error.to_string().contains("renumber failed"));
    let db_guard = db.lock().unwrap();
    let folder_repo = SqliteFolderRepository::new(db_guard.reader());
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    for (folder, feed) in [(&stale_folder_a, &feed_a), (&stale_folder_b, &feed_b)] {
        assert!(folder_repo
            .find_by_remote_id(&account.id, folder.remote_id.as_deref().unwrap())
            .unwrap()
            .is_some());
        assert_eq!(
            feed_repo.find_by_id(&feed.id).unwrap().unwrap().folder_id,
            Some(folder.id.clone())
        );
    }
}

#[test]
fn delete_missing_greader_folders_isolated_by_account_and_provider_kind() {
    let db = test_db();
    let (account, _) = insert_account_and_feed(&db, "https://rss.example.com");
    let other_account = test_account("https://other.example.com");
    let local_account = test_local_account();
    let stale_remote_id = "user/-/label/Stale";
    {
        let db_guard = db.lock().unwrap();
        let account_repo = SqliteAccountRepository::new(db_guard.writer());
        let folder_repo = SqliteFolderRepository::new(db_guard.writer());
        account_repo.save(&other_account).unwrap();
        account_repo.save(&local_account).unwrap();
        for account_id in [&account.id, &other_account.id, &local_account.id] {
            folder_repo
                .save(&Folder {
                    id: FolderId::new(),
                    account_id: account_id.clone(),
                    remote_id: Some(stale_remote_id.to_string()),
                    name: "Stale".to_string(),
                    sort_order: 0,
                })
                .unwrap();
        }
    }

    let deleted_count = delete_missing_greader_folders(&db, &account, &HashSet::new()).unwrap();

    assert_eq!(deleted_count, 1);
    let db_guard = db.lock().unwrap();
    let folder_repo = SqliteFolderRepository::new(db_guard.reader());
    assert!(folder_repo
        .find_by_remote_id(&account.id, stale_remote_id)
        .unwrap()
        .is_none());
    assert!(folder_repo
        .find_by_remote_id(&other_account.id, stale_remote_id)
        .unwrap()
        .is_some());
    assert!(folder_repo
        .find_by_remote_id(&local_account.id, stale_remote_id)
        .unwrap()
        .is_some());
}

#[test]
fn deleted_greader_folders_warning_reports_cleanup_count_and_recovery_message() {
    let warning = deleted_greader_folders_warning(2);

    assert_eq!(warning.kind, AccountSyncWarningKind::Generic);
    assert_eq!(
            warning.message,
            "FreshRSS removed 2 folder(s) that no longer exist remotely; their feeds were moved to Uncategorized."
        );
}

#[tokio::test]
async fn sync_greader_account_keeps_stale_folder_when_folder_snapshot_fails() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_provider_response(ProviderHttpResponseFixture::auth_token())
        .create_async()
        .await;
    let folder_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/tag/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::status(500))
        .create_async()
        .await;

    let db = test_db();
    let account = test_account(&server.url());
    let stale_folder = Folder {
        id: FolderId::new(),
        account_id: account.id.clone(),
        remote_id: Some("user/-/label/Stale".to_string()),
        name: "Stale".to_string(),
        sort_order: 0,
    };
    {
        let db_guard = db.lock().unwrap();
        SqliteAccountRepository::new(db_guard.writer())
            .save(&account)
            .unwrap();
        SqliteFolderRepository::new(db_guard.writer())
            .save(&stale_folder)
            .unwrap();
    }
    let _credentials = configure_dev_credentials(&account.id).await;

    let error = sync_greader_account(&db, &account, GReaderProvider::for_freshrss(&server.url()))
        .await
        .expect_err("folder snapshot failure should fail sync before cleanup");

    folder_mock.assert_async().await;
    assert!(error.to_string().contains("500"));
    let db_guard = db.lock().unwrap();
    assert!(SqliteFolderRepository::new(db_guard.reader())
        .find_by_remote_id(&account.id, "user/-/label/Stale")
        .unwrap()
        .is_some());
}

#[tokio::test]
async fn sync_greader_account_keeps_stale_folder_when_folder_snapshot_is_malformed() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_provider_response(ProviderHttpResponseFixture::auth_token())
        .create_async()
        .await;
    let folder_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/tag/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::json(
            r#"{ "tags": [{ "id": "user/-/label/Bad%ZZ" }] }"#,
        ))
        .create_async()
        .await;

    let db = test_db();
    let account = test_account(&server.url());
    let stale_folder = Folder {
        id: FolderId::new(),
        account_id: account.id.clone(),
        remote_id: Some("user/-/label/Stale".to_string()),
        name: "Stale".to_string(),
        sort_order: 0,
    };
    {
        let db_guard = db.lock().unwrap();
        SqliteAccountRepository::new(db_guard.writer())
            .save(&account)
            .unwrap();
        SqliteFolderRepository::new(db_guard.writer())
            .save(&stale_folder)
            .unwrap();
    }
    let _credentials = configure_dev_credentials(&account.id).await;

    let error = sync_greader_account(&db, &account, GReaderProvider::for_freshrss(&server.url()))
        .await
        .expect_err("malformed folder snapshot should fail before cleanup");

    folder_mock.assert_async().await;
    assert!(error.to_string().contains("invalid label"));
    let db_guard = db.lock().unwrap();
    assert!(SqliteFolderRepository::new(db_guard.reader())
        .find_by_remote_id(&account.id, "user/-/label/Stale")
        .unwrap()
        .is_some());
}

#[tokio::test]
async fn sync_greader_account_keeps_stale_folder_when_later_subscription_sync_fails() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_provider_response(ProviderHttpResponseFixture::auth_token())
        .create_async()
        .await;
    let folder_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/tag/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::json(r#"{ "tags": [] }"#))
        .create_async()
        .await;
    let subscription_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/subscription/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::status(500))
        .create_async()
        .await;

    let db = test_db();
    let account = test_account(&server.url());
    let stale_folder = Folder {
        id: FolderId::new(),
        account_id: account.id.clone(),
        remote_id: Some("user/-/label/Stale".to_string()),
        name: "Stale".to_string(),
        sort_order: 0,
    };
    {
        let db_guard = db.lock().unwrap();
        SqliteAccountRepository::new(db_guard.writer())
            .save(&account)
            .unwrap();
        SqliteFolderRepository::new(db_guard.writer())
            .save(&stale_folder)
            .unwrap();
    }
    let _credentials = configure_dev_credentials(&account.id).await;

    let error = sync_greader_account(&db, &account, GReaderProvider::for_freshrss(&server.url()))
        .await
        .expect_err("later subscription failure should leave stale folder untouched");

    folder_mock.assert_async().await;
    subscription_mock.assert_async().await;
    assert!(error.to_string().contains("500"));
    let db_guard = db.lock().unwrap();
    assert!(SqliteFolderRepository::new(db_guard.reader())
        .find_by_remote_id(&account.id, "user/-/label/Stale")
        .unwrap()
        .is_some());
}

#[test]
fn save_greader_subscriptions_does_not_recreate_feed_deleted_after_sync_started() {
    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, "https://rss.example.com");
    let sync_started_remote_feed_ids =
        HashSet::from([feed.remote_id.clone().expect("test feed has remote id")]);
    {
        let db_guard = db.lock().unwrap();
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        feed_repo
            .delete(&feed.id)
            .expect("test feed delete should succeed");
    }

    save_greader_subscriptions(
        &db,
        &account,
        &HashMap::new(),
        &[RemoteSubscription {
            remote_id: FEED_REMOTE_ID.to_string(),
            title: "Example Feed".to_string(),
            url: "https://example.com/rss".to_string(),
            site_url: "https://example.com".to_string(),
            folder_remote_id: None,
            icon_url: None,
        }],
        &sync_started_remote_feed_ids,
    )
    .expect("stale subscription persist should skip deleted feed without failing");

    let db_guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    assert!(
        feed_repo.find_by_id(&feed.id).unwrap().is_none(),
        "in-flight subscription sync must not recreate a feed deleted after sync started"
    );
    assert!(
        feed_repo
            .find_by_remote_id(&account.id, FEED_REMOTE_ID)
            .unwrap()
            .is_none(),
        "deleted remote feed must stay absent after stale subscription persist"
    );
}

#[test]
fn save_greader_subscriptions_persists_new_remote_subscription_not_seen_at_sync_start() {
    let db = test_db();
    let account = test_account("https://rss.example.com");
    {
        let db_guard = db.lock().unwrap();
        let account_repo = SqliteAccountRepository::new(db_guard.writer());
        account_repo.save(&account).unwrap();
    }

    save_greader_subscriptions(
        &db,
        &account,
        &HashMap::new(),
        &[RemoteSubscription {
            remote_id: FEED_REMOTE_ID.to_string(),
            title: "Example Feed".to_string(),
            url: "https://example.com/rss".to_string(),
            site_url: "https://example.com".to_string(),
            folder_remote_id: None,
            icon_url: None,
        }],
        &HashSet::new(),
    )
    .expect("new subscription persist should succeed");

    let db_guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    assert!(
        feed_repo
            .find_by_remote_id(&account.id, FEED_REMOTE_ID)
            .unwrap()
            .is_some(),
        "remote subscriptions not present at sync start are regular additions"
    );
}

#[test]
fn save_greader_subscriptions_preserves_existing_icon_when_remote_icon_is_missing() {
    let db = test_db();
    let (account, mut feed) = insert_account_and_feed(&db, "https://rss.example.com");
    feed.icon_url = Some("https://example.com/old-icon.png".to_string());
    feed.reader_mode = "on".to_string();
    feed.web_preview_mode = "off".to_string();
    {
        let db_guard = db.lock().unwrap();
        SqliteFeedRepository::new(db_guard.writer())
            .save(&feed)
            .expect("existing feed with icon should be saved");
    }

    save_greader_subscriptions(
        &db,
        &account,
        &HashMap::new(),
        &[RemoteSubscription {
            remote_id: FEED_REMOTE_ID.to_string(),
            title: "Example Feed".to_string(),
            url: "https://example.com/rss".to_string(),
            site_url: "https://example.com".to_string(),
            folder_remote_id: None,
            icon_url: Some("https://example.com/new-icon.png".to_string()),
        }],
        &HashSet::new(),
    )
    .expect("provider icon should be persisted");

    save_greader_subscriptions(
        &db,
        &account,
        &HashMap::new(),
        &[RemoteSubscription {
            remote_id: FEED_REMOTE_ID.to_string(),
            title: "Example Feed".to_string(),
            url: "https://example.com/rss".to_string(),
            site_url: "https://example.com".to_string(),
            folder_remote_id: None,
            icon_url: None,
        }],
        &HashSet::new(),
    )
    .expect("missing provider icon should not fail subscription sync");

    let db_guard = db.lock().unwrap();
    let saved = SqliteFeedRepository::new(db_guard.reader())
        .find_by_remote_id(&account.id, FEED_REMOTE_ID)
        .expect("saved feed lookup should succeed")
        .expect("existing feed should remain present");
    assert_eq!(
        saved.icon_url.as_deref(),
        Some("https://example.com/new-icon.png")
    );
    assert_eq!(saved.reader_mode, "on");
    assert_eq!(saved.web_preview_mode, "off");
}

#[test]
fn save_greader_subscriptions_preserves_local_feed_icon_when_url_conflicts() {
    let db = test_db();
    let account = test_account("https://rss.example.com");
    let mut feed = test_local_feed(&account.id, "https://example.com/rss");
    feed.icon = Some(vec![1, 2, 3]);
    feed.icon_url = Some("https://example.com/old-icon.png".to_string());
    feed.reader_mode = "on".to_string();
    feed.web_preview_mode = "off".to_string();
    {
        let db_guard = db.lock().unwrap();
        SqliteAccountRepository::new(db_guard.writer())
            .save(&account)
            .expect("test account should be saved");
        SqliteFeedRepository::new(db_guard.writer())
            .save(&feed)
            .expect("existing local feed should be saved");
    }

    save_greader_subscriptions(
        &db,
        &account,
        &HashMap::new(),
        &[RemoteSubscription {
            remote_id: FEED_REMOTE_ID.to_string(),
            title: "Example Feed".to_string(),
            url: feed.url.clone(),
            site_url: "https://example.com".to_string(),
            folder_remote_id: None,
            icon_url: None,
        }],
        &HashSet::new(),
    )
    .expect("URL-conflicting subscription should be saved");

    let db_guard = db.lock().unwrap();
    let saved = SqliteFeedRepository::new(db_guard.reader())
        .find_by_remote_id(&account.id, FEED_REMOTE_ID)
        .expect("saved feed lookup should succeed")
        .expect("URL-conflicting feed should remain present");
    assert_eq!(saved.id, feed.id);
    assert_eq!(saved.icon.as_deref(), Some(&[1, 2, 3][..]));
    assert_eq!(
        saved.icon_url.as_deref(),
        Some("https://example.com/old-icon.png")
    );
    assert_eq!(saved.reader_mode, "on");
    assert_eq!(saved.web_preview_mode, "off");
}

#[test]
fn save_greader_subscriptions_batch_reconciles_multiple_feeds_in_one_call() {
    // Regression test for the subscriptions.rs N+1 fix: a single
    // save_greader_subscriptions call carrying several remote
    // subscriptions must correctly update an existing feed matched by
    // remote_id, reconcile a local feed matched only by url (remote_id
    // conflict), and insert a brand-new feed, all in one batch.
    let db = test_db();
    let (account, existing_by_remote_id) = insert_account_and_feed(&db, "https://rss.example.com");
    let url_conflict_feed = test_local_feed(&account.id, "https://example.com/url-conflict");
    {
        let db_guard = db.lock().unwrap();
        SqliteFeedRepository::new(db_guard.writer())
            .save(&url_conflict_feed)
            .expect("local url-conflict feed should be saved");
    }

    const NEW_REMOTE_ID: &str = "feed/https://example.com/new";
    const URL_CONFLICT_REMOTE_ID: &str = "feed/https://example.com/url-conflict";

    save_greader_subscriptions(
        &db,
        &account,
        &HashMap::new(),
        &[
            RemoteSubscription {
                remote_id: FEED_REMOTE_ID.to_string(),
                title: "Updated Title".to_string(),
                url: "https://example.com/rss".to_string(),
                site_url: "https://example.com".to_string(),
                folder_remote_id: None,
                icon_url: None,
            },
            RemoteSubscription {
                remote_id: URL_CONFLICT_REMOTE_ID.to_string(),
                title: "URL Conflict Feed".to_string(),
                url: url_conflict_feed.url.clone(),
                site_url: "https://example.com".to_string(),
                folder_remote_id: None,
                icon_url: None,
            },
            RemoteSubscription {
                remote_id: NEW_REMOTE_ID.to_string(),
                title: "Brand New Feed".to_string(),
                url: "https://example.com/new".to_string(),
                site_url: "https://example.com".to_string(),
                folder_remote_id: None,
                icon_url: None,
            },
        ],
        &HashSet::new(),
    )
    .expect("batch of remote subscriptions should persist in one call");

    let db_guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());

    let updated = feed_repo
        .find_by_remote_id(&account.id, FEED_REMOTE_ID)
        .expect("lookup should succeed")
        .expect("feed matched by remote_id should still exist");
    assert_eq!(updated.id, existing_by_remote_id.id);
    assert_eq!(updated.title, "Updated Title");

    let url_conflict_saved = feed_repo
        .find_by_remote_id(&account.id, URL_CONFLICT_REMOTE_ID)
        .expect("lookup should succeed")
        .expect("feed matched by url should adopt the remote_id");
    assert_eq!(url_conflict_saved.id, url_conflict_feed.id);
    assert_eq!(url_conflict_saved.title, "URL Conflict Feed");

    let new_feed = feed_repo
        .find_by_remote_id(&account.id, NEW_REMOTE_ID)
        .expect("lookup should succeed")
        .expect("brand-new remote subscription should be inserted");
    assert_eq!(new_feed.title, "Brand New Feed");

    assert_eq!(
        feed_repo
            .find_by_account(&account.id)
            .expect("find_by_account should succeed")
            .len(),
        3,
        "batch should result in exactly the three reconciled feeds"
    );
}

#[test]
fn pending_mutation_retry_warning_keeps_remote_entry_id_out_of_public_copy() {
    let warning = pending_mutation_retry_warning(PendingMutationType::MarkRead);

    assert_eq!(warning.kind, AccountSyncWarningKind::RetryPending);
    assert_eq!(
        warning.message,
        "Local change 'mark_read' will retry next sync."
    );
    assert!(!warning.message.contains("remote_entry_id"));
    assert!(!warning.message.contains("https://"));
}

#[test]
fn dropped_pending_mutation_warning_is_user_visible_without_remote_entry_id() {
    let warning = dropped_pending_mutation_warning(PendingMutationType::Star);

    assert_eq!(warning.kind, AccountSyncWarningKind::Generic);
    assert_eq!(
            warning.message,
            "Local change 'star' could not be sent because the feed is no longer managed by FreshRSS. Sync again after refreshing the feed."
        );
    assert!(!warning.message.contains("remote_entry_id"));
    assert!(!warning.message.contains("https://"));
}

#[test]
fn should_pull_remote_state_ignores_future_success_timestamp() {
    let db = test_db();
    let account = test_account("https://rss.example.com");
    let now = chrono::DateTime::parse_from_rfc3339("2026-05-10T00:00:00Z")
        .unwrap()
        .with_timezone(&chrono::Utc);
    {
        let db_guard = db.lock().unwrap();
        let account_repo = SqliteAccountRepository::new(db_guard.writer());
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        account_repo.save(&account).unwrap();
        sync_state_repo
            .save(&SyncState {
                account_id: account.id.clone(),
                scope_key: SyncStateScopeKey::greader_remote_state_full().as_string(),
                timestamp_usec: Some((now + chrono::Duration::hours(1)).timestamp_micros()),
                continuation: None,
                etag: None,
                last_modified: None,
                last_success_at: Some((now + chrono::Duration::hours(1)).to_rfc3339()),
                last_error: None,
                error_count: 0,
                next_retry_at: None,
            })
            .unwrap();
    }

    assert!(should_pull_remote_state(&db, &account.id, now).unwrap());
}

#[test]
fn greader_cursor_timestamp_policy_ignores_invalid_saved_and_entry_values() {
    let future = chrono::Utc::now() + chrono::Duration::hours(1);
    let saved_state = SyncState {
        account_id: AccountId("account".to_string()),
        scope_key: feed_scope_key("feed/remote").as_string(),
        timestamp_usec: Some(future.timestamp_micros()),
        continuation: Some("stale-page".to_string()),
        etag: Some("etag".to_string()),
        last_modified: Some("Wed, 01 Jan 2025 00:00:00 GMT".to_string()),
        last_success_at: None,
        last_error: None,
        error_count: 0,
        next_retry_at: None,
    };
    let cursor = cursor_from_state(Some(&saved_state))
        .expect("existing sync state should still build a cursor");

    assert_eq!(cursor.continuation, None);
    assert_eq!(cursor.since, None);
    assert_eq!(sync_state_timestamp_usec(Some(&saved_state)), None);

    let mut latest_timestamp_usec = Some(1_700_000_000_000_000);
    update_latest_timestamp_usec(
        &mut latest_timestamp_usec,
        Some(&SyncCursor {
            continuation: None,
            since: Some(future),
            etag: None,
            last_modified: None,
        }),
    );
    assert_eq!(latest_timestamp_usec, Some(1_700_000_000_000_000));
}

#[test]
fn pending_mutation_target_lookup_returns_db_error_without_deleting_pending_mutation() {
    let db = test_db();
    let account = test_account("https://rss.example.com");
    let pending_mutation_id = {
        let db_guard = db.lock().unwrap();
        let account_repo = SqliteAccountRepository::new(db_guard.writer());
        account_repo.save(&account).unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![
                        account.id.as_ref(),
                        PendingMutationType::MarkRead.as_str(),
                        "entry-1",
                        "2024-01-01T00:00:00Z"
                    ],
                )
                .unwrap();
        let pending_mutation_id = db_guard.writer().last_insert_rowid();
        db_guard
            .writer()
            .execute("DROP TABLE articles", [])
            .unwrap();
        pending_mutation_id
    };

    let _ = pending_mutation_id;
    let result = pending_mutation_ids_targeting_provider_managed_greader_feeds(&db, &account.id);

    assert!(result.is_err());
    let pending_count: i64 = db
        .lock()
        .unwrap()
        .reader()
        .query_row("SELECT COUNT(*) FROM pending_mutations", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(pending_count, 1);
}

#[test]
fn pending_mutation_target_lookup_treats_missing_target_as_non_greader() {
    let db = test_db();
    let account = test_account("https://rss.example.com");
    let pending_mutation_id = {
        let db_guard = db.lock().unwrap();
        let account_repo = SqliteAccountRepository::new(db_guard.writer());
        account_repo.save(&account).unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![
                        account.id.as_ref(),
                        PendingMutationType::MarkRead.as_str(),
                        "missing-entry",
                        "2024-01-01T00:00:00Z"
                    ],
                )
                .unwrap();
        db_guard.writer().last_insert_rowid()
    };

    let provider_managed_ids =
        pending_mutation_ids_targeting_provider_managed_greader_feeds(&db, &account.id).unwrap();

    assert!(!provider_managed_ids.contains(&pending_mutation_id));
}

#[test]
fn pending_mutation_target_lookup_rejects_remote_entry_id_collision_across_feeds() {
    let db = test_db();
    let (account, feeds) = insert_account_and_feeds(
        &db,
        "https://rss.example.com",
        &[
            (
                "",
                "Local Collision",
                "https://example.com/local.xml",
                "https://example.com/local",
            ),
            (
                "feed/https://example.com/remote.xml",
                "Remote Collision",
                "https://example.com/remote.xml",
                "https://example.com/remote",
            ),
        ],
    );
    let remote_entry_id = "duplicate-entry";
    let pending_mutation_id = {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        article_repo
            .upsert(&[
                Article {
                    id: ArticleId("local-duplicate-entry".to_string()),
                    feed_id: feeds[0].id.clone(),
                    remote_id: Some(remote_entry_id.to_string()),
                    title: "Local Collision".to_string(),
                    content_raw: "body".to_string(),
                    content_sanitized: "body".to_string(),
                    sanitizer_version: sanitizer::SANITIZER_VERSION,
                    summary: None,
                    url: Some("https://example.com/local-entry".to_string()),
                    author: None,
                    published_at: chrono::Utc::now(),
                    thumbnail: None,
                    is_read: false,
                    is_starred: false,
                    fetched_at: chrono::Utc::now(),
                },
                Article {
                    id: ArticleId("remote-duplicate-entry".to_string()),
                    feed_id: feeds[1].id.clone(),
                    remote_id: Some(remote_entry_id.to_string()),
                    title: "Remote Collision".to_string(),
                    content_raw: "body".to_string(),
                    content_sanitized: "body".to_string(),
                    sanitizer_version: sanitizer::SANITIZER_VERSION,
                    summary: None,
                    url: Some("https://example.com/remote-entry".to_string()),
                    author: None,
                    published_at: chrono::Utc::now(),
                    thumbnail: None,
                    is_read: false,
                    is_starred: false,
                    fetched_at: chrono::Utc::now(),
                },
            ])
            .unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![
                        account.id.as_ref(),
                        PendingMutationType::MarkRead.as_str(),
                        remote_entry_id,
                        "2024-01-01T00:00:00Z"
                    ],
                )
                .unwrap();
        db_guard.writer().last_insert_rowid()
    };

    let provider_managed_ids =
        pending_mutation_ids_targeting_provider_managed_greader_feeds(&db, &account.id).unwrap();

    assert!(!provider_managed_ids.contains(&pending_mutation_id));
}

#[test]
fn pending_mutation_ids_targeting_provider_managed_greader_feeds_returns_exact_subset() {
    let db = test_db();
    let (account, feeds) = insert_account_and_feeds(
        &db,
        "https://rss.example.com",
        &[
            (
                "feed/https://example.com/provider-a.xml",
                "Provider Feed A",
                "https://example.com/provider-a.xml",
                "https://example.com/provider-a",
            ),
            (
                "feed/https://example.com/provider-b.xml",
                "Provider Feed B",
                "https://example.com/provider-b.xml",
                "https://example.com/provider-b",
            ),
            (
                "",
                "Local Collision",
                "https://example.com/local.xml",
                "https://example.com/local",
            ),
            (
                "feed/https://example.com/remote-collision.xml",
                "Remote Collision",
                "https://example.com/remote-collision.xml",
                "https://example.com/remote-collision",
            ),
        ],
    );

    fn make_article(id: &str, feed_id: &FeedId, remote_id: &str) -> Article {
        Article {
            id: ArticleId(id.to_string()),
            feed_id: feed_id.clone(),
            remote_id: Some(remote_id.to_string()),
            title: id.to_string(),
            content_raw: "body".to_string(),
            content_sanitized: "body".to_string(),
            sanitizer_version: sanitizer::SANITIZER_VERSION,
            summary: None,
            url: Some(format!("https://example.com/{id}")),
            author: None,
            published_at: chrono::Utc::now(),
            thumbnail: None,
            is_read: false,
            is_starred: false,
            fetched_at: chrono::Utc::now(),
        }
    }

    let (
        provider_mutation_id_a,
        provider_mutation_id_b,
        collision_mutation_id,
        no_match_mutation_id,
    ) = {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        article_repo
            .upsert(&[
                make_article("provider-entry-a", &feeds[0].id, "provider-entry-a"),
                make_article("provider-entry-b", &feeds[1].id, "provider-entry-b"),
                make_article("local-collision-entry", &feeds[2].id, "collision-entry"),
                make_article("remote-collision-entry", &feeds[3].id, "collision-entry"),
            ])
            .unwrap();

        let insert_pending = |remote_entry_id: &str| -> i64 {
            db_guard
                    .writer()
                    .execute(
                        "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
                         VALUES (?1, ?2, ?3, ?4)",
                        rusqlite::params![
                            account.id.as_ref(),
                            PendingMutationType::MarkRead.as_str(),
                            remote_entry_id,
                            "2024-01-01T00:00:00Z"
                        ],
                    )
                    .unwrap();
            db_guard.writer().last_insert_rowid()
        };

        (
            insert_pending("provider-entry-a"),
            insert_pending("provider-entry-b"),
            insert_pending("collision-entry"),
            insert_pending("missing-entry"),
        )
    };

    let provider_managed_ids =
        pending_mutation_ids_targeting_provider_managed_greader_feeds(&db, &account.id).unwrap();

    assert!(provider_managed_ids.contains(&provider_mutation_id_a));
    assert!(provider_managed_ids.contains(&provider_mutation_id_b));
    assert!(!provider_managed_ids.contains(&collision_mutation_id));
    assert!(!provider_managed_ids.contains(&no_match_mutation_id));
    assert_eq!(provider_managed_ids.len(), 2);
}

fn test_feed(account_id: &AccountId) -> Feed {
    Feed {
        id: FeedId::new(),
        account_id: account_id.clone(),
        folder_id: None,
        remote_id: Some(FEED_REMOTE_ID.to_string()),
        title: "Example Feed".to_string(),
        url: "https://example.com/rss".to_string(),
        site_url: "https://example.com".to_string(),
        icon: None,
        icon_url: None,
        unread_count: 0,
        reader_mode: "inherit".to_string(),
        web_preview_mode: "inherit".to_string(),
    }
}

fn insert_account_and_feed(db: &Mutex<DbManager>, server_url: &str) -> (Account, Feed) {
    let account = test_account(server_url);
    let feed = test_feed(&account.id);

    let db_guard = db.lock().unwrap();
    let account_repo = SqliteAccountRepository::new(db_guard.writer());
    let feed_repo = SqliteFeedRepository::new(db_guard.writer());
    account_repo.save(&account).unwrap();
    feed_repo.save(&feed).unwrap();

    (account, feed)
}

#[test]
fn apply_remote_state_with_protection_reads_pending_mutations_saved_before_the_call() {
    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, "http://localhost");
    let remote_id = "protected-entry".to_string();
    let article_id = ArticleId("protected-article".to_string());

    {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        article_repo
            .upsert(&[Article {
                id: article_id.clone(),
                feed_id: feed.id.clone(),
                remote_id: Some(remote_id.clone()),
                title: "Protected".to_string(),
                content_raw: "body".to_string(),
                content_sanitized: "body".to_string(),
                sanitizer_version: sanitizer::SANITIZER_VERSION,
                summary: None,
                url: None,
                author: None,
                published_at: chrono::Utc::now(),
                thumbnail: None,
                is_read: true,
                is_starred: false,
                fetched_at: chrono::Utc::now(),
            }])
            .unwrap();

        // A pending MarkRead mutation, saved directly to the DB (not passed via
        // `extra_protected_read_ids`), must still be picked up: the helper is
        // responsible for re-reading pending mutations from the DB inside its
        // own lock, not relying on a caller-supplied snapshot.
        let pending_repo = SqlitePendingMutationRepository::new(db_guard.writer());
        pending_repo
            .save(&PendingMutation {
                id: None,
                account_id: account.id.clone(),
                mutation_type: PendingMutationType::MarkRead,
                remote_entry_id: remote_id.clone(),
                created_at: chrono::Utc::now().to_rfc3339(),
            })
            .unwrap();
    }

    // Remote reports the entry as unread; without protection this would
    // revert the article to unread.
    apply_remote_state_with_protection(&db, &account.id, &[], &[], &[], &[]).unwrap();

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let article = article_repo
        .find_by_feed(&feed.id, &Pagination::default())
        .unwrap()
        .into_iter()
        .find(|article| article.id == article_id)
        .unwrap();
    assert!(
        article.is_read,
        "pending MarkRead mutation saved before the call should protect the article \
             from being reverted to the remote's stale unread state"
    );
}

#[test]
fn upsert_articles_in_current_transaction_preserves_older_published_at_on_resync() {
    let db = test_db();
    let (_account, feed) = insert_account_and_feed(&db, "http://localhost");
    let db_guard = db.lock().unwrap();
    let conn = db_guard.writer();

    let t1 = chrono::DateTime::parse_from_rfc3339("2026-01-01T00:00:00+00:00")
        .unwrap()
        .with_timezone(&chrono::Utc);
    let t2 = chrono::DateTime::parse_from_rfc3339("2026-06-01T00:00:00+00:00")
        .unwrap()
        .with_timezone(&chrono::Utc);
    let mut article = Article {
        id: ArticleId("preserve-published-at".to_string()),
        feed_id: feed.id.clone(),
        remote_id: Some("entry-preserve-published-at".to_string()),
        title: "Preserve on re-sync".to_string(),
        content_raw: "body".to_string(),
        content_sanitized: "body".to_string(),
        sanitizer_version: sanitizer::SANITIZER_VERSION,
        summary: None,
        url: None,
        author: None,
        published_at: t1,
        thumbnail: None,
        is_read: false,
        is_starred: false,
        fetched_at: t1,
    };
    upsert_articles_in_current_transaction(conn, std::slice::from_ref(&article)).unwrap();

    // Re-sync synthesizes a newer published_at (e.g. now()) for the same id.
    article.published_at = t2;
    upsert_articles_in_current_transaction(conn, std::slice::from_ref(&article)).unwrap();

    let published_at: String = conn
        .query_row(
            "SELECT published_at FROM articles WHERE id = ?1",
            rusqlite::params![article.id.0],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        published_at, "2026-01-01T00:00:00+00:00",
        "existing older published_at should be preserved across re-sync"
    );

    // A later sync delivering an even older real publish date should replace it.
    let t0 = chrono::DateTime::parse_from_rfc3339("2025-12-01T00:00:00+00:00")
        .unwrap()
        .with_timezone(&chrono::Utc);
    article.published_at = t0;
    upsert_articles_in_current_transaction(conn, std::slice::from_ref(&article)).unwrap();

    let published_at: String = conn
        .query_row(
            "SELECT published_at FROM articles WHERE id = ?1",
            rusqlite::params![article.id.0],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        published_at, "2025-12-01T00:00:00+00:00",
        "an older real published_at delivered later should replace the synthesized value"
    );
}

fn make_test_feed(
    account_id: &AccountId,
    remote_id: &str,
    title: &str,
    url: &str,
    site_url: &str,
) -> Feed {
    Feed {
        id: FeedId::new(),
        account_id: account_id.clone(),
        folder_id: None,
        remote_id: Some(remote_id.to_string()),
        title: title.to_string(),
        url: url.to_string(),
        site_url: site_url.to_string(),
        icon: None,
        icon_url: None,
        unread_count: 0,
        reader_mode: "inherit".to_string(),
        web_preview_mode: "inherit".to_string(),
    }
}

fn insert_account_and_feeds(
    db: &Mutex<DbManager>,
    server_url: &str,
    feed_specs: &[(&str, &str, &str, &str)],
) -> (Account, Vec<Feed>) {
    let account = test_account(server_url);
    let feeds = feed_specs
        .iter()
        .map(|(remote_id, title, url, site_url)| {
            make_test_feed(&account.id, remote_id, title, url, site_url)
        })
        .collect::<Vec<_>>();

    let db_guard = db.lock().unwrap();
    let account_repo = SqliteAccountRepository::new(db_guard.writer());
    let feed_repo = SqliteFeedRepository::new(db_guard.writer());
    account_repo.save(&account).unwrap();
    for feed in &feeds {
        feed_repo.save(feed).unwrap();
    }

    (account, feeds)
}

fn test_local_account() -> Account {
    Account {
        id: AccountId::new(),
        kind: ProviderKind::Local,
        name: "Local".to_string(),
        server_url: None,
        username: None,
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    }
}

fn test_local_feed(account_id: &AccountId, feed_url: &str) -> Feed {
    Feed {
        id: FeedId::new(),
        account_id: account_id.clone(),
        folder_id: None,
        remote_id: None,
        title: "Local Feed".to_string(),
        url: feed_url.to_string(),
        site_url: "https://example.com".to_string(),
        icon: None,
        icon_url: None,
        unread_count: 0,
        reader_mode: "inherit".to_string(),
        web_preview_mode: "inherit".to_string(),
    }
}

fn insert_local_account_and_feed(db: &Mutex<DbManager>, feed_url: &str) -> (Account, Feed) {
    let account = test_local_account();
    let feed = test_local_feed(&account.id, feed_url);

    let db_guard = db.lock().unwrap();
    let account_repo = SqliteAccountRepository::new(db_guard.writer());
    let feed_repo = SqliteFeedRepository::new(db_guard.writer());
    account_repo.save(&account).unwrap();
    feed_repo.save(&feed).unwrap();

    (account, feed)
}

async fn authenticated_provider(server_url: &str) -> GReaderProvider {
    let mut provider = GReaderProvider::for_freshrss(server_url);
    provider
        .authenticate(&Credentials {
            token: Some("u".to_string()),
            password: Some("p".to_string()),
        })
        .await
        .unwrap();
    provider
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

#[test]
fn resolve_greader_subscription_folder_id_preserves_existing_folder_when_remote_folder_is_missing()
{
    let account_id = AccountId::new();
    let existing_folder_id = FolderId::new();
    let existing_feed = Feed {
        id: FeedId::new(),
        account_id,
        folder_id: Some(existing_folder_id.clone()),
        remote_id: Some("feed/https://example.com/rss".to_string()),
        title: "Feed".to_string(),
        url: "https://example.com/rss".to_string(),
        site_url: "https://example.com".to_string(),
        icon: None,
        icon_url: None,
        unread_count: 0,
        reader_mode: "on".to_string(),
        web_preview_mode: "off".to_string(),
    };
    let folder_remote_id_map = HashMap::new();

    let resolved = resolve_greader_subscription_folder_id(
        Some("user/-/label/Deleted Remote Folder"),
        &folder_remote_id_map,
        Some(&existing_feed),
    );

    assert_eq!(resolved, Some(existing_folder_id));
}

#[test]
fn resolve_greader_subscription_folder_id_uses_remote_folder_when_present() {
    let remote_folder_id = FolderId::new();
    let folder_remote_id_map = HashMap::from([(
        "user/-/label/Remote Folder".to_string(),
        remote_folder_id.clone(),
    )]);

    let resolved = resolve_greader_subscription_folder_id(
        Some("user/-/label/Remote Folder"),
        &folder_remote_id_map,
        None,
    );

    assert_eq!(resolved, Some(remote_folder_id));
}

#[test]
fn resolve_greader_folder_sort_order_preserves_existing_order_when_remote_order_is_missing() {
    let account_id = AccountId::new();
    let folder = Folder {
        id: FolderId::new(),
        account_id,
        remote_id: Some("user/-/label/Tech".to_string()),
        name: "Tech".to_string(),
        sort_order: 7,
    };
    let mut next_sort_order = 12;

    let sort_order = resolve_greader_folder_sort_order(None, Some(&folder), &mut next_sort_order);

    assert_eq!(sort_order, 7);
    assert_eq!(next_sort_order, 12);
}

#[test]
fn resolve_greader_folder_sort_order_assigns_new_missing_remote_order_to_tail() {
    let mut next_sort_order = 12;

    let sort_order = resolve_greader_folder_sort_order(None, None, &mut next_sort_order);

    assert_eq!(sort_order, 12);
    assert_eq!(next_sort_order, 13);
}

#[test]
fn resolve_greader_folder_sort_order_prefers_remote_order_when_present() {
    let account_id = AccountId::new();
    let folder = Folder {
        id: FolderId::new(),
        account_id,
        remote_id: Some("user/-/label/Tech".to_string()),
        name: "Tech".to_string(),
        sort_order: 7,
    };
    let mut next_sort_order = 12;

    let sort_order =
        resolve_greader_folder_sort_order(Some(3), Some(&folder), &mut next_sort_order);

    assert_eq!(sort_order, 3);
    assert_eq!(next_sort_order, 12);
}

#[tokio::test]
async fn sync_greader_account_uses_account_stream_for_full_sync_and_maps_entries_to_feeds() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_provider_response(ProviderHttpResponseFixture::auth_token())
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/tag/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::json(r#"{ "tags": [] }"#))
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/subscription/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::json(
            r#"{
                    "subscriptions": [
                        {
                            "id": "feed/https://example.com/feed-1.xml",
                            "title": "Feed One",
                            "url": "https://example.com/feed-1.xml",
                            "htmlUrl": "https://example.com/one",
                            "categories": [],
                            "iconUrl": "https://example.com/icon-one.png"
                        },
                        {
                            "id": "feed/https://example.com/feed-2.xml",
                            "title": "Feed Two",
                            "url": "https://example.com/feed-2.xml",
                            "htmlUrl": "https://example.com/two",
                            "categories": []
                        }
                    ]
                }"#,
        ))
        .create_async()
        .await;

    let account_stream_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/user%2F-%2Fstate%2Fcom.google%2Freading-list",
            )
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "200".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_provider_response(ProviderHttpResponseFixture::json(
                r#"{
                    "items": [
                        {
                            "id": "entry-1",
                            "title": "Article One",
                            "alternate": [{"href": "https://example.com/articles/1"}],
                            "summary": {"content": "Summary One"},
                            "content": {"content": "<p>Body One</p>"},
                            "timestampUsec": "1700000100000000",
                            "published": 1700000000,
                            "updated": 1700000100,
                            "origin": {
                                "streamId": "feed/https://example.com/feed-1.xml",
                                "title": "Feed One"
                            },
                            "categories": ["user/-/state/com.google/reading-list"]
                        },
                        {
                            "id": "entry-2",
                            "title": "Article Two",
                            "alternate": [{"href": "https://example.com/articles/2"}],
                            "summary": {"content": "Summary Two"},
                            "content": {"content": "<p>Body Two</p>"},
                            "timestampUsec": "1700000200000000",
                            "published": 1700000100,
                            "updated": 1700000200,
                            "origin": {
                                "streamId": "feed/https://example.com/feed-2.xml",
                                "title": "Feed Two"
                            },
                            "categories": ["user/-/state/com.google/reading-list"]
                        }
                    ]
                }"#,
            ))
            .create_async()
            .await;

    let per_feed_one_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/feed%2Fhttps%3A%2F%2Fexample.com%2Ffeed-1.xml",
            )
            .expect(0)
            .create_async()
            .await;
    let per_feed_two_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/feed%2Fhttps%3A%2F%2Fexample.com%2Ffeed-2.xml",
            )
            .expect(0)
            .create_async()
            .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("n".into(), "10000".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/read".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::empty_item_refs())
        .create_async()
        .await;
    server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("n".into(), "10000".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/starred".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::empty_item_refs())
        .create_async()
        .await;
    server
        .mock("GET", "/api/greader.php/reader/api/0/unread-count")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("all".into(), "true".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::json(
            r#"{
                    "unreadcounts": [
                        { "id": "feed/https://example.com/feed-1.xml", "count": 1 },
                        { "id": "feed/https://example.com/feed-2.xml", "count": 1 }
                    ]
                }"#,
        ))
        .create_async()
        .await;

    let db = test_db();
    let (account, feeds) = insert_account_and_feeds(
        &db,
        &server.url(),
        &[
            (
                "feed/https://example.com/feed-1.xml",
                "Feed One",
                "https://example.com/feed-1.xml",
                "https://example.com/one",
            ),
            (
                "feed/https://example.com/feed-2.xml",
                "Feed Two",
                "https://example.com/feed-2.xml",
                "https://example.com/two",
            ),
        ],
    );
    let stale_folder = Folder {
        id: FolderId::new(),
        account_id: account.id.clone(),
        remote_id: Some("user/-/label/Stale".to_string()),
        name: "Stale".to_string(),
        sort_order: 0,
    };
    {
        let db_guard = db.lock().unwrap();
        SqliteFolderRepository::new(db_guard.writer())
            .save(&stale_folder)
            .unwrap();
    }
    let _credentials = configure_dev_credentials(&account.id).await;

    let provider = GReaderProvider::for_freshrss(&server.url());
    let outcome = sync_greader_account(&db, &account, provider).await.unwrap();

    account_stream_mock.assert_async().await;
    per_feed_one_mock.assert_async().await;
    per_feed_two_mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    let folder_repo = SqliteFolderRepository::new(db_guard.reader());
    let feed_one_articles = article_repo
        .find_by_feed(&feeds[0].id, &Pagination::default())
        .unwrap();
    let feed_two_articles = article_repo
        .find_by_feed(&feeds[1].id, &Pagination::default())
        .unwrap();
    let feed_one = feed_repo.find_by_id(&feeds[0].id).unwrap().unwrap();
    let feed_two = feed_repo.find_by_id(&feeds[1].id).unwrap().unwrap();

    assert_eq!(outcome.warnings.len(), 1);
    assert_eq!(
            outcome.warnings[0].message,
            "FreshRSS removed 1 folder(s) that no longer exist remotely; their feeds were moved to Uncategorized."
        );
    assert!(folder_repo
        .find_by_remote_id(&account.id, "user/-/label/Stale")
        .unwrap()
        .is_none());
    assert_eq!(feed_one.icon.as_deref(), None);
    assert_eq!(feed_one_articles.len(), 1);
    assert_eq!(feed_two_articles.len(), 1);
    assert_eq!(feed_one_articles[0].title, "Article One");
    assert_eq!(feed_two_articles[0].title, "Article Two");
    assert_eq!(feed_one.unread_count, 1);
    assert_eq!(feed_two.unread_count, 1);
}

#[tokio::test]
async fn reconcile_greader_unread_counts_keeps_local_count_when_backfill_returns_no_articles() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let unread_stream_mock = server
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
        .with_status(200)
        .with_body(r#"{ "items": [] }"#)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, &server.url());
    let provider = authenticated_provider(&server.url()).await;
    let server_unread_counts = HashMap::from([(FEED_REMOTE_ID.to_string(), 1)]);

    let backfilled = reconcile_greader_unread_counts(
        &db,
        &provider,
        &account,
        std::slice::from_ref(&feed),
        &server_unread_counts,
    )
    .await
    .unwrap();

    unread_stream_mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    let reconciled_feed = feed_repo.find_by_id(&feed.id).unwrap().unwrap();

    assert_eq!(backfilled, 1);
    assert_eq!(reconciled_feed.unread_count, 0);
}

#[tokio::test]
async fn reconcile_greader_unread_counts_marks_local_surplus_unread_as_read() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let unread_stream_mock = server
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
        .with_status(200)
        .with_body(
            r#"{
                    "items": [
                        {
                            "id": "tag:google.com,2005:reader/item/0000000000000001",
                            "title": "Still Unread",
                            "alternate": [{ "href": "https://example.com/1" }],
                            "categories": [],
                            "published": 1767225600
                        }
                    ]
                }"#,
        )
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, &server.url());
    let sibling_feed = Feed {
        id: FeedId::new(),
        account_id: account.id.clone(),
        folder_id: None,
        remote_id: Some("feed/https://example.com/sibling-rss".to_string()),
        title: "Sibling Feed".to_string(),
        url: "https://example.com/sibling-rss".to_string(),
        site_url: "https://example.com".to_string(),
        icon: None,
        icon_url: None,
        unread_count: 0,
        reader_mode: "inherit".to_string(),
        web_preview_mode: "inherit".to_string(),
    };
    let local_articles = [
        Article {
            id: generate_entry_id(
                account.id.as_ref(),
                Some("tag:google.com,2005:reader/item/0000000000000001"),
                &feed.url,
                Some("https://example.com/1"),
                Some("Still Unread"),
            ),
            feed_id: feed.id.clone(),
            remote_id: Some("tag:google.com,2005:reader/item/0000000000000001".to_string()),
            title: "Still Unread".to_string(),
            content_raw: "body".to_string(),
            content_sanitized: "body".to_string(),
            sanitizer_version: sanitizer::SANITIZER_VERSION,
            summary: None,
            url: Some("https://example.com/1".to_string()),
            author: None,
            published_at: chrono::Utc::now(),
            thumbnail: None,
            is_read: false,
            is_starred: false,
            fetched_at: chrono::Utc::now(),
        },
        Article {
            id: generate_entry_id(
                account.id.as_ref(),
                Some("tag:google.com,2005:reader/item/0000000000000002"),
                &feed.url,
                Some("https://example.com/2"),
                Some("Stale Unread"),
            ),
            feed_id: feed.id.clone(),
            remote_id: Some("tag:google.com,2005:reader/item/0000000000000002".to_string()),
            title: "Stale Unread".to_string(),
            content_raw: "body".to_string(),
            content_sanitized: "body".to_string(),
            sanitizer_version: sanitizer::SANITIZER_VERSION,
            summary: None,
            url: Some("https://example.com/2".to_string()),
            author: None,
            published_at: chrono::Utc::now(),
            thumbnail: None,
            is_read: false,
            is_starred: false,
            fetched_at: chrono::Utc::now(),
        },
        Article {
            id: generate_entry_id(
                account.id.as_ref(),
                Some("tag:google.com,2005:reader/item/sibling-muted"),
                &sibling_feed.url,
                Some("https://example.com/sibling-muted"),
                Some("Kindle Unlimited sibling"),
            ),
            feed_id: sibling_feed.id.clone(),
            remote_id: Some("tag:google.com,2005:reader/item/sibling-muted".to_string()),
            title: "Kindle Unlimited sibling".to_string(),
            content_raw: "body".to_string(),
            content_sanitized: "body".to_string(),
            sanitizer_version: sanitizer::SANITIZER_VERSION,
            summary: None,
            url: Some("https://example.com/sibling-muted".to_string()),
            author: None,
            published_at: chrono::Utc::now(),
            thumbnail: None,
            is_read: false,
            is_starred: false,
            fetched_at: chrono::Utc::now(),
        },
    ];
    {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        feed_repo.save(&sibling_feed).unwrap();
        article_repo.upsert(&local_articles).unwrap();
        feed_repo.update_unread_count(&feed.id, 2).unwrap();
        feed_repo.update_unread_count(&sibling_feed.id, 77).unwrap();
        db_guard
            .writer()
            .execute(
                "INSERT INTO preferences (key, value) VALUES ('mute_auto_mark_read', 'true')",
                [],
            )
            .unwrap();
        db_guard
            .writer()
            .execute(
                "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?4)",
                rusqlite::params![
                    uuid::Uuid::new_v4().to_string(),
                    "kindle unlimited",
                    "title",
                    chrono::Utc::now().to_rfc3339()
                ],
            )
            .unwrap();
    }

    let provider = authenticated_provider(&server.url()).await;
    let server_unread_counts = HashMap::from([(FEED_REMOTE_ID.to_string(), 1)]);

    let backfilled = reconcile_greader_unread_counts(
        &db,
        &provider,
        &account,
        std::slice::from_ref(&feed),
        &server_unread_counts,
    )
    .await
    .unwrap();

    unread_stream_mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    let articles = article_repo
        .find_by_feed(&feed.id, &Pagination::default())
        .unwrap();
    let reconciled_feed = feed_repo.find_by_id(&feed.id).unwrap().unwrap();
    let sibling_feed_after = feed_repo.find_by_id(&sibling_feed.id).unwrap().unwrap();
    let sibling_article_is_read: bool = db_guard
        .reader()
        .query_row(
            "SELECT is_read FROM articles WHERE feed_id = ?1",
            rusqlite::params![sibling_feed.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    let read_by_remote_id = articles
        .iter()
        .map(|article| (article.remote_id.as_deref(), article.is_read))
        .collect::<HashMap<_, _>>();

    assert_eq!(backfilled, 0);
    assert_eq!(reconciled_feed.unread_count, 1);
    assert_eq!(
        read_by_remote_id.get(&Some("tag:google.com,2005:reader/item/0000000000000001")),
        Some(&false)
    );
    assert_eq!(
        read_by_remote_id.get(&Some("tag:google.com,2005:reader/item/0000000000000002")),
        Some(&true)
    );
    assert!(!sibling_article_is_read);
    assert_eq!(sibling_feed_after.unread_count, 77);
}

#[tokio::test]
async fn reconcile_greader_unread_counts_does_not_treat_star_pending_as_read_pending() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let unread_stream_mock = server
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
        .with_status(200)
        .with_body(r#"{ "items": [] }"#)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, &server.url());
    let remote_entry_id = "tag:google.com,2005:reader/item/star-pending-only";
    {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        article_repo
            .upsert(&[Article {
                id: generate_entry_id(
                    account.id.as_ref(),
                    Some(remote_entry_id),
                    &feed.url,
                    Some("https://example.com/star-pending"),
                    Some("Star Pending Only"),
                ),
                feed_id: feed.id.clone(),
                remote_id: Some(remote_entry_id.to_string()),
                title: "Star Pending Only".to_string(),
                content_raw: "body".to_string(),
                content_sanitized: "body".to_string(),
                sanitizer_version: sanitizer::SANITIZER_VERSION,
                summary: None,
                url: Some("https://example.com/star-pending".to_string()),
                author: None,
                published_at: chrono::Utc::now(),
                thumbnail: None,
                is_read: false,
                is_starred: false,
                fetched_at: chrono::Utc::now(),
            }])
            .unwrap();
        feed_repo.update_unread_count(&feed.id, 1).unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
                     VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![
                        account.id.as_ref(),
                        PendingMutationType::Star.as_str(),
                        remote_entry_id,
                        "2024-01-01T00:00:00Z"
                    ],
                )
                .unwrap();
    }

    let provider = authenticated_provider(&server.url()).await;
    let server_unread_counts = HashMap::from([(FEED_REMOTE_ID.to_string(), 0)]);

    reconcile_greader_unread_counts(
        &db,
        &provider,
        &account,
        std::slice::from_ref(&feed),
        &server_unread_counts,
    )
    .await
    .unwrap();

    unread_stream_mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let articles = article_repo
        .find_by_feed(&feed.id, &Pagination::default())
        .unwrap();

    assert_eq!(articles[0].remote_id.as_deref(), Some(remote_entry_id));
    assert!(articles[0].is_read);
}

#[tokio::test]
async fn sync_greader_account_uses_account_sync_state_for_incremental_sync() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/tag/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "tags": [] }"#)
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/subscription/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                    "subscriptions": [
                        {
                            "id": "feed/https://example.com/feed-1.xml",
                            "title": "Feed One",
                            "url": "https://example.com/feed-1.xml",
                            "htmlUrl": "https://example.com/one",
                            "categories": []
                        }
                    ]
                }"#,
        )
        .create_async()
        .await;

    let account_stream_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/user%2F-%2Fstate%2Fcom.google%2Freading-list",
            )
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "200".into()),
                Matcher::UrlEncoded("ot".into(), "1700000000000000".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "items": [] }"#)
            .create_async()
            .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("n".into(), "10000".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/read".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "itemRefs": [] }"#)
        .create_async()
        .await;
    server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("n".into(), "10000".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/starred".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "itemRefs": [] }"#)
        .create_async()
        .await;
    server
        .mock("GET", "/api/greader.php/reader/api/0/unread-count")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("all".into(), "true".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "unreadcounts": [] }"#)
        .create_async()
        .await;

    let db = test_db();
    let (account, _feeds) = insert_account_and_feeds(
        &db,
        &server.url(),
        &[(
            "feed/https://example.com/feed-1.xml",
            "Feed One",
            "https://example.com/feed-1.xml",
            "https://example.com/one",
        )],
    );
    {
        let db_guard = db.lock().unwrap();
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        sync_state_repo
            .save(&SyncState {
                account_id: account.id.clone(),
                scope_key: SyncStateScopeKey::greader_account_all().as_string(),
                timestamp_usec: Some(1_700_000_000_000_000),
                continuation: None,
                etag: None,
                last_modified: None,
                last_success_at: None,
                last_error: Some("stale".to_string()),
                error_count: 2,
                next_retry_at: Some("2025-01-01T01:00:00Z".to_string()),
            })
            .unwrap();
    }
    let _credentials = configure_dev_credentials(&account.id).await;

    let provider = GReaderProvider::for_freshrss(&server.url());
    sync_greader_account(&db, &account, provider).await.unwrap();

    account_stream_mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let state = sync_state_repo
        .get(&account.id, &SyncStateScopeKey::greader_account_all())
        .unwrap()
        .unwrap();

    assert_eq!(state.timestamp_usec, Some(1_700_000_000_000_000));
    assert_eq!(state.last_error, None);
    assert_eq!(state.error_count, 0);
    assert_eq!(state.next_retry_at, None);
    assert!(state.last_success_at.is_some());
}

#[tokio::test]
async fn sync_greader_account_entries_records_failure_state_when_later_page_fails() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let page1_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/user%2F-%2Fstate%2Fcom.google%2Freading-list",
            )
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "200".into()),
                Matcher::UrlEncoded("ot".into(), "1700000000000000".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "items": [
                        {
                            "id": "entry-1",
                            "title": "Page 1",
                            "alternate": [{"href": "https://example.com/1"}],
                            "summary": {"content": "Summary 1"},
                            "timestampUsec": "1700000100000000",
                            "published": 1700000100,
                            "origin": {
                                "streamId": "feed/https://example.com/rss",
                                "title": "Example"
                            },
                            "categories": []
                        }
                    ],
                    "continuation": "page-2"
                }"#,
            )
            .create_async()
            .await;

    let page2_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/user%2F-%2Fstate%2Fcom.google%2Freading-list",
            )
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "200".into()),
                Matcher::UrlEncoded("c".into(), "page-2".into()),
                Matcher::UrlEncoded("ot".into(), "1700000100000000".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(500)
            .with_body("boom")
            .create_async()
            .await;

    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, &server.url());
    let saved_state = SyncState {
        account_id: account.id.clone(),
        scope_key: SyncStateScopeKey::greader_account_all().as_string(),
        timestamp_usec: Some(1_700_000_000_000_000),
        continuation: None,
        etag: Some("etag-old".to_string()),
        last_modified: Some("Wed, 01 Jan 2025 00:00:00 GMT".to_string()),
        last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
        last_error: Some("old error".to_string()),
        error_count: 1,
        next_retry_at: Some("2025-01-01T01:00:00Z".to_string()),
    };
    {
        let db_guard = db.lock().unwrap();
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        sync_state_repo.save(&saved_state).unwrap();
    }

    let provider = authenticated_provider(&server.url()).await;
    let feeds_by_remote_id = HashMap::from([(FEED_REMOTE_ID.to_string(), feed.clone())]);
    let error = sync_greader_account_entries(&db, &provider, &account, &feeds_by_remote_id)
        .await
        .unwrap_err();

    page1_mock.assert_async().await;
    page2_mock.assert_async().await;
    assert!(error.to_string().contains("500"));

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let articles = article_repo
        .find_by_feed(&feed.id, &Pagination::default())
        .unwrap();
    let state = sync_state_repo
        .get(&account.id, &SyncStateScopeKey::greader_account_all())
        .unwrap()
        .unwrap();

    assert_eq!(articles.len(), 1);
    assert_eq!(state.timestamp_usec, Some(1_700_000_100_000_000));
    assert_eq!(state.continuation, None);
    assert_eq!(state.etag, None);
    assert_eq!(state.last_modified, None);
    assert_eq!(state.last_success_at, saved_state.last_success_at);
    assert!(state
        .last_error
        .as_deref()
        .is_some_and(|message| message.contains("500")));
    assert_eq!(state.error_count, 2);
    assert_eq!(state.next_retry_at, None);
}

#[tokio::test]
async fn sync_greader_account_turns_account_level_skips_into_warnings() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/tag/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "tags": [] }"#)
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/subscription/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                    "subscriptions": [
                        {
                            "id": "feed/https://example.com/feed-1.xml",
                            "title": "Feed One",
                            "url": "https://example.com/feed-1.xml",
                            "htmlUrl": "https://example.com/one",
                            "categories": []
                        }
                    ]
                }"#,
        )
        .create_async()
        .await;

    let account_stream_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/user%2F-%2Fstate%2Fcom.google%2Freading-list",
            )
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "200".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(
                r#"{
                    "items": [
                        {
                            "id": "entry-without-origin",
                            "title": "Missing Origin",
                            "categories": []
                        }
                    ]
                }"#,
            )
            .create_async()
            .await;

    let per_feed_one_mock = server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/feed%2Fhttps%3A%2F%2Fexample.com%2Ffeed-1.xml",
            )
            .expect(0)
            .create_async()
            .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("n".into(), "10000".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/read".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "itemRefs": [] }"#)
        .create_async()
        .await;
    server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("n".into(), "10000".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/starred".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "itemRefs": [] }"#)
        .create_async()
        .await;
    server
        .mock("GET", "/api/greader.php/reader/api/0/unread-count")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("all".into(), "true".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                    "unreadcounts": [
                        { "id": "feed/https://example.com/feed-1.xml", "count": 0 }
                    ]
                }"#,
        )
        .create_async()
        .await;
    let local_failure_mock = server
        .mock("GET", "/local-broken.xml")
        .expect(0)
        .with_status(500)
        .with_body("server error")
        .create_async()
        .await;

    let local_broken_url = format!("{}/local-broken.xml", server.url());
    let db = test_db();
    let (account, feeds) = insert_account_and_feeds(
        &db,
        &server.url(),
        &[
            (
                "feed/https://example.com/feed-1.xml",
                "Feed One",
                "https://example.com/feed-1.xml",
                "https://example.com/one",
            ),
            (
                "",
                "Broken Local",
                &local_broken_url,
                "https://example.com/local",
            ),
        ],
    );
    let _credentials = configure_dev_credentials(&account.id).await;

    let provider = GReaderProvider::for_freshrss(&server.url());
    let outcome = sync_greader_account(&db, &account, provider).await.unwrap();

    account_stream_mock.assert_async().await;
    per_feed_one_mock.assert_async().await;
    local_failure_mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let articles = article_repo
        .find_by_feed(&feeds[0].id, &Pagination::default())
        .unwrap();

    assert!(articles.is_empty());
    assert_eq!(outcome.warnings.len(), 2);
    assert!(outcome.warnings.iter().any(|warning| warning
        .message
        .contains("skipped 1 entry item(s) during sync")));
    assert!(outcome.warnings.iter().any(|warning| warning
        .message
        .contains("Local feed 'Broken Local' failed during provider sync")));
}

#[tokio::test]
async fn sync_greader_account_skips_pull_state_when_recent_remote_state_sync_exists() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/tag/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "tags": [] }"#)
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/subscription/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                    "subscriptions": [
                        {
                            "id": "feed/https://example.com/feed-1.xml",
                            "title": "Feed One",
                            "url": "https://example.com/feed-1.xml",
                            "htmlUrl": "https://example.com/one",
                            "categories": []
                        }
                    ]
                }"#,
        )
        .create_async()
        .await;

    server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/user%2F-%2Fstate%2Fcom.google%2Freading-list",
            )
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "200".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "items": [] }"#)
            .create_async()
            .await;

    let pull_state_read_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("n".into(), "10000".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/read".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .expect(0)
        .create_async()
        .await;
    let pull_state_starred_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("n".into(), "10000".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/starred".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .expect(0)
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/unread-count")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("all".into(), "true".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "unreadcounts": [] }"#)
        .create_async()
        .await;

    let db = test_db();
    let (account, _feeds) = insert_account_and_feeds(
        &db,
        &server.url(),
        &[(
            "feed/https://example.com/feed-1.xml",
            "Feed One",
            "https://example.com/feed-1.xml",
            "https://example.com/one",
        )],
    );
    {
        let db_guard = db.lock().unwrap();
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        sync_state_repo
            .save(&SyncState {
                account_id: account.id.clone(),
                scope_key: SyncStateScopeKey::greader_remote_state_full().as_string(),
                timestamp_usec: Some(chrono::Utc::now().timestamp_micros()),
                continuation: None,
                etag: None,
                last_modified: None,
                last_success_at: Some(chrono::Utc::now().to_rfc3339()),
                last_error: None,
                error_count: 0,
                next_retry_at: None,
            })
            .unwrap();
    }
    let _credentials = configure_dev_credentials(&account.id).await;

    let provider = GReaderProvider::for_freshrss(&server.url());
    sync_greader_account(&db, &account, provider).await.unwrap();

    pull_state_read_mock.assert_async().await;
    pull_state_starred_mock.assert_async().await;
}

#[tokio::test]
async fn sync_greader_account_guards_pushed_and_retrying_pending_state() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_provider_response(ProviderHttpResponseFixture::auth_token())
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/tag/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::json(r#"{ "tags": [] }"#))
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/subscription/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::json(
            r#"{
                    "subscriptions": [
                        {
                            "id": "feed/https://example.com/feed-1.xml",
                            "title": "Feed One",
                            "url": "https://example.com/feed-1.xml",
                            "htmlUrl": "https://example.com/one",
                            "categories": []
                        }
                    ]
                }"#,
        ))
        .create_async()
        .await;

    server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/user%2F-%2Fstate%2Fcom.google%2Freading-list",
            )
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "200".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_provider_response(ProviderHttpResponseFixture::json(r#"{ "items": [] }"#))
            .create_async()
            .await;

    let pushed_mutation_mock = server
        .mock("POST", "/api/greader.php/reader/api/0/edit-tag")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .match_body("i=entry-pushed&a=user%2F-%2Fstate%2Fcom.google%2Fread")
        .with_status(200)
        .with_body("OK")
        .create_async()
        .await;
    let retry_mutation_mock = server
        .mock("POST", "/api/greader.php/reader/api/0/edit-tag")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .match_body("i=entry-retry&a=user%2F-%2Fstate%2Fcom.google%2Fread")
        .with_status(500)
        .with_body("failed")
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("n".into(), "10000".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/read".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::empty_item_refs())
        .create_async()
        .await;
    server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("n".into(), "10000".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/starred".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::empty_item_refs())
        .create_async()
        .await;
    server
        .mock("GET", "/api/greader.php/reader/api/0/unread-count")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("all".into(), "true".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::json(
            r#"{ "unreadcounts": [{ "id": "feed/https://example.com/feed-1.xml", "count": 0 }] }"#,
        ))
        .create_async()
        .await;

    let db = test_db();
    let (account, feeds) = insert_account_and_feeds(
        &db,
        &server.url(),
        &[(
            "feed/https://example.com/feed-1.xml",
            "Feed One",
            "https://example.com/feed-1.xml",
            "https://example.com/one",
        )],
    );
    {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let pending_repo = SqlitePendingMutationRepository::new(db_guard.writer());
        let now = chrono::Utc::now();
        article_repo
            .upsert(&[
                Article {
                    id: ArticleId("article-pushed".to_string()),
                    feed_id: feeds[0].id.clone(),
                    remote_id: Some("entry-pushed".to_string()),
                    title: "Pushed".to_string(),
                    content_raw: "<p>Pushed</p>".to_string(),
                    content_sanitized: "<p>Pushed</p>".to_string(),
                    sanitizer_version: sanitizer::SANITIZER_VERSION,
                    summary: None,
                    url: Some("https://example.com/pushed".to_string()),
                    author: None,
                    published_at: now,
                    thumbnail: None,
                    is_read: true,
                    is_starred: false,
                    fetched_at: now,
                },
                Article {
                    id: ArticleId("article-retry".to_string()),
                    feed_id: feeds[0].id.clone(),
                    remote_id: Some("entry-retry".to_string()),
                    title: "Retry".to_string(),
                    content_raw: "<p>Retry</p>".to_string(),
                    content_sanitized: "<p>Retry</p>".to_string(),
                    sanitizer_version: sanitizer::SANITIZER_VERSION,
                    summary: None,
                    url: Some("https://example.com/retry".to_string()),
                    author: None,
                    published_at: now,
                    thumbnail: None,
                    is_read: true,
                    is_starred: false,
                    fetched_at: now,
                },
            ])
            .unwrap();
        pending_repo
            .save(&PendingMutation {
                id: None,
                account_id: account.id.clone(),
                mutation_type: PendingMutationType::MarkRead,
                remote_entry_id: "entry-pushed".to_string(),
                created_at: "2026-05-23T00:00:00Z".to_string(),
            })
            .unwrap();
        pending_repo
            .save(&PendingMutation {
                id: None,
                account_id: account.id.clone(),
                mutation_type: PendingMutationType::MarkRead,
                remote_entry_id: "entry-retry".to_string(),
                created_at: "2026-05-23T00:00:01Z".to_string(),
            })
            .unwrap();
    }
    let _credentials = configure_dev_credentials(&account.id).await;

    let provider = GReaderProvider::for_freshrss(&server.url());
    let outcome = sync_greader_account(&db, &account, provider).await.unwrap();

    pushed_mutation_mock.assert_async().await;
    retry_mutation_mock.assert_async().await;
    assert_eq!(outcome.warnings.len(), 1);
    assert_eq!(
        outcome.warnings[0].kind,
        AccountSyncWarningKind::RetryPending
    );

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let pending_repo = SqlitePendingMutationRepository::new(db_guard.reader());
    let saved_articles = article_repo
        .find_by_feed(
            &feeds[0].id,
            &Pagination {
                offset: 0,
                limit: 10,
            },
        )
        .unwrap();
    let read_by_remote_id = saved_articles
        .iter()
        .filter_map(|article| {
            article
                .remote_id
                .as_ref()
                .map(|remote_id| (remote_id.as_str(), article.is_read))
        })
        .collect::<HashMap<_, _>>();
    assert_eq!(read_by_remote_id.get("entry-pushed"), Some(&true));
    assert_eq!(read_by_remote_id.get("entry-retry"), Some(&true));

    let pending = pending_repo.find_by_account(&account.id).unwrap();
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].remote_entry_id, "entry-retry");
}

#[tokio::test]
async fn sync_greader_feed_entries_uses_saved_timestamp_for_incremental_sync() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let stream_mock = server
        .mock(
            "GET",
            Matcher::Regex(r"/api/greader.php/reader/api/0/stream/contents/.*".to_string()),
        )
        .match_query(Matcher::Regex(
            "^output=json&n=200&ot=1700000000000000$".to_string(),
        ))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "items": [] }"#)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, &server.url());
    let saved_state = SyncState {
        account_id: account.id.clone(),
        scope_key: feed_scope_key(FEED_REMOTE_ID).as_string(),
        timestamp_usec: Some(1_700_000_000_000_000),
        continuation: Some("stale-continuation".to_string()),
        etag: Some("etag-old".to_string()),
        last_modified: Some("Wed, 01 Jan 2025 00:00:00 GMT".to_string()),
        last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
        last_error: Some("previous failure".to_string()),
        error_count: 2,
        next_retry_at: Some("2025-01-01T01:00:00Z".to_string()),
    };
    {
        let db_guard = db.lock().unwrap();
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        sync_state_repo.save(&saved_state).unwrap();
    }

    let provider = authenticated_provider(&server.url()).await;
    sync_greader_feed_entries(&db, &provider, &account, &feed)
        .await
        .unwrap();

    stream_mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let state = sync_state_repo
        .get(&account.id, &feed_scope_key(FEED_REMOTE_ID))
        .unwrap()
        .unwrap();

    assert_eq!(state.timestamp_usec, Some(1_700_000_000_000_000));
    assert_eq!(state.continuation, None);
    assert_eq!(state.etag, None);
    assert_eq!(state.last_modified, None);
    assert_eq!(state.last_error, None);
    assert_eq!(state.error_count, 0);
    assert_eq!(state.next_retry_at, None);
    assert!(state.last_success_at.is_some());
}

#[tokio::test]
async fn sync_greader_feed_entries_advances_timestamp_from_entries_without_next_cursor() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let stream_mock = server
        .mock(
            "GET",
            Matcher::Regex(r"/api/greader.php/reader/api/0/stream/contents/.*".to_string()),
        )
        .match_query(Matcher::Regex("^output=json&n=200$".to_string()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                    "items": [
                        {
                            "id": "entry-without-provider-cursor",
                            "title": "No Cursor",
                            "alternate": [{"href": "https://example.com/no-cursor"}],
                            "published": 1700000100,
                            "origin": {
                                "streamId": "feed/https://example.com/rss",
                                "title": "Example"
                            },
                            "categories": []
                        }
                    ]
                }"#,
        )
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, &server.url());
    let provider = authenticated_provider(&server.url()).await;

    sync_greader_feed_entries(&db, &provider, &account, &feed)
        .await
        .unwrap();

    stream_mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let state = sync_state_repo
        .get(&account.id, &feed_scope_key(FEED_REMOTE_ID))
        .unwrap()
        .unwrap();

    assert_eq!(state.timestamp_usec, Some(1_700_000_100_000_000));
}

#[tokio::test]
async fn sync_greader_feed_entries_advances_timestamp_after_all_pages_finish() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let page1_mock = server
        .mock(
            "GET",
            Matcher::Regex(r"/api/greader.php/reader/api/0/stream/contents/.*".to_string()),
        )
        .match_query(Matcher::Regex(
            "^output=json&n=200&ot=1700000000000000$".to_string(),
        ))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                    "items": [
                        {
                            "id": "entry-1",
                            "title": "Page 1",
                            "alternate": [{"href": "https://example.com/1"}],
                            "summary": {"content": "Summary 1"},
                            "timestampUsec": "1700000100000000",
                            "published": 1700000100,
                            "origin": {
                                "streamId": "feed/https://example.com/rss",
                                "title": "Example"
                            },
                            "categories": []
                        }
                    ],
                    "continuation": "page-2"
                }"#,
        )
        .create_async()
        .await;

    let page2_mock = server
        .mock(
            "GET",
            Matcher::Regex(r"/api/greader.php/reader/api/0/stream/contents/.*".to_string()),
        )
        .match_query(Matcher::Regex(
            "^output=json&n=200&c=page-2&ot=1700000100000000$".to_string(),
        ))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                    "items": [
                        {
                            "id": "entry-2",
                            "title": "Page 2",
                            "alternate": [{"href": "https://example.com/2"}],
                            "summary": {"content": "Summary 2"},
                            "updated": 1700000200,
                            "published": 1700000190,
                            "origin": {
                                "streamId": "feed/https://example.com/rss",
                                "title": "Example"
                            },
                            "categories": ["user/-/state/com.google/read"]
                        }
                    ]
                }"#,
        )
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, &server.url());
    {
        let db_guard = db.lock().unwrap();
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        sync_state_repo
            .save(&SyncState {
                account_id: account.id.clone(),
                scope_key: feed_scope_key(FEED_REMOTE_ID).as_string(),
                timestamp_usec: Some(1_700_000_000_000_000),
                continuation: None,
                etag: None,
                last_modified: None,
                last_success_at: None,
                last_error: None,
                error_count: 0,
                next_retry_at: None,
            })
            .unwrap();
    }

    let provider = authenticated_provider(&server.url()).await;
    sync_greader_feed_entries(&db, &provider, &account, &feed)
        .await
        .unwrap();

    page1_mock.assert_async().await;
    page2_mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let articles = article_repo
        .find_by_feed(&feed.id, &Pagination::default())
        .unwrap();
    let state = sync_state_repo
        .get(&account.id, &feed_scope_key(FEED_REMOTE_ID))
        .unwrap()
        .unwrap();

    assert_eq!(articles.len(), 2);
    assert_eq!(state.timestamp_usec, Some(1_700_000_200_000_000));
    assert_eq!(state.continuation, None);
}

#[tokio::test]
async fn sync_greader_feed_entries_records_failure_state_when_later_page_fails() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let page1_mock = server
        .mock(
            "GET",
            Matcher::Regex(r"/api/greader.php/reader/api/0/stream/contents/.*".to_string()),
        )
        .match_query(Matcher::Regex(
            "^output=json&n=200&ot=1700000000000000$".to_string(),
        ))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                    "items": [
                        {
                            "id": "entry-1",
                            "title": "Page 1",
                            "alternate": [{"href": "https://example.com/1"}],
                            "summary": {"content": "Summary 1"},
                            "timestampUsec": "1700000100000000",
                            "published": 1700000100,
                            "origin": {
                                "streamId": "feed/https://example.com/rss",
                                "title": "Example"
                            },
                            "categories": []
                        }
                    ],
                    "continuation": "page-2"
                }"#,
        )
        .create_async()
        .await;

    let page2_mock = server
        .mock(
            "GET",
            Matcher::Regex(r"/api/greader.php/reader/api/0/stream/contents/.*".to_string()),
        )
        .match_query(Matcher::Regex(
            "^output=json&n=200&c=page-2&ot=1700000100000000$".to_string(),
        ))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(500)
        .with_body("boom")
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, &server.url());
    let saved_state = SyncState {
        account_id: account.id.clone(),
        scope_key: feed_scope_key(FEED_REMOTE_ID).as_string(),
        timestamp_usec: Some(1_700_000_000_000_000),
        continuation: None,
        etag: Some("etag-old".to_string()),
        last_modified: Some("Wed, 01 Jan 2025 00:00:00 GMT".to_string()),
        last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
        last_error: Some("old error".to_string()),
        error_count: 1,
        next_retry_at: Some("2025-01-01T01:00:00Z".to_string()),
    };
    {
        let db_guard = db.lock().unwrap();
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        sync_state_repo.save(&saved_state).unwrap();
    }

    let provider = authenticated_provider(&server.url()).await;
    let error = sync_greader_feed_entries(&db, &provider, &account, &feed)
        .await
        .unwrap_err();

    page1_mock.assert_async().await;
    page2_mock.assert_async().await;
    assert!(error.to_string().contains("500"));

    let db_guard = db.lock().unwrap();
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let state = sync_state_repo
        .get(&account.id, &feed_scope_key(FEED_REMOTE_ID))
        .unwrap()
        .unwrap();

    assert_eq!(state.timestamp_usec, Some(1_700_000_100_000_000));
    assert_eq!(state.continuation, None);
    assert_eq!(state.etag, None);
    assert_eq!(state.last_modified, None);
    assert_eq!(state.last_success_at, saved_state.last_success_at);
    assert!(state
        .last_error
        .as_deref()
        .is_some_and(|message| message.contains("500")));
    assert_eq!(state.error_count, 2);
    assert_eq!(state.next_retry_at, None);
}

#[tokio::test]
async fn repair_greader_remote_state_applies_read_flags_and_recalculates_counts() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("n".into(), "10000".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/read".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "itemRefs": [{ "id": "1" }] }"#)
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("n".into(), "10000".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/starred".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "itemRefs": [] }"#)
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/unread-count")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("all".into(), "true".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(format!(
            r#"{{ "unreadcounts": [{{ "id": "{FEED_REMOTE_ID}", "count": 0 }}] }}"#
        ))
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, &server.url());
    {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        let article = Article {
            id: generate_entry_id(
                account.id.as_ref(),
                Some("tag:google.com,2005:reader/item/0000000000000001"),
                &feed.url,
                Some("https://example.com/1"),
                Some("Example Article"),
            ),
            feed_id: feed.id.clone(),
            remote_id: Some("tag:google.com,2005:reader/item/0000000000000001".to_string()),
            title: "Example Article".to_string(),
            content_raw: "body".to_string(),
            content_sanitized: "body".to_string(),
            sanitizer_version: sanitizer::SANITIZER_VERSION,
            summary: None,
            url: Some("https://example.com/1".to_string()),
            author: None,
            published_at: chrono::Utc::now(),
            thumbnail: None,
            is_read: false,
            is_starred: false,
            fetched_at: chrono::Utc::now(),
        };
        article_repo.upsert(&[article]).unwrap();
        feed_repo.update_unread_count(&feed.id, 1).unwrap();
    }

    let _credentials = configure_dev_credentials(&account.id).await;

    let provider = GReaderProvider::for_freshrss(&server.url());
    repair_greader_remote_state(&db, &account, provider)
        .await
        .unwrap();

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    let articles = article_repo
        .find_by_feed(&feed.id, &Pagination::default())
        .unwrap();
    let repaired_feed = feed_repo.find_by_id(&feed.id).unwrap().unwrap();

    assert_eq!(articles.len(), 1);
    assert!(articles[0].is_read);
    assert_eq!(repaired_feed.unread_count, 0);
}

#[tokio::test]
async fn repair_greader_remote_state_keeps_article_marked_read_during_pull_state() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let db = std::sync::Arc::new(test_db());
    let (account, feed) = insert_account_and_feed(&db, &server.url());
    let remote_entry_id = "tag:google.com,2005:reader/item/0000000000000002".to_string();
    let article_id = generate_entry_id(
        account.id.as_ref(),
        Some(&remote_entry_id),
        &feed.url,
        Some("https://example.com/2"),
        Some("Read During Pull"),
    );
    {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let article = Article {
            id: article_id.clone(),
            feed_id: feed.id.clone(),
            remote_id: Some(remote_entry_id.clone()),
            title: "Read During Pull".to_string(),
            content_raw: "body".to_string(),
            content_sanitized: "body".to_string(),
            sanitizer_version: sanitizer::SANITIZER_VERSION,
            summary: None,
            url: Some("https://example.com/2".to_string()),
            author: None,
            published_at: chrono::Utc::now(),
            thumbnail: None,
            is_read: false,
            is_starred: false,
            fetched_at: chrono::Utc::now(),
        };
        article_repo.upsert(&[article]).unwrap();
    }

    // Remote still reports the article as unread. While the read-ids
    // stream response is being produced (mid pull_state), the user marks
    // the article read locally, queueing a pending mutation.
    let mark_read_db = std::sync::Arc::clone(&db);
    let mark_read_account_id = account.id.clone();
    let mark_read_article_id = article_id.clone();
    let mark_read_remote_entry_id = remote_entry_id.clone();
    server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/read".into()),
        ]))
        .with_status(200)
        .with_body_from_request(move |_| {
            let db_guard = mark_read_db.lock().unwrap();
            db_guard
                .writer()
                .execute(
                    "UPDATE articles SET is_read = 1 WHERE id = ?1",
                    rusqlite::params![mark_read_article_id.0],
                )
                .unwrap();
            let pending_repo = SqlitePendingMutationRepository::new(db_guard.writer());
            pending_repo
                .save(&PendingMutation {
                    id: None,
                    account_id: mark_read_account_id.clone(),
                    mutation_type: PendingMutationType::MarkRead,
                    remote_entry_id: mark_read_remote_entry_id.clone(),
                    created_at: chrono::Utc::now().to_rfc3339(),
                })
                .unwrap();
            br#"{ "itemRefs": [] }"#.to_vec()
        })
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/starred".into()),
        ]))
        .with_status(200)
        .with_body(r#"{ "itemRefs": [] }"#)
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/unread-count")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("all".into(), "true".into()),
        ]))
        .with_status(200)
        .with_body(format!(
            r#"{{ "unreadcounts": [{{ "id": "{FEED_REMOTE_ID}", "count": 0 }}] }}"#
        ))
        .create_async()
        .await;

    let _credentials = configure_dev_credentials(&account.id).await;

    let provider = GReaderProvider::for_freshrss(&server.url());
    repair_greader_remote_state(&db, &account, provider)
        .await
        .unwrap();

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let articles = article_repo
        .find_by_feed(&feed.id, &Pagination::default())
        .unwrap();
    assert_eq!(articles.len(), 1);
    assert!(
        articles[0].is_read,
        "a read marked during pull_state should stay read after apply_remote_state"
    );
}

#[tokio::test]
async fn sync_local_feed_initial_fetch_saves_articles_and_validators() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .match_header("if-none-match", Matcher::Missing)
        .match_header("if-modified-since", Matcher::Missing)
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_header("etag", LOCAL_ETAG_NEW)
        .with_header("last-modified", LOCAL_LAST_MODIFIED_NEW)
        .with_body(LOCAL_RSS_INITIAL)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();

    sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .unwrap();

    mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let articles = article_repo
        .find_by_feed(&feed.id, &Pagination::default())
        .unwrap();
    let state = sync_state_repo
        .get(&account.id, &local_feed_scope_key(&feed.url))
        .unwrap()
        .unwrap();

    assert_eq!(articles.len(), 1);
    assert_eq!(articles[0].title, "Local Article");
    assert_eq!(state.etag.as_deref(), Some(LOCAL_ETAG_NEW));
    assert_eq!(
        state.last_modified.as_deref(),
        Some(LOCAL_LAST_MODIFIED_NEW)
    );
    assert_eq!(state.continuation, None);
    assert_eq!(state.timestamp_usec, None);
    assert_eq!(state.error_count, 0);
    assert!(state.last_success_at.is_some());
}

#[tokio::test]
async fn sync_local_feed_saves_validators_under_requested_and_redirect_final_scope_keys() {
    let mut server = mockito::Server::new_async().await;
    let requested_feed_url = format!("{}/old-feed.xml?z=last&a=first", server.url());
    let redirect = server
        .mock("GET", "/old-feed.xml")
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("z".into(), "last".into()),
            mockito::Matcher::UrlEncoded("a".into(), "first".into()),
        ]))
        .with_status(308)
        .with_header("location", "/feed.xml?b=2&a=1")
        .create_async()
        .await;
    let final_feed = server
        .mock("GET", "/feed.xml")
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("b".into(), "2".into()),
            mockito::Matcher::UrlEncoded("a".into(), "1".into()),
        ]))
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_header("etag", LOCAL_ETAG_NEW)
        .with_header("last-modified", LOCAL_LAST_MODIFIED_NEW)
        .with_body(LOCAL_RSS_INITIAL)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &requested_feed_url);
    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();

    sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .unwrap();

    redirect.assert_async().await;
    final_feed.assert_async().await;

    let db_guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let saved_feed = feed_repo.find_by_id(&feed.id).unwrap().unwrap();
    let requested_state = sync_state_repo
        .get(&account.id, local_feed_scope_key(&requested_feed_url))
        .unwrap()
        .unwrap();
    let final_state = sync_state_repo
        .get(
            &account.id,
            local_feed_scope_key(&format!("{}/feed.xml?a=1&b=2", server.url())),
        )
        .unwrap()
        .unwrap();

    assert_eq!(requested_state.etag.as_deref(), Some(LOCAL_ETAG_NEW));
    assert_eq!(final_state.etag.as_deref(), Some(LOCAL_ETAG_NEW));
    assert_eq!(
        requested_state.last_modified.as_deref(),
        Some(LOCAL_LAST_MODIFIED_NEW)
    );
    assert_eq!(
        final_state.last_modified.as_deref(),
        Some(LOCAL_LAST_MODIFIED_NEW)
    );
    assert_eq!(saved_feed.url, requested_feed_url);
}

#[tokio::test]
async fn sync_local_feed_keeps_http_validators_in_sync_state_not_feed_http_cache() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_header("etag", LOCAL_ETAG_NEW)
        .with_header("last-modified", LOCAL_LAST_MODIFIED_NEW)
        .with_body(LOCAL_RSS_INITIAL)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();

    sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .unwrap();

    mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let state = sync_state_repo
        .get(&account.id, &local_feed_scope_key(&feed.url))
        .unwrap()
        .unwrap();
    let feed_http_cache_count: i64 = db_guard
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM feed_http_cache WHERE feed_id = ?1",
            rusqlite::params![feed.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(state.etag.as_deref(), Some(LOCAL_ETAG_NEW));
    assert_eq!(
        state.last_modified.as_deref(),
        Some(LOCAL_LAST_MODIFIED_NEW)
    );
    assert_eq!(feed_http_cache_count, 0);
}

#[tokio::test]
async fn sync_local_feed_returns_post_write_integrity_error() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_body(LOCAL_RSS_INITIAL)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    {
        let db_guard = db.lock().unwrap();
        db_guard
            .writer()
            .execute("DROP TABLE preferences", [])
            .unwrap();
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    let error = sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .expect_err("post-write integrity failures should be returned");

    mock.assert_async().await;
    let db_guard = db.lock().unwrap();
    let article_count: i64 = db_guard
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE feed_id = ?1",
            rusqlite::params![feed.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    let sync_state_count: i64 = db_guard
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM sync_state WHERE account_id = ?1 AND scope_key = ?2",
            rusqlite::params![
                account.id.as_ref(),
                local_feed_scope_key(&feed.url).as_string()
            ],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(article_count, 0);
    assert_eq!(sync_state_count, 0);
    match error {
        AppError::UserVisible { message } => {
            assert!(message.contains("no such table: preferences"));
        }
        AppError::Retryable { message } | AppError::RetryableWithMetadata { message, .. } => {
            panic!("post-write DB failures should not be retryable: {message}");
        }
    }
}

#[tokio::test]
async fn sync_local_feed_rolls_back_articles_when_sync_state_save_fails() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_header("etag", LOCAL_ETAG_NEW)
        .with_body(LOCAL_RSS_INITIAL)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    {
        let db_guard = db.lock().unwrap();
        db_guard
            .writer()
            .execute_batch(
                "CREATE TEMP TRIGGER fail_local_feed_sync_state_save
                     BEFORE INSERT ON sync_state
                     WHEN NEW.scope_key LIKE 'local_feed:%'
                     BEGIN
                       SELECT RAISE(ABORT, 'forced sync_state failure');
                     END;",
            )
            .unwrap();
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    let error = sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .expect_err("sync_state failure should roll back article writes");

    mock.assert_async().await;
    let db_guard = db.lock().unwrap();
    let article_count: i64 = db_guard
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE feed_id = ?1",
            rusqlite::params![feed.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    let sync_state_count: i64 = db_guard
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM sync_state WHERE account_id = ?1 AND scope_key = ?2",
            rusqlite::params![
                account.id.as_ref(),
                local_feed_scope_key(&feed.url).as_string()
            ],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(article_count, 0);
    assert_eq!(sync_state_count, 0);
    match error {
        AppError::UserVisible { message } => {
            assert!(message.contains("forced sync_state failure"));
        }
        AppError::Retryable { message } | AppError::RetryableWithMetadata { message, .. } => {
            panic!("sync_state DB failures should not be retryable: {message}");
        }
    }
}

#[tokio::test]
async fn sync_local_feed_updates_validators_and_article_on_200_response() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .match_header("if-none-match", LOCAL_ETAG_OLD)
        .match_header("if-modified-since", LOCAL_LAST_MODIFIED_OLD)
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_header("etag", LOCAL_ETAG_NEW)
        .with_header("last-modified", LOCAL_LAST_MODIFIED_NEW)
        .with_body(LOCAL_RSS_UPDATED)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    let existing_article = Article {
        id: generate_entry_id(
            account.id.as_ref(),
            Some("local-guid-1"),
            &feed.url,
            Some("https://example.com/1"),
            Some("Local Article"),
        ),
        feed_id: feed.id.clone(),
        remote_id: Some("local-guid-1".to_string()),
        title: "Local Article".to_string(),
        content_raw: "old".to_string(),
        content_sanitized: "old".to_string(),
        sanitizer_version: sanitizer::SANITIZER_VERSION,
        summary: None,
        url: Some("https://example.com/1".to_string()),
        author: None,
        published_at: chrono::Utc::now(),
        thumbnail: None,
        is_read: false,
        is_starred: false,
        fetched_at: chrono::Utc::now(),
    };
    {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        article_repo.upsert(&[existing_article]).unwrap();
        sync_state_repo
            .save(&SyncState {
                account_id: account.id.clone(),
                scope_key: local_feed_scope_key(&feed.url).as_string(),
                timestamp_usec: None,
                continuation: None,
                etag: Some(LOCAL_ETAG_OLD.to_string()),
                last_modified: Some(LOCAL_LAST_MODIFIED_OLD.to_string()),
                last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
                last_error: Some("old error".to_string()),
                error_count: 2,
                next_retry_at: Some("2025-01-01T01:00:00Z".to_string()),
            })
            .unwrap();
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .unwrap();

    mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let articles = article_repo
        .find_by_feed(&feed.id, &Pagination::default())
        .unwrap();
    let state = sync_state_repo
        .get(&account.id, &local_feed_scope_key(&feed.url))
        .unwrap()
        .unwrap();

    assert_eq!(articles.len(), 1);
    assert_eq!(articles[0].title, "Local Article Updated");
    assert_eq!(state.etag.as_deref(), Some(LOCAL_ETAG_NEW));
    assert_eq!(
        state.last_modified.as_deref(),
        Some(LOCAL_LAST_MODIFIED_NEW)
    );
    assert_eq!(state.error_count, 0);
    assert_eq!(state.last_error, None);
    assert_eq!(state.next_retry_at, None);
    assert!(state.last_success_at.is_some());
}

#[tokio::test]
async fn sync_local_feed_preserves_weak_etag_and_drops_invalid_last_modified() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_header("etag", "W/\"weak-etag\"")
        .with_header("last-modified", "not-a-date")
        .with_body(LOCAL_RSS_INITIAL)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();

    sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .unwrap();

    mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let state = sync_state_repo
        .get(&account.id, &local_feed_scope_key(&feed.url))
        .unwrap()
        .unwrap();

    assert_eq!(state.etag.as_deref(), Some("W/\"weak-etag\""));
    assert_eq!(state.last_modified, None);
}

#[tokio::test]
async fn sync_local_feed_drops_invalid_saved_validators_before_request() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_header("etag", LOCAL_ETAG_NEW)
        .with_header("last-modified", LOCAL_LAST_MODIFIED_NEW)
        .with_body(LOCAL_RSS_INITIAL)
        .expect(1)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    {
        let db_guard = db.lock().unwrap();
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        sync_state_repo
            .save(&SyncState {
                account_id: account.id.clone(),
                scope_key: local_feed_scope_key(&feed.url).as_string(),
                timestamp_usec: None,
                continuation: None,
                etag: Some("unquoted-etag".to_string()),
                last_modified: Some("invalid-date".to_string()),
                last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
                last_error: None,
                error_count: 0,
                next_retry_at: None,
            })
            .unwrap();
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .unwrap();

    mock.assert_async().await;
}

#[tokio::test]
async fn sync_local_feed_skips_upsert_when_server_returns_not_modified() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .match_header("if-none-match", LOCAL_ETAG_OLD)
        .match_header("if-modified-since", LOCAL_LAST_MODIFIED_OLD)
        .with_status(304)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    let existing_fetched_at = chrono::Utc::now() - chrono::Duration::days(1);
    let existing_article = Article {
        id: generate_entry_id(
            account.id.as_ref(),
            Some("local-guid-1"),
            &feed.url,
            Some("https://example.com/1"),
            Some("Local Article"),
        ),
        feed_id: feed.id.clone(),
        remote_id: Some("local-guid-1".to_string()),
        title: "Local Article".to_string(),
        content_raw: "old".to_string(),
        content_sanitized: "old".to_string(),
        sanitizer_version: sanitizer::SANITIZER_VERSION,
        summary: None,
        url: Some("https://example.com/1".to_string()),
        author: None,
        published_at: chrono::Utc::now() - chrono::Duration::days(2),
        thumbnail: None,
        is_read: false,
        is_starred: false,
        fetched_at: existing_fetched_at,
    };
    {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        article_repo.upsert(&[existing_article]).unwrap();
        sync_state_repo
            .save(&SyncState {
                account_id: account.id.clone(),
                scope_key: local_feed_scope_key(&feed.url).as_string(),
                timestamp_usec: None,
                continuation: None,
                etag: Some(LOCAL_ETAG_OLD.to_string()),
                last_modified: Some(LOCAL_LAST_MODIFIED_OLD.to_string()),
                last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
                last_error: Some("old error".to_string()),
                error_count: 3,
                next_retry_at: Some("2025-01-01T01:00:00Z".to_string()),
            })
            .unwrap();
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .unwrap();

    mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let articles = article_repo
        .find_by_feed(&feed.id, &Pagination::default())
        .unwrap();
    let state = sync_state_repo
        .get(&account.id, &local_feed_scope_key(&feed.url))
        .unwrap()
        .unwrap();

    assert_eq!(articles.len(), 1);
    assert_eq!(articles[0].title, "Local Article");
    assert_eq!(articles[0].fetched_at, existing_fetched_at);
    assert_eq!(state.etag.as_deref(), Some(LOCAL_ETAG_OLD));
    assert_eq!(
        state.last_modified.as_deref(),
        Some(LOCAL_LAST_MODIFIED_OLD)
    );
    assert_eq!(state.error_count, 0);
    assert_eq!(state.last_error, None);
    assert_eq!(state.next_retry_at, None);
    assert!(state.last_success_at.is_some());
}

#[tokio::test]
async fn sync_local_feed_repairs_mute_and_unread_count_on_not_modified() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .match_header("if-none-match", LOCAL_ETAG_OLD)
        .match_header("if-modified-since", LOCAL_LAST_MODIFIED_OLD)
        .with_status(304)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    let sibling_feed = test_local_feed(&account.id, &format!("{}/sibling.xml", server.url()));
    let mut existing_article = Article {
        id: ArticleId("local-muted-article".to_string()),
        feed_id: feed.id.clone(),
        remote_id: Some("local-guid-muted".to_string()),
        title: "Kindle Unlimited local".to_string(),
        content_raw: "old".to_string(),
        content_sanitized: "old".to_string(),
        sanitizer_version: sanitizer::SANITIZER_VERSION,
        summary: None,
        url: Some("https://example.com/muted".to_string()),
        author: None,
        published_at: chrono::Utc::now(),
        thumbnail: None,
        is_read: false,
        is_starred: false,
        fetched_at: chrono::Utc::now(),
    };
    existing_article.id = generate_entry_id(
        account.id.as_ref(),
        existing_article.remote_id.as_deref(),
        &feed.url,
        existing_article.url.as_deref(),
        Some(&existing_article.title),
    );
    let mut sibling_article = Article {
        id: ArticleId("local-muted-sibling-article".to_string()),
        feed_id: sibling_feed.id.clone(),
        remote_id: Some("local-guid-muted-sibling".to_string()),
        title: "Kindle Unlimited sibling local".to_string(),
        content_raw: "old".to_string(),
        content_sanitized: "old".to_string(),
        sanitizer_version: sanitizer::SANITIZER_VERSION,
        summary: None,
        url: Some("https://example.com/sibling-muted".to_string()),
        author: None,
        published_at: chrono::Utc::now(),
        thumbnail: None,
        is_read: false,
        is_starred: false,
        fetched_at: chrono::Utc::now(),
    };
    sibling_article.id = generate_entry_id(
        account.id.as_ref(),
        sibling_article.remote_id.as_deref(),
        &sibling_feed.url,
        sibling_article.url.as_deref(),
        Some(&sibling_article.title),
    );
    {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        feed_repo.save(&sibling_feed).unwrap();
        article_repo
            .upsert(&[existing_article.clone(), sibling_article.clone()])
            .unwrap();
        feed_repo.update_unread_count(&feed.id, 99).unwrap();
        feed_repo.update_unread_count(&sibling_feed.id, 77).unwrap();
        db_guard
            .writer()
            .execute(
                "INSERT INTO preferences (key, value) VALUES ('mute_auto_mark_read', 'true')",
                [],
            )
            .unwrap();
        db_guard
            .writer()
            .execute(
                "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?4)",
                rusqlite::params![
                    uuid::Uuid::new_v4().to_string(),
                    "kindle unlimited",
                    "title",
                    chrono::Utc::now().to_rfc3339()
                ],
            )
            .unwrap();
        sync_state_repo
            .save(&SyncState {
                account_id: account.id.clone(),
                scope_key: local_feed_scope_key(&feed.url).as_string(),
                timestamp_usec: None,
                continuation: None,
                etag: Some(LOCAL_ETAG_OLD.to_string()),
                last_modified: Some(LOCAL_LAST_MODIFIED_OLD.to_string()),
                last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
                last_error: None,
                error_count: 0,
                next_retry_at: None,
            })
            .unwrap();
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .unwrap();

    mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let article_is_read: bool = db_guard
        .reader()
        .query_row(
            "SELECT is_read FROM articles WHERE id = ?1",
            rusqlite::params![existing_article.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    let unread_count: i64 = db_guard
        .reader()
        .query_row(
            "SELECT unread_count FROM feeds WHERE id = ?1",
            rusqlite::params![feed.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    let sibling_article_is_read: bool = db_guard
        .reader()
        .query_row(
            "SELECT is_read FROM articles WHERE id = ?1",
            rusqlite::params![sibling_article.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    let sibling_unread_count: i64 = db_guard
        .reader()
        .query_row(
            "SELECT unread_count FROM feeds WHERE id = ?1",
            rusqlite::params![sibling_feed.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();

    assert!(article_is_read);
    assert_eq!(unread_count, 0);
    assert!(!sibling_article_is_read);
    assert_eq!(sibling_unread_count, 77);
}

#[tokio::test]
async fn sync_local_feed_clears_validators_when_server_does_not_support_them() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .match_header("if-none-match", LOCAL_ETAG_OLD)
        .match_header("if-modified-since", LOCAL_LAST_MODIFIED_OLD)
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_body(LOCAL_RSS_UPDATED)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    {
        let db_guard = db.lock().unwrap();
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        sync_state_repo
            .save(&SyncState {
                account_id: account.id.clone(),
                scope_key: local_feed_scope_key(&feed.url).as_string(),
                timestamp_usec: None,
                continuation: None,
                etag: Some(LOCAL_ETAG_OLD.to_string()),
                last_modified: Some(LOCAL_LAST_MODIFIED_OLD.to_string()),
                last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
                last_error: None,
                error_count: 0,
                next_retry_at: None,
            })
            .unwrap();
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .unwrap();

    mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let articles = article_repo
        .find_by_feed(&feed.id, &Pagination::default())
        .unwrap();
    let state = sync_state_repo
        .get(&account.id, &local_feed_scope_key(&feed.url))
        .unwrap()
        .unwrap();

    assert_eq!(articles.len(), 1);
    assert_eq!(articles[0].title, "Local Article Updated");
    assert_eq!(state.etag, None);
    assert_eq!(state.last_modified, None);
    assert_eq!(state.error_count, 0);
    assert!(state.last_success_at.is_some());
}

#[test]
fn greader_feed_routing_distinguishes_provider_managed_and_local_like_ids() {
    assert!(is_provider_managed_greader_feed(Some("feed/1")));
    assert!(is_provider_managed_greader_feed(Some(
        "feed/http://example.com/rss"
    )));

    assert!(!is_provider_managed_greader_feed(Some(
        "https://example.com/feed.xml"
    )));
    assert!(!is_provider_managed_greader_feed(Some(
        "tag:google.com,2005:reader/item/123"
    )));
    assert!(!is_provider_managed_greader_feed(None));
}
