use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

use crate::domain::error::{DomainError, DomainResult};
use crate::infra::db::sqlite_mute_keyword::build_mute_keyword_exclusion_clause;

static IN_MEMORY_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DatabaseInfo {
    pub db_size_bytes: u64,
    pub wal_size_bytes: u64,
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
                Ok(_) => {
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
                    if let Err(e) = super::backup::cleanup_old_backups(db_path, 3) {
                        tracing::warn!("Failed to clean up old backups: {e}");
                    }
                }
                Ok(())
            }
            Err(e) => {
                tracing::error!("Migration failed: {e}");
                if backup_file.exists() {
                    tracing::info!("Attempting restore from backup: {}", backup_file.display());
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
                             Close the application and restore the backup manually from the backup directory to the database file."
                        )));
                    }

                    // Restore succeeded but return error — don't run with old schema
                    Err(DomainError::Migration(format!(
                        "Migration to v{} failed: {e}. Database restored to v{backup_version}. \
                         Backup: {}. If the application still does not start, close it and restore \
                         the newest backup over the database file manually.",
                        super::migration::LATEST_VERSION,
                        super::backup::redacted_path_label(backup_file)
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
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA busy_timeout = 5000;",
        )?;
        Ok(())
    }

    fn reconcile_startup_migration_cost(&self) -> DomainResult<()> {
        let started_at = Instant::now();
        let repaired_article_content_rows = self.reconcile_article_content_text()?;
        let repaired_feed_unread_count_rows = self.reconcile_feed_unread_counts()?;
        let elapsed_ms = started_at.elapsed().as_millis() as u64;

        tracing::info!(
            repaired_article_content_rows,
            repaired_feed_unread_count_rows,
            elapsed_ms,
            "Measured startup migration repair cost"
        );

        Ok(())
    }

    fn reconcile_feed_unread_counts(&self) -> DomainResult<usize> {
        let has_mute_keywords_table: bool = self.writer.query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'mute_keywords')",
            [],
            |row| row.get(0),
        )?;
        let visible_unread_clause = if has_mute_keywords_table {
            build_mute_keyword_exclusion_clause(
                "articles.title",
                "CASE WHEN trim(coalesce(articles.content_text, '')) = '' THEN coalesce(articles.summary, '') ELSE articles.content_text END",
            )
        } else {
            "1 = 1".to_string()
        };
        let count_visible_unread = format!(
            "SELECT COUNT(*)
             FROM articles
             WHERE articles.feed_id = feeds.id
               AND articles.is_read = 0
               AND {visible_unread_clause}"
        );
        let sql = format!(
            "UPDATE feeds
             SET unread_count = ({count_visible_unread})
             WHERE unread_count != ({count_visible_unread})"
        );
        let updated_rows = self.writer.execute(&sql, [])?;

        if updated_rows > 0 {
            tracing::info!("Reconciled unread counts for {updated_rows} feed(s) on startup");
        }

        Ok(updated_rows)
    }

    fn reconcile_article_content_text(&self) -> DomainResult<usize> {
        let has_content_text: i32 = self.writer.query_row(
            "SELECT COUNT(*)
             FROM pragma_table_info('articles')
             WHERE name = 'content_text'",
            [],
            |row| row.get(0),
        )?;
        if has_content_text == 0 {
            return Ok(0);
        }

        let mut stmt = self.writer.prepare(
            "SELECT id, content_sanitized, summary
             FROM articles
             WHERE trim(coalesce(content_text, '')) = ''",
        )?;

        let pending = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        let repaired_rows = pending.len();

        if pending.is_empty() {
            return Ok(0);
        }

        let tx = self.writer.unchecked_transaction()?;
        {
            let mut update = tx.prepare("UPDATE articles SET content_text = ?1 WHERE id = ?2")?;
            for (id, content_sanitized, summary) in pending {
                let content_text = super::sqlite_article::article_body_text(
                    &content_sanitized,
                    summary.as_deref(),
                );
                update.execute(rusqlite::params![content_text, id])?;
            }
        }
        tx.commit()?;
        Ok(repaired_rows)
    }

    pub fn writer(&self) -> &Connection {
        &self.writer
    }

    pub fn reader(&self) -> &Connection {
        &self.reader
    }

    pub fn database_info(&self) -> DomainResult<DatabaseInfo> {
        match self.database_path()? {
            Some(path) => Ok(Self::database_info_from_path(&path)),
            None => Self::database_info_from_connection(&self.writer),
        }
    }

    pub fn vacuum(&mut self) -> DomainResult<DatabaseInfo> {
        let Some(db_path) = self.database_path()? else {
            self.writer.execute_batch("VACUUM")?;
            return self.database_info();
        };

        self.replace_with_in_memory_connections()?;

        let vacuum_result = Self::vacuum_file_database(&db_path);
        self.restore_file_connections_after_vacuum(&db_path, vacuum_result)
    }

    fn database_path(&self) -> DomainResult<Option<PathBuf>> {
        let db_path: String = self
            .writer
            .query_row("PRAGMA database_list", [], |row| row.get(2))?;

        if db_path.is_empty() || db_path == ":memory:" || db_path.starts_with("file:memdb_") {
            return Ok(None);
        }

        Ok(Some(PathBuf::from(db_path)))
    }

    fn database_info_from_path(path: &Path) -> DatabaseInfo {
        let db_size_bytes = path.metadata().map(|metadata| metadata.len()).unwrap_or(0);
        let wal_size_bytes = Self::wal_path(path)
            .metadata()
            .map(|metadata| metadata.len())
            .unwrap_or(0);

        DatabaseInfo {
            db_size_bytes,
            wal_size_bytes,
            total_size_bytes: db_size_bytes + wal_size_bytes,
        }
    }

    fn database_info_from_connection(conn: &Connection) -> DomainResult<DatabaseInfo> {
        let page_count: i64 = conn.query_row("PRAGMA page_count", [], |row| row.get(0))?;
        let page_size: i64 = conn.query_row("PRAGMA page_size", [], |row| row.get(0))?;
        let db_size_bytes = u64::try_from(page_count.max(0)).unwrap_or(0)
            * u64::try_from(page_size.max(0)).unwrap_or(0);

        Ok(DatabaseInfo {
            db_size_bytes,
            wal_size_bytes: 0,
            total_size_bytes: db_size_bytes,
        })
    }

    fn wal_path(path: &Path) -> PathBuf {
        let mut wal_path = path.as_os_str().to_os_string();
        wal_path.push("-wal");
        PathBuf::from(wal_path)
    }

    fn replace_with_in_memory_connections(&mut self) -> DomainResult<()> {
        let writer_placeholder = Connection::open_in_memory()?;
        let reader_placeholder = Connection::open_in_memory()?;

        let old_writer = std::mem::replace(&mut self.writer, writer_placeholder);
        let old_reader = std::mem::replace(&mut self.reader, reader_placeholder);
        drop(old_writer);
        drop(old_reader);

        Ok(())
    }

    fn open_file_connections(db_path: &Path) -> DomainResult<(Connection, Connection)> {
        let writer = Connection::open(db_path)?;
        Self::apply_pragmas(&writer)?;

        let reader = Connection::open(db_path)?;
        Self::apply_pragmas(&reader)?;

        Ok((writer, reader))
    }

    fn restore_file_connections_after_vacuum(
        &mut self,
        db_path: &Path,
        vacuum_result: DomainResult<()>,
    ) -> DomainResult<DatabaseInfo> {
        let (writer, reader) = Self::open_file_connections(db_path).map_err(|reopen_err| {
            DomainError::Persistence(format!(
                "Failed to reopen database connections after VACUUM: {reopen_err}"
            ))
        })?;
        self.writer = writer;
        self.reader = reader;

        match vacuum_result {
            Ok(()) => self.database_info(),
            Err(vacuum_err) => Err(vacuum_err),
        }
    }

    fn vacuum_file_database(db_path: &Path) -> DomainResult<()> {
        let vacuum_conn = Connection::open(db_path)?;
        Self::apply_pragmas(&vacuum_conn)?;
        vacuum_conn.execute_batch(
            "PRAGMA wal_checkpoint(TRUNCATE);
             VACUUM;
             PRAGMA wal_checkpoint(TRUNCATE);",
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

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
    fn schema_version_matches_latest() {
        let db = DbManager::new_in_memory().unwrap();
        let version: i32 = db
            .reader()
            .query_row(
                "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(version, super::super::migration::LATEST_VERSION);
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
    fn file_connections_apply_runtime_pragmas_to_writer_and_reader() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("pragma-test.db");

        let db = DbManager::new(&db_path).unwrap();

        for conn in [db.writer(), db.reader()] {
            let foreign_keys: i32 = conn
                .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
                .unwrap();
            let busy_timeout: i32 = conn
                .query_row("PRAGMA busy_timeout", [], |row| row.get(0))
                .unwrap();
            let journal_mode: String = conn
                .query_row("PRAGMA journal_mode", [], |row| row.get(0))
                .unwrap();

            assert_eq!(foreign_keys, 1);
            assert_eq!(busy_timeout, 5000);
            assert_eq!(journal_mode, "wal");
        }
    }

    #[test]
    fn new_does_not_backup_fresh_db() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        // First init — creates a fresh DB at the latest schema version
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

        let backup_for_outdated_schema = crate::infra::db::backup::backup_path(&db_path, 6);
        assert!(
            !backup_for_outdated_schema.exists(),
            "No backup when schema is current"
        );
    }

    #[test]
    fn new_blocks_future_schema_version_as_downgrade() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("future-schema.db");

        {
            let db = DbManager::new(&db_path).unwrap();
            db.writer()
                .execute("DELETE FROM schema_version", [])
                .unwrap();
            db.writer()
                .execute(
                    "INSERT INTO schema_version (version) VALUES (?1)",
                    [super::super::migration::LATEST_VERSION + 1],
                )
                .unwrap();
        }

        let Err(error) = DbManager::new(&db_path) else {
            panic!("future schema should block startup");
        };
        let message = error.to_string();

        assert!(
            message.contains("newer than this application supports"),
            "future schema should be a recoverable downgrade block: {message}"
        );
        assert!(
            message.contains("Downgrade startup is blocked"),
            "downgrade error should explain why startup is blocked: {message}"
        );
        assert!(
            !crate::infra::db::backup::backup_path(
                &db_path,
                super::super::migration::LATEST_VERSION + 1
            )
            .exists(),
            "downgrade block should not create a migration backup"
        );
    }

    #[test]
    fn migration_failure_restores_from_backup() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");

        // Create a DB at v5, then manually add the V6 column without recording version 6.
        // DbManager::new should back up the v5 DB, fail V6 with a duplicate column error,
        // restore the backup, and return an error instead of running on the half-migrated DB.
        {
            let conn = rusqlite::Connection::open(&db_path).unwrap();
            conn.execute_batch(include_str!("../../../migrations/V1__initial.sql"))
                .unwrap();
            conn.execute_batch(include_str!("../../../migrations/V2__preferences.sql"))
                .unwrap();
            conn.execute_batch(include_str!("../../../migrations/V3__fts5.sql"))
                .unwrap();
            conn.execute_batch(include_str!("../../../migrations/V4__tags.sql"))
                .unwrap();
            conn.execute_batch(include_str!(
                "../../../migrations/V5__feed_display_mode.sql"
            ))
            .unwrap();
            conn.execute(
                "INSERT INTO accounts (id, kind, name) VALUES ('a1', 'Local', 'Test')",
                [],
            )
            .unwrap();
            conn.execute(
                "ALTER TABLE sync_state ADD COLUMN timestamp_usec INTEGER",
                [],
            )
            .unwrap();
        }

        // DbManager::new will:
        // 1. See version=5, needs migration
        // 2. Create backup at v5
        // 3. Try V6 (ALTER TABLE ADD COLUMN timestamp_usec) → FAIL (column exists)
        // 4. Restore from backup (v5)
        // 5. Return Err (fail-fast, don't run with old schema)
        let result = DbManager::new(&db_path);
        assert!(
            result.is_err(),
            "Should fail after migration failure + restore"
        );
        let err_msg = format!("{}", result.err().unwrap());
        assert!(
            err_msg.contains("restored to v5"),
            "Error should mention restore: {err_msg}"
        );
        assert!(
            err_msg.contains("[redacted parent]/test_v5_"),
            "Error should include redacted backup label: {err_msg}"
        );
        assert!(
            !err_msg.contains(dir.path().to_string_lossy().as_ref()),
            "Error should not include the full backup path: {err_msg}"
        );

        // Verify backup was restored — data should be intact
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        let name: String = conn
            .query_row("SELECT name FROM accounts WHERE id = 'a1'", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(name, "Test");

        // Verify schema version is 5 (restored state)
        let version = super::super::migration::get_schema_version(&conn);
        assert_eq!(version, 5, "Should be restored to v5");
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

    #[test]
    fn vacuum_reopens_file_backed_connections_and_keeps_db_usable() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("vacuum-test.db");
        let mut db = DbManager::new(&db_path).unwrap();

        db.writer()
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS vacuum_probe (
                    id INTEGER PRIMARY KEY,
                    payload TEXT NOT NULL
                );
                INSERT INTO vacuum_probe (payload) VALUES (hex(randomblob(4096)));
                INSERT INTO vacuum_probe (payload) VALUES (hex(randomblob(4096)));
                DELETE FROM vacuum_probe WHERE id = 1;",
            )
            .unwrap();

        let before = db.database_info().unwrap();
        let after = db.vacuum().unwrap();

        db.writer()
            .execute(
                "INSERT INTO vacuum_probe (payload) VALUES ('after-vacuum')",
                [],
            )
            .unwrap();

        let count: i32 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM vacuum_probe", [], |row| row.get(0))
            .unwrap();

        assert!(before.total_size_bytes > 0);
        assert!(after.total_size_bytes > 0);
        assert_eq!(
            after.wal_size_bytes, 0,
            "VACUUM should truncate WAL before reporting refreshed file sizes"
        );
        assert_eq!(
            after.total_size_bytes, after.db_size_bytes,
            "VACUUM size report should not include stale WAL bytes after checkpoint"
        );
        assert_eq!(count, 2, "DB should remain writable/readable after VACUUM");
    }

    #[test]
    fn vacuum_reports_checkpointed_size_while_reader_connection_was_open() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("vacuum-reader-open.db");
        let mut db = DbManager::new(&db_path).unwrap();

        db.writer()
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS vacuum_probe (
                    id INTEGER PRIMARY KEY,
                    payload TEXT NOT NULL
                );
                INSERT INTO vacuum_probe (payload) VALUES (hex(randomblob(8192)));
                INSERT INTO vacuum_probe (payload) VALUES (hex(randomblob(8192)));",
            )
            .unwrap();

        let reader_count: i32 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM vacuum_probe", [], |row| row.get(0))
            .unwrap();
        let before = db.database_info().unwrap();
        let after = db.vacuum().unwrap();

        assert_eq!(reader_count, 2);
        assert!(
            before.total_size_bytes > 0,
            "fixture should create a file-backed DB before VACUUM"
        );
        assert_eq!(
            after.wal_size_bytes, 0,
            "VACUUM should report a checkpointed WAL size across platform file semantics"
        );
        assert_eq!(
            after.total_size_bytes, after.db_size_bytes,
            "reported total should be stable after WAL checkpoint/truncate"
        );
    }

    #[test]
    fn database_info_total_includes_db_and_wal_but_not_shm_sidecar() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("size-contract.db");
        let wal_path = DbManager::wal_path(&db_path);
        let mut shm_path = db_path.as_os_str().to_os_string();
        shm_path.push("-shm");
        let shm_path = PathBuf::from(shm_path);

        std::fs::write(&db_path, [0_u8; 13]).unwrap();
        std::fs::write(&wal_path, [0_u8; 7]).unwrap();
        std::fs::write(&shm_path, [0_u8; 11]).unwrap();

        let info = DbManager::database_info_from_path(&db_path);

        assert_eq!(info.db_size_bytes, 13);
        assert_eq!(info.wal_size_bytes, 7);
        assert_eq!(info.total_size_bytes, 20);
    }

    #[test]
    fn vacuum_reopen_failure_returns_domain_error_without_panic() {
        let dir = tempfile::tempdir().unwrap();
        let missing_parent_db_path = dir.path().join("missing-parent").join("db.sqlite");
        let mut db = DbManager::new_in_memory().unwrap();

        let error = db
            .restore_file_connections_after_vacuum(&missing_parent_db_path, Ok(()))
            .expect_err("reopen failure should be returned as a domain error");

        match error {
            DomainError::Persistence(message) => {
                assert!(
                    message.starts_with("Failed to reopen database connections after VACUUM:"),
                    "unexpected message: {message}"
                );
            }
            other => panic!("expected persistence error, got {other:?}"),
        }
    }

    #[test]
    fn vacuum_failure_restores_file_connections_and_keeps_db_usable() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("vacuum-failure-recovery.db");
        let mut db = DbManager::new(&db_path).unwrap();

        db.writer()
            .execute_batch(
                "CREATE TABLE IF NOT EXISTS vacuum_probe (
                    id INTEGER PRIMARY KEY,
                    payload TEXT NOT NULL
                );
                INSERT INTO vacuum_probe (payload) VALUES ('before-failure');",
            )
            .unwrap();
        db.replace_with_in_memory_connections().unwrap();

        let error = db
            .restore_file_connections_after_vacuum(
                &db_path,
                Err(DomainError::Persistence(
                    "simulated VACUUM failure".to_string(),
                )),
            )
            .expect_err("VACUUM failure should still be returned");

        match error {
            DomainError::Persistence(message) => {
                assert_eq!(message, "simulated VACUUM failure");
            }
            other => panic!("expected original VACUUM persistence error, got {other:?}"),
        }

        db.writer()
            .execute(
                "INSERT INTO vacuum_probe (payload) VALUES ('after-failure')",
                [],
            )
            .unwrap();

        let payloads: Vec<String> = db
            .reader()
            .prepare("SELECT payload FROM vacuum_probe ORDER BY id")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();

        assert_eq!(
            payloads,
            vec!["before-failure".to_string(), "after-failure".to_string()]
        );
    }

    #[test]
    fn new_repairs_latest_version_schema_when_feed_columns_are_missing() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("broken-latest.db");

        {
            let conn = Connection::open(&db_path).unwrap();
            conn.execute_batch(include_str!("../../../migrations/V1__initial.sql"))
                .unwrap();
            conn.execute_batch(include_str!("../../../migrations/V2__preferences.sql"))
                .unwrap();
            conn.execute_batch(include_str!("../../../migrations/V3__fts5.sql"))
                .unwrap();
            conn.execute_batch(include_str!("../../../migrations/V4__tags.sql"))
                .unwrap();
            conn.execute_batch(include_str!(
                "../../../migrations/V5__feed_display_mode.sql"
            ))
            .unwrap();
            conn.execute_batch(include_str!(
                "../../../migrations/V6__sync_state_timestamp_usec.sql"
            ))
            .unwrap();
            conn.execute_batch(include_str!(
                "../../../migrations/V7__feed_display_mode_inherit.sql"
            ))
            .unwrap();
            conn.execute(
                "INSERT INTO accounts (id, kind, name) VALUES ('a1', 'Local', 'Test')",
                [],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO feeds (id, account_id, title, url, site_url, unread_count, display_mode) VALUES ('f1', 'a1', 'Feed', 'https://example.com/feed.xml', 'https://example.com', 0, 'normal')",
                [],
            )
            .unwrap();
            conn.execute("DELETE FROM schema_version", []).unwrap();
            conn.execute(
                "INSERT INTO schema_version (version) VALUES (?1)",
                [super::super::migration::LATEST_VERSION],
            )
            .unwrap();
        }

        let db = DbManager::new(&db_path).unwrap();

        let (reader_mode, web_preview_mode): (String, String) = db
            .reader()
            .query_row(
                "SELECT reader_mode, web_preview_mode FROM feeds WHERE id = 'f1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();

        assert_eq!(reader_mode, "on");
        assert_eq!(web_preview_mode, "off");
    }

    #[test]
    fn new_reconciles_stale_feed_unread_counts_from_articles() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("stale-unread-counts.db");

        {
            let db = DbManager::new(&db_path).unwrap();
            db.writer()
                .execute(
                    "INSERT INTO accounts (id, kind, name) VALUES ('a1', 'Local', 'Test')",
                    [],
                )
                .unwrap();
            db.writer()
                .execute(
                    "INSERT INTO feeds (id, account_id, title, url, unread_count) VALUES ('f1', 'a1', 'Feed', 'https://example.com/feed.xml', 0)",
                    [],
                )
                .unwrap();
            db.writer()
                .execute(
                    "INSERT INTO articles (id, feed_id, title, content_raw, content_sanitized, sanitizer_version, published_at, fetched_at, is_read) \
                     VALUES ('art-1', 'f1', 'Unread 1', '', '', 1, '2026-04-14T00:00:00Z', '2026-04-14T00:00:00Z', 0)",
                    [],
                )
                .unwrap();
            db.writer()
                .execute(
                    "INSERT INTO articles (id, feed_id, title, content_raw, content_sanitized, sanitizer_version, published_at, fetched_at, is_read) \
                     VALUES ('art-2', 'f1', 'Unread 2', '', '', 1, '2026-04-14T00:00:00Z', '2026-04-14T00:00:00Z', 0)",
                    [],
                )
                .unwrap();
        }

        let repaired = DbManager::new(&db_path).unwrap();
        let unread_count: i32 = repaired
            .reader()
            .query_row(
                "SELECT unread_count FROM feeds WHERE id = 'f1'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(unread_count, 2);
    }

    #[test]
    fn new_reconciles_stale_feed_unread_counts_excluding_muted_articles() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("stale-muted-unread-counts.db");

        {
            let db = DbManager::new(&db_path).unwrap();
            db.writer()
                .execute(
                    "INSERT INTO accounts (id, kind, name) VALUES ('a1', 'Local', 'Test')",
                    [],
                )
                .unwrap();
            db.writer()
                .execute(
                    "INSERT INTO feeds (id, account_id, title, url, unread_count) VALUES ('f1', 'a1', 'Feed', 'https://example.com/feed.xml', 0)",
                    [],
                )
                .unwrap();
            db.writer()
                .execute(
                    "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at) VALUES ('mk1', 'kindle unlimited', 'title', '2026-04-14T00:00:00Z', '2026-04-14T00:00:00Z')",
                    [],
                )
                .unwrap();
            db.writer()
                .execute(
                    "INSERT INTO articles (id, feed_id, title, content_raw, content_sanitized, content_text, sanitizer_version, published_at, fetched_at, is_read) \
                     VALUES ('art-visible', 'f1', 'Visible unread', '', '', '', 1, '2026-04-14T00:00:00Z', '2026-04-14T00:00:00Z', 0)",
                    [],
                )
                .unwrap();
            db.writer()
                .execute(
                    "INSERT INTO articles (id, feed_id, title, content_raw, content_sanitized, content_text, sanitizer_version, published_at, fetched_at, is_read) \
                     VALUES ('art-muted', 'f1', 'Kindle Unlimited deal', '', '', '', 1, '2026-04-14T00:00:00Z', '2026-04-14T00:00:00Z', 0)",
                    [],
                )
                .unwrap();
        }

        let repaired = DbManager::new(&db_path).unwrap();
        let unread_count: i32 = repaired
            .reader()
            .query_row(
                "SELECT unread_count FROM feeds WHERE id = 'f1'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(unread_count, 1);
    }

    #[test]
    fn new_reconciles_article_content_text_after_backup_migration() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("reconcile-content-text.db");

        {
            let conn = Connection::open(&db_path).unwrap();
            conn.execute_batch(include_str!("../../../migrations/V1__initial.sql"))
                .unwrap();
            conn.execute_batch(include_str!("../../../migrations/V2__preferences.sql"))
                .unwrap();
            conn.execute_batch(include_str!("../../../migrations/V3__fts5.sql"))
                .unwrap();
            conn.execute_batch(include_str!("../../../migrations/V4__tags.sql"))
                .unwrap();
            conn.execute_batch(include_str!(
                "../../../migrations/V5__feed_display_mode.sql"
            ))
            .unwrap();
            conn.execute_batch(include_str!(
                "../../../migrations/V6__sync_state_timestamp_usec.sql"
            ))
            .unwrap();
            conn.execute_batch(include_str!(
                "../../../migrations/V7__feed_display_mode_inherit.sql"
            ))
            .unwrap();
            conn.execute_batch(include_str!(
                "../../../migrations/V8__feed_reader_preview_modes.sql"
            ))
            .unwrap();
            conn.execute_batch(include_str!(
                "../../../migrations/V9__reader_preview_default_preferences.sql"
            ))
            .unwrap();
            conn.execute_batch(include_str!(
                "../../../migrations/V11__account_sync_on_startup.sql"
            ))
            .unwrap();
            conn.execute_batch(include_str!("../../../migrations/V12__mute_keywords.sql"))
                .unwrap();
            conn.execute_batch(include_str!(
                "../../../migrations/V13__tag_color_palette_refresh.sql"
            ))
            .unwrap();

            conn.execute(
                "INSERT INTO accounts (id, kind, name) VALUES ('a1', 'Local', 'Test')",
                [],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO feeds (id, account_id, title, url) VALUES ('f1', 'a1', 'Feed', 'https://example.com/feed.xml')",
                [],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO articles (
                    id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version,
                    summary, url, author, thumbnail, published_at, is_read, is_starred, fetched_at
                 ) VALUES (
                    'art-1', 'f1', NULL, 'Muted article', '', '<p>Kindle <strong>Unlimited</strong></p>', 1,
                    NULL, NULL, NULL, NULL, '2026-04-15T00:00:00+00:00', 0, 0, '2026-04-15T00:00:00+00:00'
                 )",
                [],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO articles (
                    id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version,
                    summary, url, author, thumbnail, published_at, is_read, is_starred, fetched_at
                 ) VALUES (
                    'art-2', 'f1', NULL, 'Summary fallback', '', '', 1,
                    'Summary only body', NULL, NULL, NULL, '2026-04-15T00:00:00+00:00', 0, 0, '2026-04-15T00:00:00+00:00'
                 )",
                [],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO articles (
                    id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version,
                    summary, url, author, thumbnail, published_at, is_read, is_starred, fetched_at
                 ) VALUES (
                    'art-3', 'f1', NULL, 'Malformed content', '', '<p>Broken <strong>body</p>Trailing', 1,
                    'Should not be used', NULL, NULL, NULL, '2026-04-15T00:00:00+00:00', 0, 0, '2026-04-15T00:00:00+00:00'
                 )",
                [],
            )
            .unwrap();
        }

        let repaired = DbManager::new(&db_path).unwrap();
        let (html_content_text, summary_content_text, malformed_content_text): (
            String,
            String,
            String,
        ) = repaired
            .reader()
            .query_row(
                "SELECT
                   (SELECT content_text FROM articles WHERE id = 'art-1'),
                   (SELECT content_text FROM articles WHERE id = 'art-2'),
                   (SELECT content_text FROM articles WHERE id = 'art-3')",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();

        assert_eq!(
            html_content_text,
            super::super::sqlite_article::article_body_text(
                "<p>Kindle <strong>Unlimited</strong></p>",
                None
            )
        );
        assert_eq!(
            summary_content_text,
            super::super::sqlite_article::article_body_text("", Some("Summary only body"))
        );
        assert_eq!(
            malformed_content_text,
            super::super::sqlite_article::article_body_text(
                "<p>Broken <strong>body</p>Trailing",
                Some("Should not be used")
            )
        );
    }

    #[test]
    fn startup_reconcile_reports_article_content_and_unread_count_repair_counts() {
        let db = DbManager::new_in_memory().unwrap();
        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES ('a1', 'Local', 'Test')",
                [],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, title, url, unread_count) VALUES ('f1', 'a1', 'Feed', 'https://example.com/feed.xml', 0)",
                [],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO articles (
                    id, feed_id, title, content_raw, content_sanitized, content_text,
                    sanitizer_version, published_at, fetched_at, is_read
                 ) VALUES (
                    'art-1', 'f1', 'Unread', '', '<p>Readable body</p>', '',
                    1, '2026-04-14T00:00:00Z', '2026-04-14T00:00:00Z', 0
                 )",
                [],
            )
            .unwrap();

        let repaired_article_content_rows = db.reconcile_article_content_text().unwrap();
        let repaired_feed_unread_count_rows = db.reconcile_feed_unread_counts().unwrap();
        let (content_text, unread_count): (String, i32) = db
            .reader()
            .query_row(
                "SELECT
                   (SELECT content_text FROM articles WHERE id = 'art-1'),
                   (SELECT unread_count FROM feeds WHERE id = 'f1')",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();

        assert_eq!(
            repaired_article_content_rows, 1,
            "startup cost should count repaired article content rows"
        );
        assert_eq!(
            repaired_feed_unread_count_rows, 1,
            "startup cost should count repaired feed unread_count rows"
        );
        assert_eq!(
            content_text,
            super::super::sqlite_article::article_body_text("<p>Readable body</p>", None)
        );
        assert_eq!(unread_count, 1);
    }
}
