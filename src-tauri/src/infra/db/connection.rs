use rusqlite::Connection;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

use crate::domain::error::{DomainError, DomainResult};

static IN_MEMORY_COUNTER: AtomicU64 = AtomicU64::new(0);

pub struct DbManager {
    writer: Connection,
    reader: Connection,
}

impl DbManager {
    pub fn new(db_path: &Path) -> DomainResult<Self> {
        // Check if this is a fresh database (file doesn't exist yet)
        let is_fresh = !db_path.exists();

        // Phase 1: Open a temporary connection to check schema version
        let probe = Connection::open(db_path)?;
        probe.execute_batch("PRAGMA busy_timeout = 5000;")?;
        let current_version = super::migration::get_schema_version(&probe);
        let needs_migration = current_version < super::migration::LATEST_VERSION;
        drop(probe);

        // Phase 2: Backup before migration (skip for fresh/empty DB)
        if needs_migration && !is_fresh {
            super::backup::create_backup(db_path, current_version)?;
        }

        // Phase 3: Open connections and run migrations
        let writer = Connection::open(db_path)?;
        Self::apply_pragmas(&writer)?;
        let reader = Connection::open(db_path)?;
        Self::apply_pragmas(&reader)?;

        let mut manager = Self { writer, reader };

        match super::migration::run_migrations(&mut manager.writer) {
            Ok(result) => {
                if result.migrated() {
                    // Clean up old backups, keep last 3
                    if let Err(e) = super::backup::cleanup_old_backups(db_path, 3) {
                        tracing::warn!("Failed to clean up old backups: {e}");
                    }
                }
                Ok(manager)
            }
            Err(e) => {
                // Migration failed — attempt restore from backup
                tracing::error!("Migration failed: {e}");
                let backup = super::backup::backup_path(db_path, current_version);
                if backup.exists() {
                    tracing::info!("Attempting restore from backup v{current_version}...");
                    drop(manager); // Release DB connections before file operations
                    if let Err(restore_err) =
                        super::backup::restore_backup(db_path, &backup, current_version)
                    {
                        tracing::error!("Restore also failed: {restore_err}");
                        return Err(DomainError::Migration(format!(
                            "Migration failed ({e}) and restore failed ({restore_err}). \
                             Manual intervention required."
                        )));
                    }
                    // Re-open with restored (pre-migration) schema and continue
                    tracing::warn!(
                        "Database restored to v{current_version} after migration failure. \
                         Running with older schema."
                    );
                    let writer = Connection::open(db_path)?;
                    Self::apply_pragmas(&writer)?;
                    let reader = Connection::open(db_path)?;
                    Self::apply_pragmas(&reader)?;
                    Ok(Self { writer, reader })
                } else {
                    Err(DomainError::Migration(format!(
                        "Migration failed: {e}. No backup available for restore."
                    )))
                }
            }
        }
    }

    /// In-memory DB for testing
    pub fn new_in_memory() -> DomainResult<Self> {
        // For in-memory, both connections must share the same DB.
        // Use a unique named in-memory DB with shared cache to avoid conflicts in parallel tests.
        let id = IN_MEMORY_COUNTER.fetch_add(1, Ordering::Relaxed);
        let uri = format!("file:memdb_{id}?mode=memory&cache=shared");
        let writer = Connection::open(&uri)?;
        Self::apply_pragmas(&writer)?;

        let reader = Connection::open(&uri)?;
        Self::apply_pragmas(&reader)?;

        let mut manager = Self { writer, reader };
        let _result = super::migration::run_migrations(&mut manager.writer)?;
        Ok(manager)
    }

    fn apply_pragmas(conn: &Connection) -> DomainResult<()> {
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA busy_timeout = 5000;",
        )?;
        Ok(())
    }

    pub fn writer(&self) -> &Connection {
        &self.writer
    }

    pub fn reader(&self) -> &Connection {
        &self.reader
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_in_memory_creates_all_tables() {
        let db = DbManager::new_in_memory().unwrap();
        let tables: Vec<String> = db
            .reader()
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();

        assert!(tables.contains(&"accounts".to_string()));
        assert!(tables.contains(&"folders".to_string()));
        assert!(tables.contains(&"feeds".to_string()));
        assert!(tables.contains(&"articles".to_string()));
        assert!(tables.contains(&"sync_state".to_string()));
        assert!(tables.contains(&"pending_mutations".to_string()));
        assert!(tables.contains(&"feed_http_cache".to_string()));
        assert!(tables.contains(&"schema_version".to_string()));
        assert!(tables.contains(&"preferences".to_string()));
    }

    #[test]
    fn schema_version_is_5() {
        let db = DbManager::new_in_memory().unwrap();
        let version: i32 = db
            .reader()
            .query_row(
                "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(version, 5);
    }

    #[test]
    fn fts5_table_exists() {
        let db = DbManager::new_in_memory().unwrap();
        let count: i32 = db
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='articles_fts'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn foreign_keys_enabled() {
        let db = DbManager::new_in_memory().unwrap();
        let fk: i32 = db
            .reader()
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .unwrap();
        assert_eq!(fk, 1);
    }

    #[test]
    fn new_does_not_backup_fresh_db() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        // First init — creates fresh DB (from v0 to v5)
        let _db = DbManager::new(&db_path).unwrap();
        drop(_db);

        // Fresh DB should NOT create a backup (nothing to back up)
        let backup = crate::infra::db::backup::backup_path(&db_path, 0);
        assert!(!backup.exists(), "Fresh DB should not create a backup");
    }

    #[test]
    fn new_skips_backup_when_already_current() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        // First init — creates DB at latest version
        let _db = DbManager::new(&db_path).unwrap();
        drop(_db);

        // Second init — no migration needed, no backup
        let _db2 = DbManager::new(&db_path).unwrap();
        drop(_db2);

        let backup_v5 = crate::infra::db::backup::backup_path(&db_path, 5);
        assert!(!backup_v5.exists(), "No backup when schema is current");
    }

    #[test]
    fn cascade_delete_works() {
        let db = DbManager::new_in_memory().unwrap();
        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES ('a1', 'Local', 'Test')",
                [],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, title, url) VALUES ('f1', 'a1', 'Feed', 'http://feed.com')",
                [],
            )
            .unwrap();
        // Delete account should cascade to feeds
        db.writer()
            .execute("DELETE FROM accounts WHERE id = 'a1'", [])
            .unwrap();
        let count: i32 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM feeds", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }
}
