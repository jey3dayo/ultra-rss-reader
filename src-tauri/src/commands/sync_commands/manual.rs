// User-initiated sync commands live here; scheduler-originated entrypoints
// remain in scheduler.rs.
use std::sync::atomic::Ordering;

use tauri::State;
use tracing::warn;

use crate::commands::dto::{
    sync_issue_owner_for_app_error, AccountSyncError, AccountSyncStatus, AccountSyncWarning,
    AppError, SyncProgressKind, SyncResult,
};
use crate::commands::feed_commands::lock_db;
use crate::commands::AppState;
use crate::domain::types::{AccountId, FeedId};
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use crate::repository::account::AccountRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::sync_state::{SyncStateRepository, SyncStateScopeKey};

use super::account_sync::{run_sync_for_accounts_with_progress, sync_account, sync_feed};
use super::progress::{
    emit_sync_event_log_only, emit_sync_warning_event, should_emit_manual_single_sync_completion,
    SyncGuard, SyncProgressReporter, SYNC_COMPLETED_EVENT, SYNC_SUCCEEDED_EVENT,
};
use super::scheduler::{
    clear_scheduler_sync_status, enable_automatic_sync, load_all_accounts, map_account_sync_status,
    purge_old_articles,
};
use super::should_emit_sync_succeeded;

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
    if super::should_purge_old_articles_after_sync(result.synced) {
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
                    account_id = %account.id.as_ref(),
                    "Failed to clear scheduler sync status after manual sync: {error}"
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
                            detail: warning.detail,
                        }),
                );
            reporter.emit_account_finished(&account, true);
        }
        Err(e) => {
            warn!(account_id = %account.id.as_ref(), "Sync failed for account: {e}");
            result.failed.push(AccountSyncError {
                account_id: account.id.as_ref().to_string(),
                account_name: account.name.clone(),
                action_owner: Some(sync_issue_owner_for_app_error(&e)),
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
                            detail: warning.detail,
                        }),
                );
            reporter.emit_account_finished(&account, true);
        }
        Err(e) => {
            warn!(
                account_id = %account.id.as_ref(),
                feed_id = %feed.id.as_ref(),
                "Sync failed for feed: {e}"
            );
            result.failed.push(AccountSyncError {
                account_id: account.id.as_ref().to_string(),
                account_name: account.name.clone(),
                action_owner: Some(sync_issue_owner_for_app_error(&e)),
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
