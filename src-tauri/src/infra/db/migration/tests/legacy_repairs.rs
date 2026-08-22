use super::super::consts::*;
use super::super::repairs::*;
use super::super::*;
use super::open_in_memory;

#[test]
fn v7_converts_legacy_normal_display_mode_to_inherit() {
    let mut conn = open_in_memory();
    conn.execute_batch(MIGRATION_V1).unwrap();
    conn.execute_batch(MIGRATION_V2).unwrap();
    conn.execute_batch(MIGRATION_V3).unwrap();
    conn.execute_batch(MIGRATION_V4).unwrap();
    conn.execute_batch(MIGRATION_V5).unwrap();
    conn.execute_batch(MIGRATION_V6).unwrap();

    conn.execute(
        "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
        ("acc-1", "local", "Local"),
    )
    .unwrap();
    conn.execute(
         "INSERT INTO feeds (id, account_id, title, url, site_url, unread_count, display_mode) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
         ("feed-1", "acc-1", "Tech Blog", "https://example.com/feed.xml", "https://example.com", 0, "normal"),
     )
     .unwrap();

    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, 6);
    assert_eq!(result.to_version, LATEST_VERSION);

    let display_mode: String = conn
        .query_row(
            "SELECT display_mode FROM feeds WHERE id = ?1",
            ("feed-1",),
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(display_mode, "inherit");
}

#[test]
fn v8_converts_display_mode_to_reader_and_preview_axes() {
    let mut conn = open_in_memory();
    conn.execute_batch(MIGRATION_V1).unwrap();
    conn.execute_batch(MIGRATION_V2).unwrap();
    conn.execute_batch(MIGRATION_V3).unwrap();
    conn.execute_batch(MIGRATION_V4).unwrap();
    conn.execute_batch(MIGRATION_V5).unwrap();
    conn.execute_batch(MIGRATION_V6).unwrap();
    conn.execute_batch(MIGRATION_V7).unwrap();

    conn.execute(
        "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
        ("acc-1", "local", "Local"),
    )
    .unwrap();
    conn.execute(
         "INSERT INTO feeds (id, account_id, title, url, site_url, unread_count, display_mode) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
         ("feed-1", "acc-1", "Tech Blog", "https://example.com/feed.xml", "https://example.com", 0, "widescreen"),
     )
     .unwrap();

    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, 7);
    assert_eq!(result.to_version, LATEST_VERSION);

    let (reader_mode, web_preview_mode): (String, String) = conn
        .query_row(
            "SELECT reader_mode, web_preview_mode FROM feeds WHERE id = ?1",
            ("feed-1",),
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(reader_mode, "on");
    assert_eq!(web_preview_mode, "on");
}

#[test]
fn v8_allows_duplicate_reader_preview_columns_only() {
    let mut conn = open_in_memory();
    conn.execute_batch(MIGRATION_V1).unwrap();
    conn.execute_batch(MIGRATION_V2).unwrap();
    conn.execute_batch(MIGRATION_V3).unwrap();
    conn.execute_batch(MIGRATION_V4).unwrap();
    conn.execute_batch(MIGRATION_V5).unwrap();
    conn.execute_batch(MIGRATION_V6).unwrap();
    conn.execute_batch(MIGRATION_V7).unwrap();
    conn.execute_batch(
        "ALTER TABLE feeds ADD COLUMN reader_mode TEXT NOT NULL DEFAULT 'inherit';
          ALTER TABLE feeds ADD COLUMN web_preview_mode TEXT NOT NULL DEFAULT 'inherit';",
    )
    .unwrap();

    conn.execute(
        "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
        ("acc-1", "local", "Local"),
    )
    .unwrap();
    conn.execute(
        "INSERT INTO feeds (id, account_id, title, url, site_url, unread_count, display_mode)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        (
            "feed-1",
            "acc-1",
            "Tech Blog",
            "https://example.com/feed.xml",
            "https://example.com",
            0,
            "normal",
        ),
    )
    .unwrap();

    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, 7);
    assert_eq!(result.to_version, LATEST_VERSION);

    let (reader_mode, web_preview_mode): (String, String) = conn
        .query_row(
            "SELECT reader_mode, web_preview_mode FROM feeds WHERE id = ?1",
            ("feed-1",),
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(reader_mode, "on");
    assert_eq!(web_preview_mode, "off");
}

#[test]
fn duplicate_unlisted_migration_column_still_fails() {
    let mut conn = open_in_memory();
    conn.execute_batch(MIGRATION_V1).unwrap();
    conn.execute_batch(MIGRATION_V2).unwrap();
    conn.execute_batch(MIGRATION_V3).unwrap();
    conn.execute_batch(MIGRATION_V4).unwrap();
    conn.execute_batch(MIGRATION_V5).unwrap();
    conn.execute_batch("ALTER TABLE sync_state ADD COLUMN timestamp_usec INTEGER;")
        .unwrap();

    let result = run_migrations(&mut conn);

    assert!(
        result.is_err(),
        "V6 duplicate timestamp_usec should not be treated as an allowed fallback"
    );
    assert_eq!(get_schema_version(&conn), 5);
}

#[test]
fn v9_migrates_reader_view_preference_to_reader_and_preview_defaults() {
    let mut conn = open_in_memory();
    conn.execute_batch(MIGRATION_V1).unwrap();
    conn.execute_batch(MIGRATION_V2).unwrap();
    conn.execute_batch(MIGRATION_V3).unwrap();
    conn.execute_batch(MIGRATION_V4).unwrap();
    conn.execute_batch(MIGRATION_V5).unwrap();
    conn.execute_batch(MIGRATION_V6).unwrap();
    conn.execute_batch(MIGRATION_V7).unwrap();
    apply_v8_feed_reader_preview_modes(&conn).unwrap();

    conn.execute(
        "INSERT INTO preferences (key, value) VALUES (?1, ?2)",
        ("reader_view", "widescreen"),
    )
    .unwrap();

    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, 8);
    assert_eq!(result.to_version, LATEST_VERSION);

    let prefs: Vec<(String, String)> = conn
        .prepare("SELECT key, value FROM preferences ORDER BY key")
        .unwrap()
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();

    assert!(prefs.contains(&("reader_mode_default".to_string(), "true".to_string())));
    assert!(prefs.contains(&("web_preview_mode_default".to_string(), "true".to_string())));
    assert!(!prefs.iter().any(|(key, _)| key == "reader_view"));
}

#[test]
fn failed_migration_rolls_back_all_versions() {
    let mut conn = open_in_memory();
    conn.execute_batch(MIGRATION_V1).unwrap();
    conn.execute_batch(
        "CREATE TABLE tags (
             id TEXT PRIMARY KEY,
             name TEXT NOT NULL UNIQUE,
             color TEXT
         );",
    )
    .unwrap();

    let result = run_migrations(&mut conn);
    assert!(
        result.is_err(),
        "migration should fail on conflicting tags table"
    );
    assert_eq!(
        get_schema_version(&conn),
        1,
        "schema version should stay at the original version after rollback"
    );

    let preferences_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='preferences'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        preferences_count, 0,
        "V2 changes should be rolled back when a later migration fails"
    );

    let fts_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='articles_fts'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        fts_count, 0,
        "V3 changes should be rolled back when a later migration fails"
    );
}

#[test]
fn v10_repairs_v9_schema_missing_reader_preview_columns() {
    let mut conn = open_in_memory();
    conn.execute_batch(MIGRATION_V1).unwrap();
    conn.execute_batch(MIGRATION_V2).unwrap();
    conn.execute_batch(MIGRATION_V3).unwrap();
    conn.execute_batch(MIGRATION_V4).unwrap();
    conn.execute_batch(MIGRATION_V5).unwrap();
    conn.execute_batch(MIGRATION_V6).unwrap();
    conn.execute_batch(MIGRATION_V7).unwrap();

    conn.execute(
        "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
        ("acc-1", "local", "Local"),
    )
    .unwrap();
    conn.execute(
         "INSERT INTO feeds (id, account_id, title, url, site_url, unread_count, display_mode) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
         ("feed-1", "acc-1", "Tech Blog", "https://example.com/feed.xml", "https://example.com", 0, "widescreen"),
     )
     .unwrap();

    conn.execute("DELETE FROM schema_version", []).unwrap();
    conn.execute("INSERT INTO schema_version (version) VALUES (9)", [])
        .unwrap();

    let result = run_migrations(&mut conn).unwrap();
    assert_eq!(result.from_version, 9);
    assert_eq!(result.to_version, LATEST_VERSION);

    let (reader_mode, web_preview_mode): (String, String) = conn
        .query_row(
            "SELECT reader_mode, web_preview_mode FROM feeds WHERE id = ?1",
            ("feed-1",),
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(reader_mode, "on");
    assert_eq!(web_preview_mode, "on");
}
