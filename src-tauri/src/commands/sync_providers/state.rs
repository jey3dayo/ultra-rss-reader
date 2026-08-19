use std::sync::Mutex;

use crate::commands::dto::AppError;
use crate::commands::feed_commands::lock_db;
use crate::domain::provider::{RemoteEntry, SyncCursor};
use crate::domain::types::{AccountId, FeedId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use crate::repository::sync_state::{SyncState, SyncStateRepository, SyncStateScopeKey};

const GREADER_REMOTE_STATE_PULL_COOLDOWN_MINUTES: i64 = 10;

pub(super) fn update_latest_timestamp_usec(
    latest_timestamp_usec: &mut Option<i64>,
    next_cursor: Option<&SyncCursor>,
) {
    if let Some(next_timestamp_usec) = next_cursor
        .and_then(|cursor| cursor.since)
        .map(|ts| ts.timestamp_micros())
        .and_then(valid_sync_cursor_timestamp_usec)
    {
        *latest_timestamp_usec = Some(
            latest_timestamp_usec
                .map(|current| current.max(next_timestamp_usec))
                .unwrap_or(next_timestamp_usec),
        );
    }
}

fn valid_sync_cursor_timestamp_usec(timestamp_usec: i64) -> Option<i64> {
    if timestamp_usec < 0 {
        return None;
    }
    let timestamp = chrono::DateTime::from_timestamp_micros(timestamp_usec)?;
    if timestamp > chrono::Utc::now() {
        return None;
    }
    Some(timestamp_usec)
}

pub(super) fn sync_state_timestamp_usec(state: Option<&SyncState>) -> Option<i64> {
    state
        .and_then(|state| state.timestamp_usec)
        .and_then(valid_sync_cursor_timestamp_usec)
}

pub(super) fn update_latest_timestamp_usec_from_entries(
    latest_timestamp_usec: &mut Option<i64>,
    entries: &[RemoteEntry],
) {
    if let Some(next_timestamp_usec) = entries
        .iter()
        .filter_map(|entry| entry.updated_at.or(entry.published_at))
        .map(|timestamp| timestamp.timestamp_micros())
        .filter_map(valid_sync_cursor_timestamp_usec)
        .max()
    {
        *latest_timestamp_usec = Some(
            latest_timestamp_usec
                .map(|current| current.max(next_timestamp_usec))
                .unwrap_or(next_timestamp_usec),
        );
    }
}

pub(super) fn load_sync_state(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    scope_key: &SyncStateScopeKey,
) -> Result<Option<SyncState>, AppError> {
    let db_guard = lock_db(db)?;
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    Ok(sync_state_repo.get(account_id, scope_key)?)
}

pub(super) fn save_sync_state(db: &Mutex<DbManager>, state: &SyncState) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
    sync_state_repo.save(state)?;
    Ok(())
}

pub(super) fn save_greader_sync_failure_state(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    scope_key: &SyncStateScopeKey,
    saved_state: Option<&SyncState>,
    latest_timestamp_usec: Option<i64>,
    error: &AppError,
) -> Result<(), AppError> {
    save_sync_state(
        db,
        &SyncState {
            account_id: account_id.clone(),
            scope_key: scope_key.as_string(),
            timestamp_usec: latest_timestamp_usec
                .or_else(|| saved_state.and_then(|state| state.timestamp_usec)),
            continuation: None,
            etag: None,
            last_modified: None,
            last_success_at: saved_state.and_then(|state| state.last_success_at.clone()),
            last_error: Some(error.to_string()),
            error_count: saved_state
                .map(|state| state.error_count.saturating_add(1))
                .unwrap_or(1),
            next_retry_at: None,
        },
    )
}

pub(super) fn should_pull_remote_state(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    now: chrono::DateTime<chrono::Utc>,
) -> Result<bool, AppError> {
    let scope_key = SyncStateScopeKey::greader_remote_state_full();
    let state = load_sync_state(db, account_id, &scope_key)?;
    let Some(last_success_at) = state.and_then(|saved| saved.last_success_at) else {
        return Ok(true);
    };

    let Ok(last_success_at) = chrono::DateTime::parse_from_rfc3339(&last_success_at) else {
        return Ok(true);
    };
    let last_success_at = last_success_at.with_timezone(&chrono::Utc);
    if last_success_at > now {
        return Ok(true);
    }

    Ok(now.signed_duration_since(last_success_at)
        >= chrono::Duration::minutes(GREADER_REMOTE_STATE_PULL_COOLDOWN_MINUTES))
}

pub(super) fn mark_remote_state_sync_completed(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    now: chrono::DateTime<chrono::Utc>,
) -> Result<(), AppError> {
    let scope_key = SyncStateScopeKey::greader_remote_state_full();
    save_sync_state(
        db,
        &SyncState {
            account_id: account_id.clone(),
            scope_key: scope_key.as_string(),
            timestamp_usec: Some(now.timestamp_micros()),
            continuation: None,
            etag: None,
            last_modified: None,
            last_success_at: Some(now.to_rfc3339()),
            last_error: None,
            error_count: 0,
            next_retry_at: None,
        },
    )
}

pub(super) fn feed_scope_key(remote_id: &str) -> SyncStateScopeKey {
    SyncStateScopeKey::feed(remote_id)
}

pub(super) fn article_count_for_feed(
    db: &Mutex<DbManager>,
    feed_id: &FeedId,
) -> Result<usize, AppError> {
    let db_guard = lock_db(db)?;
    let count = db_guard
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE feed_id = ?1",
            rusqlite::params![feed_id.as_ref()],
            |row| row.get::<_, i64>(0),
        )
        .map_err(crate::domain::error::DomainError::from)
        .map_err(AppError::from)?;
    Ok(count as usize)
}

pub(super) fn cursor_from_state(state: Option<&SyncState>) -> Option<SyncCursor> {
    state.map(|state| SyncCursor {
        // Cross-sync resumes are timestamp-based. Continuation tokens are only
        // valid within a single pagination run and must not be revived later.
        continuation: None,
        since: sync_state_timestamp_usec(Some(state))
            .and_then(chrono::DateTime::from_timestamp_micros),
        etag: None,
        last_modified: None,
    })
}
