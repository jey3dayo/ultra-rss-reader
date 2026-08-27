use rusqlite::Connection;
use std::path::{Path, PathBuf};

use crate::domain::error::{DomainError, DomainResult};

use super::{DatabaseInfo, DbManager};

impl DbManager {
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

    pub fn refresh_query_statistics(&self) -> DomainResult<()> {
        self.writer.execute_batch("ANALYZE;")?;
        Ok(())
    }

    pub fn vacuum(&mut self) -> DomainResult<DatabaseInfo> {
        let Some(db_path) = self.database_path()? else {
            self.writer.execute_batch("VACUUM")?;
            self.refresh_query_statistics()?;
            return self.database_info();
        };

        self.replace_with_in_memory_connections()?;

        let vacuum_result = Self::vacuum_file_database(&db_path);
        self.restore_file_connections_after_vacuum(&db_path, vacuum_result)
    }

    /// Create a manual backup of the current database without a migration.
    /// Reuses the migration backup routine (integrity check, WAL checkpoint,
    /// atomic copy, metadata) and keeps only the most recent backups afterward.
    /// Live connections are swapped out during the copy, mirroring `vacuum`, so
    /// the backup captures a checkpointed, consistent file.
    pub fn create_manual_backup(&mut self) -> DomainResult<PathBuf> {
        let Some(db_path) = self.database_path()? else {
            return Err(DomainError::Persistence(
                "In-memory database cannot be backed up".to_string(),
            ));
        };
        let schema_version = super::super::migration::read_schema_version(&self.writer)?;

        self.replace_with_in_memory_connections()?;
        let backup_result = super::super::backup::create_backup(&db_path, schema_version);

        let (writer, reader) = Self::open_file_connections(&db_path).map_err(|reopen_err| {
            DomainError::Persistence(format!(
                "Failed to reopen database connections after backup: {reopen_err}"
            ))
        })?;
        self.writer = writer;
        self.reader = reader;

        let backup_path = backup_result?;
        if let Err(e) = super::super::backup::cleanup_old_backups(&db_path, 3) {
            tracing::warn!("Failed to clean up old backups: {e}");
        }
        Ok(backup_path)
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

    pub(super) fn database_info_from_path(path: &Path) -> DatabaseInfo {
        let db_size_bytes = Self::sidecar_size_bytes(path, "database");
        let wal_size_bytes = Self::sidecar_size_bytes(&Self::wal_path(path), "WAL");
        let shm_size_bytes = Self::sidecar_size_bytes(&Self::shm_path(path), "SHM");

        DatabaseInfo {
            db_size_bytes,
            wal_size_bytes,
            shm_size_bytes,
            total_size_bytes: db_size_bytes + wal_size_bytes + shm_size_bytes,
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
            shm_size_bytes: 0,
            total_size_bytes: db_size_bytes,
        })
    }

    fn sidecar_size_bytes(path: &Path, label: &str) -> u64 {
        match path.metadata() {
            Ok(metadata) => metadata.len(),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => 0,
            Err(error) => {
                tracing::warn!(
                    path = %super::super::backup::redacted_path_label(path),
                    error = %error,
                    "Failed to read {label} file size for database info"
                );
                0
            }
        }
    }

    pub(super) fn wal_path(path: &Path) -> PathBuf {
        let mut wal_path = path.as_os_str().to_os_string();
        wal_path.push("-wal");
        PathBuf::from(wal_path)
    }

    pub(super) fn shm_path(path: &Path) -> PathBuf {
        let mut shm_path = path.as_os_str().to_os_string();
        shm_path.push("-shm");
        PathBuf::from(shm_path)
    }

    pub(super) fn replace_with_in_memory_connections(&mut self) -> DomainResult<()> {
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

    pub(super) fn restore_file_connections_after_vacuum(
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
            Ok(()) => {
                let database_info = self.database_info()?;
                self.refresh_query_statistics()?;
                Ok(database_info)
            }
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
