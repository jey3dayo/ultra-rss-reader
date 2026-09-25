use std::path::Path;

use serde_json::json;
use tempfile::tempdir;

use crate::cli::command::CliCommand;
use crate::cli::route::{NetworkAccess, ReadOnlyDb, Route};
use crate::domain::account::{Account, ConnectionVerificationStatus};
use crate::domain::article::Article;
use crate::domain::feed::Feed;
use crate::domain::provider::ProviderKind;
use crate::domain::types::{AccountId, ArticleId, FeedId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use crate::repository::account::AccountRepository;
use crate::repository::article::ArticleMutationRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::pending_mutation::{
    PendingMutation, PendingMutationRepository, PendingMutationType,
};
use crate::repository::sync_state::{SyncState, SyncStateRepository, SyncStateScopeKey};

use super::account::AccountListCommand;
use super::db::DbIntegrityCommand;
use super::feed::{FeedDiagnoseCommand, FeedListCommand, FeedStaleCommand};
use super::pending_mutation::PendingMutationListCommand;
use super::status::StatusCommand;
use super::sync_state::SyncStateShowCommand;

fn fixture_account(id: &str, kind: ProviderKind) -> Account {
    Account {
        id: AccountId(id.to_string()),
        kind,
        name: "Fixture Account".to_string(),
        server_url: Some("https://example.invalid".to_string()),
        username: Some("fixture-user".to_string()),
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: true,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    }
}

fn fixture_feed(id: &str, account_id: &AccountId, url: &str, unread_count: i32) -> Feed {
    Feed {
        id: FeedId(id.to_string()),
        account_id: account_id.clone(),
        folder_id: None,
        remote_id: None,
        title: format!("Feed {id}"),
        url: url.to_string(),
        site_url: "https://example.invalid".to_string(),
        icon: None,
        icon_url: None,
        unread_count,
        reader_mode: "inherit".to_string(),
        web_preview_mode: "inherit".to_string(),
    }
}

fn fixture_article(
    id: &str,
    feed_id: &FeedId,
    published_at: chrono::DateTime<chrono::Utc>,
) -> Article {
    Article {
        id: ArticleId(id.to_string()),
        feed_id: feed_id.clone(),
        remote_id: None,
        title: format!("Article {id}"),
        content_raw: String::new(),
        content_sanitized: String::new(),
        sanitizer_version: 1,
        summary: None,
        url: None,
        author: None,
        published_at,
        thumbnail: None,
        is_read: false,
        is_starred: false,
        fetched_at: published_at,
    }
}

/// Checkpoints and drops the writer, then opens a fresh `ReadOnlyDb` — the
/// same sequence `migrated_read_only_db_with_one_account` uses.
fn checkpoint_close_and_open_read_only(manager: DbManager, db_path: &Path) -> ReadOnlyDb {
    manager
        .writer()
        .pragma_update(None, "wal_checkpoint", "TRUNCATE")
        .expect("checkpoint should succeed on a fixture writer");
    drop(manager);
    ReadOnlyDb::open(db_path)
        .expect("read-only open should succeed on a freshly migrated, checkpointed database")
}

/// Builds a fully-migrated DB via `DbManager::new`, seeds one account, then
/// hands back a checkpointed, closed-and-reopened `ReadOnlyDb`. Fixture
/// boundary: a failure here means the fixture didn't start, not the
/// behavior under test.
fn migrated_read_only_db_with_one_account() -> (tempfile::TempDir, ReadOnlyDb) {
    let dir = tempdir().expect("tempdir should be creatable");
    let db_path = dir.path().join("fixture.db");

    let manager = DbManager::new(&db_path).expect("fresh db should migrate cleanly");
    {
        let repo = SqliteAccountRepository::new(manager.writer());
        repo.save(&fixture_account("acct-1", ProviderKind::Local))
            .expect("saving the fixture account should succeed");
    }
    manager
        .writer()
        .pragma_update(None, "wal_checkpoint", "TRUNCATE")
        .expect("checkpoint should succeed on a fixture writer");
    drop(manager);

    let read_only = ReadOnlyDb::open(&db_path)
        .expect("read-only open should succeed on a freshly migrated, checkpointed database");
    (dir, read_only)
}

#[tokio::test]
async fn status_reports_the_seeded_account_and_matching_schema_version() {
    let (_dir, read_only) = migrated_read_only_db_with_one_account();

    let output = StatusCommand
        .run(Route::ReadOnly(read_only), NetworkAccess::Allowed)
        .await
        .expect("status should succeed against a valid read-only db");

    assert_eq!(output.json_data["account_count"], json!(1));
    assert_eq!(output.json_data["accounts"][0]["id"], json!("acct-1"));
    assert_eq!(output.json_data["accounts"][0]["kind"], json!("local"));
    assert_eq!(
        output.json_data["schema_version"], output.json_data["latest_version"],
        "a freshly migrated database should already be at the latest schema version"
    );
}

#[tokio::test]
async fn account_list_reports_the_seeded_account_fields() {
    let (_dir, read_only) = migrated_read_only_db_with_one_account();

    let output = AccountListCommand
        .run(Route::ReadOnly(read_only), NetworkAccess::Allowed)
        .await
        .expect("account list should succeed against a valid read-only db");

    let accounts = output.json_data["accounts"]
        .as_array()
        .expect("accounts should be a JSON array");
    assert_eq!(accounts.len(), 1);
    assert_eq!(accounts[0]["id"], json!("acct-1"));
    assert_eq!(accounts[0]["kind"], json!("local"));
    assert_eq!(accounts[0]["username"], json!("fixture-user"));
    assert_eq!(
        accounts[0]["connection_verification_status"],
        json!("unverified")
    );
}

#[tokio::test]
async fn feed_list_reports_unread_count_and_latest_article_timestamps() {
    let dir = tempdir().expect("tempdir should be creatable");
    let db_path = dir.path().join("fixture.db");
    let manager = DbManager::new(&db_path).expect("fresh db should migrate cleanly");
    let account = fixture_account("acct-1", ProviderKind::Local);
    let feed = fixture_feed("feed-1", &account.id, "https://example.invalid/feed.xml", 3);
    let older = "2026-09-20T00:00:00Z".parse().unwrap();
    let newer = "2026-09-22T00:00:00Z".parse().unwrap();
    {
        SqliteAccountRepository::new(manager.writer())
            .save(&account)
            .expect("saving the fixture account should succeed");
        SqliteFeedRepository::new(manager.writer())
            .save(&feed)
            .expect("saving the fixture feed should succeed");
        SqliteArticleRepository::new(manager.writer())
            .upsert(&[
                fixture_article("art-1", &feed.id, older),
                fixture_article("art-2", &feed.id, newer),
            ])
            .expect("saving fixture articles should succeed");
    }
    let read_only = checkpoint_close_and_open_read_only(manager, &db_path);

    let output = FeedListCommand {
        account: None,
        folder: None,
    }
    .run(Route::ReadOnly(read_only), NetworkAccess::Allowed)
    .await
    .expect("feed list should succeed against a valid read-only db");

    let feeds = output.json_data["feeds"]
        .as_array()
        .expect("feeds should be a JSON array");
    assert_eq!(feeds.len(), 1);
    assert_eq!(feeds[0]["id"], json!("feed-1"));
    assert_eq!(feeds[0]["unread_count"], json!(3));
    assert_eq!(feeds[0]["latest_published_at"], json!(newer.to_rfc3339()));
}

#[tokio::test]
async fn feed_stale_flags_a_feed_whose_latest_article_is_far_past_its_own_cadence() {
    let dir = tempdir().expect("tempdir should be creatable");
    let db_path = dir.path().join("fixture.db");
    let manager = DbManager::new(&db_path).expect("fresh db should migrate cleanly");
    let account = fixture_account("acct-1", ProviderKind::Local);
    let feed = fixture_feed("feed-1", &account.id, "https://example.invalid/feed.xml", 0);
    // Six articles a day apart, all more than a year in the past: far beyond
    // any `4 * expected_interval` or `min_hours` threshold relative to now.
    let base: chrono::DateTime<chrono::Utc> = "2025-01-01T00:00:00Z".parse().unwrap();
    let articles: Vec<Article> = (0_i64..6)
        .map(|i| {
            fixture_article(
                &format!("art-{i}"),
                &feed.id,
                base + chrono::Duration::days(i),
            )
        })
        .collect();
    {
        SqliteAccountRepository::new(manager.writer())
            .save(&account)
            .expect("saving the fixture account should succeed");
        SqliteFeedRepository::new(manager.writer())
            .save(&feed)
            .expect("saving the fixture feed should succeed");
        SqliteArticleRepository::new(manager.writer())
            .upsert(&articles)
            .expect("saving fixture articles should succeed");
    }
    let read_only = checkpoint_close_and_open_read_only(manager, &db_path);

    let output = FeedStaleCommand {
        account: None,
        min_hours: 6.0,
    }
    .run(Route::ReadOnly(read_only), NetworkAccess::Allowed)
    .await
    .expect("feed stale should succeed against a valid read-only db");

    let stale_feeds = output.json_data["stale_feeds"]
        .as_array()
        .expect("stale_feeds should be a JSON array");
    assert_eq!(stale_feeds.len(), 1);
    assert_eq!(stale_feeds[0]["id"], json!("feed-1"));
    assert!(stale_feeds[0]["ratio"].as_f64().unwrap() > 4.0);
}

#[tokio::test]
async fn feed_diagnose_returns_not_found_when_nothing_matches() {
    let (_dir, read_only) = migrated_read_only_db_with_one_account();

    let error = FeedDiagnoseCommand {
        query: "https://example.invalid/no-such-feed.xml".to_string(),
        account: None,
    }
    .run(Route::ReadOnly(read_only), NetworkAccess::Disabled)
    .await
    .expect_err("no matching feed should be a NOT_FOUND error");

    assert_eq!(
        error.exit_code,
        crate::cli::exit_code::CliExitCode::NotFound
    );
}

#[tokio::test]
async fn feed_diagnose_with_no_network_reports_source_skipped_and_is_not_unhealthy() {
    let dir = tempdir().expect("tempdir should be creatable");
    let db_path = dir.path().join("fixture.db");
    let manager = DbManager::new(&db_path).expect("fresh db should migrate cleanly");
    let account = fixture_account("acct-1", ProviderKind::Local);
    let feed = fixture_feed("feed-1", &account.id, "https://example.invalid/feed.xml", 0);
    {
        SqliteAccountRepository::new(manager.writer())
            .save(&account)
            .expect("saving the fixture account should succeed");
        SqliteFeedRepository::new(manager.writer())
            .save(&feed)
            .expect("saving the fixture feed should succeed");
    }
    let read_only = checkpoint_close_and_open_read_only(manager, &db_path);

    let output = FeedDiagnoseCommand {
        query: feed.url.clone(),
        account: None,
    }
    .run(Route::ReadOnly(read_only), NetworkAccess::Disabled)
    .await
    .expect("diagnose with a real match and no network should succeed");

    assert!(output.exit_code.is_none());
    let matches = output.json_data["matches"]
        .as_array()
        .expect("matches should be a JSON array");
    assert_eq!(matches.len(), 1);
    assert_eq!(matches[0]["verdict"], json!("source_skipped"));
    assert_eq!(matches[0]["source"]["status"], json!("skipped"));
}

#[tokio::test]
async fn sync_state_show_filters_by_scope_and_hides_raw_continuation_and_etag() {
    let dir = tempdir().expect("tempdir should be creatable");
    let db_path = dir.path().join("fixture.db");
    let manager = DbManager::new(&db_path).expect("fresh db should migrate cleanly");
    let account = fixture_account("acct-1", ProviderKind::Local);
    {
        SqliteAccountRepository::new(manager.writer())
            .save(&account)
            .expect("saving the fixture account should succeed");
        let repo = SqliteSyncStateRepository::new(manager.writer());
        repo.save(&SyncState {
            account_id: account.id.clone(),
            scope_key: SyncStateScopeKey::scheduler().as_string(),
            timestamp_usec: None,
            continuation: Some("secret-continuation".to_string()),
            etag: Some("\"secret-etag\"".to_string()),
            last_modified: None,
            last_success_at: Some("2026-09-25T00:00:00Z".to_string()),
            last_error: None,
            error_count: 0,
            next_retry_at: None,
        })
        .expect("saving the fixture sync_state row should succeed");
    }
    let read_only = checkpoint_close_and_open_read_only(manager, &db_path);

    let output = SyncStateShowCommand {
        account_id: "acct-1".to_string(),
        scope: Some("scheduler".to_string()),
    }
    .run(Route::ReadOnly(read_only), NetworkAccess::Allowed)
    .await
    .expect("sync-state show should succeed against a valid read-only db");

    let rows = output.json_data["rows"]
        .as_array()
        .expect("rows should be a JSON array");
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0]["scope_key"], json!("scheduler"));
    assert_eq!(rows[0]["has_continuation"], json!(true));
    assert_eq!(rows[0]["has_etag"], json!(true));
    let raw = serde_json::to_string(&rows[0]).unwrap();
    assert!(!raw.contains("secret-continuation"));
    assert!(!raw.contains("secret-etag"));
}

#[tokio::test]
async fn pending_mutation_list_reports_rows_without_a_payload_body() {
    let dir = tempdir().expect("tempdir should be creatable");
    let db_path = dir.path().join("fixture.db");
    let manager = DbManager::new(&db_path).expect("fresh db should migrate cleanly");
    let account = fixture_account("acct-1", ProviderKind::FreshRss);
    {
        SqliteAccountRepository::new(manager.writer())
            .save(&account)
            .expect("saving the fixture account should succeed");
        SqlitePendingMutationRepository::new(manager.writer())
            .save(&PendingMutation {
                id: None,
                account_id: account.id.clone(),
                mutation_type: PendingMutationType::MarkRead,
                remote_entry_id: "feed/remote-1".to_string(),
                created_at: "2026-09-25T00:00:00Z".to_string(),
            })
            .expect("saving the fixture pending mutation should succeed");
    }
    let read_only = checkpoint_close_and_open_read_only(manager, &db_path);

    let output = PendingMutationListCommand { account: None }
        .run(Route::ReadOnly(read_only), NetworkAccess::Allowed)
        .await
        .expect("pending-mutation list should succeed against a valid read-only db");

    let rows = output.json_data["pending_mutations"]
        .as_array()
        .expect("pending_mutations should be a JSON array");
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0]["account_id"], json!("acct-1"));
    assert_eq!(rows[0]["mutation_type"], json!("mark_read"));
    assert_eq!(rows[0]["target_remote_entry_id"], json!("feed/remote-1"));
}

#[tokio::test]
async fn db_integrity_reports_orphaned_articles_and_feed_groups() {
    let dir = tempdir().expect("tempdir should be creatable");
    let db_path = dir.path().join("fixture.db");
    let manager = DbManager::new(&db_path).expect("fresh db should migrate cleanly");
    let account = fixture_account("acct-1", ProviderKind::Local);
    let feed = fixture_feed("feed-1", &account.id, "https://example.invalid/feed.xml", 0);
    {
        SqliteAccountRepository::new(manager.writer())
            .save(&account)
            .expect("saving the fixture account should succeed");
        SqliteFeedRepository::new(manager.writer())
            .save(&feed)
            .expect("saving the fixture feed should succeed");
        SqliteArticleRepository::new(manager.writer())
            .upsert(&[fixture_article(
                "healthy-article",
                &feed.id,
                "2026-09-01T00:00:00Z".parse().unwrap(),
            )])
            .expect("saving the healthy fixture article should succeed");

        // Orphaned article: same pattern as sqlite_article/tests/orphaned.rs
        // — toggle foreign_keys off since articles.feed_id has a real FK.
        manager
            .writer()
            .execute_batch("PRAGMA foreign_keys = OFF;")
            .expect("toggling foreign_keys off should succeed");
        manager
            .writer()
            .execute(
                "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, summary, url, author, published_at, thumbnail, is_read, is_starred, fetched_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                rusqlite::params![
                    "orphan-article",
                    "missing-feed",
                    Option::<String>::None,
                    "Broken Article",
                    "",
                    "",
                    1,
                    Option::<String>::None,
                    Option::<String>::None,
                    Option::<String>::None,
                    "2026-09-01T00:00:00Z",
                    Option::<String>::None,
                    false,
                    false,
                    "2026-09-01T00:00:00Z",
                ],
            )
            .expect("inserting the orphaned fixture article should succeed");
        manager
            .writer()
            .execute_batch("PRAGMA foreign_keys = ON;")
            .expect("toggling foreign_keys back on should succeed");
    }
    let read_only = checkpoint_close_and_open_read_only(manager, &db_path);

    let output = DbIntegrityCommand
        .run(Route::ReadOnly(read_only), NetworkAccess::Allowed)
        .await
        .expect("db integrity should succeed against a valid read-only db");

    assert_eq!(output.json_data["orphaned_article_count"], json!(1));
    let orphaned_feeds = output.json_data["orphaned_feeds"]
        .as_array()
        .expect("orphaned_feeds should be a JSON array");
    assert_eq!(orphaned_feeds.len(), 1);
    assert_eq!(orphaned_feeds[0]["missing_feed_id"], json!("missing-feed"));
}
