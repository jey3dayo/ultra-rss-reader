//! End-to-end integration test: add local feed -> sync -> read articles

use std::sync::atomic::AtomicBool;
use std::sync::Mutex;

use chrono::Utc;
use mockito::Matcher;
use ultra_rss_reader_lib::commands::sync_commands::run_full_sync;
use ultra_rss_reader_lib::domain::account::Account;
use ultra_rss_reader_lib::domain::article::{generate_entry_id, Article};
use ultra_rss_reader_lib::domain::feed::Feed;
use ultra_rss_reader_lib::domain::provider::ProviderKind;
use ultra_rss_reader_lib::domain::types::*;
use ultra_rss_reader_lib::infra::db::connection::DbManager;
use ultra_rss_reader_lib::infra::db::sqlite_account::SqliteAccountRepository;
use ultra_rss_reader_lib::infra::db::sqlite_article::SqliteArticleRepository;
use ultra_rss_reader_lib::infra::db::sqlite_feed::SqliteFeedRepository;
use ultra_rss_reader_lib::infra::db::sqlite_folder::SqliteFolderRepository;
use ultra_rss_reader_lib::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
use ultra_rss_reader_lib::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use ultra_rss_reader_lib::infra::keyring_store;
use ultra_rss_reader_lib::infra::provider::local::LocalProvider;
use ultra_rss_reader_lib::repository::account::AccountRepository;
use ultra_rss_reader_lib::repository::article::{ArticleRepository, Pagination};
use ultra_rss_reader_lib::repository::feed::FeedRepository;
use ultra_rss_reader_lib::repository::pending_mutation::{
    PendingMutation, PendingMutationRepository,
};
use ultra_rss_reader_lib::repository::sync_state::SyncStateRepository;
use ultra_rss_reader_lib::service::sync_flow;

struct PasswordCleanup(String);

impl Drop for PasswordCleanup {
    fn drop(&mut self) {
        let _ = keyring_store::delete_password(&self.0);
    }
}

struct EnvVarCleanup(&'static str);

impl Drop for EnvVarCleanup {
    fn drop(&mut self) {
        std::env::remove_var(self.0);
    }
}

#[tokio::test]
async fn local_feed_e2e() {
    // 1. Setup
    let db = DbManager::new_in_memory().unwrap();
    let account_id = AccountId::new();

    // Create account
    let account_repo = SqliteAccountRepository::new(db.writer());
    let account = Account {
        id: account_id.clone(),
        kind: ProviderKind::Local,
        name: "Local".into(),
        server_url: None,
        username: None,
        sync_interval_secs: 3600,
        sync_on_wake: false,
        keep_read_items_days: 30,
    };
    account_repo.save(&account).unwrap();

    // 2. Add feed (mock HTTP)
    let mut server = mockito::Server::new_async().await;
    let rss = r#"<?xml version="1.0"?>
    <rss version="2.0">
    <channel>
        <title>Test Feed</title>
        <link>https://example.com</link>
        <item><title>Article 1</title><link>https://example.com/1</link><guid>g1</guid></item>
        <item><title>Article 2</title><link>https://example.com/2</link><guid>g2</guid></item>
    </channel>
    </rss>"#;
    let mock = server
        .mock("GET", "/feed.xml")
        .with_body(rss)
        .create_async()
        .await;

    let feed_url = format!("{}/feed.xml", server.url());
    let feed_id = FeedId::new();
    let feed_repo = SqliteFeedRepository::new(db.writer());
    feed_repo
        .save(&Feed {
            id: feed_id.clone(),
            account_id: account_id.clone(),
            folder_id: None,
            remote_id: None,
            title: "Test Feed".into(),
            url: feed_url,
            site_url: "https://example.com".into(),
            icon: None,
            unread_count: 0,
            reader_mode: "on".into(),
            web_preview_mode: "off".into(),
        })
        .unwrap();

    // 3. Run sync
    let provider = LocalProvider::new();
    let article_repo = SqliteArticleRepository::new(db.writer());
    let folder_repo = SqliteFolderRepository::new(db.writer());
    let pending_repo = SqlitePendingMutationRepository::new(db.writer());

    let updated = sync_flow::sync_account(
        &account_id,
        &provider,
        &article_repo,
        &feed_repo,
        &folder_repo,
        &pending_repo,
    )
    .await
    .unwrap();

    assert!(updated.contains(&feed_id));
    mock.assert_async().await;

    // 4. Verify articles
    let articles = article_repo
        .find_by_feed(&feed_id, &Pagination::default())
        .unwrap();
    assert_eq!(articles.len(), 2);
    assert!(articles.iter().all(|a| !a.is_read));

    // 5. Mark as read
    article_repo.mark_as_read(&articles[0].id, true).unwrap();

    // 6. Verify unread count
    let count = feed_repo.recalculate_unread_count(&feed_id).unwrap();
    assert_eq!(count, 1);
}

#[tokio::test]
async fn freshrss_sync_preserves_local_like_feed_read_state() {
    std::env::set_var("DEV_CREDENTIALS", "1");
    let _env_cleanup = EnvVarCleanup("DEV_CREDENTIALS");
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let syncing = AtomicBool::new(false);
    let account_id = AccountId::new();
    let _password_cleanup = PasswordCleanup(account_id.0.clone());

    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let article_url = "https://example.com/local-1";

    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let folders_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/tag/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .with_status(200)
        .with_body(r#"{ "tags": [] }"#)
        .create_async()
        .await;

    let subscriptions_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/subscription/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .with_status(200)
        .with_body(r#"{ "subscriptions": [] }"#)
        .create_async()
        .await;

    let read_ids_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("n".into(), "10000".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/read".into()),
        ]))
        .with_status(200)
        .with_body(r#"{ "itemRefs": [] }"#)
        .create_async()
        .await;

    let starred_ids_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("n".into(), "10000".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/starred".into()),
        ]))
        .with_status(200)
        .with_body(r#"{ "itemRefs": [] }"#)
        .create_async()
        .await;

    let local_feed_mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("Content-Type", "application/rss+xml")
        .with_body(format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
            <rss version="2.0">
              <channel>
                <title>Local Feed</title>
                <item>
                  <title>Updated Local Article</title>
                  <link>{article_url}</link>
                  <guid>local-guid-1</guid>
                </item>
              </channel>
            </rss>"#
        ))
        .create_async()
        .await;

    let feed_id = FeedId::new();
    let article_id = generate_entry_id(
        account_id.as_ref(),
        Some("local-guid-1"),
        &feed_url,
        Some(article_url),
        Some("Original Local Article"),
    );

    {
        let db_guard = db.lock().unwrap();
        let account_repo = SqliteAccountRepository::new(db_guard.writer());
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let pending_repo = SqlitePendingMutationRepository::new(db_guard.writer());

        account_repo
            .save(&Account {
                id: account_id.clone(),
                kind: ProviderKind::FreshRss,
                name: "FreshRSS".into(),
                server_url: Some(server.url()),
                username: Some("u".into()),
                sync_interval_secs: 3600,
                sync_on_wake: false,
                keep_read_items_days: 30,
            })
            .unwrap();
        feed_repo
            .save(&Feed {
                id: feed_id.clone(),
                account_id: account_id.clone(),
                folder_id: None,
                remote_id: Some(feed_url.clone()),
                title: "Local Feed".into(),
                url: feed_url.clone(),
                site_url: server.url(),
                icon: None,
                unread_count: 0,
                reader_mode: "inherit".into(),
                web_preview_mode: "inherit".into(),
            })
            .unwrap();
        article_repo
            .upsert(&[Article {
                id: article_id.clone(),
                feed_id: feed_id.clone(),
                remote_id: Some("local-guid-1".into()),
                title: "Original Local Article".into(),
                content_raw: "<p>Original</p>".into(),
                content_sanitized: "<p>Original</p>".into(),
                sanitizer_version: 1,
                summary: Some("Original summary".into()),
                url: Some(article_url.into()),
                author: None,
                published_at: Utc::now(),
                thumbnail: None,
                is_read: true,
                is_starred: false,
                fetched_at: Utc::now(),
            }])
            .unwrap();
        pending_repo
            .save(&PendingMutation {
                id: None,
                account_id: account_id.clone(),
                mutation_type: "mark_read".into(),
                remote_entry_id: "local-guid-1".into(),
                created_at: "2026-04-01T00:00:00Z".into(),
            })
            .unwrap();
    }

    keyring_store::set_password(account_id.as_ref(), "p").unwrap();

    let result = run_full_sync(&db, &syncing).await.unwrap();

    assert!(result.synced);
    assert_eq!(result.total, 1);
    assert_eq!(
        result.succeeded,
        1,
        "sync failures: {:?}",
        result
            .failed
            .iter()
            .map(|failure| (&failure.account_name, &failure.message))
            .collect::<Vec<_>>()
    );
    assert!(result.failed.is_empty());

    folders_mock.assert_async().await;
    subscriptions_mock.assert_async().await;
    read_ids_mock.assert_async().await;
    starred_ids_mock.assert_async().await;
    local_feed_mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let pending_repo = SqlitePendingMutationRepository::new(db_guard.reader());
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());

    let articles = article_repo
        .find_by_feed(&feed_id, &Pagination::default())
        .unwrap();
    assert_eq!(articles.len(), 1);
    assert_eq!(articles[0].title, "Updated Local Article");
    assert!(articles[0].is_read);

    let unread = article_repo.count_unread_by_account(&account_id).unwrap();
    assert_eq!(unread, 0);
    assert!(pending_repo
        .find_by_account(&account_id)
        .unwrap()
        .is_empty());
    assert!(sync_state_repo
        .get(&account_id, &format!("local_feed:{feed_url}"))
        .unwrap()
        .is_some());
    assert!(sync_state_repo
        .get(&account_id, &format!("feed:{feed_url}"))
        .unwrap()
        .is_none());
}
