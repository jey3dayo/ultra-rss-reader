mod consts;
mod repairs;
#[cfg(test)]
mod tests;

use rusqlite::{params, Connection};
use tracing::info;

use crate::domain::error::{DomainError, DomainResult};

use consts::{
    MIGRATION_V1, MIGRATION_V11, MIGRATION_V12, MIGRATION_V13, MIGRATION_V14, MIGRATION_V15,
    MIGRATION_V17, MIGRATION_V18, MIGRATION_V19, MIGRATION_V2, MIGRATION_V21, MIGRATION_V23,
    MIGRATION_V25, MIGRATION_V26, MIGRATION_V3, MIGRATION_V4, MIGRATION_V5, MIGRATION_V6,
    MIGRATION_V7, MIGRATION_V9,
};
use repairs::{
    apply_v16_account_connection_verification, apply_v20_article_account_ordered_indexes,
    apply_v22_local_account_sync_export_state, apply_v24_feed_icon_url,
    apply_v8_feed_reader_preview_modes, feed_mode_columns_need_repair,
    repair_missing_feed_mode_columns,
};

/// Result of a migration run.
#[derive(Debug)]
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

pub const LATEST_VERSION: i32 = 26;

/// Applies every pending migration in one SQLite transaction.
///
/// SQLite transactional DDL is part of the migration contract here: if any
/// migration step fails after earlier `ALTER TABLE` or `CREATE TABLE`
/// statements, the transaction rolls those schema changes back with the data
/// changes and leaves `schema_version` at the pre-migration value. The next
/// startup can retry from the same version instead of booting on a partially
/// migrated schema.
pub fn run_migrations(conn: &mut Connection) -> DomainResult<MigrationResult> {
    let tx = conn.transaction()?;
    let from_version = read_schema_version(&tx)?;
    let mut repaired_schema = false;

    if from_version > LATEST_VERSION {
        return Err(DomainError::Migration(format!(
            "Database schema version {from_version} is newer than this application supports (v{LATEST_VERSION}). \
             Downgrade startup is blocked to avoid data loss. Install a newer application version or restore a compatible backup."
        )));
    }

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
        apply_v8_feed_reader_preview_modes(&tx)?;
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
    if from_version < 12 {
        tx.execute_batch(MIGRATION_V12)?;
    }
    if from_version < 13 {
        tx.execute_batch(MIGRATION_V13)?;
    }
    if from_version < 14 {
        tx.execute_batch(MIGRATION_V14)?;
    }
    if from_version < 15 {
        tx.execute_batch(MIGRATION_V15)?;
    }
    if from_version < 16 {
        apply_v16_account_connection_verification(&tx)?;
    }
    if from_version < 17 {
        tx.execute_batch(MIGRATION_V17)?;
    }
    if from_version < 18 {
        tx.execute_batch(MIGRATION_V18)?;
    }
    if from_version < 19 {
        tx.execute_batch(MIGRATION_V19)?;
    }
    if from_version < 20 {
        apply_v20_article_account_ordered_indexes(&tx)?;
    }
    if from_version < 21 {
        tx.execute_batch(MIGRATION_V21)?;
    }
    if from_version < 22 {
        apply_v22_local_account_sync_export_state(&tx)?;
    }
    if from_version < 23 {
        tx.execute_batch(MIGRATION_V23)?;
    }
    if from_version < 24 {
        apply_v24_feed_icon_url(&tx)?;
    }
    if from_version < 25 {
        tx.execute_batch(MIGRATION_V25)?;
    }
    if from_version < 26 {
        tx.execute_batch(MIGRATION_V26)?;
    }

    let to_version = read_schema_version(&tx)?;
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
    read_schema_version(conn).unwrap_or(0)
}

pub fn read_schema_version(conn: &Connection) -> DomainResult<i32> {
    if !table_exists(conn, "schema_version")? {
        if user_table_count(conn)? == 0 {
            return Ok(0);
        }

        return Err(DomainError::Migration(
            "schema_version table is missing from an existing database. Restore a compatible backup or recreate the database.".to_string(),
        ));
    }

    let row_count: i64 =
        conn.query_row("SELECT COUNT(*) FROM schema_version", [], |row| row.get(0))?;
    if row_count == 0 {
        return Err(DomainError::Migration(
            "schema_version table is empty. Restore a compatible backup or recreate the database."
                .to_string(),
        ));
    }

    let invalid_type_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM schema_version WHERE typeof(version) != 'integer'",
        [],
        |row| row.get(0),
    )?;
    if invalid_type_count != 0 {
        return Err(DomainError::Migration(
            "schema_version contains a non-integer version. Restore a compatible backup or recreate the database.".to_string(),
        ));
    }

    let (min_version, max_version): (i32, i32) = conn.query_row(
        "SELECT MIN(version), MAX(version) FROM schema_version",
        [],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;

    if min_version < 0 {
        return Err(DomainError::Migration(
            "schema_version contains a negative version. Restore a compatible backup or recreate the database.".to_string(),
        ));
    }

    if row_count > 1 && min_version == max_version {
        return Err(DomainError::Migration(format!(
            "schema_version contains duplicate v{max_version} rows. Restore a compatible backup or recreate the database."
        )));
    }

    Ok(max_version)
}

fn user_table_count(conn: &Connection) -> DomainResult<i64> {
    Ok(conn.query_row(
        "SELECT COUNT(*)
         FROM sqlite_master
         WHERE type = 'table'
           AND name NOT LIKE 'sqlite_%'",
        [],
        |row| row.get(0),
    )?)
}

pub fn schema_needs_migration(conn: &Connection) -> DomainResult<bool> {
    let version = read_schema_version(conn)?;
    if version > LATEST_VERSION {
        return Err(DomainError::Migration(format!(
            "Database schema version {version} is newer than this application supports (v{LATEST_VERSION}). \
             Downgrade startup is blocked to avoid data loss. Install a newer application version or restore a compatible backup."
        )));
    }

    Ok(version < LATEST_VERSION || feed_mode_columns_need_repair(conn)?)
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
