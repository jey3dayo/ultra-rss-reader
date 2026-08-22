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
