use rusqlite::{params, Connection};

use crate::domain::error::DomainResult;
use crate::domain::types::AccountId;
use crate::repository::sync_state::{SyncState, SyncStateRepository};

pub struct SqliteSyncStateRepository<'a> {
    conn: &'a Connection,
}

impl<'a> SqliteSyncStateRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }
}

impl SyncStateRepository for SqliteSyncStateRepository<'_> {
    fn get(&self, account_id: &AccountId, scope_key: &str) -> DomainResult<Option<SyncState>> {
        let mut stmt = self.conn.prepare(
            "SELECT account_id, scope_key, timestamp_usec, continuation, etag, last_modified, last_success_at, last_error, error_count, next_retry_at FROM sync_state WHERE account_id = ?1 AND scope_key = ?2",
        )?;
        let mut rows = stmt.query_map(params![account_id.0, scope_key], |row| {
            Ok(SyncState {
                account_id: AccountId(row.get(0)?),
                scope_key: row.get(1)?,
                timestamp_usec: row.get(2)?,
                continuation: row.get(3)?,
                etag: row.get(4)?,
                last_modified: row.get(5)?,
                last_success_at: row.get(6)?,
                last_error: row.get(7)?,
                error_count: row.get(8)?,
                next_retry_at: row.get(9)?,
            })
        })?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    fn save(&self, state: &SyncState) -> DomainResult<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO sync_state (account_id, scope_key, timestamp_usec, continuation, etag, last_modified, last_success_at, last_error, error_count, next_retry_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                state.account_id.0,
                state.scope_key,
                state.timestamp_usec,
                state.continuation,
                state.etag,
                state.last_modified,
                state.last_success_at,
                state.last_error,
                state.error_count,
                state.next_retry_at,
            ],
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

    fn insert_test_account(db: &DbManager) -> AccountId {
        let id = AccountId::new();
        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                params![id.0, "Local", "Test"],
            )
            .unwrap();
        id
    }

    #[test]
    fn save_and_get() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteSyncStateRepository::new(db.writer());

        let state = SyncState {
            account_id: account_id.clone(),
            scope_key: "all".to_string(),
            timestamp_usec: Some(1_700_000_100_000_000),
            continuation: Some("cont-123".to_string()),
            etag: Some("etag-abc".to_string()),
            last_modified: None,
            last_success_at: Some("2024-01-01T00:00:00Z".to_string()),
            last_error: None,
            error_count: 0,
            next_retry_at: None,
        };
        repo.save(&state).unwrap();

        let found = repo.get(&account_id, "all").unwrap().unwrap();
        assert_eq!(found.timestamp_usec, Some(1_700_000_100_000_000));
        assert_eq!(found.continuation, Some("cont-123".to_string()));
        assert_eq!(found.etag, Some("etag-abc".to_string()));
        assert_eq!(found.error_count, 0);
    }

    #[test]
    fn get_returns_none_for_missing() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteSyncStateRepository::new(db.writer());

        let result = repo.get(&account_id, "nonexistent").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn save_updates_existing() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteSyncStateRepository::new(db.writer());

        let mut state = SyncState {
            account_id: account_id.clone(),
            scope_key: "all".to_string(),
            timestamp_usec: None,
            continuation: None,
            etag: None,
            last_modified: None,
            last_success_at: None,
            last_error: None,
            error_count: 0,
            next_retry_at: None,
        };
        repo.save(&state).unwrap();

        state.timestamp_usec = Some(1_700_000_200_000_000);
        state.continuation = Some("new-cont".to_string());
        state.error_count = 3;
        repo.save(&state).unwrap();

        let found = repo.get(&account_id, "all").unwrap().unwrap();
        assert_eq!(found.timestamp_usec, Some(1_700_000_200_000_000));
        assert_eq!(found.continuation, Some("new-cont".to_string()));
        assert_eq!(found.error_count, 3);
    }
}
