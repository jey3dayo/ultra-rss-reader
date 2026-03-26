use rusqlite::Connection;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

use crate::domain::error::DomainResult;

static IN_MEMORY_COUNTER: AtomicU64 = AtomicU64::new(0);

pub struct DbManager {
    writer: Connection,
    reader: Connection,
}

impl DbManager {
    pub fn new(db_path: &Path) -> DomainResult<Self> {
        let writer = Connection::open(db_path)?;
        Self::apply_pragmas(&writer)?;

        let reader = Connection::open(db_path)?;
        Self::apply_pragmas(&reader)?;

        let mut manager = Self { writer, reader };
        super::migration::run_migrations(&mut manager.writer)?;
        Ok(manager)
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
        super::migration::run_migrations(&mut manager.writer)?;
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
    }

    #[test]
    fn schema_version_is_1() {
        let db = DbManager::new_in_memory().unwrap();
        let version: i32 = db
            .reader()
            .query_row("SELECT version FROM schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 1);
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
