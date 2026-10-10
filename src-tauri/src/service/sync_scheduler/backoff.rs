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
use crate::infra::keyring_store::NEEDS_AUTH;
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
    match failure_notice(account, error, &backoff_state, cfg!(target_os = "macos")) {
        FailureNotice::CredentialAccessRequired(warning) => {
            push_scheduler_warning(warnings_to_emit, warning);
            return backoff;
        }
        FailureNotice::RetryScheduled(warning) => {
            push_scheduler_warning(warnings_to_emit, warning);
        }
        FailureNotice::Quiet => {}
    }
    tracing::info!(
        account_id = %account.id.as_ref(),
        backoff_secs = backoff.as_secs(),
        error_count = backoff_state.error_count,
        "Background sync backoff scheduled"
    );
    backoff
}

enum FailureNotice {
    CredentialAccessRequired(AccountSyncWarning),
    RetryScheduled(AccountSyncWarning),
    Quiet,
}

fn is_credential_access_required(message: &str) -> bool {
    message.contains(NEEDS_AUTH)
}

fn failure_notice(
    account: &Account,
    error: &AppError,
    backoff_state: &RetryBackoffState,
    credential_gate_enabled: bool,
) -> FailureNotice {
    if credential_gate_enabled && is_credential_access_required(&error.to_string()) {
        return FailureNotice::CredentialAccessRequired(AccountSyncWarning {
            account_id: account.id.as_ref().to_string(),
            account_name: account.name.clone(),
            kind: AccountSyncWarningKind::Generic,
            message: error.to_string(),
            retry_at: None,
            retry_in_seconds: None,
            detail: AccountSyncWarningDetail::CredentialAccessRequired {
                account_name: account.name.clone(),
            },
        });
    }
    if !backoff_state.retry_warning_changed {
        return FailureNotice::Quiet;
    }
    FailureNotice::RetryScheduled(AccountSyncWarning {
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
    })
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

#[cfg(any(target_os = "macos", test))]
fn credential_access_pending(has_lease: bool, last_error: Option<&str>) -> bool {
    !has_lease && last_error.is_some_and(is_credential_access_required)
}

/// Once authorization is required, only an explicit connection can resume macOS scheduling.
pub(super) fn waiting_for_credential_access(db: &Mutex<DbManager>, account: &Account) -> bool {
    #[cfg(target_os = "macos")]
    {
        let has_lease = crate::infra::keyring_store::session_cache::has_lease(account.id.as_ref());
        let Ok(db) = db.lock() else {
            return false;
        };
        let repo = SqliteSyncStateRepository::new(db.reader());
        let last_error = repo
            .get(&account.id, SyncStateScopeKey::scheduler())
            .ok()
            .flatten()
            .and_then(|state| state.last_error);
        credential_access_pending(has_lease, last_error.as_deref())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (db, account);
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::account::ConnectionVerificationStatus;
    use crate::domain::provider::ProviderKind;

    fn account() -> Account {
        Account {
            id: AccountId("credential-gate".to_string()),
            kind: ProviderKind::FreshRss,
            name: "FreshRSS".to_string(),
            server_url: None,
            username: None,
            sync_interval_secs: 60,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Unverified,
            connection_verified_at: None,
            connection_verification_error: None,
        }
    }

    fn backoff_state(retry_warning_changed: bool) -> RetryBackoffState {
        RetryBackoffState {
            error_count: 1,
            next_retry_at: None,
            retry_in_seconds: 120,
            retry_warning_changed,
        }
    }

    // The error crosses the command boundary as text; this pins the marker the scheduler matches.
    fn needs_auth_error() -> AppError {
        crate::infra::keyring_store::session_cache::needs_auth().into()
    }

    #[test]
    fn needs_auth_marker_survives_the_app_error_conversion() {
        assert!(is_credential_access_required(
            &needs_auth_error().to_string()
        ));
        assert!(!is_credential_access_required(
            "Auth error: HTTP 401 Unauthorized"
        ));
    }

    #[test]
    fn needs_auth_failure_requests_credential_access_instead_of_scheduling_retry() {
        for retry_warning_changed in [true, false] {
            let notice = failure_notice(
                &account(),
                &needs_auth_error(),
                &backoff_state(retry_warning_changed),
                true,
            );
            assert!(matches!(
                notice,
                FailureNotice::CredentialAccessRequired(AccountSyncWarning {
                    detail: AccountSyncWarningDetail::CredentialAccessRequired { .. },
                    retry_at: None,
                    retry_in_seconds: None,
                    ..
                })
            ));
        }
    }

    #[test]
    fn needs_auth_failure_keeps_retry_warning_when_the_credential_gate_is_disabled() {
        let notice = failure_notice(&account(), &needs_auth_error(), &backoff_state(true), false);
        assert!(matches!(notice, FailureNotice::RetryScheduled(_)));
    }

    #[test]
    fn other_failures_schedule_a_retry_only_when_the_warning_changed() {
        let error = AppError::UserVisible {
            message: "Auth error: HTTP 401 Unauthorized".to_string(),
        };
        assert!(matches!(
            failure_notice(&account(), &error, &backoff_state(true), true),
            FailureNotice::RetryScheduled(_)
        ));
        assert!(matches!(
            failure_notice(&account(), &error, &backoff_state(false), true),
            FailureNotice::Quiet
        ));
    }

    #[test]
    fn waiting_for_credential_access_ends_once_a_lease_exists() {
        let last_error = needs_auth_error().to_string();
        assert!(credential_access_pending(false, Some(&last_error)));
        assert!(!credential_access_pending(true, Some(&last_error)));
        assert!(!credential_access_pending(false, None));
        assert!(!credential_access_pending(
            false,
            Some("Auth error: HTTP 401 Unauthorized")
        ));
    }
}
