use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter, State};
use tracing::warn;

use crate::commands::dto::{
    AccountSyncError, AppError, SyncProgressEvent, SyncProgressKind, SyncProgressStage, SyncResult,
};
use crate::commands::AppState;
use crate::domain::account::Account;
use crate::domain::provider::ProviderKind;
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_preference::SqlitePreferenceRepository;
use crate::infra::provider::greader::GReaderProvider;
use crate::infra::provider::local::LocalProvider;
use crate::repository::account::AccountRepository;
use crate::repository::article::ArticleRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::preference::PreferenceRepository;

use super::feed_commands::lock_db;
use super::sync_providers::{sync_greader_account, sync_local_feed};

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
            "sync-progress",
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

    fn emit_started(&self, account: Option<&Account>) {
        self.emit(SyncProgressStage::Started, 0, account, None);
    }

    fn emit_account_started(&self, account: &Account) {
        self.emit(
            SyncProgressStage::AccountStarted,
            self.completed.load(Ordering::SeqCst),
            Some(account),
            None,
        );
    }

    fn emit_account_finished(&self, account: &Account, success: bool) {
        let completed = self.completed.fetch_add(1, Ordering::SeqCst) + 1;
        self.emit(
            SyncProgressStage::AccountFinished,
            completed,
            Some(account),
            Some(success),
        );
    }

    fn emit_finished(&self, success: bool) {
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

fn enable_automatic_sync(
    automatic_sync_enabled: &AtomicBool,
    automatic_sync_notify: &tokio::sync::Notify,
) {
    if !automatic_sync_enabled.swap(true, Ordering::SeqCst) {
        automatic_sync_notify.notify_waiters();
    }
}

/// Sync a single account, returning Ok(()) on success or Err on failure.
pub(crate) async fn sync_account(db: &Mutex<DbManager>, account: &Account) -> Result<(), AppError> {
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
            Ok(())
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
        });
    }
    let _guard = SyncGuard(syncing);

    let accounts: Vec<Account> = {
        let db_guard = lock_db(db)?;
        let account_repo = SqliteAccountRepository::new(db_guard.reader());
        account_repo.find_all()?
    };

    let total = accounts.len();
    let mut succeeded = 0usize;
    let mut failed = Vec::new();

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
            Ok(()) => succeeded += 1,
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
    })
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
        let _ = app_handle.emit("sync-completed", ());
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
        let _ = app_handle.emit("sync-completed", ());
    }
    Ok(result)
}

#[tauri::command]
pub async fn trigger_sync_account(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    account_id: String,
) -> Result<SyncResult, AppError> {
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
    };
    match sync_account(&state.db, &account).await {
        Ok(()) => {
            result.succeeded = 1;
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
        let _ = app_handle.emit("sync-completed", ());
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
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
}
