use std::collections::HashMap;
use std::panic::AssertUnwindSafe;
use std::sync::atomic::Ordering;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use futures::FutureExt;
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::dto::{AccountSyncWarning, AccountSyncWarningKind, SyncProgressKind};
use crate::commands::sync_commands::{purge_old_articles, sync_account, SyncProgressReporter};
use crate::domain::account::Account;
use crate::domain::types::AccountId;
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use crate::repository::account::AccountRepository;
use crate::repository::sync_state::{SyncState, SyncStateRepository};

const TICK_INTERVAL: Duration = Duration::from_secs(10);
const MAX_BACKOFF: Duration = Duration::from_secs(3600);
const SYNC_STATE_SCOPE: &str = "scheduler";

/// Per-account scheduling state kept in memory.
struct AccountSchedule {
    next_sync: Instant,
}

struct RetryBackoffState {
    error_count: i32,
    next_retry_at: Option<String>,
    retry_in_seconds: u64,
}

/// Start a background task that periodically syncs accounts based on their
/// individual `sync_interval_secs` settings.
///
/// Each account is tracked independently. On failure, exponential backoff
/// is applied using `sync_state.error_count`. On success, `error_count` is
/// reset and the next sync is scheduled at `now + sync_interval_secs`.
pub fn start_sync_scheduler(_db: &Mutex<DbManager>, app_handle: AppHandle) {
    tracing::info!("Starting background sync scheduler");

    tauri::async_runtime::spawn(async move {
        let state = app_handle.state::<crate::commands::AppState>();
        tracing::info!("Background sync is locked until the first manual sync completes");

        wait_for_automatic_sync_enabled(
            state.automatic_sync_enabled.as_ref(),
            state.automatic_sync_notify.as_ref(),
        )
        .await;

        let mut schedules: HashMap<String, AccountSchedule> = HashMap::new();

        loop {
            tokio::time::sleep(TICK_INTERVAL).await;

            if !state.automatic_sync_enabled.load(Ordering::SeqCst) {
                continue;
            }

            let accounts: Vec<Account> = match state.db.lock().ok().and_then(|db_guard| {
                let repo = SqliteAccountRepository::new(db_guard.reader());
                repo.find_all().ok()
            }) {
                Some(a) => a,
                None => continue,
            };

            let now = Instant::now();

            // Remove schedules for deleted accounts
            let account_ids: Vec<String> =
                accounts.iter().map(|a| a.id.as_ref().to_string()).collect();
            schedules.retain(|id, _| account_ids.contains(id));

            // Ensure every account has a schedule entry
            for account in &accounts {
                let id = account.id.as_ref().to_string();
                schedules.entry(id).or_insert_with(|| {
                    let interval = account_interval(account);
                    AccountSchedule {
                        next_sync: now + interval,
                    }
                });
            }

            // Check which accounts are due and not in backoff
            let due_accounts: Vec<&Account> = accounts
                .iter()
                .filter(|account| {
                    let id = account.id.as_ref().to_string();
                    schedules
                        .get(&id)
                        .map(|s| now >= s.next_sync)
                        .unwrap_or(false)
                })
                .filter(|account| !is_in_backoff(&state.db, &account.id))
                .collect();

            if due_accounts.is_empty() {
                continue;
            }

            // Skip if another sync (manual) is already in progress
            if state.syncing.load(Ordering::SeqCst) {
                tracing::debug!("Skipping scheduled sync: manual sync in progress");
                continue;
            }

            let mut any_synced = false;
            let mut warnings_to_emit = Vec::new();
            let reporter = SyncProgressReporter::new(
                app_handle.clone(),
                SyncProgressKind::Automatic,
                due_accounts.len(),
            );
            reporter.emit_started(None);

            for account in due_accounts {
                let account_id_str = account.id.as_ref().to_string();
                reporter.emit_account_started(account);
                let result = AssertUnwindSafe(sync_account(&state.db, account))
                    .catch_unwind()
                    .await;

                match result {
                    Ok(Ok(outcome)) => {
                        tracing::info!("Background sync completed for account '{}'", account.name);
                        for warning in &outcome.warnings {
                            tracing::warn!(
                                "Background sync warning for account '{}': {}",
                                account.name,
                                warning.message
                            );
                            warnings_to_emit.push(AccountSyncWarning {
                                account_id: account.id.as_ref().to_string(),
                                account_name: account.name.clone(),
                                kind: warning.kind,
                                message: warning.message.clone(),
                                retry_at: warning.retry_at.clone(),
                                retry_in_seconds: warning.retry_in_seconds,
                            });
                        }
                        reporter.emit_account_finished(account, true);
                        reset_error_count(&state.db, &account.id);
                        if let Some(schedule) = schedules.get_mut(&account_id_str) {
                            schedule.next_sync = Instant::now() + account_interval(account);
                        }
                        any_synced = true;
                    }
                    Ok(Err(e)) => {
                        tracing::warn!(
                            "Background sync failed for account '{}': {e}",
                            account.name
                        );
                        reporter.emit_account_finished(account, false);
                        let backoff_state = increment_error_count(&state.db, &account.id, &e);
                        let backoff = calculate_backoff(account, backoff_state.error_count);
                        if let Some(schedule) = schedules.get_mut(&account_id_str) {
                            schedule.next_sync = Instant::now() + backoff;
                        }
                        warnings_to_emit.push(AccountSyncWarning {
                            account_id: account.id.as_ref().to_string(),
                            account_name: account.name.clone(),
                            kind: AccountSyncWarningKind::RetryScheduled,
                            message: format!(
                                "Background sync failed and will retry automatically for '{}'.",
                                account.name
                            ),
                            retry_at: backoff_state.next_retry_at.clone(),
                            retry_in_seconds: Some(backoff_state.retry_in_seconds),
                        });
                        tracing::info!(
                            "Account '{}' backoff: {}s (error_count={})",
                            account.name,
                            backoff.as_secs(),
                            backoff_state.error_count
                        );
                    }
                    Err(_) => {
                        tracing::error!(
                            "Background sync panicked for account '{}', scheduler continues",
                            account.name
                        );
                        reporter.emit_account_finished(account, false);
                        if let Some(schedule) = schedules.get_mut(&account_id_str) {
                            schedule.next_sync = Instant::now() + account_interval(account);
                        }
                    }
                }
            }

            reporter.emit_finished(any_synced);

            if !warnings_to_emit.is_empty() {
                if let Err(e) = app_handle.emit("sync-warning", warnings_to_emit.clone()) {
                    tracing::warn!("Failed to emit sync-warning event: {e}");
                }
            }

            if any_synced {
                if let Err(e) = app_handle.emit("sync-completed", ()) {
                    tracing::warn!("Failed to emit sync-completed event: {e}");
                }
                purge_old_articles(&state.db);
            }
        }
    });
}

fn account_interval(account: &Account) -> Duration {
    let secs = if account.sync_interval_secs > 0 {
        account.sync_interval_secs as u64
    } else {
        3600
    };
    Duration::from_secs(secs)
}

fn calculate_backoff(account: &Account, error_count: i32) -> Duration {
    let base = account_interval(account);
    let multiplier = 1u64.checked_shl(error_count.min(10) as u32).unwrap_or(1024);
    let backoff = base.saturating_mul(multiplier as u32);
    backoff.min(MAX_BACKOFF)
}

fn is_in_backoff(db: &Mutex<DbManager>, account_id: &AccountId) -> bool {
    let Some(db_guard) = db.lock().ok() else {
        return false;
    };
    let repo = SqliteSyncStateRepository::new(db_guard.reader());
    let Some(state) = repo.get(account_id, SYNC_STATE_SCOPE).ok().flatten() else {
        return false;
    };
    if state.error_count == 0 {
        return false;
    }
    // If next_retry_at is set and in the future, we're in backoff
    if let Some(ref next_retry) = state.next_retry_at {
        if let Ok(retry_time) = chrono::DateTime::parse_from_rfc3339(next_retry) {
            return chrono::Utc::now() < retry_time;
        }
    }
    false
}

fn reset_error_count(db: &Mutex<DbManager>, account_id: &AccountId) {
    let Some(db_guard) = db.lock().ok() else {
        return;
    };
    let repo = SqliteSyncStateRepository::new(db_guard.writer());
    let mut state = repo
        .get(account_id, SYNC_STATE_SCOPE)
        .ok()
        .flatten()
        .unwrap_or_else(|| SyncState {
            account_id: account_id.clone(),
            scope_key: SYNC_STATE_SCOPE.to_string(),
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
    let _ = repo.save(&state);
}

fn increment_error_count(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    error: &crate::commands::dto::AppError,
) -> RetryBackoffState {
    let Some(db_guard) = db.lock().ok() else {
        return RetryBackoffState {
            error_count: 1,
            next_retry_at: None,
            retry_in_seconds: calculate_backoff_secs(1),
        };
    };
    let repo = SqliteSyncStateRepository::new(db_guard.writer());
    let mut state = repo
        .get(account_id, SYNC_STATE_SCOPE)
        .ok()
        .flatten()
        .unwrap_or_else(|| SyncState {
            account_id: account_id.clone(),
            scope_key: SYNC_STATE_SCOPE.to_string(),
            timestamp_usec: None,
            continuation: None,
            etag: None,
            last_modified: None,
            last_success_at: None,
            last_error: None,
            error_count: 0,
            next_retry_at: None,
        });
    state.error_count += 1;
    state.last_error = Some(error.to_string());
    // Set next_retry_at for the backoff check
    let backoff_secs = calculate_backoff_secs(state.error_count);
    let next_retry = chrono::Utc::now() + chrono::Duration::seconds(backoff_secs as i64);
    let next_retry_at = next_retry.to_rfc3339();
    state.next_retry_at = Some(next_retry_at.clone());
    let _ = repo.save(&state);
    RetryBackoffState {
        error_count: state.error_count,
        next_retry_at: Some(next_retry_at),
        retry_in_seconds: backoff_secs,
    }
}

fn calculate_backoff_secs(error_count: i32) -> u64 {
    let base: u64 = 60; // 1 minute base
    let multiplier = 1u64.checked_shl(error_count.min(10) as u32).unwrap_or(1024);
    (base * multiplier).min(MAX_BACKOFF.as_secs())
}

pub async fn wait_for_automatic_sync_enabled(
    automatic_sync_enabled: &std::sync::atomic::AtomicBool,
    automatic_sync_notify: &tokio::sync::Notify,
) {
    while !automatic_sync_enabled.load(Ordering::SeqCst) {
        automatic_sync_notify.notified().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};
    use tokio::sync::Notify;

    #[tokio::test]
    async fn wait_for_automatic_sync_enabled_returns_immediately_when_already_enabled() {
        let automatic_sync_enabled = AtomicBool::new(true);
        let automatic_sync_notify = Notify::new();

        tokio::time::timeout(
            Duration::from_millis(50),
            wait_for_automatic_sync_enabled(&automatic_sync_enabled, &automatic_sync_notify),
        )
        .await
        .expect("should not wait when automatic sync is already enabled");
    }

    #[tokio::test]
    async fn wait_for_automatic_sync_enabled_waits_for_notification() {
        let automatic_sync_enabled = std::sync::Arc::new(AtomicBool::new(false));
        let automatic_sync_notify = std::sync::Arc::new(Notify::new());

        let enabled = automatic_sync_enabled.clone();
        let notify = automatic_sync_notify.clone();
        let waiter = tokio::spawn(async move {
            wait_for_automatic_sync_enabled(enabled.as_ref(), notify.as_ref()).await;
        });

        tokio::time::sleep(Duration::from_millis(10)).await;
        automatic_sync_enabled.store(true, Ordering::SeqCst);
        automatic_sync_notify.notify_waiters();

        tokio::time::timeout(Duration::from_millis(50), waiter)
            .await
            .expect("waiter should complete after notify")
            .expect("wait task should not panic");
    }

    #[test]
    fn account_interval_uses_sync_interval_secs() {
        let account = Account {
            id: AccountId::new(),
            kind: crate::domain::provider::ProviderKind::Local,
            name: "test".to_string(),
            server_url: None,
            username: None,
            sync_interval_secs: 900,
            sync_on_wake: false,
            keep_read_items_days: 30,
        };
        assert_eq!(account_interval(&account), Duration::from_secs(900));
    }

    #[test]
    fn account_interval_defaults_to_3600_when_zero() {
        let account = Account {
            id: AccountId::new(),
            kind: crate::domain::provider::ProviderKind::Local,
            name: "test".to_string(),
            server_url: None,
            username: None,
            sync_interval_secs: 0,
            sync_on_wake: false,
            keep_read_items_days: 30,
        };
        assert_eq!(account_interval(&account), Duration::from_secs(3600));
    }

    #[test]
    fn calculate_backoff_increases_exponentially() {
        let account = Account {
            id: AccountId::new(),
            kind: crate::domain::provider::ProviderKind::Local,
            name: "test".to_string(),
            server_url: None,
            username: None,
            sync_interval_secs: 60,
            sync_on_wake: false,
            keep_read_items_days: 30,
        };
        assert_eq!(calculate_backoff(&account, 0), Duration::from_secs(60));
        assert_eq!(calculate_backoff(&account, 1), Duration::from_secs(120));
        assert_eq!(calculate_backoff(&account, 2), Duration::from_secs(240));
        assert_eq!(calculate_backoff(&account, 3), Duration::from_secs(480));
    }

    #[test]
    fn calculate_backoff_caps_at_max() {
        let account = Account {
            id: AccountId::new(),
            kind: crate::domain::provider::ProviderKind::Local,
            name: "test".to_string(),
            server_url: None,
            username: None,
            sync_interval_secs: 60,
            sync_on_wake: false,
            keep_read_items_days: 30,
        };
        assert_eq!(calculate_backoff(&account, 20), MAX_BACKOFF);
    }

    #[test]
    fn calculate_backoff_secs_caps_at_max() {
        assert!(calculate_backoff_secs(20) <= MAX_BACKOFF.as_secs());
    }
}
