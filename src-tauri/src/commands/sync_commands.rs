use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::{Emitter, State};
use tracing::warn;

use crate::commands::dto::{AccountSyncError, AppError, SyncResult};
use crate::commands::AppState;
use crate::domain::account::Account;
use crate::domain::provider::ProviderKind;
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_preference::SqlitePreferenceRepository;
use crate::infra::provider::greader::GReaderProvider;
use crate::infra::provider::local::LocalProvider;
use crate::repository::account::AccountRepository;
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

fn is_automatic_sync_enabled(automatic_sync_enabled: &AtomicBool) -> bool {
    automatic_sync_enabled.load(Ordering::SeqCst)
}

fn enable_automatic_sync(automatic_sync_enabled: &AtomicBool) {
    automatic_sync_enabled.store(true, Ordering::SeqCst);
}

/// Sync a single account, returning Ok(()) on success or Err on failure.
async fn sync_account(db: &Mutex<DbManager>, account: &Account) -> Result<(), AppError> {
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

    // Sync accounts concurrently using join_all
    let futures: Vec<_> = accounts
        .iter()
        .map(|account| sync_account(db, account))
        .collect();
    let results = futures::future::join_all(futures).await;

    for (account, result) in accounts.iter().zip(results) {
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
    if !is_automatic_sync_enabled(automatic_sync_enabled) {
        tracing::info!("Automatic sync is disabled until the first manual sync completes");
        return Ok(SyncResult {
            synced: false,
            total: 0,
            succeeded: 0,
            failed: Vec::new(),
        });
    }

    run_full_sync(db, syncing).await
}

/// Get the minimum sync interval from all accounts (defaults to 3600s if no accounts).
pub fn get_min_sync_interval(db: &Mutex<DbManager>) -> std::time::Duration {
    const DEFAULT_INTERVAL_SECS: u64 = 3600;

    let secs = lock_db(db)
        .ok()
        .and_then(|db_guard| {
            let repo = SqliteAccountRepository::new(db_guard.reader());
            repo.find_all().ok()
        })
        .and_then(|accounts| {
            accounts
                .iter()
                .map(|a| a.sync_interval_secs)
                .filter(|&s| s > 0)
                .min()
        })
        .map(|s| s as u64)
        .unwrap_or(DEFAULT_INTERVAL_SECS);

    std::time::Duration::from_secs(secs)
}

#[tauri::command]
pub async fn trigger_sync(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<SyncResult, AppError> {
    let result = run_full_sync(&state.db, &state.syncing).await?;
    if result.synced {
        enable_automatic_sync(state.automatic_sync_enabled.as_ref());
        let _ = app_handle.emit("sync-completed", ());
    }
    Ok(result)
}

#[tauri::command]
pub async fn trigger_automatic_sync(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<SyncResult, AppError> {
    let result = run_automatic_sync(
        &state.db,
        &state.syncing,
        state.automatic_sync_enabled.as_ref(),
    )
    .await?;
    if result.synced {
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
}
