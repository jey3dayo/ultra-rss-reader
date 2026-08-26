use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Instant;

use tauri::AppHandle;
use tracing::{info, warn};

use crate::commands::dto::{
    sync_issue_owner_for_app_error, AccountSyncError, AccountSyncWarning, AppError,
    SyncProgressKind, SyncResult,
};
use crate::commands::feed_commands::lock_db;
use crate::commands::sync_providers::{
    redacted_feed_host_class, repair_greader_remote_state, sync_greader_account, sync_greader_feed,
    sync_local_feed, GReaderSession, ProviderSyncOutcome, SessionError,
};
use crate::domain::account::Account;
use crate::domain::feed::Feed;
use crate::domain::provider::ProviderKind;
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::repository::feed::FeedRepository;

use super::local_import_export::{
    local_feed_sync_warning, local_provider, run_local_account_auto_export,
    run_local_account_auto_import,
};
use super::progress::{SyncGuard, SyncProgressReporter};
use super::scheduler::{clear_scheduler_sync_status, load_all_accounts};

/// Sync a single account, returning warnings on soft anomalies and Err on hard failures.
pub(crate) async fn sync_account(
    db: &Mutex<DbManager>,
    account: &Account,
) -> Result<ProviderSyncOutcome, AppError> {
    match account.kind {
        ProviderKind::Local => {
            let provider = local_provider();
            let mut warnings = Vec::new();
            if let Some(warning) = run_local_account_auto_import(db, &account.id) {
                warnings.push(warning);
            }
            let feeds = {
                let db_guard = lock_db(db)?;
                let feed_repo = SqliteFeedRepository::new(db_guard.reader());
                feed_repo.find_by_account(&account.id)?
            };
            for feed in &feeds {
                if let Err(error) = sync_local_feed(db, &provider, &account.id, feed).await {
                    warn!(
                        account_id = %account.id.as_ref(),
                        feed_id = %feed.id.as_ref(),
                        host_class = redacted_feed_host_class(&feed.url),
                        "Failed to pull entries for local feed: {error}"
                    );
                    warnings.push(local_feed_sync_warning(feed, &error));
                }
            }
            if let Some(warning) = run_local_account_auto_export(db, &account.id) {
                warnings.push(warning);
            }
            Ok(ProviderSyncOutcome { warnings })
        }
        ProviderKind::FreshRss => {
            let auth_started_at = Instant::now();
            let session = match GReaderSession::establish(account).await {
                Ok(session) => session,
                Err(error @ SessionError::MissingUsername) => {
                    error.log_skip(account);
                    return Ok(ProviderSyncOutcome::default());
                }
                Err(error @ SessionError::MissingServerUrl) => {
                    return Err(error.into_user_visible());
                }
                Err(SessionError::Auth(error)) => return Err(error),
            };
            info!(
                account_id = %account.id.as_ref(),
                phase = "auth",
                elapsed_ms = auth_started_at.elapsed().as_millis() as u64,
                "FreshRSS sync phase completed"
            );
            sync_greader_account(db, account, &session).await
        }
        ProviderKind::Quarantined => Err(AppError::UserVisible {
            message: "Account configuration is quarantined".into(),
        }),
    }
}

pub(crate) async fn sync_feed(
    db: &Mutex<DbManager>,
    account: &Account,
    feed: &Feed,
) -> Result<ProviderSyncOutcome, AppError> {
    match account.kind {
        ProviderKind::Local => {
            let provider = local_provider();
            sync_local_feed(db, &provider, &account.id, feed).await?;
            Ok(ProviderSyncOutcome::default())
        }
        ProviderKind::FreshRss => {
            let session = match GReaderSession::establish(account).await {
                Ok(session) => session,
                Err(error @ SessionError::MissingUsername) => {
                    error.log_skip_with_context(account, "single-feed sync");
                    return Ok(ProviderSyncOutcome::default());
                }
                Err(error @ SessionError::MissingServerUrl) => {
                    return Err(error.into_user_visible());
                }
                Err(SessionError::Auth(error)) => return Err(error),
            };
            sync_greader_feed(db, account, feed, &session).await
        }
        ProviderKind::Quarantined => Err(AppError::UserVisible {
            message: "Account configuration is quarantined".into(),
        }),
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

pub(crate) async fn run_full_sync_with_progress(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    reporter: Option<SyncProgressReporter>,
) -> Result<SyncResult, AppError> {
    let accounts = load_all_accounts(db)?;

    run_sync_for_accounts_with_progress(db, syncing, accounts, reporter).await
}

pub(crate) async fn run_sync_for_accounts_with_progress(
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

    run_sync_for_accounts_guarded(db, accounts, reporter).await
}

/// Runs the account-sync body assuming the `syncing` flag/[`SyncGuard`] is
/// already held by the caller. Callers that need to hold the guard across
/// additional work (e.g. a startup remote-state repair step that must not
/// race with a concurrent sync) should acquire the CAS themselves and call
/// this function directly instead of `run_sync_for_accounts_with_progress`,
/// which would otherwise fail its own CAS against the caller's guard.
pub(crate) async fn run_sync_for_accounts_guarded(
    db: &Mutex<DbManager>,
    accounts: Vec<Account>,
    reporter: Option<SyncProgressReporter>,
) -> Result<SyncResult, AppError> {
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
                        account_id = %account.id.as_ref(),
                        "Failed to clear scheduler sync status after manual sync: {error}"
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
                            detail: warning.detail,
                        }),
                );
            }
            Err(e) => {
                warn!(account_id = %account.id.as_ref(), "Sync failed for account: {e}");
                failed.push(AccountSyncError {
                    account_id: account.id.as_ref().to_string(),
                    account_name: account.name.clone(),
                    action_owner: Some(sync_issue_owner_for_app_error(&e)),
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

/// Runs [`run_local_account_auto_import`] for Local accounts that have
/// `sync_on_startup` disabled and are therefore excluded from the startup
/// feed-sync set below. Accounts already in `startup_sync_accounts` are
/// covered by the auto-import hook inside `sync_account`, so this only
/// supplements the ones that would otherwise never see their local sync
/// folder read until a manual sync or the periodic scheduler runs.
pub(crate) fn run_local_account_startup_import_supplement(
    db: &Mutex<DbManager>,
    all_accounts: &[Account],
    startup_sync_accounts: &[Account],
) -> Vec<AccountSyncWarning> {
    let startup_ids = startup_sync_accounts
        .iter()
        .map(|account| account.id.as_ref())
        .collect::<std::collections::HashSet<_>>();

    all_accounts
        .iter()
        .filter(|account| {
            matches!(account.kind, ProviderKind::Local)
                && !startup_ids.contains(account.id.as_ref())
        })
        .filter_map(|account| {
            run_local_account_auto_import(db, &account.id).map(|warning| AccountSyncWarning {
                account_id: account.id.as_ref().to_string(),
                account_name: account.name.clone(),
                kind: warning.kind,
                message: warning.message,
                retry_at: warning.retry_at,
                retry_in_seconds: warning.retry_in_seconds,
                detail: warning.detail,
            })
        })
        .collect()
}

pub(crate) struct StartupSyncAndRepairOutcome {
    pub(crate) sync_result: SyncResult,
    pub(crate) repaired_account_ids: Vec<String>,
}

/// Runs the startup remote-state repair loop and (if any) the startup
/// account sync under a single `syncing` guard acquired up front.
///
/// The repair loop awaits network I/O (authenticate / pull_state) and calls
/// `apply_remote_state`, so it must not run concurrently with a manually or
/// scheduler-triggered sync. Acquiring the guard here, before the repair
/// loop starts, closes that race: a concurrent sync attempt now fails its
/// own CAS and returns immediately instead of racing the repair's
/// remote-state apply. See
/// `.claude/rules/remote-state-reconciliation.md`.
///
/// `app_handle` is only required when `startup_sync_accounts` is non-empty
/// (it feeds the `SyncProgressReporter`); callers driving a repair-only
/// startup pass may omit it.
pub(crate) async fn run_startup_sync_and_repair(
    db: &Mutex<DbManager>,
    syncing: &AtomicBool,
    app_handle: Option<AppHandle>,
    startup_sync_accounts: Vec<Account>,
    repair_only_accounts: Vec<Account>,
    local_startup_import_warnings: Vec<AccountSyncWarning>,
) -> Result<StartupSyncAndRepairOutcome, AppError> {
    if syncing
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        tracing::info!("Sync already in progress, skipping startup sync");
        return Ok(StartupSyncAndRepairOutcome {
            sync_result: SyncResult {
                synced: false,
                total: 0,
                succeeded: 0,
                failed: Vec::new(),
                warnings: local_startup_import_warnings,
            },
            repaired_account_ids: Vec::new(),
        });
    }
    let _guard = SyncGuard(syncing);

    let mut repaired_account_ids = Vec::new();
    let mut repair_failures = Vec::new();
    for account in &repair_only_accounts {
        match GReaderSession::establish(account).await {
            Ok(session) => match repair_greader_remote_state(db, account, &session).await {
                Ok(()) => repaired_account_ids.push(account.id.as_ref().to_string()),
                Err(error) => repair_failures.push(AccountSyncError {
                    account_id: account.id.as_ref().to_string(),
                    account_name: account.name.clone(),
                    action_owner: Some(sync_issue_owner_for_app_error(&error)),
                    message: error.to_string(),
                }),
            },
            Err(error @ SessionError::MissingUsername) => {
                error.log_skip_with_context(account, "remote-state repair");
                repaired_account_ids.push(account.id.as_ref().to_string());
            }
            Err(error @ SessionError::MissingServerUrl) => {
                let error = error.into_user_visible();
                repair_failures.push(AccountSyncError {
                    account_id: account.id.as_ref().to_string(),
                    account_name: account.name.clone(),
                    action_owner: Some(sync_issue_owner_for_app_error(&error)),
                    message: error.to_string(),
                });
            }
            Err(SessionError::Auth(error)) => repair_failures.push(AccountSyncError {
                account_id: account.id.as_ref().to_string(),
                account_name: account.name.clone(),
                action_owner: Some(sync_issue_owner_for_app_error(&error)),
                message: error.to_string(),
            }),
        }
    }

    let mut sync_result = if startup_sync_accounts.is_empty() {
        SyncResult {
            synced: !repaired_account_ids.is_empty(),
            total: repair_only_accounts.len(),
            succeeded: repaired_account_ids.len(),
            failed: repair_failures.clone(),
            warnings: Vec::new(),
        }
    } else {
        let app_handle =
            app_handle.expect("app_handle is required when startup_sync_accounts is non-empty");
        let reporter = SyncProgressReporter::new(
            app_handle,
            SyncProgressKind::ManualAll,
            startup_sync_accounts.len(),
        );
        // The syncing guard is already held above, so call the guarded body
        // directly rather than `run_sync_for_accounts_with_progress`, which
        // would fail its own CAS against our already-true `syncing` flag.
        let mut result =
            run_sync_for_accounts_guarded(db, startup_sync_accounts, Some(reporter)).await?;
        result.total += repair_only_accounts.len();
        result.succeeded += repaired_account_ids.len();
        result.failed.extend(repair_failures.clone());
        if !repair_failures.is_empty() {
            result.synced = true;
        }
        result
    };
    sync_result.warnings.extend(local_startup_import_warnings);

    Ok(StartupSyncAndRepairOutcome {
        sync_result,
        repaired_account_ids,
    })
}
