use rusqlite::Connection;
use tracing::info;

use crate::domain::error::DomainResult;

const MIGRATION_V1: &str = include_str!("../../../migrations/V1__initial.sql");
const MIGRATION_V2: &str = include_str!("../../../migrations/V2__preferences.sql");
const MIGRATION_V3: &str = include_str!("../../../migrations/V3__fts5.sql");
const MIGRATION_V4: &str = include_str!("../../../migrations/V4__tags.sql");
const MIGRATION_V5: &str = include_str!("../../../migrations/V5__feed_display_mode.sql");
const MIGRATION_V6: &str = include_str!("../../../migrations/V6__sync_state_timestamp_usec.sql");

/// Result of a migration run.
pub struct MigrationResult {
    /// Schema version before migration.
    pub from_version: i32,
    /// Schema version after migration.
    pub to_version: i32,
}

impl MigrationResult {
    /// Returns true if any migrations were applied.
    pub fn migrated(&self) -> bool {
        self.from_version < self.to_version
    }
}

pub const LATEST_VERSION: i32 = 6;

pub fn run_migrations(conn: &mut Connection) -> DomainResult<MigrationResult> {
    let tx = conn.transaction()?;
    let from_version = get_schema_version(&tx);

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

    let to_version = get_schema_version(&tx);
    tx.commit()?;

    if from_version < to_version {
        info!("Database migrated from v{from_version} to v{to_version}");
    } else {
        info!("Database schema is up to date (v{to_version})");
    }

    Ok(MigrationResult {
        from_version,
        to_version,
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

        let has_timestamp_usec: bool = conn
            .prepare("SELECT timestamp_usec FROM sync_state LIMIT 0")
            .is_ok();
        assert!(
            has_timestamp_usec,
            "latest sync_state cursor column should exist"
        );
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
}
