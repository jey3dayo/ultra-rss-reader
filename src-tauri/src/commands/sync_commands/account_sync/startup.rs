//! Startup-only sync paths: Local-account import supplement and the guarded startup repair + sync pass.

use super::*;

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

fn log_startup_finish_result(outcome: &StartupSyncAndRepairOutcome, finish_warning_start: usize) {
    for warning in outcome
        .sync_result
        .warnings
        .iter()
        .skip(finish_warning_start)
    {
        log_sync_warning(
            SyncTrigger::Startup,
            &ProviderKind::FreshRss,
            warning.kind,
            &warning.detail,
        );
    }
    log_sync_completion(SyncTrigger::Startup, None, &outcome.sync_result);
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
/// `finish` runs once the outcome is complete and, when the guard was
/// acquired, while it is still held.
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
    finish: impl FnOnce(&mut StartupSyncAndRepairOutcome),
) -> Result<StartupSyncAndRepairOutcome, AppError> {
    if syncing
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        tracing::info!("Sync already in progress, skipping startup sync");
        let mut outcome = StartupSyncAndRepairOutcome {
            sync_result: SyncResult {
                synced: false,
                total: 0,
                succeeded: 0,
                failed: Vec::new(),
                warnings: local_startup_import_warnings,
            },
            repaired_account_ids: Vec::new(),
        };
        let finish_warning_start = outcome.sync_result.warnings.len();
        finish(&mut outcome);
        log_startup_finish_result(&outcome, finish_warning_start);
        return Ok(outcome);
    }
    let _guard = SyncGuard(syncing);

    let mut repaired_account_ids = Vec::new();
    let mut repair_failures = Vec::new();
    for account in &repair_only_accounts {
        match GReaderSession::establish(account).await {
            Ok(session) => match repair_greader_remote_state(db, account, &session).await {
                Ok(()) => repaired_account_ids.push(account.id.as_ref().to_string()),
                Err(error) => {
                    log_sync_failure(SyncTrigger::StartupRepair, &account.kind, &error);
                    repair_failures.push(AccountSyncError {
                        account_id: account.id.as_ref().to_string(),
                        account_name: account.name.clone(),
                        action_owner: Some(sync_issue_owner_for_app_error(&error)),
                        message: error.to_string(),
                    });
                }
            },
            Err(error @ SessionError::MissingUsername) => {
                error.log_skip_with_context(account, "remote-state repair");
                repaired_account_ids.push(account.id.as_ref().to_string());
            }
            Err(error @ SessionError::MissingServerUrl) => {
                let error = error.into_user_visible();
                log_sync_failure(SyncTrigger::StartupRepair, &account.kind, &error);
                repair_failures.push(AccountSyncError {
                    account_id: account.id.as_ref().to_string(),
                    account_name: account.name.clone(),
                    action_owner: Some(sync_issue_owner_for_app_error(&error)),
                    message: error.to_string(),
                });
            }
            Err(SessionError::Auth(error) | SessionError::Credential(error)) => {
                log_sync_failure(SyncTrigger::StartupRepair, &account.kind, &error);
                repair_failures.push(AccountSyncError {
                    account_id: account.id.as_ref().to_string(),
                    account_name: account.name.clone(),
                    action_owner: Some(sync_issue_owner_for_app_error(&error)),
                    message: error.to_string(),
                });
            }
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
        let mut result = run_sync_for_accounts_guarded(
            db,
            startup_sync_accounts,
            Some(reporter),
            SyncTrigger::Startup,
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
    sync_result.warnings.extend(local_startup_import_warnings);

    let mut outcome = StartupSyncAndRepairOutcome {
        sync_result,
        repaired_account_ids,
    };
    let finish_warning_start = outcome.sync_result.warnings.len();
    finish(&mut outcome);
    log_startup_finish_result(&outcome, finish_warning_start);
    Ok(outcome)
}
