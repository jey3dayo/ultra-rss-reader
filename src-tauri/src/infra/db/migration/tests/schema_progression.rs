use super::super::consts::*;
use super::super::*;
use super::{migrate_to_v19, migrate_to_v29, migrate_to_v31, open_in_memory};

#[test]
fn version_skip_v1_to_latest() {
    let mut conn = open_in_memory();
    conn.execute_batch(MIGRATION_V1).unwrap();
    assert_eq!(get_schema_version(&conn), 1);

    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, 1);
    assert_eq!(result.to_version, LATEST_VERSION);
    assert!(result.migrated());

    // Verify V2 (preferences) was applied
    let pref_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='preferences'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(pref_count, 1);

    // Verify V4 (tags) was applied
    let tag_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='tags'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(tag_count, 1);
}

#[test]
fn version_skip_v3_to_latest() {
    let mut conn = open_in_memory();
    conn.execute_batch(MIGRATION_V1).unwrap();
    conn.execute_batch(MIGRATION_V2).unwrap();
    conn.execute_batch(MIGRATION_V3).unwrap();
    assert_eq!(get_schema_version(&conn), 3);

    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, 3);
    assert_eq!(result.to_version, LATEST_VERSION);

    // Verify V5 (display_mode) was applied
    let has_display_mode: bool = conn
        .prepare("SELECT display_mode FROM feeds LIMIT 0")
        .is_ok();
    assert!(has_display_mode, "V5 display_mode column should exist");

    let has_reader_mode: bool = conn
        .prepare("SELECT reader_mode FROM feeds LIMIT 0")
        .is_ok();
    assert!(has_reader_mode, "V8 reader_mode column should exist");

    let has_timestamp_usec: bool = conn
        .prepare("SELECT timestamp_usec FROM sync_state LIMIT 0")
        .is_ok();
    assert!(
        has_timestamp_usec,
        "latest sync_state cursor column should exist"
    );
}

#[test]
fn latest_schema_includes_account_startup_sync_column() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();

    let has_sync_on_startup: bool = conn
        .prepare("SELECT sync_on_startup FROM accounts LIMIT 0")
        .is_ok();
    assert!(
        has_sync_on_startup,
        "latest accounts schema should include sync_on_startup"
    );
}

#[test]
fn latest_schema_includes_account_connection_verification_columns() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();

    assert!(conn
        .prepare("SELECT connection_verification_status FROM accounts LIMIT 0")
        .is_ok());
    assert!(conn
        .prepare("SELECT connection_verified_at FROM accounts LIMIT 0")
        .is_ok());
    assert!(conn
        .prepare("SELECT connection_verification_error FROM accounts LIMIT 0")
        .is_ok());
}

#[test]
fn latest_schema_includes_account_folder_order_mode_column() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();

    assert!(conn
        .prepare("SELECT folder_order_mode FROM accounts LIMIT 0")
        .is_ok());
}

#[test]
fn latest_schema_includes_local_account_sync_export_digest_column() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();

    assert!(conn
        .prepare("SELECT last_export_digest FROM local_account_sync_settings LIMIT 0")
        .is_ok());
}

#[test]
fn latest_schema_includes_article_view_history() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();

    assert!(conn
        .prepare("SELECT account_id, article_id, viewed_at FROM article_view_history LIMIT 0")
        .is_ok());
}

#[test]
fn latest_schema_prevents_duplicate_pending_mutations() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();

    let index_count: i64 = conn
        .query_row(
            "SELECT COUNT(*)
              FROM pragma_index_list('pending_mutations')
              WHERE name = 'idx_pending_mutations_unique_entry_type'
                AND [unique] = 1",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(index_count, 1);
}

#[test]
fn latest_schema_includes_article_list_ordered_index() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();

    let index_count: i64 = conn
        .query_row(
            "SELECT COUNT(*)
              FROM pragma_index_list('articles')
              WHERE name = 'idx_articles_feed_published_fetched_id'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(index_count, 1);
}

#[test]
fn v20_repairs_existing_article_account_id_mismatches() {
    let mut conn = open_in_memory();
    migrate_to_v19(&conn);
    conn.execute_batch("ALTER TABLE articles ADD COLUMN account_id TEXT;")
        .unwrap();

    conn.execute(
        "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3), (?4, ?2, ?5)",
        ("acc-a", "local", "Account A", "acc-b", "Account B"),
    )
    .unwrap();
    conn.execute(
        "INSERT INTO feeds (id, account_id, title, url, site_url)
          VALUES (?1, ?2, ?3, ?4, ?5), (?6, ?7, ?8, ?9, ?10)",
        (
            "feed-a",
            "acc-a",
            "Feed A",
            "https://example.com/a.xml",
            "https://example.com/a",
            "feed-b",
            "acc-b",
            "Feed B",
            "https://example.com/b.xml",
            "https://example.com/b",
        ),
    )
    .unwrap();
    conn.execute(
        "INSERT INTO articles (id, account_id, feed_id, title, published_at, fetched_at)
          VALUES (?1, ?2, ?3, ?4, ?5, ?5), (?6, NULL, ?7, ?8, ?5, ?5)",
        (
            "article-wrong",
            "acc-b",
            "feed-a",
            "Wrong account",
            "2026-06-17T00:00:00Z",
            "article-null",
            "feed-b",
            "Null account",
        ),
    )
    .unwrap();

    let result = run_migrations(&mut conn).unwrap();

    assert_eq!(result.from_version, 19);
    assert_eq!(result.to_version, LATEST_VERSION);
    let rows = conn
        .prepare("SELECT id, account_id FROM articles ORDER BY id")
        .unwrap()
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .unwrap()
        .collect::<rusqlite::Result<Vec<_>>>()
        .unwrap();
    assert_eq!(
        rows,
        vec![
            ("article-null".to_string(), "acc-b".to_string()),
            ("article-wrong".to_string(), "acc-a".to_string())
        ]
    );
}

#[test]
fn v30_backfills_last_seen_article_at_from_stored_articles() {
    let mut conn = open_in_memory();
    migrate_to_v29(&conn);
    assert_eq!(get_schema_version(&conn), 29);

    conn.execute_batch(
        "INSERT INTO accounts (id, kind, name) VALUES ('acc-1', 'FreshRSS', 'Test');
         INSERT INTO feeds (id, account_id, title, url, site_url)
         VALUES ('feed-stale', 'acc-1', 'Stale', 'https://example.com/stale.xml', 'https://example.com');
         INSERT INTO feeds (id, account_id, title, url, site_url)
         VALUES ('feed-empty', 'acc-1', 'Empty', 'https://example.com/empty.xml', 'https://example.com');
         INSERT INTO articles (id, account_id, feed_id, title, published_at, fetched_at)
         VALUES ('a1', 'acc-1', 'feed-stale', 'Old', '2023-01-01T00:00:00+00:00', '2023-01-02T00:00:00+00:00'),
                ('a2', 'acc-1', 'feed-stale', 'Newer old', '2023-06-01T00:00:00+00:00', '2023-06-02T00:00:00+00:00');",
    )
    .unwrap();

    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, 29);
    assert_eq!(result.to_version, LATEST_VERSION);

    let sync_enabled: i64 = conn
        .query_row(
            "SELECT sync_enabled FROM accounts WHERE id = 'acc-1'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        sync_enabled, 1,
        "accounts that predate V31 stay sync-enabled"
    );

    let stale_last_seen: Option<String> = conn
        .query_row(
            "SELECT last_seen_article_at FROM feeds WHERE id = 'feed-stale'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        stale_last_seen.as_deref(),
        Some("2023-06-01T00:00:00+00:00"),
        "backfill must take the newest stored article per feed"
    );

    let empty_last_seen: Option<String> = conn
        .query_row(
            "SELECT last_seen_article_at FROM feeds WHERE id = 'feed-empty'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        empty_last_seen, None,
        "a feed with no stored articles stays unknown until a sync observes one"
    );
}

fn feed_created_at(conn: &rusqlite::Connection, feed_id: &str) -> Option<String> {
    conn.query_row(
        "SELECT created_at FROM feeds WHERE id = ?1",
        [feed_id],
        |row| row.get(0),
    )
    .unwrap()
}

#[test]
fn v32_backfills_existing_feeds_with_migration_time() {
    let mut conn = open_in_memory();
    migrate_to_v31(&conn);
    assert_eq!(get_schema_version(&conn), 31);
    conn.execute_batch(
        "INSERT INTO accounts (id, kind, name) VALUES ('acc-1', 'FreshRSS', 'Test');
         INSERT INTO feeds (id, account_id, title, url, site_url)
         VALUES ('feed-old', 'acc-1', 'Old', 'https://example.com/old.xml', 'https://example.com');",
    )
    .unwrap();

    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, 31);
    assert_eq!(result.to_version, 32);

    let backfilled_recently: bool = conn
        .query_row(
            "SELECT julianday(created_at) BETWEEN julianday('now', '-1 minute') AND julianday('now', '+1 minute')
             FROM feeds WHERE id = 'feed-old'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert!(
        backfilled_recently,
        "existing feeds start their age at the migration time"
    );
}

#[test]
fn v32_stamps_feeds_inserted_after_migration_even_during_local_sync_apply() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();
    conn.execute_batch(
        "INSERT INTO accounts (id, kind, name) VALUES ('acc-1', 'Local', 'Test');
         INSERT INTO feeds (id, account_id, title, url, site_url)
         VALUES ('feed-plain', 'acc-1', 'Plain', 'https://example.com/plain.xml', 'https://example.com');
         UPDATE local_sync_apply_guard SET active = 1;
         INSERT INTO feeds (id, account_id, title, url, site_url)
         VALUES ('feed-imported', 'acc-1', 'Imported', 'https://example.com/imported.xml', 'https://example.com');
         UPDATE local_sync_apply_guard SET active = 0;",
    )
    .unwrap();

    assert!(feed_created_at(&conn, "feed-plain").is_some());
    assert!(
        feed_created_at(&conn, "feed-imported").is_some(),
        "the sync-apply guard must not leave imported feeds without a creation time"
    );
}

#[test]
fn v32_keeps_an_explicit_created_at_on_insert() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();
    conn.execute_batch(
        "INSERT INTO accounts (id, kind, name) VALUES ('acc-1', 'Local', 'Test');
         INSERT INTO feeds (id, account_id, title, url, site_url, created_at)
         VALUES ('feed-1', 'acc-1', 'One', 'https://example.com/one.xml', 'https://example.com', '2020-01-01T00:00:00.000Z');",
    )
    .unwrap();

    assert_eq!(
        feed_created_at(&conn, "feed-1").as_deref(),
        Some("2020-01-01T00:00:00.000Z")
    );
}
