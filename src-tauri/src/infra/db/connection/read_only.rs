use std::path::{Path, PathBuf};
use std::time::Duration;

use rusqlite::{Connection, OpenFlags};

use crate::domain::error::DomainError;

use super::super::migration::{read_schema_version, LATEST_VERSION};
use super::{DatabaseInfo, DbManager};

const READ_ONLY_BUSY_TIMEOUT_MS: u64 = 5000;

/// Distinct from [`crate::domain::error::DomainError`] because the CLI dispatcher
/// maps each variant to its own exit code (`NOT_FOUND` vs `SCHEMA_MISMATCH` vs a
/// generic failure); collapsing them into `DomainError` would lose that
/// distinction for every caller of `DomainError`.
#[derive(Debug, thiserror::Error)]
pub enum ReadOnlyOpenError {
    #[error("database file not found: {}", .0.display())]
    MissingFile(PathBuf),
    #[error("database schema version {found} does not match the version this CLI expects ({expected}); reinstall a matching app/CLI version")]
    SchemaMismatch { found: i32, expected: i32 },
    #[error(transparent)]
    Domain(#[from] DomainError),
}

/// A read-only handle on the application SQLite database.
///
/// Opened with `SQLITE_OPEN_READ_ONLY` only: no migrations, no backup, no
/// `reconcile_startup_migration_cost`, and no `apply_pragmas` contract checks
/// run. This must never gain a writer connection or a `&mut` method that
/// executes anything beyond `SELECT`/`PRAGMA` reads.
#[derive(Debug)]
pub struct ReadOnlyDbManager {
    conn: Connection,
    path: PathBuf,
}

impl ReadOnlyDbManager {
    pub fn open(path: &Path) -> Result<Self, ReadOnlyOpenError> {
        if !path.exists() {
            return Err(ReadOnlyOpenError::MissingFile(path.to_path_buf()));
        }

        let conn = Connection::open_with_flags(
            path,
            OpenFlags::SQLITE_OPEN_READ_ONLY
                | OpenFlags::SQLITE_OPEN_URI
                | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )
        .map_err(DomainError::from)?;
        conn.busy_timeout(Duration::from_millis(READ_ONLY_BUSY_TIMEOUT_MS))
            .map_err(DomainError::from)?;

        let found = read_schema_version(&conn)?;
        if found != LATEST_VERSION {
            return Err(ReadOnlyOpenError::SchemaMismatch {
                found,
                expected: LATEST_VERSION,
            });
        }

        Ok(Self {
            conn,
            path: path.to_path_buf(),
        })
    }

    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    pub fn database_info(&self) -> DatabaseInfo {
        DbManager::database_info_from_path(&self.path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;
    use tempfile::tempdir;

    fn checkpoint(manager: &DbManager) {
        manager
            .writer()
            .pragma_update(None, "wal_checkpoint", "TRUNCATE")
            .expect("checkpoint should succeed on a fixture writer");
    }

    fn set_schema_version(manager: &DbManager, version: i32) {
        manager
            .writer()
            .execute("UPDATE schema_version SET version = ?1", params![version])
            .expect("updating schema_version should succeed as a fixture setup step");
    }

    #[test]
    fn open_rejects_a_missing_file_with_missing_file() {
        let dir = tempdir().expect("tempdir should be creatable");
        let missing = dir.path().join("does-not-exist.db");

        let error = ReadOnlyDbManager::open(&missing).expect_err("missing file should be rejected");

        match error {
            ReadOnlyOpenError::MissingFile(path) => assert_eq!(path, missing),
            other => panic!("expected MissingFile, got {other:?}"),
        }
    }

    #[test]
    fn open_rejects_an_older_schema_version_with_schema_mismatch() {
        let dir = tempdir().expect("tempdir should be creatable");
        let db_path = dir.path().join("older.db");

        let manager = DbManager::new(&db_path).expect("fresh db should migrate cleanly");
        set_schema_version(&manager, LATEST_VERSION - 1);
        checkpoint(&manager);
        drop(manager);

        let error =
            ReadOnlyDbManager::open(&db_path).expect_err("older schema version should be rejected");

        match error {
            ReadOnlyOpenError::SchemaMismatch { found, expected } => {
                assert_eq!(found, LATEST_VERSION - 1);
                assert_eq!(expected, LATEST_VERSION);
            }
            other => panic!("expected SchemaMismatch, got {other:?}"),
        }
    }

    #[test]
    fn open_rejects_a_newer_schema_version_with_schema_mismatch() {
        let dir = tempdir().expect("tempdir should be creatable");
        let db_path = dir.path().join("newer.db");

        let manager = DbManager::new(&db_path).expect("fresh db should migrate cleanly");
        set_schema_version(&manager, LATEST_VERSION + 1);
        checkpoint(&manager);
        drop(manager);

        let error =
            ReadOnlyDbManager::open(&db_path).expect_err("newer schema version should be rejected");

        match error {
            ReadOnlyOpenError::SchemaMismatch { found, expected } => {
                assert_eq!(found, LATEST_VERSION + 1);
                assert_eq!(expected, LATEST_VERSION);
            }
            other => panic!("expected SchemaMismatch, got {other:?}"),
        }
    }

    #[test]
    fn open_accepts_a_freshly_migrated_database_at_the_latest_version() {
        let dir = tempdir().expect("tempdir should be creatable");
        let db_path = dir.path().join("current.db");

        let manager = DbManager::new(&db_path).expect("fresh db should migrate cleanly");
        checkpoint(&manager);
        drop(manager);

        let read_only =
            ReadOnlyDbManager::open(&db_path).expect("current schema version should open");
        let version =
            read_schema_version(read_only.conn()).expect("schema_version should be readable");
        assert_eq!(version, LATEST_VERSION);
    }
}
