use std::collections::HashSet;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::commands::dto::{
    AccountSyncWarning, AccountSyncWarningDetail, AccountSyncWarningKind, AppError,
};
use crate::domain::account::Account;
use crate::domain::error::{DomainError, DomainResult, PROVIDER_RETRY_AFTER_MAX_SECONDS};
use crate::domain::types::AccountId;
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use crate::repository::sync_state::{SyncState, SyncStateRepository, SyncStateScopeKey};

use super::scheduling::account_interval;
use super::{
    MAX_BACKOFF, MAX_BACKOFF_MULTIPLIER, MAX_BACKOFF_SHIFT_BITS, MAX_SCHEDULER_WARNINGS_PER_TICK,
    RETRY_AFTER_MESSAGE_PREFIX,
};

#[derive(Debug)]
pub(super) struct RetryBackoffState {
    pub(super) error_count: i32,
    pub(super) next_retry_at: Option<String>,
    pub(super) retry_in_seconds: u64,
    pub(super) retry_warning_changed: bool,
}

pub(super) fn retry_at_to_next_sync(next_retry_at: &str, now: Instant) -> Option<Instant> {
    let retry_time = chrono::DateTime::parse_from_rfc3339(next_retry_at)
        .ok()?
        .with_timezone(&chrono::Utc);
    let delay = retry_time
        .signed_duration_since(chrono::Utc::now())
        .to_std()
        .unwrap_or(Duration::ZERO);
    Some(now + delay)
}

pub(super) fn persisted_retry_next_sync(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    now: Instant,
) -> Option<Instant> {
    let db_guard = db.lock().ok()?;
    let repo = SqliteSyncStateRepository::new(db_guard.reader());
    let state = repo
        .get(account_id, SyncStateScopeKey::scheduler())
        .ok()??;
    if state.error_count == 0 {
        return None;
    }
    state
        .next_retry_at
        .as_deref()
        .and_then(|next_retry_at| retry_at_to_next_sync(next_retry_at, now))
}

pub(super) fn backoff_persistence_failure_warning(
    account: &Account,
    error: &DomainError,
) -> AccountSyncWarning {
    AccountSyncWarning {
        account_id: account.id.as_ref().to_string(),
        account_name: account.name.clone(),
        kind: AccountSyncWarningKind::Generic,
        message: format!(
            "Scheduled sync could not persist retry state for '{}': {error}",
            account.name
        ),
        retry_at: None,
        retry_in_seconds: None,
        detail: AccountSyncWarningDetail::BackoffPersistFailed {
            account_name: account.name.clone(),
            message: error.to_string(),
        },
    }
}

fn scheduler_warning_key(warning: &AccountSyncWarning) -> String {
    format!(
        "{}\n{:?}\n{}\n{}",
        warning.account_id,
        warning.kind,
        warning.message,
        warning.retry_at.as_deref().unwrap_or_default()
    )
}

pub(super) fn push_scheduler_warning(
    warnings_to_emit: &mut Vec<AccountSyncWarning>,
    warning: AccountSyncWarning,
) {
    if warnings_to_emit.len() >= MAX_SCHEDULER_WARNINGS_PER_TICK {
        return;
    }
    let key = scheduler_warning_key(&warning);
    if warnings_to_emit
        .iter()
        .any(|existing| scheduler_warning_key(existing) == key)
    {
        return;
    }
    warnings_to_emit.push(warning);
}

pub(super) fn complete_failed_account_sync(
    db: &Mutex<DbManager>,
    account: &Account,
    error: &crate::commands::dto::AppError,
    warnings_to_emit: &mut Vec<AccountSyncWarning>,
) -> Duration {
    let backoff_state = match increment_error_count(db, account, error) {
        Ok(backoff_state) => backoff_state,
        Err(error) => {
            tracing::warn!(
                account_id = %account.id.as_ref(),
                "Background sync could not persist backoff state: {error}"
            );
            push_scheduler_warning(
                warnings_to_emit,
                backoff_persistence_failure_warning(account, &error),
            );
            RetryBackoffState {
                error_count: 1,
                next_retry_at: None,
                retry_in_seconds: calculate_backoff_secs(account, 1),
                retry_warning_changed: true,
            }
        }
    };
    let backoff = calculate_backoff(account, backoff_state.error_count)
        .max(Duration::from_secs(backoff_state.retry_in_seconds));
    if backoff_state.retry_warning_changed {
        push_scheduler_warning(
            warnings_to_emit,
            AccountSyncWarning {
                account_id: account.id.as_ref().to_string(),
                account_name: account.name.clone(),
                kind: AccountSyncWarningKind::RetryScheduled,
                message: format!(
                    "Background sync failed and will retry automatically for '{}'.",
                    account.name
                ),
                retry_at: backoff_state.next_retry_at.clone(),
                retry_in_seconds: Some(backoff_state.retry_in_seconds),
                detail: AccountSyncWarningDetail::BackgroundSyncRetryScheduled {
                    account_name: account.name.clone(),
                },
            },
        );
    }
    tracing::info!(
        account_id = %account.id.as_ref(),
        backoff_secs = backoff.as_secs(),
        error_count = backoff_state.error_count,
        "Background sync backoff scheduled"
    );
    backoff
}

pub(super) fn calculate_backoff(account: &Account, error_count: i32) -> Duration {
    Duration::from_secs(calculate_backoff_secs(account, error_count))
}

pub(super) fn calculate_backoff_secs(account: &Account, error_count: i32) -> u64 {
    let base = account_interval(account).as_secs();
    let error_count = clamped_backoff_error_count(error_count);
    let multiplier = 1u64
        .checked_shl(error_count)
        .unwrap_or(MAX_BACKOFF_MULTIPLIER);
    base.saturating_mul(multiplier).min(MAX_BACKOFF.as_secs())
}

pub(super) fn is_in_backoff(db: &Mutex<DbManager>, account_id: &AccountId) -> bool {
    let Some(db_guard) = db.lock().ok() else {
        return false;
    };
    let repo = SqliteSyncStateRepository::new(db_guard.writer());
    let scope_key = SyncStateScopeKey::scheduler();
    let Some(mut state) = repo.get(account_id, &scope_key).ok().flatten() else {
        return false;
    };
    if state.error_count == 0 {
        return false;
    }
    if let Some(ref next_retry) = state.next_retry_at {
        if let Ok(retry_time) = chrono::DateTime::parse_from_rfc3339(next_retry) {
            return chrono::Utc::now() < retry_time;
        }
        clear_invalid_next_retry_at(&repo, &mut state);
    }
    false
}

fn invalid_next_retry_cleanup_failures() -> &'static Mutex<HashSet<String>> {
    super::INVALID_NEXT_RETRY_CLEANUP_FAILURES.get_or_init(|| Mutex::new(HashSet::new()))
}

fn invalid_next_retry_cleanup_key(state: &SyncState, invalid_next_retry_at: &str) -> String {
    format!(
        "{}\n{}\n{}",
        state.account_id.as_ref(),
        state.scope_key,
        invalid_next_retry_at
    )
}

pub(super) fn clear_invalid_next_retry_at<R>(repo: &R, state: &mut SyncState)
where
    R: SyncStateRepository,
{
    let Some(invalid_next_retry_at) = state.next_retry_at.clone() else {
        return;
    };
    let cleanup_key = invalid_next_retry_cleanup_key(state, &invalid_next_retry_at);
    if invalid_next_retry_cleanup_failures()
        .lock()
        .map(|failures| failures.contains(&cleanup_key))
        .unwrap_or(false)
    {
        state.next_retry_at = None;
        return;
    }

    tracing::warn!(
        "Clearing invalid scheduler next_retry_at for account '{}': {}",
        state.account_id.as_ref(),
        invalid_next_retry_at
    );
    state.next_retry_at = None;
    match repo.save(state) {
        Ok(()) => {
            if let Ok(mut failures) = invalid_next_retry_cleanup_failures().lock() {
                failures.remove(&cleanup_key);
            }
        }
        Err(error) => {
            if let Ok(mut failures) = invalid_next_retry_cleanup_failures().lock() {
                failures.insert(cleanup_key);
            }
            tracing::warn!(
                "Failed to clear invalid scheduler next_retry_at for account '{}': {error}",
                state.account_id.as_ref()
            );
        }
    }
}

pub(super) fn reset_error_count(db: &Mutex<DbManager>, account_id: &AccountId) -> DomainResult<()> {
    let db_guard = db
        .lock()
        .map_err(|error| DomainError::Persistence(format!("Lock error: {error}")))?;
    let repo = SqliteSyncStateRepository::new(db_guard.writer());
    let scope_key = SyncStateScopeKey::scheduler();
    let mut state = repo
        .get(account_id, &scope_key)?
        .unwrap_or_else(|| SyncState {
            account_id: account_id.clone(),
            scope_key: scope_key.as_string(),
            timestamp_usec: None,
            continuation: None,
            etag: None,
            last_modified: None,
            last_success_at: None,
            last_error: None,
            error_count: 0,
            next_retry_at: None,
        });
    state.error_count = 0;
    state.last_error = None;
    state.next_retry_at = None;
    state.last_success_at = Some(chrono::Utc::now().to_rfc3339());
    repo.save(&state)
}

pub(super) fn increment_error_count(
    db: &Mutex<DbManager>,
    account: &Account,
    error: &crate::commands::dto::AppError,
) -> DomainResult<RetryBackoffState> {
    let db_guard = db
        .lock()
        .map_err(|error| DomainError::Persistence(format!("Lock error: {error}")))?;
    let repo = SqliteSyncStateRepository::new(db_guard.writer());
    let scope_key = SyncStateScopeKey::scheduler();
    let mut state = repo
        .get(&account.id, &scope_key)?
        .unwrap_or_else(|| SyncState {
            account_id: account.id.clone(),
            scope_key: scope_key.as_string(),
            timestamp_usec: None,
            continuation: None,
            etag: None,
            last_modified: None,
            last_success_at: None,
            last_error: None,
            error_count: 0,
            next_retry_at: None,
        });
    state.error_count = (clamped_backoff_error_count(state.error_count) as i32).saturating_add(1);
    state.last_error = Some(error.to_string());
    let previous_next_retry_at = state.next_retry_at.clone();
    let backoff_secs = retry_after_seconds_from_app_error(error)
        .unwrap_or(0)
        .max(calculate_backoff_secs(account, state.error_count));
    let next_retry = chrono::Utc::now() + chrono::Duration::seconds(backoff_secs as i64);
    let next_retry_at = next_retry.to_rfc3339();
    state.next_retry_at = Some(next_retry_at.clone());
    repo.save(&state)?;
    Ok(RetryBackoffState {
        error_count: state.error_count,
        next_retry_at: Some(next_retry_at),
        retry_in_seconds: backoff_secs,
        retry_warning_changed: previous_next_retry_at != state.next_retry_at,
    })
}

fn clamped_backoff_error_count(error_count: i32) -> u32 {
    error_count.clamp(0, MAX_BACKOFF_SHIFT_BITS as i32) as u32
}

pub(super) fn retry_after_seconds_from_app_error(error: &AppError) -> Option<u64> {
    match error {
        AppError::RetryableWithMetadata {
            message,
            retry_after_seconds,
        } if message.starts_with(RETRY_AFTER_MESSAGE_PREFIX) => {
            retry_after_seconds.map(|seconds| seconds.min(PROVIDER_RETRY_AFTER_MAX_SECONDS))
        }
        AppError::Retryable { .. }
        | AppError::RetryableWithMetadata { .. }
        | AppError::UserVisible { .. } => None,
    }
}
