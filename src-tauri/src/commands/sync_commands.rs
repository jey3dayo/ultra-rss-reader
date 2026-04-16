use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

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
use crate::repository::sync_state::{SyncState, SyncStateRepository};

use super::feed_commands::lock_db;
use super::sync_providers::{sync_greader_account, sync_greader_feed, sync_local_feed};

const SCHEDULER_SYNC_STATE_SCOPE: &str = "scheduler";
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
        let completed = self.completed.fetch_add(1, Ordering::SeqCst) + 1;
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

fn is_automatic_sync_enabled(automatic_sync_enabled: &AtomicBool) -> bool {
    automatic_sync_enabled.load(Ordering::SeqCst)
}

pub(crate) fn should_emit_sync_succeeded(result: &SyncResult) -> bool {
    result.synced && result.succeeded > 0 && result.failed.is_empty() && result.warnings.is_empty()
}

fn enable_automatic_sync(
    automatic_sync_enabled: &AtomicBool,
    automatic_sync_notify: &tokio::sync::Notify,
) {
    if !automatic_sync_enabled.swap(true, Ordering::SeqCst) {
        automatic_sync_notify.notify_waiters();
    }
}

/// Sync a single account, returning warnings on soft anomalies and Err on hard failures.
pub(crate) async fn sync_account(
    db: &Mutex<DbManager>,
    account: &Account,
) -> Result<super::sync_providers::ProviderSyncOutcome, AppError> {
    match account.kind {
        ProviderKind::Local => {
            let provider = LocalProvider::new();
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
        ProviderKind::Inoreader => {
            let (app_id, app_key) = {
                let db_guard = lock_db(db)?;
                let pref_repo = SqlitePreferenceRepository::new(db_guard.reader());
                (
                    pref_repo.get("inoreader_app_id").unwrap_or(None),
                    pref_repo.get("inoreader_app_key").unwrap_or(None),
                )
            };
            let provider = GReaderProvider::for_inoreader(app_id, app_key);
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
            let provider = LocalProvider::new();
            sync_local_feed(db, &provider, &account.id, feed).await?;
            Ok(super::sync_providers::ProviderSyncOutcome::default())
        }
        ProviderKind::FreshRss => {
            let server_url = account.server_url.as_deref().unwrap_or_default();
            let provider = GReaderProvider::for_freshrss(server_url);
            sync_greader_feed(db, account, feed, provider).await
        }
        ProviderKind::Inoreader => {
            let (app_id, app_key) = {
                let db_guard = lock_db(db)?;
                let pref_repo = SqlitePreferenceRepository::new(db_guard.reader());
                (
                    pref_repo.get("inoreader_app_id").unwrap_or(None),
                    pref_repo.get("inoreader_app_key").unwrap_or(None),
                )
            };
            let provider = GReaderProvider::for_inoreader(app_id, app_key);
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
    let accounts: Vec<Account> = {
        let db_guard = lock_db(db)?;
        let account_repo = SqliteAccountRepository::new(db_guard.reader());
        account_repo.find_all()?
    };

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
) -> Result<SyncResult, AppError> {
    let accounts = {
        let db_guard = lock_db(&state.db)?;
        let account_repo = SqliteAccountRepository::new(db_guard.reader());
        account_repo
            .find_all()?
            .into_iter()
            .filter(|account| account.sync_on_startup)
            .collect::<Vec<_>>()
    };
    if accounts.is_empty() {
        return Ok(SyncResult {
            synced: false,
            total: 0,
            succeeded: 0,
            failed: Vec::new(),
            warnings: Vec::new(),
        });
    }
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
        let _ = app_handle.emit(SYNC_COMPLETED_EVENT, ());
        if should_emit_sync_succeeded(&result) {
            let _ = app_handle.emit(SYNC_SUCCEEDED_EVENT, ());
        }
    }
    Ok(result)
}

fn clear_scheduler_sync_status(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let repo = SqliteSyncStateRepository::new(db_guard.writer());
    let mut state = repo
        .get(account_id, SCHEDULER_SYNC_STATE_SCOPE)?
        .unwrap_or_else(|| SyncState {
            account_id: account_id.clone(),
            scope_key: SCHEDULER_SYNC_STATE_SCOPE.to_string(),
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
                match repo.purge_old_read(cutoff) {
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
    let reporter = SyncProgressReporter::new(app_handle.clone(), SyncProgressKind::ManualAll, {
        let db_guard = lock_db(&state.db)?;
        let account_repo = SqliteAccountRepository::new(db_guard.reader());
        account_repo.find_all()?.len()
    });
    let result = run_full_sync_with_progress(&state.db, &state.syncing, Some(reporter)).await?;
    if result.synced {
        enable_automatic_sync(
            state.automatic_sync_enabled.as_ref(),
            state.automatic_sync_notify.as_ref(),
        );
        let _ = app_handle.emit(SYNC_COMPLETED_EVENT, ());
        if should_emit_sync_succeeded(&result) {
            let _ = app_handle.emit(SYNC_SUCCEEDED_EVENT, ());
        }
    }
    Ok(result)
}

#[tauri::command]
pub async fn trigger_automatic_sync(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<SyncResult, AppError> {
    let reporter = SyncProgressReporter::new(app_handle.clone(), SyncProgressKind::Automatic, {
        let db_guard = lock_db(&state.db)?;
        let account_repo = SqliteAccountRepository::new(db_guard.reader());
        account_repo.find_all()?.len()
    });
    let result = run_automatic_sync_with_progress(
        &state.db,
        &state.syncing,
        state.automatic_sync_enabled.as_ref(),
        Some(reporter),
    )
    .await?;
    if result.synced {
        if !result.warnings.is_empty() {
            let _ = app_handle.emit(SYNC_WARNING_EVENT, result.warnings.clone());
        }
        let _ = app_handle.emit(SYNC_COMPLETED_EVENT, ());
        if should_emit_sync_succeeded(&result) {
            let _ = app_handle.emit(SYNC_SUCCEEDED_EVENT, ());
        }
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
    let state = repo.get(&AccountId(account_id), SCHEDULER_SYNC_STATE_SCOPE)?;
    Ok(match state {
        Some(sync_state) => AccountSyncStatus {
            last_error: sync_state.last_error,
            error_count: sync_state.error_count,
            next_retry_at: sync_state.next_retry_at,
        },
        None => AccountSyncStatus {
            last_error: None,
            error_count: 0,
            next_retry_at: None,
        },
    })
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
    if result.succeeded > 0 {
        let _ = app_handle.emit(SYNC_COMPLETED_EVENT, ());
        if should_emit_sync_succeeded(&result) {
            let _ = app_handle.emit(SYNC_SUCCEEDED_EVENT, ());
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
            if let Err(error) = clear_scheduler_sync_status(&state.db, &account.id) {
                warn!(
                    "Failed to clear scheduler sync status for account '{}' after feed sync: {error}",
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
    if result.succeeded > 0 {
        let _ = app_handle.emit(SYNC_COMPLETED_EVENT, ());
        if should_emit_sync_succeeded(&result) {
            let _ = app_handle.emit(SYNC_SUCCEEDED_EVENT, ());
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::feed::Feed;
    use crate::domain::provider::ProviderKind;
    use crate::domain::types::AccountId;
    use crate::infra::db::sqlite_feed::SqliteFeedRepository;
    use crate::repository::feed::FeedRepository;
    use mockito::Server;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Mutex;

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
}
