use super::super::consts::*;
use super::super::*;
use super::{assert_single_schema_version_row, open_in_memory};

#[test]
fn latest_schema_version_is_single_latest_row() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();

    assert_single_schema_version_row(&conn, LATEST_VERSION);
}

#[test]
fn schema_version_reader_allows_only_truly_fresh_missing_table() {
    let conn = open_in_memory();
    assert_eq!(read_schema_version(&conn).unwrap(), 0);

    conn.execute("CREATE TABLE accounts (id TEXT PRIMARY KEY)", [])
        .unwrap();
    let error = read_schema_version(&conn).unwrap_err();

    assert!(
        error
            .to_string()
            .contains("schema_version table is missing"),
        "existing DB without schema_version should be recoverable corruption: {error}"
    );
}

#[test]
fn schema_version_reader_rejects_corrupted_metadata_rows() {
    let conn = open_in_memory();
    conn.execute("CREATE TABLE schema_version (version)", [])
        .unwrap();

    let empty_error = read_schema_version(&conn).unwrap_err();
    assert!(
        empty_error
            .to_string()
            .contains("schema_version table is empty"),
        "empty schema_version should be corrupted metadata: {empty_error}"
    );

    conn.execute(
        "INSERT INTO schema_version (version) VALUES ('invalid')",
        [],
    )
    .unwrap();
    let invalid_type_error = read_schema_version(&conn).unwrap_err();
    assert!(
        invalid_type_error
            .to_string()
            .contains("non-integer version"),
        "invalid version type should be corrupted metadata: {invalid_type_error}"
    );

    conn.execute("DELETE FROM schema_version", []).unwrap();
    conn.execute(
        "INSERT INTO schema_version (version) VALUES (?1), (?1)",
        [LATEST_VERSION],
    )
    .unwrap();
    let duplicate_error = read_schema_version(&conn).unwrap_err();
    assert!(
        duplicate_error.to_string().contains("duplicate"),
        "duplicate identical schema rows should be corrupted metadata: {duplicate_error}"
    );
}

#[test]
fn schema_version_reader_preserves_legacy_incremental_rows() {
    let conn = open_in_memory();
    conn.execute("CREATE TABLE schema_version (version INTEGER NOT NULL)", [])
        .unwrap();
    conn.execute(
        "INSERT INTO schema_version (version) VALUES (5), (6), (7)",
        [],
    )
    .unwrap();

    assert_eq!(read_schema_version(&conn).unwrap(), 7);
}

#[test]
fn future_schema_version_blocks_downgrade_migration() {
    let mut conn = open_in_memory();
    run_migrations(&mut conn).unwrap();
    set_schema_version(&conn, LATEST_VERSION + 1).unwrap();

    let Err(error) = run_migrations(&mut conn) else {
        panic!("future schema should block migration");
    };
    let message = error.to_string();

    assert!(
        message.contains("newer than this application supports"),
        "future schema should be treated as downgrade block: {message}"
    );
    assert!(
        message.contains("Downgrade startup is blocked"),
        "downgrade error should explain recovery direction: {message}"
    );
}

#[test]
fn partial_migration_failure_rolls_back_ddl_and_preserves_schema_version_for_retry() {
    let mut conn = open_in_memory();
    conn.execute_batch(MIGRATION_V1).unwrap();
    conn.execute_batch(MIGRATION_V2).unwrap();
    conn.execute_batch(MIGRATION_V3).unwrap();
    conn.execute_batch(MIGRATION_V4).unwrap();
    conn.execute_batch(MIGRATION_V5).unwrap();
    conn.execute_batch(MIGRATION_V6).unwrap();
    conn.execute_batch(MIGRATION_V7).unwrap();
    assert_eq!(get_schema_version(&conn), 7);

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
    // Fail after V8 adds columns but before it can copy display_mode data.
    // The migration transaction must erase those DDL changes so removing
    // the failure trigger allows the same DB to retry from v7.
    conn.execute_batch(
        "CREATE TRIGGER fail_v8_data_copy
          BEFORE UPDATE ON feeds
          BEGIN
            SELECT RAISE(FAIL, 'fixture data copy failed');
          END;",
    )
    .unwrap();

    let error = run_migrations(&mut conn).unwrap_err();

    assert!(
        error.to_string().contains("fixture data copy failed"),
        "migration should surface the failed data copy: {error}"
    );
    assert_eq!(
        get_schema_version(&conn),
        7,
        "failed migration must leave schema_version unchanged for retry"
    );
    assert!(
        !table_has_column(&conn, "feeds", V8_READER_MODE_COLUMN).unwrap(),
        "transactional DDL must roll back the partially added reader_mode column"
    );
    assert!(
        !table_has_column(&conn, "feeds", V8_WEB_PREVIEW_MODE_COLUMN).unwrap(),
        "transactional DDL must roll back the partially added web_preview_mode column"
    );
    let display_mode: String = conn
        .query_row(
            "SELECT display_mode FROM feeds WHERE id = ?1",
            ("feed-1",),
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        display_mode, "normal",
        "failed migration must preserve pre-migration feed data for retry"
    );

    conn.execute("DROP TRIGGER fail_v8_data_copy", []).unwrap();
    let result = run_migrations(&mut conn).unwrap();

    assert_eq!(result.from_version, 7);
    assert_eq!(result.to_version, LATEST_VERSION);
    assert!(table_has_column(&conn, "feeds", V8_READER_MODE_COLUMN).unwrap());
    assert!(table_has_column(&conn, "feeds", V8_WEB_PREVIEW_MODE_COLUMN).unwrap());
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
