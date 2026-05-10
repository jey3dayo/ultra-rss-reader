use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};
use tracing::warn;

use crate::commands::dto::{
    AccountSyncError, AccountSyncStatus, AccountSyncWarning, AppError, SyncProgressEvent,
    SyncProgressKind, SyncProgressStage, SyncResult,
};
use crate::commands::AppState;
use crate::domain::account::Account;
use crate::domain::feed::Feed;
use crate::domain::provider::ProviderKind;
use crate::domain::types::{AccountId, FeedId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_preference::SqlitePreferenceRepository;
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use crate::infra::provider::greader::GReaderProvider;
use crate::infra::provider::local::LocalProvider;
use crate::repository::account::AccountRepository;
use crate::repository::article::ArticleRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::preference::PreferenceRepository;
use crate::repository::sync_state::{SyncState, SyncStateRepository, SyncStateScopeKey};

use super::feed_commands::lock_db;
use super::sync_providers::{
    repair_greader_remote_state, sync_greader_account, sync_greader_feed, sync_local_feed,
};

const STARTUP_REMOTE_STATE_REPAIR_KEY: &str = "startup_remote_state_repair_v1";
const STARTUP_REMOTE_STATE_REPAIR_VALUE: &str = "done";
pub(crate) const SYNC_COMPLETED_EVENT: &str = "sync-completed";
pub(crate) const SYNC_SUCCEEDED_EVENT: &str = "sync-succeeded";
pub(crate) const SYNC_WARNING_EVENT: &str = "sync-warning";
const SYNC_PROGRESS_EVENT: &str = "sync-progress";

/// RAII guard that resets the `AtomicBool` to `false` on drop, ensuring the
/// sync flag is always cleared even on early return or panic.
struct SyncGuard<'a>(&'a AtomicBool);

impl Drop for SyncGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

#[derive(Clone)]
pub(crate) struct SyncProgressReporter {
    app_handle: AppHandle,
    kind: SyncProgressKind,
    total: usize,
    completed: Arc<AtomicUsize>,
}

impl SyncProgressReporter {
    pub(crate) fn new(app_handle: AppHandle, kind: SyncProgressKind, total: usize) -> Self {
        Self {
            app_handle,
            kind,
            total,
            completed: Arc::new(AtomicUsize::new(0)),
        }
    }

    fn emit(
        &self,
        stage: SyncProgressStage,
        completed: usize,
        account: Option<&Account>,
        success: Option<bool>,
    ) {
        if let Err(e) = self.app_handle.emit(
            SYNC_PROGRESS_EVENT,
            SyncProgressEvent {
                stage,
                kind: self.kind,
                total: self.total,
                completed,
                account_id: account.map(|account| account.id.as_ref().to_string()),
                account_name: account.map(|account| account.name.clone()),
                success,
            },
        ) {
            warn!("Failed to emit sync-progress event: {e}");
        }
    }

    pub(crate) fn emit_started(&self, account: Option<&Account>) {
        self.emit(SyncProgressStage::Started, 0, account, None);
    }

    pub(crate) fn emit_account_started(&self, account: &Account) {
        self.emit(
            SyncProgressStage::AccountStarted,
            self.completed.load(Ordering::SeqCst),
            Some(account),
            None,
        );
    }

    pub(crate) fn emit_account_finished(&self, account: &Account, success: bool) {
        let completed = next_sync_progress_completed(&self.completed, self.total);
        self.emit(
            SyncProgressStage::AccountFinished,
            completed,
            Some(account),
            Some(success),
        );
    }

    pub(crate) fn emit_finished(&self, success: bool) {
        self.emit(
            SyncProgressStage::Finished,
            self.completed.load(Ordering::SeqCst),
            None,
            Some(success),
        );
    }
}

fn next_sync_progress_completed(completed: &AtomicUsize, total: usize) -> usize {
    let mut current = completed.load(Ordering::SeqCst);
    loop {
        let next = current.saturating_add(1).min(total);
        match completed.compare_exchange(current, next, Ordering::SeqCst, Ordering::SeqCst) {
            Ok(_) => return next,
            Err(actual) => current = actual,
        }
    }
}

fn is_automatic_sync_enabled(automatic_sync_enabled: &AtomicBool) -> bool {
    automatic_sync_enabled.load(Ordering::SeqCst)
}

fn load_all_accounts(db: &Mutex<DbManager>) -> Result<Vec<Account>, AppError> {
    let db_guard = lock_db(db)?;
    let account_repo = SqliteAccountRepository::new(db_guard.reader());
    Ok(account_repo.find_all()?)
}

pub(crate) fn should_emit_sync_succeeded(result: &SyncResult) -> bool {
    result.synced && result.succeeded > 0 && result.failed.is_empty() && result.warnings.is_empty()
}

pub(crate) fn should_emit_sync_warning(result: &SyncResult) -> bool {
    result.synced && !result.warnings.is_empty()
}

fn should_emit_manual_single_sync_completion(result: &SyncResult) -> bool {
    result.synced && result.succeeded > 0
}

fn emit_sync_warning_event(app_handle: &tauri::AppHandle, result: &SyncResult) {
    if should_emit_sync_warning(result) {
        emit_sync_event_log_only(app_handle, SYNC_WARNING_EVENT, result.warnings.clone());
    }
}

fn sync_event_emit_warning(event: &str, error: &impl std::fmt::Display) -> String {
    format!("Failed to emit {event} event after sync: {error}")
}

fn emit_sync_event_log_only<S>(app_handle: &AppHandle, event: &str, payload: S)
where
    S: Serialize + Clone,
{
    if let Err(error) = app_handle.emit(event, payload) {
        warn!("{}", sync_event_emit_warning(event, &error));
    }
}

fn map_account_sync_status(sync_state: Option<SyncState>) -> AccountSyncStatus {
    match sync_state {
        Some(sync_state) => AccountSyncStatus {
            last_success_at: sync_state.last_success_at,
            last_error: sync_state.last_error,
            error_count: sync_state.error_count,
            next_retry_at: sync_state.next_retry_at,
        },
        None => AccountSyncStatus {
            last_success_at: None,
            last_error: None,
            error_count: 0,
            next_retry_at: None,
        },
    }
}

fn enable_automatic_sync(
    automatic_sync_enabled: &AtomicBool,
    automatic_sync_notify: &tokio::sync::Notify,
) {
    if !automatic_sync_enabled.swap(true, Ordering::SeqCst) {
        automatic_sync_notify.notify_waiters();
    }
}

fn startup_remote_state_repair_pending(db: &Mutex<DbManager>) -> Result<bool, AppError> {
    let db_guard = lock_db(db)?;
    let preference_repo = SqlitePreferenceRepository::new(db_guard.reader());
    Ok(preference_repo
        .get(STARTUP_REMOTE_STATE_REPAIR_KEY)?
        .as_deref()
        != Some(STARTUP_REMOTE_STATE_REPAIR_VALUE))
}

fn prioritize_startup_sync_accounts(
    accounts: Vec<Account>,
    preferred_account_id: Option<&str>,
) -> Vec<Account> {
    let Some(preferred_account_id) = preferred_account_id else {
        return accounts;
    };

    let (preferred, mut others): (Vec<_>, Vec<_>) = accounts
        .into_iter()
        .partition(|account| account.id.as_ref() == preferred_account_id);
    let mut prioritized = preferred;
    prioritized.append(&mut others);
    prioritized
}

fn mark_startup_remote_state_repair_complete(db: &Mutex<DbManager>) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let preference_repo = SqlitePreferenceRepository::new(db_guard.writer());
    preference_repo.set(
        STARTUP_REMOTE_STATE_REPAIR_KEY,
        STARTUP_REMOTE_STATE_REPAIR_VALUE,
    )?;
    Ok(())
}

fn startup_remote_state_repair_succeeded(
    startup_sync_accounts: &[Account],
    repair_only_accounts: &[Account],
    repaired_account_ids: &[String],
    sync_result: &SyncResult,
) -> bool {
    let repaired_account_ids = repaired_account_ids
        .iter()
        .map(String::as_str)
        .collect::<std::collections::HashSet<_>>();

    if !repair_only_accounts.is_empty() {
        return repair_only_accounts
            .iter()
            .all(|account| repaired_account_ids.contains(account.id.as_ref()));
    }

    let failed_ids = sync_result
        .failed
        .iter()
        .map(|failure| failure.account_id.as_str())
        .collect::<std::collections::HashSet<_>>();

    startup_sync_accounts
        .iter()
        .filter(|account| matches!(account.kind, ProviderKind::FreshRss))
        .all(|account| !failed_ids.contains(account.id.as_ref()))
}

#[cfg(not(test))]
fn local_provider() -> LocalProvider {
    LocalProvider::new()
}

#[cfg(test)]
fn local_provider() -> LocalProvider {
    LocalProvider::new_allowing_private_feed_urls_for_tests()
}

/// Sync a single account, returning warnings on soft anomalies and Err on hard failures.
pub(crate) async fn sync_account(
    db: &Mutex<DbManager>,
    account: &Account,
) -> Result<super::sync_providers::ProviderSyncOutcome, AppError> {
    match account.kind {
        ProviderKind::Local => {
            let provider = local_provider();
            let feeds = {
                let db_guard = lock_db(db)?;
                let feed_repo = SqliteFeedRepository::new(db_guard.reader());
                feed_repo.find_by_account(&account.id)?
            };
            for feed in &feeds {
                sync_local_feed(db, &provider, &account.id, feed).await?;
            }
            Ok(super::sync_providers::ProviderSyncOutcome::default())
        }
        ProviderKind::FreshRss => {
            let server_url = account.server_url.as_deref().unwrap_or_default();
            let provider = GReaderProvider::for_freshrss(server_url);
            sync_greader_account(db, account, provider).await
        }
    }
}

pub(crate) async fn sync_feed(
    db: &Mutex<DbManager>,
    account: &Account,
    feed: &Feed,
) -> Result<super::sync_providers::ProviderSyncOutcome, AppError> {
    match account.kind {
        ProviderKind::Local => {
            let provider = local_provider();
            sync_local_feed(db, &provider, &account.id, feed).await?;
            Ok(super::sync_providers::ProviderSyncOutcome::default())
        }
        ProviderKind::FreshRss => {
            let server_url = account.server_url.as_deref().unwrap_or_default();
            let provider = GReaderProvider::for_freshrss(server_url);
            sync_greader_feed(db, account, feed, provider).await
        }
    }
}

/// Run a full sync for all accounts. Shared by `trigger_sync` command and the background scheduler.
///
/// Uses `syncing` as a concurrent-execution guard: if another sync is already
/// in progress the call returns a `SyncResult { synced: false, .. }` immediately.
pub async fn run_full_sync(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
) -> Result<SyncResult, AppError> {
    run_full_sync_with_progress(db, syncing, None).await
}

async fn run_full_sync_with_progress(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    reporter: Option<SyncProgressReporter>,
) -> Result<SyncResult, AppError> {
    let accounts = load_all_accounts(db)?;

    run_sync_for_accounts_with_progress(db, syncing, accounts, reporter).await
}

async fn run_sync_for_accounts_with_progress(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    accounts: Vec<Account>,
    reporter: Option<SyncProgressReporter>,
) -> Result<SyncResult, AppError> {
    if syncing
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        tracing::info!("Sync already in progress, skipping");
        return Ok(SyncResult {
            synced: false,
            total: 0,
            succeeded: 0,
            failed: Vec::new(),
            warnings: Vec::new(),
        });
    }
    let _guard = SyncGuard(syncing);

    let total = accounts.len();
    let mut succeeded = 0usize;
    let mut failed = Vec::new();
    let mut warnings = Vec::new();

    if let Some(reporter) = reporter.as_ref() {
        reporter.emit_started(None);
    }

    // Sync accounts concurrently using join_all
    let futures: Vec<_> = accounts
        .into_iter()
        .map(|account| {
            let reporter = reporter.clone();
            async move {
                if let Some(reporter) = reporter.as_ref() {
                    reporter.emit_account_started(&account);
                }
                let result = sync_account(db, &account).await;
                if let Some(reporter) = reporter.as_ref() {
                    reporter.emit_account_finished(&account, result.is_ok());
                }
                (account, result)
            }
        })
        .collect();
    let results = futures::future::join_all(futures).await;

    for (account, result) in results {
        match result {
            Ok(outcome) => {
                succeeded += 1;
                if let Err(error) = clear_scheduler_sync_status(db, &account.id) {
                    warn!(
                        "Failed to clear scheduler sync status for account '{}' after manual sync: {error}",
                        account.name
                    );
                }
                warnings.extend(
                    outcome
                        .warnings
                        .into_iter()
                        .map(|warning| AccountSyncWarning {
                            account_id: account.id.as_ref().to_string(),
                            account_name: account.name.clone(),
                            kind: warning.kind,
                            message: warning.message,
                            retry_at: warning.retry_at,
                            retry_in_seconds: warning.retry_in_seconds,
                        }),
                );
            }
            Err(e) => {
                warn!(
                    "Sync failed for account {} ({}): {e}",
                    account.name,
                    account.id.as_ref()
                );
                failed.push(AccountSyncError {
                    account_id: account.id.as_ref().to_string(),
                    account_name: account.name.clone(),
                    message: e.to_string(),
                });
            }
        }
    }

    if let Some(reporter) = reporter.as_ref() {
        reporter.emit_finished(failed.is_empty());
    }

    Ok(SyncResult {
        synced: true,
        total,
        succeeded,
        failed,
        warnings,
    })
}

#[tauri::command]
pub async fn trigger_startup_sync(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    preferred_account_id: Option<String>,
) -> Result<SyncResult, AppError> {
    let all_accounts = {
        let db_guard = lock_db(&state.db)?;
        let account_repo = SqliteAccountRepository::new(db_guard.reader());
        account_repo.find_all()?
    };
    let startup_sync_accounts = all_accounts
        .iter()
        .filter(|account| account.sync_on_startup)
        .cloned()
        .collect::<Vec<_>>();
    let startup_sync_accounts =
        prioritize_startup_sync_accounts(startup_sync_accounts, preferred_account_id.as_deref());
    let repair_pending = startup_remote_state_repair_pending(&state.db)?;
    let repair_only_accounts = if repair_pending {
        all_accounts
            .iter()
            .filter(|account| {
                matches!(account.kind, ProviderKind::FreshRss) && !account.sync_on_startup
            })
            .cloned()
            .collect::<Vec<_>>()
    } else {
        Vec::new()
    };

    if startup_sync_accounts.is_empty() && repair_only_accounts.is_empty() {
        return Ok(SyncResult {
            synced: false,
            total: 0,
            succeeded: 0,
            failed: Vec::new(),
            warnings: Vec::new(),
        });
    }

    let mut repaired_account_ids = Vec::new();
    let mut repair_failures = Vec::new();
    for account in &repair_only_accounts {
        let server_url = account.server_url.as_deref().unwrap_or_default();
        let provider = GReaderProvider::for_freshrss(server_url);
        match repair_greader_remote_state(&state.db, account, provider).await {
            Ok(()) => repaired_account_ids.push(account.id.as_ref().to_string()),
            Err(error) => repair_failures.push(AccountSyncError {
                account_id: account.id.as_ref().to_string(),
                account_name: account.name.clone(),
                message: error.to_string(),
            }),
        }
    }

    let sync_result = if startup_sync_accounts.is_empty() {
        SyncResult {
            synced: !repaired_account_ids.is_empty(),
            total: repair_only_accounts.len(),
            succeeded: repaired_account_ids.len(),
            failed: repair_failures.clone(),
            warnings: Vec::new(),
        }
    } else {
        let reporter = SyncProgressReporter::new(
            app_handle.clone(),
            SyncProgressKind::ManualAll,
            startup_sync_accounts.len(),
        );
        let mut result = run_sync_for_accounts_with_progress(
            &state.db,
            &state.syncing,
            startup_sync_accounts.clone(),
            Some(reporter),
        )
        .await?;
        result.total += repair_only_accounts.len();
        result.succeeded += repaired_account_ids.len();
        result.failed.extend(repair_failures.clone());
        if !repair_failures.is_empty() {
            result.synced = true;
        }
        result
    };

    if repair_pending
        && startup_remote_state_repair_succeeded(
            &startup_sync_accounts,
            &repair_only_accounts,
            &repaired_account_ids,
            &sync_result,
        )
    {
        mark_startup_remote_state_repair_complete(&state.db)?;
    }

    if sync_result.synced
        && !all_accounts.is_empty()
        && all_accounts.iter().any(|account| account.sync_on_startup)
    {
        enable_automatic_sync(
            state.automatic_sync_enabled.as_ref(),
            state.automatic_sync_notify.as_ref(),
        );
    }
    if sync_result.synced {
        emit_sync_event_log_only(&app_handle, SYNC_COMPLETED_EVENT, ());
        if should_emit_sync_succeeded(&sync_result) {
            emit_sync_event_log_only(&app_handle, SYNC_SUCCEEDED_EVENT, ());
        }
        purge_old_articles(&state.db);
    }
    Ok(sync_result)
}

fn clear_scheduler_sync_status(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let repo = SqliteSyncStateRepository::new(db_guard.writer());
    let scope_key = SyncStateScopeKey::scheduler().as_string();
    let mut state = repo
        .get(account_id, &scope_key)?
        .unwrap_or_else(|| SyncState {
            account_id: account_id.clone(),
            scope_key,
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
    repo.save(&state)?;
    Ok(())
}

pub async fn run_automatic_sync(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    automatic_sync_enabled: &AtomicBool,
) -> Result<SyncResult, AppError> {
    run_automatic_sync_with_progress(db, syncing, automatic_sync_enabled, None).await
}

pub(crate) async fn run_automatic_sync_with_progress(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    automatic_sync_enabled: &AtomicBool,
    reporter: Option<SyncProgressReporter>,
) -> Result<SyncResult, AppError> {
    if !is_automatic_sync_enabled(automatic_sync_enabled) {
        tracing::info!("Automatic sync is disabled until the first manual sync completes");
        return Ok(SyncResult {
            synced: false,
            total: 0,
            succeeded: 0,
            failed: Vec::new(),
            warnings: Vec::new(),
        });
    }

    run_full_sync_with_progress(db, syncing, reporter).await
}

async fn run_automatic_sync_for_accounts_with_progress(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    automatic_sync_enabled: &AtomicBool,
    accounts: Vec<Account>,
    reporter: Option<SyncProgressReporter>,
) -> Result<SyncResult, AppError> {
    if !is_automatic_sync_enabled(automatic_sync_enabled) {
        tracing::info!("Automatic sync is disabled until the first manual sync completes");
        return Ok(SyncResult {
            synced: false,
            total: 0,
            succeeded: 0,
            failed: Vec::new(),
            warnings: Vec::new(),
        });
    }

    run_sync_for_accounts_with_progress(db, syncing, accounts, reporter).await
}

/// Purge old read articles based on each account's `keep_read_items_days` setting.
/// Called after background sync to prevent data bloat.
pub fn purge_old_articles(db: &Mutex<DbManager>) {
    let accounts = match lock_db(db).and_then(|g| {
        let repo = SqliteAccountRepository::new(g.reader());
        Ok(repo.find_all()?)
    }) {
        Ok(a) => a,
        Err(e) => {
            warn!("Failed to load accounts for purge: {e}");
            return;
        }
    };

    for account in &accounts {
        if account.keep_read_items_days <= 0 {
            continue;
        }
        let cutoff = chrono::Utc::now() - chrono::Duration::days(account.keep_read_items_days);
        match lock_db(db) {
            Ok(g) => {
                let repo = SqliteArticleRepository::new(g.writer());
                match repo.purge_old_read(&account.id, cutoff) {
                    Ok(n) if n > 0 => {
                        tracing::info!(
                            "Purged {n} old read articles for account '{}'",
                            account.name
                        );
                    }
                    Ok(_) => {}
                    Err(e) => {
                        warn!(
                            "Failed to purge articles for account '{}': {e}",
                            account.name
                        );
                    }
                }
            }
            Err(e) => {
                warn!("Lock error during purge: {e}");
            }
        }
    }
}

#[tauri::command]
pub async fn trigger_sync(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<SyncResult, AppError> {
    let accounts = load_all_accounts(&state.db)?;
    let reporter = SyncProgressReporter::new(
        app_handle.clone(),
        SyncProgressKind::ManualAll,
        accounts.len(),
    );
    let result =
        run_sync_for_accounts_with_progress(&state.db, &state.syncing, accounts, Some(reporter))
            .await?;
    if result.synced {
        enable_automatic_sync(
            state.automatic_sync_enabled.as_ref(),
            state.automatic_sync_notify.as_ref(),
        );
        emit_sync_warning_event(&app_handle, &result);
        emit_sync_event_log_only(&app_handle, SYNC_COMPLETED_EVENT, ());
        if should_emit_sync_succeeded(&result) {
            emit_sync_event_log_only(&app_handle, SYNC_SUCCEEDED_EVENT, ());
        }
        purge_old_articles(&state.db);
    }
    Ok(result)
}

#[tauri::command]
pub async fn trigger_automatic_sync(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<SyncResult, AppError> {
    let accounts = load_all_accounts(&state.db)?;
    let reporter = SyncProgressReporter::new(
        app_handle.clone(),
        SyncProgressKind::Automatic,
        accounts.len(),
    );
    let result = run_automatic_sync_for_accounts_with_progress(
        &state.db,
        &state.syncing,
        state.automatic_sync_enabled.as_ref(),
        accounts,
        Some(reporter),
    )
    .await?;
    if result.synced {
        emit_sync_warning_event(&app_handle, &result);
        emit_sync_event_log_only(&app_handle, SYNC_COMPLETED_EVENT, ());
        if should_emit_sync_succeeded(&result) {
            emit_sync_event_log_only(&app_handle, SYNC_SUCCEEDED_EVENT, ());
        }
        purge_old_articles(&state.db);
    }
    Ok(result)
}

#[tauri::command]
pub fn get_account_sync_status(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<AccountSyncStatus, AppError> {
    let db_guard = lock_db(&state.db)?;
    let repo = SqliteSyncStateRepository::new(db_guard.reader());
    let scope_key = SyncStateScopeKey::scheduler().as_string();
    let state = repo.get(&AccountId(account_id), &scope_key)?;
    Ok(map_account_sync_status(state))
}

#[tauri::command]
pub async fn trigger_sync_account(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    account_id: String,
) -> Result<SyncResult, AppError> {
    if state
        .syncing
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Ok(SyncResult {
            synced: false,
            total: 0,
            succeeded: 0,
            failed: Vec::new(),
            warnings: Vec::new(),
        });
    }
    let _guard = SyncGuard(&state.syncing);

    let account_id = crate::domain::types::AccountId(account_id);
    let account = {
        let db_guard = lock_db(&state.db)?;
        let repo = SqliteAccountRepository::new(db_guard.reader());
        repo.find_by_id(&account_id)?
            .ok_or_else(|| AppError::UserVisible {
                message: format!("Account not found: {}", account_id.as_ref()),
            })?
    };
    let reporter =
        SyncProgressReporter::new(app_handle.clone(), SyncProgressKind::ManualAccount, 1);
    reporter.emit_started(Some(&account));
    reporter.emit_account_started(&account);
    let name = account.name.clone();
    let mut result = SyncResult {
        synced: true,
        total: 1,
        succeeded: 0,
        failed: Vec::new(),
        warnings: Vec::new(),
    };
    match sync_account(&state.db, &account).await {
        Ok(outcome) => {
            result.succeeded = 1;
            if let Err(error) = clear_scheduler_sync_status(&state.db, &account.id) {
                warn!(
                    "Failed to clear scheduler sync status for account '{}' after manual sync: {error}",
                    account.name
                );
            }
            result
                .warnings
                .extend(
                    outcome
                        .warnings
                        .into_iter()
                        .map(|warning| AccountSyncWarning {
                            account_id: account.id.as_ref().to_string(),
                            account_name: name.clone(),
                            kind: warning.kind,
                            message: warning.message,
                            retry_at: warning.retry_at,
                            retry_in_seconds: warning.retry_in_seconds,
                        }),
                );
            reporter.emit_account_finished(&account, true);
        }
        Err(e) => {
            warn!("Sync failed for account '{}': {e}", name);
            result.failed.push(AccountSyncError {
                account_id: account.id.as_ref().to_string(),
                account_name: name,
                message: e.to_string(),
            });
            reporter.emit_account_finished(&account, false);
        }
    }
    reporter.emit_finished(result.failed.is_empty());
    if should_emit_manual_single_sync_completion(&result) {
        enable_automatic_sync(
            state.automatic_sync_enabled.as_ref(),
            state.automatic_sync_notify.as_ref(),
        );
        emit_sync_warning_event(&app_handle, &result);
        emit_sync_event_log_only(&app_handle, SYNC_COMPLETED_EVENT, ());
        if should_emit_sync_succeeded(&result) {
            emit_sync_event_log_only(&app_handle, SYNC_SUCCEEDED_EVENT, ());
        }
    }
    Ok(result)
}

#[tauri::command]
pub async fn trigger_sync_feed(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    feed_id: String,
) -> Result<SyncResult, AppError> {
    if state
        .syncing
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Ok(SyncResult {
            synced: false,
            total: 0,
            succeeded: 0,
            failed: Vec::new(),
            warnings: Vec::new(),
        });
    }
    let _guard = SyncGuard(&state.syncing);

    let feed_id = FeedId(feed_id);
    let (account, feed) = {
        let db_guard = lock_db(&state.db)?;
        let feed_repo = SqliteFeedRepository::new(db_guard.reader());
        let account_repo = SqliteAccountRepository::new(db_guard.reader());
        let feed = feed_repo
            .find_by_id(&feed_id)?
            .ok_or_else(|| AppError::UserVisible {
                message: format!("Feed not found: {}", feed_id.as_ref()),
            })?;
        let account =
            account_repo
                .find_by_id(&feed.account_id)?
                .ok_or_else(|| AppError::UserVisible {
                    message: format!("Account not found: {}", feed.account_id.as_ref()),
                })?;
        (account, feed)
    };

    let reporter =
        SyncProgressReporter::new(app_handle.clone(), SyncProgressKind::ManualAccount, 1);
    reporter.emit_started(Some(&account));
    reporter.emit_account_started(&account);

    let mut result = SyncResult {
        synced: true,
        total: 1,
        succeeded: 0,
        failed: Vec::new(),
        warnings: Vec::new(),
    };

    match sync_feed(&state.db, &account, &feed).await {
        Ok(outcome) => {
            result.succeeded = 1;
            result
                .warnings
                .extend(
                    outcome
                        .warnings
                        .into_iter()
                        .map(|warning| AccountSyncWarning {
                            account_id: account.id.as_ref().to_string(),
                            account_name: account.name.clone(),
                            kind: warning.kind,
                            message: warning.message,
                            retry_at: warning.retry_at,
                            retry_in_seconds: warning.retry_in_seconds,
                        }),
                );
            reporter.emit_account_finished(&account, true);
        }
        Err(e) => {
            warn!(
                "Sync failed for feed '{}' ({}): {e}",
                feed.title,
                feed.id.as_ref()
            );
            result.failed.push(AccountSyncError {
                account_id: account.id.as_ref().to_string(),
                account_name: account.name.clone(),
                message: e.to_string(),
            });
            reporter.emit_account_finished(&account, false);
        }
    }

    reporter.emit_finished(result.failed.is_empty());
    if should_emit_manual_single_sync_completion(&result) {
        emit_sync_warning_event(&app_handle, &result);
        emit_sync_event_log_only(&app_handle, SYNC_COMPLETED_EVENT, ());
        if should_emit_sync_succeeded(&result) {
            emit_sync_event_log_only(&app_handle, SYNC_SUCCEEDED_EVENT, ());
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::start_database_maintenance;
    use crate::domain::account::ConnectionVerificationStatus;
    use crate::domain::feed::Feed;
    use crate::domain::provider::ProviderKind;
    use crate::domain::types::AccountId;
    use crate::infra::db::sqlite_feed::SqliteFeedRepository;
    use crate::repository::feed::FeedRepository;
    use mockito::Server;
    use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
    use std::sync::Mutex;

    #[test]
    fn sync_progress_completed_is_monotonic_and_clamped_to_total() {
        let completed = AtomicUsize::new(0);

        assert_eq!(next_sync_progress_completed(&completed, 2), 1);
        assert_eq!(next_sync_progress_completed(&completed, 2), 2);
        assert_eq!(next_sync_progress_completed(&completed, 2), 2);
        assert_eq!(completed.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    async fn run_full_sync_skips_when_already_syncing() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let syncing = AtomicBool::new(true); // already syncing

        let result = run_full_sync(&db, &syncing).await;

        assert!(result.is_ok());
        let sync_result = result.unwrap();
        assert!(!sync_result.synced, "should skip when sync in progress");
    }

    #[tokio::test]
    async fn run_full_sync_skips_while_database_maintenance_is_reserved() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let syncing = AtomicBool::new(false);
        let _maintenance_guard =
            start_database_maintenance(&syncing).expect("maintenance should reserve sync guard");

        let result = run_full_sync(&db, &syncing)
            .await
            .expect("sync should skip instead of failing");

        assert!(!result.synced);
        assert_eq!(result.total, 0);
    }

    #[tokio::test]
    async fn run_full_sync_resets_flag_after_completion() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let syncing = AtomicBool::new(false);

        let result = run_full_sync(&db, &syncing).await;

        assert!(result.is_ok());
        assert!(
            !syncing.load(Ordering::SeqCst),
            "syncing flag should be reset after sync"
        );
    }

    #[tokio::test]
    async fn run_full_sync_returns_sync_result() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let syncing = AtomicBool::new(false);

        let result = run_full_sync(&db, &syncing).await.unwrap();

        assert!(result.synced);
        assert_eq!(result.total, 0); // no accounts in empty DB
        assert_eq!(result.succeeded, 0);
        assert!(result.failed.is_empty());
        assert!(result.warnings.is_empty());
    }

    #[tokio::test]
    async fn run_full_sync_quarantines_invalid_account_rows_like_account_list() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let syncing = AtomicBool::new(false);

        {
            let db_guard = db.lock().unwrap();
            db_guard
                .writer()
                .execute(
                    "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                    rusqlite::params!["invalid-provider-account", "InvalidProvider", "Invalid"],
                )
                .unwrap();
        }

        let result = run_full_sync(&db, &syncing)
            .await
            .expect("invalid account rows should be quarantined from sync");

        assert!(result.synced);
        assert_eq!(result.total, 0);
        assert_eq!(result.succeeded, 0);
        assert!(result.failed.is_empty());
        assert!(result.warnings.is_empty());
    }

    #[test]
    fn should_emit_sync_succeeded_when_sync_finishes_without_failures_or_warnings() {
        let result = SyncResult {
            synced: true,
            total: 1,
            succeeded: 1,
            failed: Vec::new(),
            warnings: Vec::new(),
        };

        assert!(should_emit_sync_succeeded(&result));
    }

    #[test]
    fn should_not_emit_sync_succeeded_when_any_account_failed() {
        let result = SyncResult {
            synced: true,
            total: 2,
            succeeded: 1,
            failed: vec![AccountSyncError {
                account_id: "acc-1".to_string(),
                account_name: "FreshRSS".to_string(),
                message: "boom".to_string(),
            }],
            warnings: Vec::new(),
        };

        assert!(!should_emit_sync_succeeded(&result));
    }

    #[test]
    fn should_not_emit_sync_succeeded_when_sync_has_warnings() {
        let result = SyncResult {
            synced: true,
            total: 1,
            succeeded: 1,
            failed: Vec::new(),
            warnings: vec![AccountSyncWarning {
                account_id: "acc-1".to_string(),
                account_name: "FreshRSS".to_string(),
                kind: crate::commands::dto::AccountSyncWarningKind::Generic,
                message: "Skipped entries.".to_string(),
                retry_at: None,
                retry_in_seconds: None,
            }],
        };

        assert!(!should_emit_sync_succeeded(&result));
    }

    #[test]
    fn should_emit_sync_warning_when_synced_result_has_warnings() {
        let result = SyncResult {
            synced: true,
            total: 1,
            succeeded: 1,
            failed: Vec::new(),
            warnings: vec![AccountSyncWarning {
                account_id: "acc-1".to_string(),
                account_name: "FreshRSS".to_string(),
                kind: crate::commands::dto::AccountSyncWarningKind::Generic,
                message: "Skipped entries.".to_string(),
                retry_at: None,
                retry_in_seconds: None,
            }],
        };

        assert!(should_emit_sync_warning(&result));
    }

    #[test]
    fn manual_single_sync_completion_emits_when_at_least_one_item_succeeded() {
        let result = SyncResult {
            synced: true,
            total: 1,
            succeeded: 1,
            failed: Vec::new(),
            warnings: Vec::new(),
        };

        assert!(should_emit_manual_single_sync_completion(&result));
    }

    #[test]
    fn manual_single_sync_completion_suppresses_failure_only_result() {
        let result = SyncResult {
            synced: true,
            total: 1,
            succeeded: 0,
            failed: vec![AccountSyncError {
                account_id: "acc-1".to_string(),
                account_name: "FreshRSS".to_string(),
                message: "boom".to_string(),
            }],
            warnings: Vec::new(),
        };

        assert!(!should_emit_manual_single_sync_completion(&result));
    }

    #[test]
    fn sync_event_emit_warning_names_failed_event_without_failing_sync() {
        let warning = sync_event_emit_warning(SYNC_COMPLETED_EVENT, &"listener unavailable");

        assert_eq!(
            warning,
            "Failed to emit sync-completed event after sync: listener unavailable"
        );
    }

    #[test]
    fn prioritize_startup_sync_accounts_moves_preferred_account_to_the_front() {
        let account_a = Account {
            id: AccountId("acc-1".to_string()),
            kind: ProviderKind::Local,
            name: "Local".to_string(),
            server_url: None,
            username: None,
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Unverified,
            connection_verified_at: None,
            connection_verification_error: None,
        };
        let account_b = Account {
            id: AccountId("acc-2".to_string()),
            kind: ProviderKind::FreshRss,
            name: "FreshRSS".to_string(),
            server_url: Some("https://example.com".to_string()),
            username: Some("user".to_string()),
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Unverified,
            connection_verified_at: None,
            connection_verification_error: None,
        };

        let prioritized = prioritize_startup_sync_accounts(
            vec![account_a.clone(), account_b.clone()],
            Some("acc-2"),
        );

        assert_eq!(
            prioritized
                .iter()
                .map(|account| account.id.as_ref())
                .collect::<Vec<_>>(),
            vec!["acc-2", "acc-1"]
        );
    }

    #[test]
    fn prioritize_startup_sync_accounts_keeps_original_order_when_preferred_account_is_missing() {
        let account_a = Account {
            id: AccountId("acc-1".to_string()),
            kind: ProviderKind::Local,
            name: "Local".to_string(),
            server_url: None,
            username: None,
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Unverified,
            connection_verified_at: None,
            connection_verification_error: None,
        };
        let account_b = Account {
            id: AccountId("acc-2".to_string()),
            kind: ProviderKind::FreshRss,
            name: "FreshRSS".to_string(),
            server_url: Some("https://example.com".to_string()),
            username: Some("user".to_string()),
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Unverified,
            connection_verified_at: None,
            connection_verification_error: None,
        };

        let prioritized = prioritize_startup_sync_accounts(
            vec![account_a.clone(), account_b.clone()],
            Some("acc-missing"),
        );

        assert_eq!(
            prioritized
                .iter()
                .map(|account| account.id.as_ref())
                .collect::<Vec<_>>(),
            vec!["acc-1", "acc-2"]
        );
    }

    fn test_sync_command_account(id: &str, kind: ProviderKind, sync_on_startup: bool) -> Account {
        Account {
            id: AccountId(id.to_string()),
            kind,
            name: id.to_string(),
            server_url: Some("https://example.com".to_string()),
            username: Some("user".to_string()),
            sync_interval_secs: 3600,
            sync_on_startup,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Unverified,
            connection_verified_at: None,
            connection_verification_error: None,
        }
    }

    fn sync_result_with_failed_ids(failed_ids: &[&str]) -> SyncResult {
        SyncResult {
            synced: true,
            total: failed_ids.len(),
            succeeded: 0,
            failed: failed_ids
                .iter()
                .map(|id| AccountSyncError {
                    account_id: id.to_string(),
                    account_name: id.to_string(),
                    message: "failed".to_string(),
                })
                .collect(),
            warnings: Vec::new(),
        }
    }

    #[test]
    fn startup_remote_state_repair_complete_allows_repair_only_success_with_normal_sync_failure() {
        let startup_account =
            test_sync_command_account("startup-fresh", ProviderKind::FreshRss, true);
        let repair_only_account =
            test_sync_command_account("repair-only-fresh", ProviderKind::FreshRss, false);
        let sync_result = sync_result_with_failed_ids(&["startup-fresh"]);

        assert!(startup_remote_state_repair_succeeded(
            &[startup_account],
            &[repair_only_account],
            &["repair-only-fresh".to_string()],
            &sync_result,
        ));
    }

    #[test]
    fn startup_remote_state_repair_complete_allows_repair_only_success_with_mixed_provider_failure()
    {
        let startup_account = test_sync_command_account("startup-local", ProviderKind::Local, true);
        let repair_only_account =
            test_sync_command_account("repair-only-fresh", ProviderKind::FreshRss, false);
        let sync_result = sync_result_with_failed_ids(&["startup-local"]);

        assert!(startup_remote_state_repair_succeeded(
            &[startup_account],
            &[repair_only_account],
            &["repair-only-fresh".to_string()],
            &sync_result,
        ));
    }

    #[test]
    fn startup_remote_state_repair_complete_allows_startup_freshrss_success_with_local_failure() {
        let startup_fresh =
            test_sync_command_account("startup-fresh", ProviderKind::FreshRss, true);
        let startup_local = test_sync_command_account("startup-local", ProviderKind::Local, true);
        let sync_result = sync_result_with_failed_ids(&["startup-local"]);

        assert!(startup_remote_state_repair_succeeded(
            &[startup_fresh, startup_local],
            &[],
            &[],
            &sync_result,
        ));
    }

    #[test]
    fn startup_remote_state_repair_complete_requires_repair_only_success() {
        let repair_only_account =
            test_sync_command_account("repair-only-fresh", ProviderKind::FreshRss, false);
        let sync_result = sync_result_with_failed_ids(&[]);

        assert!(!startup_remote_state_repair_succeeded(
            &[],
            &[repair_only_account],
            &[],
            &sync_result,
        ));
    }

    #[test]
    fn map_account_sync_status_includes_last_success_at() {
        let account_id = AccountId::new();
        let status = map_account_sync_status(Some(SyncState {
            account_id,
            scope_key: SyncStateScopeKey::scheduler().as_string(),
            timestamp_usec: None,
            continuation: None,
            etag: None,
            last_modified: None,
            last_success_at: Some("2026-04-16T12:34:00Z".to_string()),
            last_error: Some("old error".to_string()),
            error_count: 2,
            next_retry_at: Some("2026-04-16T12:40:00Z".to_string()),
        }));

        assert_eq!(
            status.last_success_at.as_deref(),
            Some("2026-04-16T12:34:00Z")
        );
        assert_eq!(status.last_error.as_deref(), Some("old error"));
        assert_eq!(status.error_count, 2);
        assert_eq!(
            status.next_retry_at.as_deref(),
            Some("2026-04-16T12:40:00Z")
        );
    }

    #[tokio::test]
    async fn second_sync_skips_when_flag_already_set() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let syncing = AtomicBool::new(false);

        let result1 = run_full_sync(&db, &syncing).await.unwrap();

        syncing.store(true, Ordering::SeqCst);
        let result2 = run_full_sync(&db, &syncing).await.unwrap();
        syncing.store(false, Ordering::SeqCst); // cleanup

        assert!(result1.synced, "first sync should execute");
        assert!(!result2.synced, "concurrent sync should be skipped");
    }

    #[tokio::test]
    async fn run_automatic_sync_skips_until_manual_sync_enabled() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let syncing = AtomicBool::new(false);
        let automatic_sync_enabled = AtomicBool::new(false);

        let result = run_automatic_sync(&db, &syncing, &automatic_sync_enabled).await;

        assert!(result.is_ok());
        let sync_result = result.unwrap();
        assert!(
            !sync_result.synced,
            "automatic sync should stay locked initially"
        );
        assert!(
            !syncing.load(Ordering::SeqCst),
            "automatic sync should not set the syncing flag when locked"
        );
    }

    #[tokio::test]
    async fn run_automatic_sync_runs_after_manual_sync_enabled() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let syncing = AtomicBool::new(false);
        let automatic_sync_enabled = AtomicBool::new(true);

        let result = run_automatic_sync(&db, &syncing, &automatic_sync_enabled)
            .await
            .unwrap();

        assert!(result.synced, "automatic sync should run after unlock");
        assert!(
            !syncing.load(Ordering::SeqCst),
            "syncing flag should be reset after automatic sync"
        );
    }

    #[tokio::test]
    async fn account_parallel_sync_reports_failures_in_requested_account_order() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let syncing = AtomicBool::new(false);
        let first_account = test_sync_command_account("first-account", ProviderKind::Local, true);
        let second_account = test_sync_command_account("second-account", ProviderKind::Local, true);

        {
            let db_guard = db.lock().unwrap();
            for account in [&first_account, &second_account] {
                db_guard
                    .writer()
                    .execute(
                        "INSERT INTO accounts (id, kind, name, sync_interval_secs, sync_on_startup, sync_on_wake, keep_read_items_days) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        rusqlite::params![
                            account.id.as_ref(),
                            "Local",
                            account.name,
                            account.sync_interval_secs,
                            account.sync_on_startup,
                            account.sync_on_wake,
                            account.keep_read_items_days,
                        ],
                    )
                    .unwrap();
            }
            let feed_repo = SqliteFeedRepository::new(db_guard.writer());
            feed_repo
                .save(&Feed {
                    id: FeedId::new(),
                    account_id: first_account.id.clone(),
                    folder_id: None,
                    remote_id: None,
                    title: "First invalid feed".to_string(),
                    url: "not-a-url".to_string(),
                    site_url: "https://example.com".to_string(),
                    icon: None,
                    unread_count: 0,
                    reader_mode: "inherit".to_string(),
                    web_preview_mode: "inherit".to_string(),
                })
                .unwrap();
            feed_repo
                .save(&Feed {
                    id: FeedId::new(),
                    account_id: second_account.id.clone(),
                    folder_id: None,
                    remote_id: None,
                    title: "Second invalid feed".to_string(),
                    url: "not-a-url".to_string(),
                    site_url: "https://example.com".to_string(),
                    icon: None,
                    unread_count: 0,
                    reader_mode: "inherit".to_string(),
                    web_preview_mode: "inherit".to_string(),
                })
                .unwrap();
        }

        let result = run_sync_for_accounts_with_progress(
            &db,
            &syncing,
            vec![second_account, first_account],
            None,
        )
        .await
        .unwrap();

        assert_eq!(
            result
                .failed
                .iter()
                .map(|failure| failure.account_id.as_str())
                .collect::<Vec<_>>(),
            vec!["second-account", "first-account"]
        );
    }

    #[test]
    fn sync_guard_resets_on_drop() {
        let syncing = AtomicBool::new(true);
        {
            let _guard = SyncGuard(&syncing);
            assert!(syncing.load(Ordering::SeqCst));
        }
        assert!(
            !syncing.load(Ordering::SeqCst),
            "flag should be false after guard drop"
        );
    }

    #[tokio::test]
    async fn enable_automatic_sync_notifies_waiters_only_once() {
        let automatic_sync_enabled = AtomicBool::new(false);
        let automatic_sync_notify = tokio::sync::Notify::new();

        let waiter = automatic_sync_notify.notified();
        enable_automatic_sync(&automatic_sync_enabled, &automatic_sync_notify);

        tokio::time::timeout(std::time::Duration::from_millis(50), waiter)
            .await
            .expect("waiter should be notified after enabling automatic sync");

        enable_automatic_sync(&automatic_sync_enabled, &automatic_sync_notify);
        assert!(automatic_sync_enabled.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn sync_feed_only_updates_the_selected_local_feed() {
        let mut server = Server::new_async().await;
        let selected_feed_url = format!("{}/selected.xml", server.url());
        let other_feed_url = format!("{}/other.xml", server.url());
        let selected_mock = server
            .mock("GET", "/selected.xml")
            .with_status(200)
            .with_header("content-type", "application/rss+xml")
            .with_body(
                r#"<?xml version="1.0" encoding="UTF-8"?>
                <rss version="2.0">
                  <channel>
                    <title>Selected Feed</title>
                    <item>
                      <guid>selected-1</guid>
                      <title>Selected Article</title>
                      <link>https://example.com/selected</link>
                    </item>
                  </channel>
                </rss>"#,
            )
            .create_async()
            .await;

        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let account = Account {
            id: AccountId::new(),
            kind: ProviderKind::Local,
            name: "Local".to_string(),
            server_url: None,
            username: None,
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Unverified,
            connection_verified_at: None,
            connection_verification_error: None,
        };
        let selected_feed = Feed {
            id: FeedId::new(),
            account_id: account.id.clone(),
            folder_id: None,
            remote_id: None,
            title: "Selected".to_string(),
            url: selected_feed_url,
            site_url: "https://example.com".to_string(),
            icon: None,
            unread_count: 0,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        };
        let other_feed = Feed {
            id: FeedId::new(),
            account_id: account.id.clone(),
            folder_id: None,
            remote_id: None,
            title: "Other".to_string(),
            url: other_feed_url,
            site_url: "https://example.com".to_string(),
            icon: None,
            unread_count: 0,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        };

        {
            let db_guard = db.lock().unwrap();
            db_guard
                .writer()
                .execute(
                    "INSERT INTO accounts (id, kind, name, sync_interval_secs, sync_on_startup, sync_on_wake, keep_read_items_days) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    rusqlite::params![account.id.as_ref(), "Local", account.name, account.sync_interval_secs, account.sync_on_startup, account.sync_on_wake, account.keep_read_items_days],
                )
                .unwrap();
            let feed_repo = SqliteFeedRepository::new(db_guard.writer());
            feed_repo.save(&selected_feed).unwrap();
            feed_repo.save(&other_feed).unwrap();
        }

        sync_feed(&db, &account, &selected_feed).await.unwrap();

        selected_mock.assert_async().await;

        let db_guard = db.lock().unwrap();
        let selected_count: i64 = db_guard
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM articles WHERE feed_id = ?1",
                rusqlite::params![selected_feed.id.as_ref()],
                |row| row.get(0),
            )
            .unwrap();
        let other_count: i64 = db_guard
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM articles WHERE feed_id = ?1",
                rusqlite::params![other_feed.id.as_ref()],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(selected_count, 1);
        assert_eq!(other_count, 0);
    }

    #[test]
    fn clear_scheduler_sync_status_clears_account_level_backoff() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let account_id = AccountId::new();
        {
            let db_guard = db.lock().unwrap();
            db_guard
                .writer()
                .execute(
                    "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                    rusqlite::params![account_id.as_ref(), "Local", "Local"],
                )
                .unwrap();
            db_guard
                .writer()
                .execute(
                    "INSERT INTO sync_state (account_id, scope_key, last_error, error_count, next_retry_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                    rusqlite::params![
                        account_id.as_ref(),
                        SyncStateScopeKey::scheduler().as_string(),
                        "old failure",
                        2,
                        "2099-01-01T00:00:00Z",
                    ],
                )
                .unwrap();
        }

        clear_scheduler_sync_status(&db, &account_id).unwrap();

        let db_guard = db.lock().unwrap();
        let repo = SqliteSyncStateRepository::new(db_guard.reader());
        let state = repo
            .get(&account_id, SyncStateScopeKey::scheduler())
            .unwrap()
            .unwrap();
        assert_eq!(state.error_count, 0);
        assert_eq!(state.last_error, None);
        assert_eq!(state.next_retry_at, None);
        assert!(state.last_success_at.is_some());
    }

    #[test]
    fn purge_old_articles_deletes_old_read_items_when_retention_is_enabled() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let account = Account {
            id: AccountId::new(),
            kind: ProviderKind::Local,
            name: "Local".to_string(),
            server_url: None,
            username: None,
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status: ConnectionVerificationStatus::Unverified,
            connection_verified_at: None,
            connection_verification_error: None,
        };
        let feed_id = FeedId::new();
        let old = chrono::Utc::now() - chrono::Duration::days(60);
        {
            let db_guard = db.lock().unwrap();
            db_guard
                .writer()
                .execute(
                    "INSERT INTO accounts (id, kind, name, keep_read_items_days) VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![account.id.as_ref(), "Local", account.name, account.keep_read_items_days],
                )
                .unwrap();
            db_guard
                .writer()
                .execute(
                    "INSERT INTO feeds (id, account_id, title, url, site_url) VALUES (?1, ?2, ?3, ?4, ?5)",
                    rusqlite::params![
                        feed_id.as_ref(),
                        account.id.as_ref(),
                        "Feed",
                        "https://example.com/feed.xml",
                        "https://example.com",
                    ],
                )
                .unwrap();
            db_guard
                .writer()
                .execute(
                    "INSERT INTO articles (id, feed_id, title, published_at, fetched_at, is_read) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    rusqlite::params![
                        "old-read",
                        feed_id.as_ref(),
                        "Old read",
                        old.to_rfc3339(),
                        old.to_rfc3339(),
                        true,
                    ],
                )
                .unwrap();
        }

        purge_old_articles(&db);

        let remaining: i64 = db
            .lock()
            .unwrap()
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM articles WHERE id = ?1",
                rusqlite::params!["old-read"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(remaining, 0);
    }
}
