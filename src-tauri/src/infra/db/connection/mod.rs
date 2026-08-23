use rusqlite::Connection;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

use crate::domain::error::{DomainError, DomainResult};

mod maintenance;
mod reconcile;

static IN_MEMORY_COUNTER: AtomicU64 = AtomicU64::new(0);
const BUSY_TIMEOUT_MS: i32 = 5000;
const FILE_JOURNAL_MODE: &str = "wal";
const IN_MEMORY_JOURNAL_MODE: &str = "memory";
const ARTICLES_FTS_TRIGGER_COUNT: i32 = 3;
const ARTICLES_FTS_TRIGGER_SQL_MARKER: &str = "content_text";
const STARTUP_SANITIZER_REPAIR_BATCH_LIMIT: usize = 500;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DatabaseInfo {
    pub db_size_bytes: u64,
    pub wal_size_bytes: u64,
    pub shm_size_bytes: u64,
    pub total_size_bytes: u64,
}

pub struct DbManager {
    writer: Connection,
    reader: Connection,
}

impl DbManager {
    pub fn new(db_path: &Path) -> DomainResult<Self> {
        // Check if this is a fresh database (file doesn't exist yet)
        let is_fresh = !db_path.exists();

        // Phase 1: Open writer and check schema version
        let writer = Connection::open(db_path)?;
        Self::apply_pragmas(&writer)?;
        let current_version = super::migration::read_schema_version(&writer)?;
        let needs_migration = super::migration::schema_needs_migration(&writer)?;

        // Phase 2: Backup before migration (skip for fresh/empty DB)
        if needs_migration && !is_fresh {
            // Drop writer before backup to ensure WAL is checkpointed
            drop(writer);
            let backup_file = super::backup::create_backup(db_path, current_version)?;
            // Re-open writer after backup
            let writer = Connection::open(db_path)?;
            Self::apply_pragmas(&writer)?;
            let reader = Connection::open(db_path)?;
            Self::apply_pragmas(&reader)?;
            let mut manager = Self { writer, reader };
            Self::run_migrations_with_restore(
                &mut manager,
                db_path,
                &backup_file,
                current_version,
            )?;
            manager.reconcile_startup_migration_cost()?;
            Ok(manager)
        } else {
            // No migration needed, or fresh DB — just open and migrate
            let reader = Connection::open(db_path)?;
            Self::apply_pragmas(&reader)?;
            let mut manager = Self { writer, reader };
            match super::migration::run_migrations(&mut manager.writer) {
                Ok(result) => {
                    if result.migrated() {
                        manager.refresh_query_statistics()?;
                    }
                    manager.reconcile_startup_migration_cost()?;
                    Ok(manager)
                }
                Err(e) => Err(DomainError::Migration(format!("Migration failed: {e}"))),
            }
        }
    }

    /// Run migrations with automatic restore on failure.
    /// On success, cleans up old backups. On failure, restores from backup
    /// and returns an error (fail-fast rather than running with an old schema).
    fn run_migrations_with_restore(
        manager: &mut Self,
        db_path: &Path,
        backup_file: &Path,
        backup_version: i32,
    ) -> DomainResult<()> {
        match super::migration::run_migrations(&mut manager.writer) {
            Ok(result) => {
                if result.migrated() {
                    manager.refresh_query_statistics()?;
                    if let Err(e) = super::backup::cleanup_old_backups(db_path, 3) {
                        tracing::warn!("Failed to clean up old backups: {e}");
                    }
                }
                Ok(())
            }
            Err(e) => {
                tracing::error!("Migration failed: {e}");
                if backup_file.exists() {
                    tracing::info!(
                        "Attempting restore from backup: {}",
                        super::backup::redacted_path_label(backup_file)
                    );
                    // Release DB connections before file operations
                    let writer = Connection::open(":memory:").unwrap();
                    let reader = Connection::open(":memory:").unwrap();
                    let old_writer = std::mem::replace(&mut manager.writer, writer);
                    let old_reader = std::mem::replace(&mut manager.reader, reader);
                    drop(old_writer);
                    drop(old_reader);

                    if let Err(restore_err) = super::backup::restore_backup(db_path, backup_file) {
                        return Err(DomainError::Migration(format!(
                            "Migration failed ({e}) and automatic restore failed ({restore_err}). \
                             {}",
                            super::backup::manual_restore_instruction()
                        )));
                    }

                    // Restore succeeded but return error — don't run with old schema
                    Err(DomainError::Migration(format!(
                        "Migration to v{} failed: {e}. Database restored to v{backup_version}. \
                         Backup: {}. If the application still does not start, {}",
                        super::migration::LATEST_VERSION,
                        super::backup::redacted_path_label(backup_file),
                        super::backup::manual_restore_instruction()
                    )))
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
        manager.reconcile_startup_migration_cost()?;
        Ok(manager)
    }

    fn apply_pragmas(conn: &Connection) -> DomainResult<()> {
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        conn.busy_timeout(std::time::Duration::from_millis(BUSY_TIMEOUT_MS as u64))?;

        let foreign_keys: i32 = conn.query_row("PRAGMA foreign_keys", [], |row| row.get(0))?;
        let busy_timeout: i32 = conn.query_row("PRAGMA busy_timeout", [], |row| row.get(0))?;
        let journal_mode: String = conn.query_row("PRAGMA journal_mode", [], |row| row.get(0))?;
        let journal_mode_ok = journal_mode.eq_ignore_ascii_case(FILE_JOURNAL_MODE)
            || journal_mode.eq_ignore_ascii_case(IN_MEMORY_JOURNAL_MODE);
        if foreign_keys != 1 || busy_timeout != BUSY_TIMEOUT_MS || !journal_mode_ok {
            return Err(DomainError::Persistence(format!(
                "SQLite connection PRAGMA contract failed: foreign_keys={foreign_keys}, busy_timeout={busy_timeout}, journal_mode={journal_mode}"
            )));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests;
