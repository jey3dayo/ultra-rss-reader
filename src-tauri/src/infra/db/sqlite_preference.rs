use std::collections::HashMap;

use rusqlite::types::ValueRef;
use rusqlite::{params, Connection};

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::preference::preference_row_quarantine_reason;
use crate::repository::preference::PreferenceRepository;

pub struct SqlitePreferenceRepository<'a> {
    conn: &'a Connection,
}

impl<'a> SqlitePreferenceRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }
}

fn preference_text_column(value: ValueRef<'_>) -> Option<String> {
    match value {
        ValueRef::Text(bytes) => std::str::from_utf8(bytes).ok().map(str::to_string),
        _ => None,
    }
}

impl PreferenceRepository for SqlitePreferenceRepository<'_> {
    fn get_all(&self) -> DomainResult<HashMap<String, String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT rowid, key, value FROM preferences")?;
        let rows = stmt.query_map([], |row| {
            let rowid: i64 = row.get(0)?;
            let key = preference_text_column(row.get_ref(1)?);
            let value = preference_text_column(row.get_ref(2)?);
            Ok((rowid, key, value))
        })?;
        let mut map = HashMap::new();
        for row in rows {
            let (rowid, key, value) = row?;
            let Some(key) = key else {
                tracing::warn!("Quarantined preference row {rowid}: key is not valid UTF-8 text");
                continue;
            };
            let Some(value) = value else {
                tracing::warn!(
                    "Quarantined preference row {rowid} for key {key}: value is not valid UTF-8 text"
                );
                continue;
            };
            if let Some(reason) = preference_row_quarantine_reason(&key, &value) {
                tracing::warn!(
                    "Quarantined preference row {rowid} for key {key}: {}",
                    reason.message(&key)
                );
                continue;
            }
            map.insert(key, value);
        }
        Ok(map)
    }

    fn get(&self, key: &str) -> DomainResult<Option<String>> {
        let result = self.conn.query_row(
            "SELECT value FROM preferences WHERE key = ?1",
            params![key],
            |row| Ok(preference_text_column(row.get_ref(0)?)),
        );
        match result {
            Ok(Some(value)) => {
                if let Some(reason) = preference_row_quarantine_reason(key, &value) {
                    tracing::warn!(
                        "Quarantined preference row for key {key}: {}",
                        reason.message(key)
                    );
                    return Ok(None);
                }
                Ok(Some(value))
            }
            Ok(None) => {
                tracing::warn!(
                    "Quarantined preference row for key {key}: value is not valid UTF-8 text"
                );
                Ok(None)
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    fn set(&self, key: &str, value: &str) -> DomainResult<()> {
        let key = key.trim();
        if key.is_empty() {
            return Err(DomainError::Validation(
                "preference key cannot be blank".to_string(),
            ));
        }

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
        repo.set("language", "ja").unwrap();

        let all = repo.get_all().unwrap();
        assert_eq!(all.len(), 3);
        assert_eq!(all.get("theme"), Some(&"dark".to_string()));
        assert_eq!(all.get("font_size"), Some(&"medium".to_string()));
        assert_eq!(all.get("language"), Some(&"ja".to_string()));
    }

    #[test]
    fn set_trims_preference_key_before_storing() {
        let db = test_db();
        let repo = SqlitePreferenceRepository::new(db.writer());

        repo.set("  theme  ", "dark").unwrap();

        assert_eq!(repo.get("theme").unwrap(), Some("dark".to_string()));
        assert_eq!(repo.get("  theme  ").unwrap(), None);
        let all = repo.get_all().unwrap();
        assert_eq!(all.len(), 1);
        assert!(all.contains_key("theme"));
    }

    #[test]
    fn get_all_quarantines_corrupted_preference_rows_without_failing() {
        let db = test_db();
        db.writer()
            .execute(
                "INSERT INTO preferences (key, value) VALUES
                    ('theme', 'dark'),
                    ('unknown_preference', 'ignored'),
                    ('debug_browser_hud', 'TRUE'),
                    ('shortcut_next_article', char(10)),
                    ('debug_web_preview_url', ?1),
                    (x'ff', 'invalid key'),
                    ('language', x'ff')",
                [&"a".repeat(1025)],
            )
            .unwrap();
        let repo = SqlitePreferenceRepository::new(db.reader());

        let all = repo.get_all().unwrap();

        assert_eq!(all.len(), 1);
        assert_eq!(all.get("theme"), Some(&"dark".to_string()));
    }

    #[test]
    fn get_quarantines_corrupted_preference_values_as_missing() {
        let db = test_db();
        db.writer()
            .execute(
                "INSERT INTO preferences (key, value) VALUES
                    ('debug_browser_hud', 'TRUE'),
                    ('language', x'ff')",
                [],
            )
            .unwrap();
        let repo = SqlitePreferenceRepository::new(db.reader());

        assert_eq!(repo.get("debug_browser_hud").unwrap(), None);
        assert_eq!(repo.get("language").unwrap(), None);
    }

    #[test]
    fn set_rejects_blank_preference_key() {
        let db = test_db();
        let repo = SqlitePreferenceRepository::new(db.writer());

        for key in ["", "   ", "\n\t"] {
            let error = repo.set(key, "dark").unwrap_err();
            assert!(
                matches!(error, DomainError::Validation(message) if message == "preference key cannot be blank")
            );
        }

        assert!(repo.get_all().unwrap().is_empty());
    }
}
