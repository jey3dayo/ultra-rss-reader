use super::super::consts::*;
use super::super::*;
use super::{normalize_sql, open_in_memory};

#[test]
fn fresh_db_migrates_to_latest() {
    let mut conn = open_in_memory();
    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, 0);
    assert_eq!(result.to_version, LATEST_VERSION);
    assert!(result.migrated());
}

#[test]
fn already_current_is_noop() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();
    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, LATEST_VERSION);
    assert_eq!(result.to_version, LATEST_VERSION);
    assert!(!result.migrated());
}

#[test]
fn latest_version_matches_migration_file_sequence() {
    let migration_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
    let mut versions = std::fs::read_dir(&migration_dir)
        .unwrap()
        .map(|entry| {
            let entry = entry.unwrap();
            let file_name = entry.file_name();
            let file_name = file_name.to_string_lossy();
            let version = file_name
                .strip_prefix('V')
                .and_then(|name| name.split_once("__"))
                .map(|(version, _)| version)
                .unwrap_or_else(|| panic!("invalid migration filename: {file_name}"));
            version
                .parse::<i32>()
                .unwrap_or_else(|_| panic!("invalid migration version: {file_name}"))
        })
        .collect::<Vec<_>>();
    versions.sort_unstable();

    assert_eq!(versions.last().copied(), Some(LATEST_VERSION));
    assert!(
        versions.windows(2).all(|window| window[0] < window[1]),
        "migration versions should be strictly increasing: {versions:?}"
    );

    let inline_versions = [10];
    for version in 1..=LATEST_VERSION {
        assert!(
            versions.binary_search(&version).is_ok() || inline_versions.contains(&version),
            "migration version {version} is not represented by a file or inline repair"
        );
    }
}

#[test]
fn v16_file_migration_matches_inline_contract() {
    let inline_v16_sql = format!(
        "{V16_CONNECTION_VERIFICATION_STATUS_SQL};
          {V16_CONNECTION_VERIFIED_AT_SQL};
          {V16_CONNECTION_VERIFICATION_ERROR_SQL};
          DELETE FROM schema_version;
          INSERT INTO schema_version (version) VALUES (16);"
    );

    assert_eq!(
        normalize_sql(MIGRATION_V16),
        normalize_sql(&inline_v16_sql),
        "file-based V16 migration must stay in sync with the inline migration"
    );
}

#[test]
fn v22_file_migration_matches_inline_contract() {
    let inline_v22_sql = format!(
        "{V22_LAST_EXPORT_DIGEST_SQL};
          DELETE FROM schema_version;
          INSERT INTO schema_version (version) VALUES (22);"
    );

    assert_eq!(
        normalize_sql(MIGRATION_V22),
        normalize_sql(&inline_v22_sql),
        "file-based V22 migration must stay in sync with the inline migration"
    );
}

#[test]
fn v22_allows_duplicate_last_export_digest_column_only() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();
    set_schema_version(&conn, 21).unwrap();

    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, 21);
    assert_eq!(result.to_version, LATEST_VERSION);
    assert!(conn
        .prepare("SELECT last_export_digest FROM local_account_sync_settings LIMIT 0")
        .is_ok());
}

#[test]
fn v24_file_migration_matches_inline_contract() {
    let inline_v24_sql = format!(
        "{V24_FEED_ICON_URL_SQL};
          DELETE FROM schema_version;
          INSERT INTO schema_version (version) VALUES (24);"
    );

    assert_eq!(
        normalize_sql(MIGRATION_V24),
        normalize_sql(&inline_v24_sql),
        "file-based V24 migration must stay in sync with the inline migration"
    );
}

#[test]
fn v24_allows_duplicate_feed_icon_url_column_only() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();
    set_schema_version(&conn, 23).unwrap();

    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, 23);
    assert_eq!(result.to_version, LATEST_VERSION);
    assert!(conn.prepare("SELECT icon_url FROM feeds LIMIT 0").is_ok());
}

#[test]
fn v27_file_migration_matches_inline_contract() {
    let inline_v27_sql = format!(
        "{V27_FOLDER_ORDER_MODE_SQL};
          DELETE FROM schema_version;
          INSERT INTO schema_version (version) VALUES (27);"
    );

    assert_eq!(
        normalize_sql(MIGRATION_V27),
        normalize_sql(&inline_v27_sql),
        "file-based V27 migration must stay in sync with the inline migration"
    );
}

#[test]
fn v28_file_migration_matches_inline_contract() {
    let inline_v28_sql = format!(
        "{V28_READ_CHANGED_AT_SQL};
          {V28_STARRED_CHANGED_AT_SQL};
          {V28_STAMP_TRIGGERS_SQL}
          DELETE FROM schema_version;
          INSERT INTO schema_version (version) VALUES (28);"
    );

    assert_eq!(
        normalize_sql(MIGRATION_V28),
        normalize_sql(&inline_v28_sql),
        "file-based V28 migration must stay in sync with the inline migration"
    );
}

#[test]
fn v27_allows_duplicate_folder_order_mode_column_only() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();
    set_schema_version(&conn, 26).unwrap();

    let first = run_migrations(&mut conn).unwrap();
    assert_eq!(first.from_version, 26);
    assert_eq!(first.to_version, LATEST_VERSION);
    assert!(conn
        .prepare("SELECT folder_order_mode FROM accounts LIMIT 0")
        .is_ok());

    let second = run_migrations(&mut conn).unwrap();
    assert_eq!(second.from_version, LATEST_VERSION);
    assert_eq!(second.to_version, LATEST_VERSION);
    assert!(!second.migrated());
}

#[test]
fn v28_adds_article_change_time_columns_and_triggers() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();

    assert!(conn
        .prepare("SELECT read_changed_at, starred_changed_at FROM articles LIMIT 0")
        .is_ok());
    let trigger_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master
             WHERE type = 'trigger'
               AND name IN ('articles_stamp_read_changed_at', 'articles_stamp_starred_changed_at')",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(trigger_count, 2);
}

#[test]
fn v28_stamps_change_times_for_repository_writes_but_not_for_explicit_times() {
    use crate::domain::types::ArticleId;
    use crate::infra::db::connection::DbManager;
    use crate::infra::db::sqlite_article::SqliteArticleRepository;
    use crate::repository::article::ArticleMutationRepository;

    let db = DbManager::new_in_memory().unwrap();
    let conn = db.writer();
    conn.execute_batch(
        "INSERT INTO accounts (id, kind, name) VALUES ('account-1', 'Local', 'Local');
         INSERT INTO feeds (id, account_id, title, url, site_url, reader_mode, web_preview_mode)
         VALUES ('feed-1', 'account-1', 'Feed', 'https://example.com/feed.xml', '', 'inherit', 'inherit');
         INSERT INTO articles (id, feed_id, title, published_at, fetched_at, is_read, is_starred)
         VALUES ('article-1', 'feed-1', 'Article', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 0, 0);",
    )
    .unwrap();
    let change_times = |conn: &Connection| -> (Option<String>, Option<String>) {
        conn.query_row(
            "SELECT read_changed_at, starred_changed_at FROM articles WHERE id = 'article-1'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap()
    };
    assert_eq!(change_times(conn), (None, None));

    let repo = SqliteArticleRepository::new(conn);
    repo.mark_as_read(&ArticleId("article-1".to_string()), true)
        .unwrap();
    let (read_changed_at, starred_changed_at) = change_times(conn);
    assert!(read_changed_at.is_some_and(|value| value.ends_with('Z')));
    assert_eq!(starred_changed_at, None);

    repo.mark_as_starred(&ArticleId("article-1".to_string()), true)
        .unwrap();
    assert!(change_times(conn).1.is_some());

    conn.execute(
        "UPDATE articles SET is_read = 0, read_changed_at = '2020-05-06T07:08:09.123Z'
         WHERE id = 'article-1'",
        [],
    )
    .unwrap();
    assert_eq!(
        change_times(conn).0.as_deref(),
        Some("2020-05-06T07:08:09.123Z")
    );
}
