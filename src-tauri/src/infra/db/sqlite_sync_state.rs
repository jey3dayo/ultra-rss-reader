use rusqlite::{params, Connection};

use crate::domain::error::DomainResult;
use crate::domain::types::AccountId;
use crate::repository::sync_state::{SyncState, SyncStateRepository, SyncStateScopeKey};

pub struct SqliteSyncStateRepository<'a> {
    conn: &'a Connection,
}

impl<'a> SqliteSyncStateRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }
}

impl SyncStateRepository for SqliteSyncStateRepository<'_> {
    fn get<K>(&self, account_id: &AccountId, scope_key: K) -> DomainResult<Option<SyncState>>
    where
        K: Into<SyncStateScopeKey>,
    {
        let scope_key = scope_key.into();
        let mut stmt = self.conn.prepare(
            "SELECT account_id, scope_key, timestamp_usec, continuation, etag, last_modified, last_success_at, last_error, error_count, next_retry_at FROM sync_state WHERE account_id = ?1 AND scope_key = ?2",
        )?;
        let mut rows = stmt.query_map(params![account_id.0, scope_key.as_string()], |row| {
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
            "INSERT INTO sync_state (account_id, scope_key, timestamp_usec, continuation, etag, last_modified, last_success_at, last_error, error_count, next_retry_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(account_id, scope_key) DO UPDATE SET
                timestamp_usec = excluded.timestamp_usec,
                continuation = excluded.continuation,
                etag = excluded.etag,
                last_modified = excluded.last_modified,
                last_success_at = excluded.last_success_at,
                last_error = excluded.last_error,
                error_count = excluded.error_count,
                next_retry_at = excluded.next_retry_at",
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

    fn sync_state_rowid(db: &DbManager, account_id: &AccountId, scope_key: &str) -> i64 {
        db.reader()
            .query_row(
                "SELECT rowid FROM sync_state WHERE account_id = ?1 AND scope_key = ?2",
                params![account_id.0, scope_key],
                |row| row.get(0),
            )
            .unwrap()
    }

    #[test]
    fn save_and_get() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteSyncStateRepository::new(db.writer());

        let state = SyncState {
            account_id: account_id.clone(),
            scope_key: SyncStateScopeKey::greader_account_all().as_string(),
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

        let found = repo
            .get(&account_id, &SyncStateScopeKey::greader_account_all())
            .unwrap()
            .unwrap();
        assert_eq!(found.timestamp_usec, Some(1_700_000_100_000_000));
        assert_eq!(found.continuation, Some("cont-123".to_string()));
        assert_eq!(found.etag, Some("etag-abc".to_string()));
        assert_eq!(found.error_count, 0);
    }

    #[test]
    fn save_and_get_round_trip_local_feed_validators_on_migration_applied_db() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteSyncStateRepository::new(db.writer());
        let scope_key = SyncStateScopeKey::local_feed("https://example.com/rss.xml");

        let state = SyncState {
            account_id: account_id.clone(),
            scope_key: scope_key.as_string(),
            timestamp_usec: None,
            continuation: None,
            etag: Some("\"etag-local\"".to_string()),
            last_modified: Some("Wed, 01 Jan 2025 00:00:00 GMT".to_string()),
            last_success_at: None,
            last_error: None,
            error_count: 0,
            next_retry_at: None,
        };

        repo.save(&state).unwrap();

        let found = repo.get(&account_id, scope_key).unwrap().unwrap();
        assert_eq!(found.etag, Some("\"etag-local\"".to_string()));
        assert_eq!(
            found.last_modified,
            Some("Wed, 01 Jan 2025 00:00:00 GMT".to_string())
        );
    }

    #[test]
    fn get_returns_none_for_missing() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteSyncStateRepository::new(db.writer());

        let result = repo
            .get(&account_id, &SyncStateScopeKey::feed("nonexistent"))
            .unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn save_updates_existing() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteSyncStateRepository::new(db.writer());

        let mut state = SyncState {
            account_id: account_id.clone(),
            scope_key: SyncStateScopeKey::greader_account_all().as_string(),
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

        let found = repo
            .get(&account_id, &SyncStateScopeKey::greader_account_all())
            .unwrap()
            .unwrap();
        assert_eq!(found.timestamp_usec, Some(1_700_000_200_000_000));
        assert_eq!(found.continuation, Some("new-cont".to_string()));
        assert_eq!(found.error_count, 3);
    }

    #[test]
    fn save_upserts_existing_without_replacing_row() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteSyncStateRepository::new(db.writer());
        let scope_key = SyncStateScopeKey::greader_account_all().as_string();

        let mut state = SyncState {
            account_id: account_id.clone(),
            scope_key: scope_key.clone(),
            timestamp_usec: Some(1_700_000_100_000_000),
            continuation: Some("old-cont".to_string()),
            etag: Some("old-etag".to_string()),
            last_modified: Some("Wed, 01 Jan 2025 00:00:00 GMT".to_string()),
            last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
            last_error: Some("old error".to_string()),
            error_count: 1,
            next_retry_at: Some("2025-01-01T01:00:00Z".to_string()),
        };
        repo.save(&state).unwrap();
        let initial_rowid = sync_state_rowid(&db, &account_id, &scope_key);

        state.timestamp_usec = Some(1_700_000_200_000_000);
        state.continuation = Some("new-cont".to_string());
        state.etag = Some("new-etag".to_string());
        state.last_modified = Some("Thu, 02 Jan 2025 00:00:00 GMT".to_string());
        state.last_success_at = Some("2025-01-02T00:00:00Z".to_string());
        state.last_error = None;
        state.error_count = 0;
        state.next_retry_at = None;
        repo.save(&state).unwrap();

        let updated_rowid = sync_state_rowid(&db, &account_id, &scope_key);
        let found = repo
            .get(&account_id, SyncStateScopeKey::greader_account_all())
            .unwrap()
            .unwrap();

        assert_eq!(updated_rowid, initial_rowid);
        assert_eq!(found.timestamp_usec, Some(1_700_000_200_000_000));
        assert_eq!(found.continuation, Some("new-cont".to_string()));
        assert_eq!(found.etag, Some("new-etag".to_string()));
        assert_eq!(
            found.last_modified,
            Some("Thu, 02 Jan 2025 00:00:00 GMT".to_string())
        );
        assert_eq!(
            found.last_success_at,
            Some("2025-01-02T00:00:00Z".to_string())
        );
        assert_eq!(found.last_error, None);
        assert_eq!(found.error_count, 0);
        assert_eq!(found.next_retry_at, None);
    }

    #[test]
    fn save_and_get_round_trip_retry_metadata_on_migration_applied_db() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteSyncStateRepository::new(db.writer());

        let state = SyncState {
            account_id: account_id.clone(),
            scope_key: SyncStateScopeKey::scheduler().as_string(),
            timestamp_usec: None,
            continuation: None,
            etag: None,
            last_modified: None,
            last_success_at: None,
            last_error: Some("temporary network error".to_string()),
            error_count: 2,
            next_retry_at: Some("2026-05-09T12:30:00Z".to_string()),
        };

        repo.save(&state).unwrap();

        let found = repo
            .get(&account_id, SyncStateScopeKey::scheduler())
            .unwrap()
            .unwrap();
        assert_eq!(
            found.last_error,
            Some("temporary network error".to_string())
        );
        assert_eq!(found.error_count, 2);
        assert_eq!(
            found.next_retry_at,
            Some("2026-05-09T12:30:00Z".to_string())
        );
    }

    #[test]
    fn get_keeps_same_scope_key_isolated_by_account_on_migration_applied_db() {
        let db = test_db();
        let account_a = insert_test_account(&db);
        let account_b = insert_test_account(&db);
        let repo = SqliteSyncStateRepository::new(db.writer());

        repo.save(&SyncState {
            account_id: account_a.clone(),
            scope_key: SyncStateScopeKey::greader_account_all().as_string(),
            timestamp_usec: Some(100),
            continuation: Some("account-a".to_string()),
            etag: None,
            last_modified: None,
            last_success_at: None,
            last_error: None,
            error_count: 0,
            next_retry_at: None,
        })
        .unwrap();
        repo.save(&SyncState {
            account_id: account_b.clone(),
            scope_key: SyncStateScopeKey::greader_account_all().as_string(),
            timestamp_usec: Some(200),
            continuation: Some("account-b".to_string()),
            etag: None,
            last_modified: None,
            last_success_at: None,
            last_error: None,
            error_count: 0,
            next_retry_at: None,
        })
        .unwrap();

        let account_a_state = repo
            .get(&account_a, SyncStateScopeKey::greader_account_all())
            .unwrap()
            .unwrap();
        let account_b_state = repo
            .get(&account_b, SyncStateScopeKey::greader_account_all())
            .unwrap()
            .unwrap();

        assert_eq!(account_a_state.timestamp_usec, Some(100));
        assert_eq!(account_a_state.continuation, Some("account-a".to_string()));
        assert_eq!(account_b_state.timestamp_usec, Some(200));
        assert_eq!(account_b_state.continuation, Some("account-b".to_string()));
    }

    #[test]
    fn scope_key_helper_builds_known_disjoint_keys() {
        let keys = [
            SyncStateScopeKey::scheduler().as_string(),
            SyncStateScopeKey::greader_account_all().as_string(),
            SyncStateScopeKey::greader_remote_state_full().as_string(),
            SyncStateScopeKey::feed("feed/1").as_string(),
            SyncStateScopeKey::local_feed("https://example.com/rss").as_string(),
            SyncStateScopeKey::from("legacy").as_string(),
        ];

        assert_eq!(keys[0], "scheduler");
        assert_eq!(keys[1], "account:greader:all");
        assert_eq!(keys[2], "account:greader:remote-state-full");
        assert_eq!(keys[3], "feed:feed/1");
        assert_eq!(keys[4], "local_feed:https://example.com/rss");
        assert_eq!(keys[5], "legacy");

        let unique = keys.iter().collect::<std::collections::HashSet<_>>();
        assert_eq!(unique.len(), keys.len());
    }
}
