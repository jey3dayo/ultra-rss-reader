use std::collections::HashMap;

use rusqlite::{params, Connection};

use crate::domain::error::DomainResult;
use crate::repository::preference::PreferenceRepository;

pub struct SqlitePreferenceRepository<'a> {
    conn: &'a Connection,
}

impl<'a> SqlitePreferenceRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }
}

impl PreferenceRepository for SqlitePreferenceRepository<'_> {
    fn get_all(&self) -> DomainResult<HashMap<String, String>> {
        let mut stmt = self.conn.prepare("SELECT key, value FROM preferences")?;
        let rows = stmt.query_map([], |row| {
            let key: String = row.get(0)?;
            let value: String = row.get(1)?;
            Ok((key, value))
        })?;
        let mut map = HashMap::new();
        for row in rows {
            let (key, value) = row?;
            map.insert(key, value);
        }
        Ok(map)
    }

    fn get(&self, key: &str) -> DomainResult<Option<String>> {
        let result = self.conn.query_row(
            "SELECT value FROM preferences WHERE key = ?1",
            params![key],
            |row| row.get(0),
        );
        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    fn set(&self, key: &str, value: &str) -> DomainResult<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO preferences (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::db::connection::DbManager;

    fn test_db() -> DbManager {
        DbManager::new_in_memory().unwrap()
    }

    #[test]
    fn set_and_get() {
        let db = test_db();
        let repo = SqlitePreferenceRepository::new(db.writer());

        repo.set("theme", "dark").unwrap();
        let value = repo.get("theme").unwrap();
        assert_eq!(value, Some("dark".to_string()));
    }

    #[test]
    fn get_missing_key_returns_none() {
        let db = test_db();
        let repo = SqlitePreferenceRepository::new(db.reader());

        let value = repo.get("nonexistent").unwrap();
        assert_eq!(value, None);
    }

    #[test]
    fn set_overwrites_existing() {
        let db = test_db();
        let repo = SqlitePreferenceRepository::new(db.writer());

        repo.set("theme", "dark").unwrap();
        repo.set("theme", "light").unwrap();
        let value = repo.get("theme").unwrap();
        assert_eq!(value, Some("light".to_string()));
    }

    #[test]
    fn get_all_returns_all_entries() {
        let db = test_db();
        let repo = SqlitePreferenceRepository::new(db.writer());

        repo.set("theme", "dark").unwrap();
        repo.set("font_size", "medium").unwrap();

        let all = repo.get_all().unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all.get("theme"), Some(&"dark".to_string()));
        assert_eq!(all.get("font_size"), Some(&"medium".to_string()));
    }
}
