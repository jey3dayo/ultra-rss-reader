use std::collections::{HashMap, HashSet};
use std::panic::AssertUnwindSafe;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use futures::FutureExt;
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::dto::{
    AccountSyncWarning, AccountSyncWarningDetail, AccountSyncWarningKind, AppError,
    SyncProgressKind,
};
use crate::commands::sync_commands::{
    log_background_sync_outcome, log_sync_failure, log_sync_panic, plan_finish, purge_old_articles,
    sync_account, FinishInput, SyncEntry, SyncProgressReporter, SyncTrigger, SYNC_COMPLETED_EVENT,
    SYNC_SUCCEEDED_EVENT, SYNC_WARNING_EVENT,
};
use crate::domain::account::Account;
#[cfg(test)]
use crate::domain::error::PROVIDER_RETRY_AFTER_MAX_SECONDS;
use crate::domain::error::{DomainError, DomainResult};
use crate::domain::types::AccountId;
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
#[cfg(test)]
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use crate::repository::account::AccountRepository;
#[cfg(test)]
use crate::repository::sync_state::{SyncState, SyncStateRepository, SyncStateScopeKey};

mod accounts;
mod backoff;
mod lifecycle;
mod outcomes;
mod scheduling;

#[cfg(test)]
use backoff::{
    backoff_persistence_failure_warning, calculate_backoff, calculate_backoff_secs,
    clear_invalid_next_retry_at, increment_error_count, retry_after_seconds_from_app_error,
};
use backoff::{
    complete_failed_account_sync, is_in_backoff, persisted_retry_next_sync, push_scheduler_warning,
    reset_error_count,
};
#[cfg(test)]
use scheduling::account_interval;
use scheduling::{
    acquire_scheduler_sync_guard, prune_deleted_account_schedules, schedule_completed_account_sync,
    schedule_failed_account_sync, select_due_accounts_for_tick, upsert_account_schedule,
    AccountSchedule,
};

use accounts::*;
use lifecycle::*;
pub use lifecycle::{drain_sync_scheduler_shutdown, request_sync_scheduler_shutdown};
use outcomes::*;

const SCHEDULER_TICK_INTERVAL_SECS: u64 = 10;
const DEFAULT_SYNC_INTERVAL_SECS: u64 = 3_600;
const MAX_BACKOFF_SHIFT_BITS: u32 = 10;
const MAX_BACKOFF_MULTIPLIER: u64 = 1 << MAX_BACKOFF_SHIFT_BITS;

const TICK_INTERVAL: Duration = Duration::from_secs(SCHEDULER_TICK_INTERVAL_SECS);
const MAX_BACKOFF: Duration = Duration::from_secs(DEFAULT_SYNC_INTERVAL_SECS);
const MAX_SCHEDULER_WARNINGS_PER_TICK: usize = 16;
const MAX_ACCOUNTS_PER_SCHEDULER_TICK: usize = 1;
static INVALID_NEXT_RETRY_CLEANUP_FAILURES: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
static SCHEDULER_LIFECYCLE: OnceLock<Mutex<SchedulerLifecycle>> = OnceLock::new();

const RETRY_AFTER_MESSAGE_PREFIX: &str = "Rate limit error: HTTP 429 ";

/// Start a background task that periodically syncs accounts based on their
/// individual `sync_interval_secs` settings.
///
/// Each account is tracked independently. On failure, exponential backoff
/// is applied using `sync_state.error_count`. On success, `error_count` is
/// reset and the next sync is scheduled at `now + sync_interval_secs`.
pub fn start_sync_scheduler(_db: &Mutex<DbManager>, app_handle: AppHandle) {
    tracing::info!("Starting background sync scheduler");

    let scheduler_start = {
        let Ok(mut lifecycle) = scheduler_lifecycle().lock() else {
            tracing::warn!("Background sync scheduler start skipped: lifecycle lock poisoned");
            return;
        };
        let Some(scheduler_start) = prepare_scheduler_start(&mut lifecycle) else {
            tracing::warn!("Background sync scheduler already running; duplicate start skipped");
            return;
        };
        scheduler_start
    };

    let shutdown = scheduler_start.shutdown;
    let running = scheduler_start.running;
    let task = tauri::async_runtime::spawn(async move {
        let _running_guard = SchedulerTaskRunningGuard(running);
        let state = app_handle.state::<crate::commands::AppState>();
        tracing::info!("Background sync is locked until the first manual sync completes");

        tokio::select! {
            () = wait_for_automatic_sync_enabled(
                state.automatic_sync_enabled.as_ref(),
                state.automatic_sync_notify.as_ref(),
            ) => {}
            () = shutdown.wait() => {
                tracing::info!("Background sync scheduler stopped before automatic sync was enabled");
                return;
            }
        }

        let mut schedules: HashMap<String, AccountSchedule> = HashMap::new();

        loop {
            tokio::select! {
                () = tokio::time::sleep(TICK_INTERVAL) => {}
                () = shutdown.wait() => {
                    tracing::info!("Background sync scheduler stopped");
                    return;
                }
            }

            run_scheduler_tick(&app_handle, state.inner(), &mut schedules).await;
        }
    });

    let Ok(mut lifecycle) = scheduler_lifecycle().lock() else {
        tracing::warn!("Background sync scheduler start skipped: lifecycle lock poisoned");
        task.abort();
        return;
    };
    register_scheduler_task(&mut lifecycle, task);
}

async fn run_scheduler_tick(
    app_handle: &AppHandle,
    state: &crate::commands::AppState,
    schedules: &mut HashMap<String, AccountSchedule>,
) {
    if !state.automatic_sync_enabled.load(Ordering::SeqCst) {
        return;
    }

    let accounts: Vec<Account> = match load_scheduler_accounts(&state.db) {
        Ok(accounts) => accounts,
        Err(error) => {
            tracing::warn!("Skipping scheduled sync: failed to load accounts: {error}");
            if let Err(emit_error) = app_handle.emit(
                SYNC_WARNING_EVENT,
                vec![scheduler_load_failure_warning(&error)],
            ) {
                tracing::warn!("Failed to emit sync-warning event: {emit_error}");
            }
            return;
        }
    };

    let now = Instant::now();
    refresh_account_schedules(&state.db, schedules, &accounts, now);

    let due_accounts = select_scheduler_due_accounts(&state.db, &accounts, schedules, now);
    if due_accounts.is_empty() {
        return;
    }

    // Skip if another sync (manual) is already in progress
    let _sync_guard = match acquire_scheduler_sync_guard(state.syncing.as_ref()) {
        Some(guard) => guard,
        None => {
            tracing::debug!("Skipping scheduled sync: manual sync in progress");
            return;
        }
    };

    let mut any_synced = false;
    let mut all_succeeded = true;
    let mut warnings_to_emit = Vec::new();
    let reporter = SyncProgressReporter::new(
        app_handle.clone(),
        SyncProgressKind::Automatic,
        due_accounts.len(),
    );
    reporter.emit_started(None);

    for account in due_accounts {
        reporter.emit_account_started(account);
        let result = AssertUnwindSafe(sync_account(&state.db, account))
            .catch_unwind()
            .await;

        match result {
            Ok(Ok(outcome)) => {
                reporter.emit_account_finished(account, true);
                let diagnostic_warnings = outcome
                    .warnings
                    .iter()
                    .map(|warning| AccountSyncWarning {
                        account_id: account.id.as_ref().to_string(),
                        account_name: account.name.clone(),
                        kind: warning.kind,
                        message: warning.message.clone(),
                        retry_at: warning.retry_at.clone(),
                        retry_in_seconds: warning.retry_in_seconds,
                        detail: warning.detail.clone(),
                    })
                    .collect();
                let account_succeeded = handle_scheduled_sync_success(
                    &state.db,
                    schedules,
                    account,
                    diagnostic_warnings,
                    &mut warnings_to_emit,
                );
                any_synced = true;
                if !account_succeeded {
                    all_succeeded = false;
                }
            }
            Ok(Err(error)) => {
                handle_scheduled_sync_failure(
                    &state.db,
                    schedules,
                    account,
                    &error,
                    &reporter,
                    &mut warnings_to_emit,
                );
                all_succeeded = false;
            }
            Err(_) => {
                handle_scheduled_sync_panic(
                    &state.db,
                    schedules,
                    account,
                    &reporter,
                    &mut warnings_to_emit,
                );
                all_succeeded = false;
            }
        }
    }

    reporter.emit_finished(any_synced);

    emit_scheduler_tick_finish(
        app_handle,
        &state.db,
        any_synced,
        all_succeeded,
        warnings_to_emit,
    );
}

fn refresh_account_schedules(
    db: &Mutex<DbManager>,
    schedules: &mut HashMap<String, AccountSchedule>,
    accounts: &[Account],
    now: Instant,
) {
    prune_deleted_account_schedules(schedules, accounts);

    // Ensure every account has a schedule entry and keep existing
    // entries aligned with account setting changes.
    for account in accounts {
        let id = account.id.as_ref().to_string();
        let persisted_retry_next_sync = persisted_retry_next_sync(db, &account.id, now);
        upsert_account_schedule(schedules, id, account, now, persisted_retry_next_sync);
    }
}

fn select_scheduler_due_accounts<'a>(
    db: &Mutex<DbManager>,
    accounts: &'a [Account],
    schedules: &HashMap<String, AccountSchedule>,
    now: Instant,
) -> Vec<&'a Account> {
    select_due_accounts_for_tick(accounts, schedules, now, usize::MAX)
        .into_iter()
        .filter(|account| !is_in_backoff(db, &account.id))
        .filter(|account| !backoff::waiting_for_credential_access(db, account))
        .take(MAX_ACCOUNTS_PER_SCHEDULER_TICK)
        .collect()
}

pub async fn wait_for_automatic_sync_enabled(
    automatic_sync_enabled: &std::sync::atomic::AtomicBool,
    automatic_sync_notify: &tokio::sync::Notify,
) {
    loop {
        let notified = automatic_sync_notify.notified();
        tokio::pin!(notified);
        // Register the waiter before checking the flag so an
        // enable_automatic_sync() that lands between the check and the
        // await cannot be missed (lost wakeup).
        notified.as_mut().enable();
        if automatic_sync_enabled.load(Ordering::SeqCst) {
            return;
        }
        notified.await;
    }
}

#[cfg(test)]
mod tests;
