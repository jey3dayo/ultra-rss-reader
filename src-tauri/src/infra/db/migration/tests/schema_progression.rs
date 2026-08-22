use super::super::consts::*;
use super::super::*;
use super::{migrate_to_v19, open_in_memory};

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
