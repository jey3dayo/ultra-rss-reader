use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::State;
use tracing::warn;

use crate::commands::dto::{
    AccountSyncStatus, AccountSyncWarning, AccountSyncWarningDetail, AppError, SyncProgressKind,
    SyncResult,
};
use crate::commands::feed_commands::lock_db;
use crate::commands::AppState;
use crate::domain::account::Account;
use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_preference::SqlitePreferenceRepository;
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use crate::repository::account::AccountRepository;
use crate::repository::article::ArticleRepository;
use crate::repository::preference::PreferenceRepository;
use crate::repository::sync_state::{SyncState, SyncStateRepository, SyncStateScopeKey};

use super::account_sync::{
    run_full_sync_with_progress, run_local_account_startup_import_supplement,
    run_startup_sync_and_repair, run_sync_for_accounts_with_progress, StartupSyncAndRepairOutcome,
};
use super::progress::{
    emit_sync_event_log_only, emit_sync_warning_event, should_purge_old_articles_after_sync,
    SyncProgressReporter, SYNC_COMPLETED_EVENT, SYNC_SUCCEEDED_EVENT,
};

pub(crate) const STARTUP_REMOTE_STATE_REPAIR_KEY: &str = "startup_remote_state_repair_v1";
pub(crate) const STARTUP_REMOTE_STATE_REPAIR_VALUE: &str = "done";
use super::should_emit_sync_succeeded;

pub(crate) fn is_automatic_sync_enabled(automatic_sync_enabled: &AtomicBool) -> bool {
    automatic_sync_enabled.load(Ordering::SeqCst)
}

pub(crate) fn load_all_accounts(db: &Mutex<DbManager>) -> Result<Vec<Account>, AppError> {
    let db_guard = lock_db(db)?;
    let account_repo = SqliteAccountRepository::new(db_guard.reader());
    Ok(account_repo
        .find_all()?
        .into_iter()
        .filter(|account| !matches!(account.kind, ProviderKind::Quarantined))
        .collect())
}

pub(crate) fn map_account_sync_status(sync_state: Option<SyncState>) -> AccountSyncStatus {
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

pub(crate) fn enable_automatic_sync(
    automatic_sync_enabled: &AtomicBool,
    automatic_sync_notify: &tokio::sync::Notify,
) {
    if !automatic_sync_enabled.swap(true, Ordering::SeqCst) {
        automatic_sync_notify.notify_waiters();
    }
}

pub(crate) fn startup_remote_state_repair_pending(db: &Mutex<DbManager>) -> Result<bool, AppError> {
    let db_guard = lock_db(db)?;
    let preference_repo = SqlitePreferenceRepository::new(db_guard.reader());
    Ok(preference_repo
        .get(STARTUP_REMOTE_STATE_REPAIR_KEY)?
        .as_deref()
        != Some(STARTUP_REMOTE_STATE_REPAIR_VALUE))
}

pub(crate) fn prioritize_startup_sync_accounts(
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

pub(crate) fn mark_startup_remote_state_repair_complete(
    db: &Mutex<DbManager>,
) -> Result<(), AppError> {
    let db_guard = lock_db(db)?;
    let preference_repo = SqlitePreferenceRepository::new(db_guard.writer());
    preference_repo.set(
        STARTUP_REMOTE_STATE_REPAIR_KEY,
        STARTUP_REMOTE_STATE_REPAIR_VALUE,
    )?;
    Ok(())
}

pub(crate) fn startup_remote_state_repair_marker_warning(error: &AppError) -> AccountSyncWarning {
    AccountSyncWarning {
        account_id: "startup".to_string(),
        account_name: "Startup sync".to_string(),
        kind: crate::commands::dto::AccountSyncWarningKind::Generic,
        message: format!(
            "Startup remote-state repair completed, but the completion marker could not be saved: {error}"
        ),
        retry_at: None,
        retry_in_seconds: None,
        detail: AccountSyncWarningDetail::StartupRepairMarkerFailed {
            message: error.to_string(),
        },
    }
}

pub(crate) fn record_startup_remote_state_repair_complete(
    db: &Mutex<DbManager>,
    sync_result: &mut SyncResult,
) {
    if let Err(error) = mark_startup_remote_state_repair_complete(db) {
        warn!(
            "Startup remote-state repair completed but marker save failed; repair will be retried on next startup: {error}"
        );
        sync_result
            .warnings
            .push(startup_remote_state_repair_marker_warning(&error));
    }
}

pub(crate) fn startup_remote_state_repair_succeeded(
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

pub(crate) fn should_enable_automatic_sync_after_startup(
    sync_result: &SyncResult,
    startup_sync_accounts: &[Account],
    _repair_only_accounts: &[Account],
) -> bool {
    sync_result.synced && !startup_sync_accounts.is_empty()
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
    let local_startup_import_warnings = run_local_account_startup_import_supplement(
        &state.db,
        &all_accounts,
        &startup_sync_accounts,
    );
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
            warnings: local_startup_import_warnings,
        });
    }

    let StartupSyncAndRepairOutcome {
        mut sync_result,
        repaired_account_ids,
    } = run_startup_sync_and_repair(
        &state.db,
        &state.syncing,
        Some(app_handle.clone()),
        startup_sync_accounts.clone(),
        repair_only_accounts.clone(),
        local_startup_import_warnings,
    )
    .await?;

    if repair_pending
        && startup_remote_state_repair_succeeded(
            &startup_sync_accounts,
            &repair_only_accounts,
            &repaired_account_ids,
            &sync_result,
        )
    {
        record_startup_remote_state_repair_complete(&state.db, &mut sync_result);
    }

    if should_enable_automatic_sync_after_startup(
        &sync_result,
        &startup_sync_accounts,
        &repair_only_accounts,
    ) {
        enable_automatic_sync(
            state.automatic_sync_enabled.as_ref(),
            state.automatic_sync_notify.as_ref(),
        );
    }
    if should_purge_old_articles_after_sync(sync_result.synced) {
        emit_sync_event_log_only(&app_handle, SYNC_COMPLETED_EVENT, ());
        if should_emit_sync_succeeded(&sync_result) {
            emit_sync_event_log_only(&app_handle, SYNC_SUCCEEDED_EVENT, ());
        }
        purge_old_articles(&state.db);
    }
    Ok(sync_result)
}

pub(crate) fn clear_scheduler_sync_status(
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

pub(crate) async fn run_automatic_sync_for_accounts_with_progress(
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
                            account_id = %account.id.as_ref(),
                            count = n,
                            "Purged old read articles for account"
                        );
                    }
                    Ok(_) => {}
                    Err(e) => {
                        warn!(
                            account_id = %account.id.as_ref(),
                            "Failed to purge articles for account: {e}"
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
    if should_purge_old_articles_after_sync(result.synced) {
        emit_sync_warning_event(&app_handle, &result);
        emit_sync_event_log_only(&app_handle, SYNC_COMPLETED_EVENT, ());
        if should_emit_sync_succeeded(&result) {
            emit_sync_event_log_only(&app_handle, SYNC_SUCCEEDED_EVENT, ());
        }
        purge_old_articles(&state.db);
    }
    Ok(result)
}
