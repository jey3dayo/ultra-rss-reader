use rusqlite::{params, Connection};
use tracing::info;

use crate::domain::error::DomainResult;

const MIGRATION_V1: &str = include_str!("../../../migrations/V1__initial.sql");
const MIGRATION_V2: &str = include_str!("../../../migrations/V2__preferences.sql");
const MIGRATION_V3: &str = include_str!("../../../migrations/V3__fts5.sql");
const MIGRATION_V4: &str = include_str!("../../../migrations/V4__tags.sql");
const MIGRATION_V5: &str = include_str!("../../../migrations/V5__feed_display_mode.sql");
const MIGRATION_V6: &str = include_str!("../../../migrations/V6__sync_state_timestamp_usec.sql");
const MIGRATION_V7: &str = include_str!("../../../migrations/V7__feed_display_mode_inherit.sql");
const MIGRATION_V8: &str = include_str!("../../../migrations/V8__feed_reader_preview_modes.sql");
const MIGRATION_V9: &str =
    include_str!("../../../migrations/V9__reader_preview_default_preferences.sql");
const MIGRATION_V11: &str = include_str!("../../../migrations/V11__account_sync_on_startup.sql");

/// Result of a migration run.
pub struct MigrationResult {
    /// Schema version before migration.
    pub from_version: i32,
    /// Schema version after migration.
    pub to_version: i32,
    /// True when the schema needed structural repair without a numeric version bump.
    pub repaired_schema: bool,
}

impl MigrationResult {
    /// Returns true if any migrations were applied.
    pub fn migrated(&self) -> bool {
        self.from_version < self.to_version || self.repaired_schema
    }
}

pub const LATEST_VERSION: i32 = 11;

pub fn run_migrations(conn: &mut Connection) -> DomainResult<MigrationResult> {
    let tx = conn.transaction()?;
    let from_version = get_schema_version(&tx);
    let mut repaired_schema = false;

    if from_version < 1 {
        tx.execute_batch(MIGRATION_V1)?;
    }
    if from_version < 2 {
        tx.execute_batch(MIGRATION_V2)?;
    }
    if from_version < 3 {
        tx.execute_batch(MIGRATION_V3)?;
    }
    if from_version < 4 {
        tx.execute_batch(MIGRATION_V4)?;
    }
    if from_version < 5 {
        tx.execute_batch(MIGRATION_V5)?;
    }
    if from_version < 6 {
        tx.execute_batch(MIGRATION_V6)?;
    }
    if from_version < 7 {
        tx.execute_batch(MIGRATION_V7)?;
    }
    if from_version < 8 {
        tx.execute_batch(MIGRATION_V8)?;
    }
    if from_version < 9 {
        tx.execute_batch(MIGRATION_V9)?;
    }
    if from_version < 10 || feed_mode_columns_need_repair(&tx)? {
        repaired_schema = repair_missing_feed_mode_columns(&tx)?;
        set_schema_version(&tx, 10)?;
    }
    if from_version < 11 {
        tx.execute_batch(MIGRATION_V11)?;
    }

    let to_version = get_schema_version(&tx);
    tx.commit()?;

    if from_version < to_version {
        info!("Database migrated from v{from_version} to v{to_version}");
    } else if repaired_schema {
        info!("Database schema repaired in place at v{to_version}");
    } else {
        info!("Database schema is up to date (v{to_version})");
    }

    Ok(MigrationResult {
        from_version,
        to_version,
        repaired_schema,
    })
}

pub fn get_schema_version(conn: &Connection) -> i32 {
    conn.query_row(
        "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1",
        [],
        |row| row.get(0),
    )
    .unwrap_or(0)
}

pub fn schema_needs_migration(conn: &Connection) -> DomainResult<bool> {
    Ok(get_schema_version(conn) < LATEST_VERSION || feed_mode_columns_need_repair(conn)?)
}

fn feed_mode_columns_need_repair(conn: &Connection) -> DomainResult<bool> {
    if !table_exists(conn, "feeds")? {
        return Ok(false);
    }

    let has_reader_mode = table_has_column(conn, "feeds", "reader_mode")?;
    let has_web_preview_mode = table_has_column(conn, "feeds", "web_preview_mode")?;
    Ok(!has_reader_mode || !has_web_preview_mode)
}

fn repair_missing_feed_mode_columns(conn: &Connection) -> DomainResult<bool> {
    if !table_exists(conn, "feeds")? {
        return Ok(false);
    }

    let has_reader_mode = table_has_column(conn, "feeds", "reader_mode")?;
    let has_web_preview_mode = table_has_column(conn, "feeds", "web_preview_mode")?;

    if has_reader_mode && has_web_preview_mode {
        return Ok(false);
    }

    if !has_reader_mode {
        conn.execute(
            "ALTER TABLE feeds ADD COLUMN reader_mode TEXT NOT NULL DEFAULT 'inherit'",
            [],
        )?;
    }
    if !has_web_preview_mode {
        conn.execute(
            "ALTER TABLE feeds ADD COLUMN web_preview_mode TEXT NOT NULL DEFAULT 'inherit'",
            [],
        )?;
    }

    if table_has_column(conn, "feeds", "display_mode")? {
        if !has_reader_mode {
            conn.execute(
                "UPDATE feeds
                 SET reader_mode = CASE
                    WHEN display_mode = 'normal' THEN 'on'
                    WHEN display_mode = 'widescreen' THEN 'on'
                    ELSE 'inherit'
                 END
                 WHERE reader_mode = 'inherit'",
                [],
            )?;
        }
        if !has_web_preview_mode {
            conn.execute(
                "UPDATE feeds
                 SET web_preview_mode = CASE
                    WHEN display_mode = 'normal' THEN 'off'
                    WHEN display_mode = 'widescreen' THEN 'on'
                    ELSE 'inherit'
                 END
                 WHERE web_preview_mode = 'inherit'",
                [],
            )?;
        }
    }

    Ok(true)
}

fn set_schema_version(conn: &Connection, version: i32) -> DomainResult<()> {
    conn.execute("DELETE FROM schema_version", [])?;
    conn.execute(
        "INSERT INTO schema_version (version) VALUES (?1)",
        params![version],
    )?;
    Ok(())
}

fn table_exists(conn: &Connection, table_name: &str) -> DomainResult<bool> {
    let exists: i32 = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1)",
        [table_name],
        |row| row.get(0),
    )?;
    Ok(exists != 0)
}

fn table_has_column(conn: &Connection, table_name: &str, column_name: &str) -> DomainResult<bool> {
    if !table_exists(conn, table_name)? {
        return Ok(false);
    }

    let pragma = format!("PRAGMA table_info({table_name})");
    let mut stmt = conn.prepare(&pragma)?;
    let mut rows = stmt.query([])?;

    while let Some(row) = rows.next()? {
        let name: String = row.get(1)?;
        if name == column_name {
            return Ok(true);
        }
    }

    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn open_in_memory() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        conn
    }

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
    fn v9_migrates_reader_view_preference_to_reader_and_preview_defaults() {
        let mut conn = open_in_memory();
        conn.execute_batch(MIGRATION_V1).unwrap();
        conn.execute_batch(MIGRATION_V2).unwrap();
        conn.execute_batch(MIGRATION_V3).unwrap();
        conn.execute_batch(MIGRATION_V4).unwrap();
        conn.execute_batch(MIGRATION_V5).unwrap();
        conn.execute_batch(MIGRATION_V6).unwrap();
        conn.execute_batch(MIGRATION_V7).unwrap();
        conn.execute_batch(MIGRATION_V8).unwrap();

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
}
