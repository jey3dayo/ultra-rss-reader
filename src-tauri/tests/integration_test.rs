//! End-to-end integration test: add local feed -> sync -> read articles

use ultra_rss_reader_lib::domain::account::Account;
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
use ultra_rss_reader_lib::infra::provider::local::LocalProvider;
use ultra_rss_reader_lib::repository::account::AccountRepository;
use ultra_rss_reader_lib::repository::article::{ArticleRepository, Pagination};
use ultra_rss_reader_lib::repository::feed::FeedRepository;
use ultra_rss_reader_lib::service::sync_flow;

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
        })
        .unwrap();

    // 3. Run sync
    let provider = LocalProvider::new();
    let article_repo = SqliteArticleRepository::new(db.writer());
    let folder_repo = SqliteFolderRepository::new(db.writer());
    let sync_state_repo = SqliteSyncStateRepository::new(db.writer());
    let pending_repo = SqlitePendingMutationRepository::new(db.writer());

    let updated = sync_flow::sync_account(
        &account_id,
        &provider,
        &article_repo,
        &feed_repo,
        &folder_repo,
        &sync_state_repo,
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
