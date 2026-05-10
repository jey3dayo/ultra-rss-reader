use std::collections::{HashMap, HashSet};
use std::panic::AssertUnwindSafe;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use futures::FutureExt;
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::dto::{
    AccountSyncWarning, AccountSyncWarningKind, AppError, SyncProgressKind,
};
use crate::commands::sync_commands::{
    purge_old_articles, sync_account, SyncProgressReporter, SYNC_COMPLETED_EVENT,
    SYNC_SUCCEEDED_EVENT, SYNC_WARNING_EVENT,
};
use crate::domain::account::Account;
use crate::domain::error::{DomainError, DomainResult};
use crate::domain::types::AccountId;
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use crate::repository::account::AccountRepository;
use crate::repository::sync_state::{SyncState, SyncStateRepository, SyncStateScopeKey};

const SCHEDULER_TICK_INTERVAL_SECS: u64 = 10;
const DEFAULT_SYNC_INTERVAL_SECS: u64 = 3_600;
const MAX_BACKOFF_SHIFT_BITS: u32 = 10;
const MAX_BACKOFF_MULTIPLIER: u64 = 1 << MAX_BACKOFF_SHIFT_BITS;

const TICK_INTERVAL: Duration = Duration::from_secs(SCHEDULER_TICK_INTERVAL_SECS);
const MAX_BACKOFF: Duration = Duration::from_secs(DEFAULT_SYNC_INTERVAL_SECS);
const MAX_SCHEDULER_WARNINGS_PER_TICK: usize = 16;
static INVALID_NEXT_RETRY_CLEANUP_FAILURES: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
static SCHEDULER_LIFECYCLE: OnceLock<Mutex<SchedulerLifecycle>> = OnceLock::new();

/// Per-account scheduling state kept in memory.
struct AccountSchedule {
    next_sync: Instant,
    interval: Duration,
}

#[derive(Debug)]
struct RetryBackoffState {
    error_count: i32,
    next_retry_at: Option<String>,
    retry_in_seconds: u64,
    retry_warning_changed: bool,
}

const RETRY_AFTER_MESSAGE_MARKER: &str = "retry_after_seconds=";
const RETRY_AFTER_MESSAGE_PREFIX: &str = "Rate limit error: HTTP 429 ";

struct SchedulerSyncGuard<'a>(&'a std::sync::atomic::AtomicBool);

impl Drop for SchedulerSyncGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

#[derive(Clone)]
struct SchedulerShutdown {
    requested: Arc<AtomicBool>,
    notify: Arc<tokio::sync::Notify>,
}

impl SchedulerShutdown {
    fn new() -> Self {
        Self {
            requested: Arc::new(AtomicBool::new(false)),
            notify: Arc::new(tokio::sync::Notify::new()),
        }
    }

    fn request(&self) {
        self.requested.store(true, Ordering::SeqCst);
        self.notify.notify_waiters();
    }

    fn is_requested(&self) -> bool {
        self.requested.load(Ordering::SeqCst)
    }

    async fn wait(&self) {
        while !self.is_requested() {
            self.notify.notified().await;
        }
    }
}

struct SchedulerLifecycle {
    task: Option<JoinHandle<()>>,
    shutdown: SchedulerShutdown,
    running: Arc<AtomicBool>,
}

impl Default for SchedulerLifecycle {
    fn default() -> Self {
        Self {
            task: None,
            shutdown: SchedulerShutdown::new(),
            running: Arc::new(AtomicBool::new(false)),
        }
    }
}

struct SchedulerStart {
    shutdown: SchedulerShutdown,
    running: Arc<AtomicBool>,
}

struct SchedulerTaskRunningGuard(Arc<AtomicBool>);

impl Drop for SchedulerTaskRunningGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

fn scheduler_lifecycle() -> &'static Mutex<SchedulerLifecycle> {
    SCHEDULER_LIFECYCLE.get_or_init(|| Mutex::new(SchedulerLifecycle::default()))
}

fn clear_inactive_scheduler_task(lifecycle: &mut SchedulerLifecycle) {
    if lifecycle.task.is_some() && !lifecycle.running.load(Ordering::SeqCst) {
        lifecycle.task = None;
    }
}

fn prepare_scheduler_start(lifecycle: &mut SchedulerLifecycle) -> Option<SchedulerStart> {
    clear_inactive_scheduler_task(lifecycle);

    if lifecycle
        .running
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return None;
    }

    lifecycle.shutdown = SchedulerShutdown::new();
    Some(SchedulerStart {
        shutdown: lifecycle.shutdown.clone(),
        running: lifecycle.running.clone(),
    })
}

fn register_scheduler_task(lifecycle: &mut SchedulerLifecycle, task: JoinHandle<()>) {
    lifecycle.task = Some(task);
}

pub fn request_sync_scheduler_shutdown() {
    let Ok(mut lifecycle) = scheduler_lifecycle().lock() else {
        tracing::warn!("Background sync scheduler shutdown skipped: lifecycle lock poisoned");
        return;
    };
    clear_inactive_scheduler_task(&mut lifecycle);
    lifecycle.shutdown.request();
}

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

            if !state.automatic_sync_enabled.load(Ordering::SeqCst) {
                continue;
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
                    continue;
                }
            };

            let now = Instant::now();

            prune_deleted_account_schedules(&mut schedules, &accounts);

            // Ensure every account has a schedule entry and keep existing
            // entries aligned with account setting changes.
            for account in &accounts {
                let id = account.id.as_ref().to_string();
                upsert_account_schedule(&mut schedules, id, account, now);
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
            let sync_guard = match acquire_scheduler_sync_guard(state.syncing.as_ref()) {
                Some(guard) => guard,
                None => {
                    tracing::debug!("Skipping scheduled sync: manual sync in progress");
                    continue;
                }
            };
            let _sync_guard = sync_guard;

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
                            push_scheduler_warning(
                                &mut warnings_to_emit,
                                AccountSyncWarning {
                                    account_id: account.id.as_ref().to_string(),
                                    account_name: account.name.clone(),
                                    kind: warning.kind,
                                    message: warning.message.clone(),
                                    retry_at: warning.retry_at.clone(),
                                    retry_in_seconds: warning.retry_in_seconds,
                                },
                            );
                        }
                        reporter.emit_account_finished(account, true);
                        match load_scheduler_account(&state.db, &account.id) {
                            Ok(Some(latest_account)) => {
                                if let Err(error) = reset_error_count(&state.db, &account.id) {
                                    tracing::warn!(
                                        "Background sync could not reset backoff state for account '{}': {error}",
                                        account.name
                                    );
                                    all_succeeded = false;
                                }
                                schedule_completed_account_sync(
                                    &mut schedules,
                                    &latest_account,
                                    Instant::now(),
                                );
                            }
                            Ok(None) => {
                                tracing::info!(
                                    "Background sync completed for deleted account '{}'; pruning schedule",
                                    account.name
                                );
                                schedules.remove(&account_id_str);
                            }
                            Err(error) => {
                                tracing::warn!(
                                    "Background sync could not refresh account '{}' before rescheduling: {error}",
                                    account.name
                                );
                                all_succeeded = false;
                            }
                        }
                        any_synced = true;
                    }
                    Ok(Err(e)) => {
                        tracing::warn!(
                            "Background sync failed for account '{}': {e}",
                            account.name
                        );
                        reporter.emit_account_finished(account, false);
                        match load_scheduler_account(&state.db, &account.id) {
                            Ok(Some(latest_account)) => {
                                let backoff = complete_failed_account_sync(
                                    &state.db,
                                    &latest_account,
                                    &e,
                                    &mut warnings_to_emit,
                                );
                                schedule_failed_account_sync(
                                    &mut schedules,
                                    &latest_account,
                                    Instant::now(),
                                    backoff,
                                );
                            }
                            Ok(None) => {
                                tracing::info!(
                                    "Background sync failed for deleted account '{}'; pruning schedule",
                                    account.name
                                );
                                schedules.remove(&account_id_str);
                            }
                            Err(error) => {
                                tracing::warn!(
                                    "Background sync could not refresh account '{}' before scheduling retry: {error}",
                                    account.name
                                );
                            }
                        }
                        all_succeeded = false;
                    }
                    Err(_) => {
                        tracing::error!(
                            "Background sync panicked for account [redacted account], scheduler continues"
                        );
                        reporter.emit_account_finished(account, false);
                        let panic_error = AppError::UserVisible {
                            message: "Background sync panicked".to_string(),
                        };
                        match load_scheduler_account(&state.db, &account.id) {
                            Ok(Some(latest_account)) => {
                                let backoff = complete_failed_account_sync(
                                    &state.db,
                                    &latest_account,
                                    &panic_error,
                                    &mut warnings_to_emit,
                                );
                                schedule_failed_account_sync(
                                    &mut schedules,
                                    &latest_account,
                                    Instant::now(),
                                    backoff,
                                );
                            }
                            Ok(None) => {
                                tracing::info!(
                                    "Background sync panicked for deleted account [redacted account]; pruning schedule"
                                );
                                schedules.remove(&account_id_str);
                            }
                            Err(error) => {
                                tracing::warn!(
                                    "Background sync could not refresh account [redacted account] before scheduling retry after panic: {error}"
                                );
                            }
                        }
                        all_succeeded = false;
                    }
                }
            }

            reporter.emit_finished(any_synced);

            if !warnings_to_emit.is_empty() {
                if let Err(e) = app_handle.emit(SYNC_WARNING_EVENT, warnings_to_emit.clone()) {
                    tracing::warn!("Failed to emit sync-warning event: {e}");
                }
                all_succeeded = false;
            }

            if any_synced {
                if let Err(e) = app_handle.emit(SYNC_COMPLETED_EVENT, ()) {
                    tracing::warn!("Failed to emit sync-completed event: {e}");
                }
                if all_succeeded {
                    if let Err(e) = app_handle.emit(SYNC_SUCCEEDED_EVENT, ()) {
                        tracing::warn!("Failed to emit sync-succeeded event: {e}");
                    }
                }
                purge_old_articles(&state.db);
            }
        }
    });

    let Ok(mut lifecycle) = scheduler_lifecycle().lock() else {
        tracing::warn!("Background sync scheduler start skipped: lifecycle lock poisoned");
        task.abort();
        return;
    };
    register_scheduler_task(&mut lifecycle, task);
}

fn account_interval(account: &Account) -> Duration {
    let secs = if account.sync_interval_secs > 0 {
        account.sync_interval_secs as u64
    } else {
        DEFAULT_SYNC_INTERVAL_SECS
    };
    Duration::from_secs(secs)
}

fn acquire_scheduler_sync_guard(
    syncing: &std::sync::atomic::AtomicBool,
) -> Option<SchedulerSyncGuard<'_>> {
    syncing
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .ok()
        .map(|_| SchedulerSyncGuard(syncing))
}

fn upsert_account_schedule(
    schedules: &mut HashMap<String, AccountSchedule>,
    account_id: String,
    account: &Account,
    now: Instant,
) {
    let interval = account_interval(account);
    let next_sync = now + interval;
    match schedules.get_mut(&account_id) {
        Some(schedule) if schedule.interval != interval => {
            schedule.interval = interval;
            schedule.next_sync = next_sync;
        }
        Some(schedule) if schedule.next_sync > next_sync => {
            schedule.next_sync = next_sync;
        }
        Some(_) => {}
        None => {
            schedules.insert(
                account_id,
                AccountSchedule {
                    next_sync,
                    interval,
                },
            );
        }
    }
}

fn prune_deleted_account_schedules(
    schedules: &mut HashMap<String, AccountSchedule>,
    accounts: &[Account],
) {
    let account_ids: HashSet<&str> = accounts.iter().map(|a| a.id.as_ref()).collect();
    schedules.retain(|id, _| account_ids.contains(id.as_str()));
}

fn schedule_completed_account_sync(
    schedules: &mut HashMap<String, AccountSchedule>,
    account: &Account,
    now: Instant,
) {
    let interval = account_interval(account);
    let account_id = account.id.as_ref().to_string();
    schedules
        .entry(account_id)
        .and_modify(|schedule| {
            schedule.interval = interval;
            schedule.next_sync = now + interval;
        })
        .or_insert(AccountSchedule {
            next_sync: now + interval,
            interval,
        });
}

fn schedule_failed_account_sync(
    schedules: &mut HashMap<String, AccountSchedule>,
    account: &Account,
    now: Instant,
    backoff: Duration,
) {
    let interval = account_interval(account);
    let account_id = account.id.as_ref().to_string();
    schedules
        .entry(account_id)
        .and_modify(|schedule| {
            schedule.interval = interval;
            schedule.next_sync = now + backoff;
        })
        .or_insert(AccountSchedule {
            next_sync: now + backoff,
            interval,
        });
}

fn load_scheduler_accounts(db: &Mutex<DbManager>) -> DomainResult<Vec<Account>> {
    let db_guard = db
        .lock()
        .map_err(|error| DomainError::Persistence(format!("Lock error: {error}")))?;
    let repo = SqliteAccountRepository::new(db_guard.reader());
    repo.find_all().map(|accounts| {
        accounts
            .into_iter()
            .filter(|account| {
                !matches!(
                    account.kind,
                    crate::domain::provider::ProviderKind::Quarantined
                )
            })
            .collect()
    })
}

fn load_scheduler_account(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
) -> DomainResult<Option<Account>> {
    let db_guard = db
        .lock()
        .map_err(|error| DomainError::Persistence(format!("Lock error: {error}")))?;
    let repo = SqliteAccountRepository::new(db_guard.reader());
    repo.find_by_id(account_id)
}

fn scheduler_load_failure_warning(error: &DomainError) -> AccountSyncWarning {
    AccountSyncWarning {
        account_id: "scheduler".to_string(),
        account_name: "Scheduler".to_string(),
        kind: AccountSyncWarningKind::Generic,
        message: format!("Scheduled sync skipped because accounts could not be loaded: {error}"),
        retry_at: None,
        retry_in_seconds: None,
    }
}

fn backoff_persistence_failure_warning(
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

fn push_scheduler_warning(
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

fn complete_failed_account_sync(
    db: &Mutex<DbManager>,
    account: &Account,
    error: &crate::commands::dto::AppError,
    warnings_to_emit: &mut Vec<AccountSyncWarning>,
) -> Duration {
    let backoff_state = match increment_error_count(db, account, error) {
        Ok(backoff_state) => backoff_state,
        Err(error) => {
            tracing::warn!(
                "Background sync could not persist backoff state for account '{}': {error}",
                account.name
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
            },
        );
    }
    tracing::info!(
        "Account '{}' backoff: {}s (error_count={})",
        account.name,
        backoff.as_secs(),
        backoff_state.error_count
    );
    backoff
}

fn calculate_backoff(account: &Account, error_count: i32) -> Duration {
    Duration::from_secs(calculate_backoff_secs(account, error_count))
}

fn calculate_backoff_secs(account: &Account, error_count: i32) -> u64 {
    let base = account_interval(account).as_secs();
    let error_count = clamped_backoff_error_count(error_count);
    let multiplier = 1u64
        .checked_shl(error_count)
        .unwrap_or(MAX_BACKOFF_MULTIPLIER);
    base.saturating_mul(multiplier).min(MAX_BACKOFF.as_secs())
}

fn is_in_backoff(db: &Mutex<DbManager>, account_id: &AccountId) -> bool {
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
    INVALID_NEXT_RETRY_CLEANUP_FAILURES.get_or_init(|| Mutex::new(HashSet::new()))
}

fn invalid_next_retry_cleanup_key(state: &SyncState, invalid_next_retry_at: &str) -> String {
    format!(
        "{}\n{}\n{}",
        state.account_id.as_ref(),
        state.scope_key,
        invalid_next_retry_at
    )
}

fn clear_invalid_next_retry_at<R>(repo: &R, state: &mut SyncState)
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

fn reset_error_count(db: &Mutex<DbManager>, account_id: &AccountId) -> DomainResult<()> {
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

fn increment_error_count(
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

fn retry_after_seconds_from_app_error(error: &crate::commands::dto::AppError) -> Option<u64> {
    let message = match error {
        AppError::Retryable { message } => message,
        AppError::UserVisible { .. } => return None,
    };
    if !message.starts_with(RETRY_AFTER_MESSAGE_PREFIX) {
        return None;
    }
    let (_, value) = message.split_once(RETRY_AFTER_MESSAGE_MARKER)?;
    let value = value
        .split(|ch: char| !ch.is_ascii_digit())
        .next()
        .unwrap_or_default();
    if value.is_empty() {
        return None;
    }
    value.parse::<u64>().ok()
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
    use crate::commands::dto::AppError;
    use crate::domain::account::ConnectionVerificationStatus;
    use crate::infra::db::connection::DbManager;
    use rusqlite::params;
    use std::cell::Cell;
    use std::sync::atomic::{AtomicBool, Ordering};
    use tokio::sync::Notify;

    struct FailingCleanupRepo<'a> {
        save_attempts: &'a Cell<usize>,
    }

    impl SyncStateRepository for FailingCleanupRepo<'_> {
        fn get<K>(&self, _account_id: &AccountId, _scope_key: K) -> DomainResult<Option<SyncState>>
        where
            K: Into<SyncStateScopeKey>,
        {
            Ok(None)
        }

        fn save(&self, _state: &SyncState) -> DomainResult<()> {
            self.save_attempts.set(self.save_attempts.get() + 1);
            Err(DomainError::Persistence("cleanup failed".to_string()))
        }
    }

    fn test_account(sync_interval_secs: i64) -> Account {
        Account {
            id: AccountId::new(),
            kind: crate::domain::provider::ProviderKind::Local,
            name: "test".to_string(),
            server_url: None,
            username: None,
            sync_interval_secs,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Unverified,
            connection_verified_at: None,
            connection_verification_error: None,
        }
    }

    fn test_db() -> DbManager {
        DbManager::new_in_memory().unwrap()
    }

    fn insert_test_account(db: &DbManager, account_id: &AccountId) {
        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                params![account_id.0, "Local", "Test"],
            )
            .unwrap();
    }

    fn set_test_account_sync_interval(db: &DbManager, account_id: &AccountId, interval_secs: i64) {
        db.writer()
            .execute(
                "UPDATE accounts SET sync_interval_secs = ?1 WHERE id = ?2",
                params![interval_secs, account_id.0],
            )
            .unwrap();
    }

    fn delete_test_account(db: &DbManager, account_id: &AccountId) {
        db.writer()
            .execute("DELETE FROM accounts WHERE id = ?1", params![account_id.0])
            .unwrap();
    }

    fn insert_sync_state_error_count(db: &DbManager, account_id: &AccountId, error_count: i32) {
        db.writer()
            .execute(
                "INSERT INTO sync_state (account_id, scope_key, error_count) VALUES (?1, ?2, ?3)",
                params![
                    account_id.0,
                    SyncStateScopeKey::scheduler().as_string(),
                    error_count
                ],
            )
            .unwrap();
    }

    fn insert_scheduler_sync_state(
        db: &DbManager,
        account_id: &AccountId,
        error_count: i32,
        next_retry_at: Option<&str>,
    ) {
        db.writer()
            .execute(
                "INSERT INTO sync_state (account_id, scope_key, error_count, next_retry_at) VALUES (?1, ?2, ?3, ?4)",
                params![
                    account_id.0,
                    SyncStateScopeKey::scheduler().as_string(),
                    error_count,
                    next_retry_at,
                ],
            )
            .unwrap();
    }

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
        let account = test_account(900);
        assert_eq!(account_interval(&account), Duration::from_secs(900));
    }

    #[test]
    fn account_interval_defaults_to_3600_when_zero() {
        let account = test_account(0);
        assert_eq!(
            account_interval(&account),
            Duration::from_secs(DEFAULT_SYNC_INTERVAL_SECS)
        );
    }

    #[test]
    fn prune_deleted_account_schedules_removes_accounts_missing_from_latest_snapshot() {
        let retained = Account {
            id: AccountId("retained-account".to_string()),
            kind: crate::domain::provider::ProviderKind::Local,
            name: "Retained".to_string(),
            server_url: None,
            username: None,
            sync_interval_secs: 60,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Unverified,
            connection_verified_at: None,
            connection_verification_error: None,
        };
        let mut schedules = HashMap::from([
            (
                retained.id.as_ref().to_string(),
                AccountSchedule {
                    next_sync: Instant::now(),
                    interval: Duration::from_secs(60),
                },
            ),
            (
                "deleted-account".to_string(),
                AccountSchedule {
                    next_sync: Instant::now(),
                    interval: Duration::from_secs(60),
                },
            ),
        ]);

        prune_deleted_account_schedules(&mut schedules, &[retained]);

        assert!(schedules.contains_key("retained-account"));
        assert!(!schedules.contains_key("deleted-account"));
    }

    #[test]
    fn upsert_account_schedule_recalculates_existing_entry_when_interval_changes() {
        let mut account = test_account(3_600);
        account.id = AccountId("rescheduled-account".to_string());
        let now = Instant::now();
        let old_next_sync = now + Duration::from_secs(3_600);
        let mut schedules = HashMap::from([(
            account.id.as_ref().to_string(),
            AccountSchedule {
                next_sync: old_next_sync,
                interval: Duration::from_secs(3_600),
            },
        )]);

        account.sync_interval_secs = 60;
        upsert_account_schedule(
            &mut schedules,
            account.id.as_ref().to_string(),
            &account,
            now,
        );

        let schedule = schedules
            .get(account.id.as_ref())
            .expect("existing schedule should remain");
        assert_eq!(schedule.interval, Duration::from_secs(60));
        assert_eq!(schedule.next_sync, now + Duration::from_secs(60));
    }

    #[test]
    fn interval_change_keeps_active_backoff_as_higher_priority_gate() {
        let db = std::sync::Mutex::new(test_db());
        let mut account = test_account(3_600);
        account.id = AccountId("backoff-account".to_string());
        let now = Instant::now();
        let mut schedules = HashMap::from([(
            account.id.as_ref().to_string(),
            AccountSchedule {
                next_sync: now + Duration::from_secs(3_600),
                interval: Duration::from_secs(3_600),
            },
        )]);
        {
            let db_guard = db.lock().unwrap();
            insert_test_account(&db_guard, &account.id);
            insert_scheduler_sync_state(
                &db_guard,
                &account.id,
                2,
                Some(&(chrono::Utc::now() + chrono::Duration::minutes(30)).to_rfc3339()),
            );
        }

        account.sync_interval_secs = 60;
        upsert_account_schedule(
            &mut schedules,
            account.id.as_ref().to_string(),
            &account,
            now,
        );

        let schedule = schedules
            .get(account.id.as_ref())
            .expect("existing schedule should remain");
        assert_eq!(schedule.interval, Duration::from_secs(60));
        assert_eq!(schedule.next_sync, now + Duration::from_secs(60));
        assert!(
            is_in_backoff(&db, &account.id),
            "active persisted backoff should still suppress the rescheduled account"
        );
    }

    #[test]
    fn completed_sync_reschedule_uses_refreshed_account_interval() {
        let db = std::sync::Mutex::new(test_db());
        let mut stale_account = test_account(3_600);
        stale_account.id = AccountId("interval-after-success".to_string());
        let due_at = Instant::now();
        let mut schedules = HashMap::from([(
            stale_account.id.as_ref().to_string(),
            AccountSchedule {
                next_sync: due_at,
                interval: account_interval(&stale_account),
            },
        )]);
        {
            let db_guard = db.lock().unwrap();
            insert_test_account(&db_guard, &stale_account.id);
            set_test_account_sync_interval(&db_guard, &stale_account.id, 60);
        }

        let latest_account = load_scheduler_account(&db, &stale_account.id)
            .expect("latest account should load")
            .expect("account should still exist");
        let rescheduled_at = Instant::now();
        schedule_completed_account_sync(&mut schedules, &latest_account, rescheduled_at);

        let schedule = schedules
            .get(stale_account.id.as_ref())
            .expect("account schedule should remain");
        assert_eq!(schedule.interval, Duration::from_secs(60));
        assert_eq!(
            schedule.next_sync,
            rescheduled_at + Duration::from_secs(60),
            "completed sync should not reuse the stale due-account interval"
        );
    }

    #[test]
    fn failed_sync_retry_uses_refreshed_account_interval_for_backoff() {
        let db = std::sync::Mutex::new(test_db());
        let mut stale_account = test_account(3_600);
        stale_account.id = AccountId("interval-after-failure".to_string());
        let due_at = Instant::now();
        let mut schedules = HashMap::from([(
            stale_account.id.as_ref().to_string(),
            AccountSchedule {
                next_sync: due_at,
                interval: account_interval(&stale_account),
            },
        )]);
        {
            let db_guard = db.lock().unwrap();
            insert_test_account(&db_guard, &stale_account.id);
            set_test_account_sync_interval(&db_guard, &stale_account.id, 60);
        }
        let latest_account = load_scheduler_account(&db, &stale_account.id)
            .expect("latest account should load")
            .expect("account should still exist");
        let mut warnings = Vec::new();

        let backoff = complete_failed_account_sync(
            &db,
            &latest_account,
            &AppError::UserVisible {
                message: "sync failed".to_string(),
            },
            &mut warnings,
        );
        let retry_scheduled_at = Instant::now();
        schedule_failed_account_sync(&mut schedules, &latest_account, retry_scheduled_at, backoff);

        let schedule = schedules
            .get(stale_account.id.as_ref())
            .expect("account schedule should remain");
        assert_eq!(backoff, Duration::from_secs(120));
        assert_eq!(schedule.interval, Duration::from_secs(60));
        assert_eq!(
            schedule.next_sync,
            retry_scheduled_at + Duration::from_secs(120),
            "failed sync should calculate retry from the refreshed account interval"
        );
        assert_eq!(warnings[0].retry_in_seconds, Some(120));
    }

    #[test]
    fn sync_completion_prunes_schedule_when_account_was_deleted_in_flight() {
        let db = std::sync::Mutex::new(test_db());
        let mut account = test_account(60);
        account.id = AccountId("deleted-in-flight".to_string());
        let mut schedules = HashMap::from([(
            account.id.as_ref().to_string(),
            AccountSchedule {
                next_sync: Instant::now(),
                interval: account_interval(&account),
            },
        )]);
        {
            let db_guard = db.lock().unwrap();
            insert_test_account(&db_guard, &account.id);
            delete_test_account(&db_guard, &account.id);
        }

        let latest_account = load_scheduler_account(&db, &account.id)
            .expect("deleted account lookup should not fail");
        if latest_account.is_none() {
            schedules.remove(account.id.as_ref());
        }

        assert!(
            !schedules.contains_key(account.id.as_ref()),
            "deleted account should not keep an in-memory schedule after in-flight sync finishes"
        );
    }

    #[test]
    fn sync_completion_does_not_reschedule_from_stale_snapshot_when_refresh_fails() {
        let db = std::sync::Mutex::new(test_db());
        let mut account = test_account(3_600);
        account.id = AccountId("refresh-failure".to_string());
        let due_at = Instant::now();
        let mut schedules = HashMap::from([(
            account.id.as_ref().to_string(),
            AccountSchedule {
                next_sync: due_at,
                interval: account_interval(&account),
            },
        )]);
        let poison_result = std::panic::catch_unwind(|| {
            let _guard = db.lock().unwrap();
            panic!("poison scheduler account refresh");
        });
        assert!(poison_result.is_err());

        let refresh_error = load_scheduler_account(&db, &account.id)
            .expect_err("poisoned lock should prevent account refresh");
        assert!(matches!(refresh_error, DomainError::Persistence(_)));

        let schedule = schedules
            .remove(account.id.as_ref())
            .expect("schedule should remain untouched after refresh failure");
        assert_eq!(schedule.interval, Duration::from_secs(3_600));
        assert_eq!(
            schedule.next_sync, due_at,
            "refresh failure should not overwrite the schedule with a stale snapshot"
        );
    }

    #[test]
    fn scheduler_sync_guard_sets_and_releases_syncing_flag() {
        let syncing = AtomicBool::new(false);

        {
            let guard = acquire_scheduler_sync_guard(&syncing)
                .expect("scheduler should acquire an idle sync flag");
            assert!(syncing.load(Ordering::SeqCst));
            assert!(
                acquire_scheduler_sync_guard(&syncing).is_none(),
                "scheduler guard should exclude overlapping sync and vacuum work"
            );
            drop(guard);
        }

        assert!(!syncing.load(Ordering::SeqCst));
    }

    #[test]
    fn scheduler_sync_guard_releases_syncing_flag_when_sync_panics() {
        let syncing = AtomicBool::new(false);

        let panic_result = std::panic::catch_unwind(|| {
            let _guard = acquire_scheduler_sync_guard(&syncing)
                .expect("scheduler should acquire an idle sync flag");
            panic!("simulated background sync panic");
        });

        assert!(panic_result.is_err());
        assert!(
            !syncing.load(Ordering::SeqCst),
            "scheduler guard should release the sync flag during panic unwinding"
        );
    }

    #[tokio::test]
    async fn scheduler_shutdown_wakes_waiting_lifecycle_task() {
        let shutdown = SchedulerShutdown::new();
        let waiter_shutdown = shutdown.clone();
        let waiter = tokio::spawn(async move {
            waiter_shutdown.wait().await;
        });

        tokio::time::sleep(Duration::from_millis(10)).await;
        shutdown.request();

        tokio::time::timeout(Duration::from_millis(50), waiter)
            .await
            .expect("shutdown waiter should complete after request")
            .expect("shutdown waiter task should not panic");
    }

    #[tokio::test]
    async fn scheduler_lifecycle_rejects_duplicate_running_task_start() {
        let mut lifecycle = SchedulerLifecycle::default();
        let first_start =
            prepare_scheduler_start(&mut lifecycle).expect("first start should be accepted");
        let first_shutdown = first_start.shutdown;
        let first_running = first_start.running;
        let first_task = tauri::async_runtime::spawn(async move {
            let _running_guard = SchedulerTaskRunningGuard(first_running);
            first_shutdown.wait().await;
        });
        register_scheduler_task(&mut lifecycle, first_task);

        let duplicate_start = prepare_scheduler_start(&mut lifecycle);

        assert!(
            duplicate_start.is_none(),
            "running scheduler task should make duplicate start a no-op"
        );
        lifecycle.shutdown.request();
        let task = lifecycle
            .task
            .take()
            .expect("registered scheduler task should remain available for shutdown drain");
        tokio::time::timeout(Duration::from_millis(50), task)
            .await
            .expect("registered scheduler task should drain after shutdown request")
            .expect("registered scheduler task should not panic");
    }

    #[tokio::test]
    async fn scheduler_lifecycle_allows_restart_after_task_cancellation() {
        let mut lifecycle = SchedulerLifecycle::default();
        let scheduler_start =
            prepare_scheduler_start(&mut lifecycle).expect("first start should be accepted");
        let shutdown = scheduler_start.shutdown;
        let running = scheduler_start.running;
        let task = tauri::async_runtime::spawn(async move {
            let _running_guard = SchedulerTaskRunningGuard(running);
            shutdown.wait().await;
        });
        register_scheduler_task(&mut lifecycle, task);

        lifecycle
            .task
            .as_ref()
            .expect("registered scheduler task should exist")
            .abort();
        let task = lifecycle
            .task
            .take()
            .expect("registered scheduler task should remain available after abort");
        task.await.expect_err("aborted scheduler task should stop");
        lifecycle.running.store(false, Ordering::SeqCst);

        assert!(
            prepare_scheduler_start(&mut lifecycle).is_some(),
            "aborted scheduler task should not permanently block restart"
        );
    }

    #[tokio::test]
    async fn scheduler_lifecycle_allows_restart_after_task_panic() {
        let mut lifecycle = SchedulerLifecycle::default();
        let scheduler_start =
            prepare_scheduler_start(&mut lifecycle).expect("first start should be accepted");
        let running = scheduler_start.running;
        let task = tauri::async_runtime::spawn(async move {
            let _running_guard = SchedulerTaskRunningGuard(running);
            panic!("simulated scheduler task panic");
        });
        register_scheduler_task(&mut lifecycle, task);

        let task = lifecycle
            .task
            .take()
            .expect("registered scheduler task should remain available after panic");
        task.await.expect_err("panicked scheduler task should stop");

        assert!(
            prepare_scheduler_start(&mut lifecycle).is_some(),
            "panicked scheduler task should be cleared before duplicate-start checks"
        );
    }

    #[test]
    fn load_scheduler_accounts_surfaces_database_lock_errors() {
        let db = std::sync::Mutex::new(test_db());
        let poison_result = std::panic::catch_unwind(|| {
            let _guard = db.lock().unwrap();
            panic!("poison scheduler db lock");
        });
        assert!(poison_result.is_err());

        let error = load_scheduler_accounts(&db).expect_err("poisoned lock should be returned");

        assert!(matches!(error, DomainError::Persistence(_)));
    }

    #[test]
    fn load_scheduler_accounts_skips_invalid_account_rows() {
        let db = std::sync::Mutex::new(test_db());
        {
            let db_guard = db.lock().unwrap();
            db_guard
                .writer()
                .execute(
                    "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                    params!["account-with-invalid-kind", "InvalidProvider", "Invalid"],
                )
                .unwrap();
        }

        let accounts =
            load_scheduler_accounts(&db).expect("invalid account rows should be skipped");

        assert!(accounts.is_empty());
    }

    #[test]
    fn scheduler_load_failure_warning_is_observable_as_generic_scheduler_warning() {
        let error = DomainError::Persistence("Lock error: poisoned".to_string());

        let warning = scheduler_load_failure_warning(&error);

        assert_eq!(warning.account_id, "scheduler");
        assert_eq!(warning.account_name, "Scheduler");
        assert_eq!(warning.kind, AccountSyncWarningKind::Generic);
        assert_eq!(
            warning.message,
            "Scheduled sync skipped because accounts could not be loaded: Persistence error: Lock error: poisoned"
        );
        assert_eq!(warning.retry_at, None);
        assert_eq!(warning.retry_in_seconds, None);
    }

    #[test]
    fn scheduler_load_failure_warning_serializes_to_sync_warning_contract() {
        let error = DomainError::Persistence("Lock error: poisoned".to_string());

        let value = serde_json::to_value(scheduler_load_failure_warning(&error))
            .expect("warning should serialize");

        assert_eq!(value["account_id"], "scheduler");
        assert_eq!(value["account_name"], "Scheduler");
        assert_eq!(value["kind"], "generic");
        assert!(value["message"]
            .as_str()
            .expect("message should be a string")
            .starts_with("Scheduled sync skipped because accounts could not be loaded:"));
        assert!(value["retry_at"].is_null());
        assert!(value["retry_in_seconds"].is_null());
    }

    #[test]
    fn backoff_persistence_failure_warning_is_observable_as_generic_account_warning() {
        let account = test_account(60);
        let error = DomainError::Persistence("FOREIGN KEY constraint failed".to_string());

        let warning = backoff_persistence_failure_warning(&account, &error);

        assert_eq!(warning.account_id, account.id.as_ref());
        assert_eq!(warning.account_name, account.name);
        assert_eq!(warning.kind, AccountSyncWarningKind::Generic);
        assert_eq!(
            warning.message,
            "Scheduled sync could not persist retry state for 'test': Persistence error: FOREIGN KEY constraint failed"
        );
        assert_eq!(warning.retry_at, None);
        assert_eq!(warning.retry_in_seconds, None);
    }

    #[test]
    fn calculate_backoff_increases_exponentially() {
        let account = test_account(60);
        assert_eq!(calculate_backoff(&account, 0), Duration::from_secs(60));
        assert_eq!(calculate_backoff(&account, 1), Duration::from_secs(120));
        assert_eq!(calculate_backoff(&account, 2), Duration::from_secs(240));
        assert_eq!(calculate_backoff(&account, 3), Duration::from_secs(480));
    }

    #[test]
    fn calculate_backoff_clamps_negative_error_count_to_initial_delay() {
        let account = test_account(60);

        assert_eq!(calculate_backoff(&account, -1), Duration::from_secs(60));
        assert_eq!(calculate_backoff_secs(&account, -1), 60);
    }

    #[test]
    fn calculate_backoff_secs_uses_account_interval_as_single_source_of_truth() {
        let account = test_account(900);

        assert_eq!(calculate_backoff(&account, 1).as_secs(), 1_800);
        assert_eq!(calculate_backoff_secs(&account, 1), 1_800);
    }

    #[test]
    fn increment_error_count_clamps_negative_stored_error_count_to_first_retry() {
        let db = std::sync::Mutex::new(test_db());
        let mut account = test_account(60);
        {
            let db_guard = db.lock().unwrap();
            insert_test_account(&db_guard, &account.id);
            insert_sync_state_error_count(&db_guard, &account.id, -5);
        }

        account.sync_interval_secs = 900;
        let backoff_state = increment_error_count(
            &db,
            &account,
            &AppError::UserVisible {
                message: "sync failed".to_string(),
            },
        )
        .expect("negative stored error count should be clamped before increment");

        assert_eq!(backoff_state.error_count, 1);
        assert_eq!(
            backoff_state.retry_in_seconds,
            calculate_backoff_secs(&account, 1)
        );
    }

    #[test]
    fn calculate_backoff_caps_at_max() {
        let account = test_account(60);
        assert_eq!(calculate_backoff(&account, 20), MAX_BACKOFF);
    }

    #[test]
    fn calculate_backoff_secs_caps_abnormal_high_values_at_max() {
        let account = test_account(60);

        assert!(calculate_backoff_secs(&account, 20) <= MAX_BACKOFF.as_secs());
        assert_eq!(
            calculate_backoff_secs(&account, i32::MAX),
            MAX_BACKOFF.as_secs()
        );
    }

    #[test]
    fn increment_error_count_persists_backoff_state_and_is_in_backoff() {
        let db = std::sync::Mutex::new(test_db());
        let account = test_account(60);
        {
            let db_guard = db.lock().unwrap();
            insert_test_account(&db_guard, &account.id);
        }

        let backoff_state = increment_error_count(
            &db,
            &account,
            &AppError::UserVisible {
                message: "sync failed".to_string(),
            },
        )
        .expect("backoff state should save");

        assert_eq!(backoff_state.error_count, 1);
        assert_eq!(
            backoff_state.retry_in_seconds,
            calculate_backoff_secs(&account, 1)
        );
        assert!(backoff_state.next_retry_at.is_some());
        assert!(is_in_backoff(&db, &account.id));
    }

    #[test]
    fn increment_error_count_surfaces_save_errors() {
        let db = std::sync::Mutex::new(test_db());
        let account = test_account(60);

        let error = increment_error_count(
            &db,
            &account,
            &AppError::UserVisible {
                message: "sync failed".to_string(),
            },
        )
        .expect_err("sync state save failure should be returned");

        assert!(matches!(error, DomainError::Persistence(_)));
    }

    #[test]
    fn reset_error_count_surfaces_save_errors() {
        let db = std::sync::Mutex::new(test_db());
        let account_id = AccountId::new();

        let error = reset_error_count(&db, &account_id)
            .expect_err("sync state save failure should be returned");

        assert!(matches!(error, DomainError::Persistence(_)));
    }

    #[test]
    fn failed_account_sync_persists_backoff_and_emits_retry_warning() {
        let db = std::sync::Mutex::new(test_db());
        let account = test_account(60);
        {
            let db_guard = db.lock().unwrap();
            insert_test_account(&db_guard, &account.id);
        }
        let mut warnings = Vec::new();

        let backoff = complete_failed_account_sync(
            &db,
            &account,
            &AppError::UserVisible {
                message: "Background sync panicked".to_string(),
            },
            &mut warnings,
        );

        assert_eq!(backoff, calculate_backoff(&account, 1));
        assert_eq!(warnings.len(), 1);
        assert_eq!(warnings[0].kind, AccountSyncWarningKind::RetryScheduled);
        assert_eq!(
            warnings[0].retry_in_seconds,
            Some(calculate_backoff_secs(&account, 1))
        );
        assert!(warnings[0].retry_at.is_some());
        assert!(is_in_backoff(&db, &account.id));
    }

    #[test]
    fn failed_account_sync_uses_provider_retry_after_when_longer_than_backoff() {
        let db = std::sync::Mutex::new(test_db());
        let account = test_account(60);
        {
            let db_guard = db.lock().unwrap();
            insert_test_account(&db_guard, &account.id);
        }
        let mut warnings = Vec::new();

        let backoff = complete_failed_account_sync(
            &db,
            &account,
            &AppError::Retryable {
                message: "Rate limit error: HTTP 429 Too Many Requests; retry_after_seconds=600"
                    .to_string(),
            },
            &mut warnings,
        );

        assert_eq!(backoff, Duration::from_secs(600));
        assert_eq!(warnings[0].retry_in_seconds, Some(600));
        assert!(warnings[0].retry_at.is_some());
        assert!(is_in_backoff(&db, &account.id));
    }

    #[test]
    fn failed_account_sync_ignores_invalid_provider_retry_after_marker() {
        let db = std::sync::Mutex::new(test_db());
        let account = test_account(60);
        {
            let db_guard = db.lock().unwrap();
            insert_test_account(&db_guard, &account.id);
        }
        let mut warnings = Vec::new();

        let backoff = complete_failed_account_sync(
            &db,
            &account,
            &AppError::Retryable {
                message: "Rate limit error: HTTP 429 Too Many Requests; retry_after_seconds=soon"
                    .to_string(),
            },
            &mut warnings,
        );

        assert_eq!(backoff, calculate_backoff(&account, 1));
        assert_eq!(
            warnings[0].retry_in_seconds,
            Some(calculate_backoff_secs(&account, 1))
        );
    }

    #[test]
    fn retry_after_seconds_ignores_user_visible_and_accidental_markers() {
        assert_eq!(
            retry_after_seconds_from_app_error(&AppError::UserVisible {
                message: "Rate limit error: HTTP 429 Too Many Requests; retry_after_seconds=600"
                    .to_string(),
            }),
            None
        );
        assert_eq!(
            retry_after_seconds_from_app_error(&AppError::Retryable {
                message: "provider copy accidentally said retry_after_seconds=600".to_string(),
            }),
            None
        );
    }

    #[test]
    fn retry_after_seconds_accepts_provider_rate_limit_marker() {
        assert_eq!(
            retry_after_seconds_from_app_error(&AppError::Retryable {
                message: "Rate limit error: HTTP 429 Too Many Requests; retry_after_seconds=600"
                    .to_string(),
            }),
            Some(600)
        );
    }

    #[test]
    fn scheduler_warning_push_dedupes_and_caps_warning_count() {
        let mut warnings = Vec::new();
        let duplicate = AccountSyncWarning {
            account_id: "account-1".to_string(),
            account_name: "Account 1".to_string(),
            kind: AccountSyncWarningKind::RetryScheduled,
            message: "retry later".to_string(),
            retry_at: Some("2099-01-01T00:00:00Z".to_string()),
            retry_in_seconds: Some(60),
        };

        push_scheduler_warning(&mut warnings, duplicate.clone());
        push_scheduler_warning(&mut warnings, duplicate);

        assert_eq!(warnings.len(), 1);

        for index in 0..(MAX_SCHEDULER_WARNINGS_PER_TICK + 4) {
            push_scheduler_warning(
                &mut warnings,
                AccountSyncWarning {
                    account_id: format!("account-{index}"),
                    account_name: format!("Account {index}"),
                    kind: AccountSyncWarningKind::Generic,
                    message: format!("provider warning {index}"),
                    retry_at: None,
                    retry_in_seconds: None,
                },
            );
        }

        assert_eq!(warnings.len(), MAX_SCHEDULER_WARNINGS_PER_TICK);
    }

    #[test]
    fn scheduler_backoff_keeps_retryable_classification_snapshot() {
        let cases = [
            (
                "network",
                AppError::Retryable {
                    message: "Network error: Request timed out. Check the server URL or your network connection."
                        .to_string(),
                },
                calculate_backoff_secs(&test_account(60), 1),
            ),
            (
                "rate-limit",
                AppError::Retryable {
                    message: "Rate limit error: HTTP 429 Too Many Requests; retry_after_seconds=600"
                        .to_string(),
                },
                600,
            ),
            (
                "auth",
                AppError::UserVisible {
                    message: "Auth error: HTTP 401 Unauthorized".to_string(),
                },
                calculate_backoff_secs(&test_account(60), 1),
            ),
            (
                "sqlite",
                AppError::UserVisible {
                    message: "Persistence error: Query returned no rows".to_string(),
                },
                calculate_backoff_secs(&test_account(60), 1),
            ),
            (
                "malformed-provider-payload",
                AppError::UserVisible {
                    message: "Parse error: malformed provider response".to_string(),
                },
                calculate_backoff_secs(&test_account(60), 1),
            ),
        ];

        for (case_name, error, expected_retry_in_seconds) in cases {
            let db = std::sync::Mutex::new(test_db());
            let mut account = test_account(60);
            account.id = AccountId(format!("backoff-{case_name}"));
            {
                let db_guard = db.lock().unwrap();
                insert_test_account(&db_guard, &account.id);
            }
            let mut warnings = Vec::new();

            let backoff = complete_failed_account_sync(&db, &account, &error, &mut warnings);

            assert_eq!(
                backoff,
                Duration::from_secs(expected_retry_in_seconds),
                "backoff changed for {case_name}"
            );
            assert_eq!(warnings.len(), 1, "warning count changed for {case_name}");
            assert_eq!(warnings[0].kind, AccountSyncWarningKind::RetryScheduled);
            assert_eq!(
                warnings[0].retry_in_seconds,
                Some(expected_retry_in_seconds),
                "retry warning changed for {case_name}"
            );
            assert!(
                is_in_backoff(&db, &account.id),
                "backoff missing for {case_name}"
            );
        }
    }

    #[test]
    fn is_in_backoff_clears_invalid_next_retry_at_and_allows_retry() {
        let db = std::sync::Mutex::new(test_db());
        let account = test_account(60);
        {
            let db_guard = db.lock().unwrap();
            insert_test_account(&db_guard, &account.id);
            insert_scheduler_sync_state(&db_guard, &account.id, 2, Some("not-a-date"));
        }

        assert!(!is_in_backoff(&db, &account.id));

        let db_guard = db.lock().unwrap();
        let repo = SqliteSyncStateRepository::new(db_guard.reader());
        let state = repo
            .get(&account.id, SyncStateScopeKey::scheduler())
            .unwrap()
            .unwrap();
        assert_eq!(state.error_count, 2);
        assert_eq!(state.next_retry_at, None);
    }

    #[test]
    fn invalid_next_retry_cleanup_save_failure_is_not_retried_for_same_invalid_value() {
        let save_attempts = Cell::new(0);
        let repo = FailingCleanupRepo {
            save_attempts: &save_attempts,
        };
        let mut state = SyncState {
            account_id: AccountId("cleanup-failure-account".to_string()),
            scope_key: SyncStateScopeKey::scheduler().as_string(),
            timestamp_usec: None,
            continuation: None,
            etag: None,
            last_modified: None,
            last_success_at: None,
            last_error: Some("old error".to_string()),
            error_count: 2,
            next_retry_at: Some("not-a-date".to_string()),
        };

        clear_invalid_next_retry_at(&repo, &mut state);
        assert_eq!(save_attempts.get(), 1);
        assert_eq!(state.next_retry_at, None);

        state.next_retry_at = Some("not-a-date".to_string());
        clear_invalid_next_retry_at(&repo, &mut state);

        assert_eq!(
            save_attempts.get(),
            1,
            "same invalid cleanup failure should be suppressed after the first save failure"
        );
        assert_eq!(state.next_retry_at, None);
    }
}
