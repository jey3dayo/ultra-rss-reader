use rusqlite::Connection;
use tracing::info;

use crate::domain::error::DomainResult;

const MIGRATION_V1: &str = include_str!("../../../migrations/V1__initial.sql");
const MIGRATION_V2: &str = include_str!("../../../migrations/V2__preferences.sql");
const MIGRATION_V3: &str = include_str!("../../../migrations/V3__fts5.sql");
const MIGRATION_V4: &str = include_str!("../../../migrations/V4__tags.sql");
const MIGRATION_V5: &str = include_str!("../../../migrations/V5__feed_display_mode.sql");

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

pub const LATEST_VERSION: i32 = 5;

pub fn run_migrations(conn: &mut Connection) -> DomainResult<MigrationResult> {
    let from_version = get_schema_version(conn);

    if from_version < 1 {
        conn.execute_batch(MIGRATION_V1)?;
    }
    if from_version < 2 {
        conn.execute_batch(MIGRATION_V2)?;
    }
    if from_version < 3 {
        conn.execute_batch(MIGRATION_V3)?;
    }
    if from_version < 4 {
        conn.execute_batch(MIGRATION_V4)?;
    }
    if from_version < 5 {
        conn.execute_batch(MIGRATION_V5)?;
    }

    let to_version = get_schema_version(conn);

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
