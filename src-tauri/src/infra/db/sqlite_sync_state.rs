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
mod tests;
