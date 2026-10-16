//! Per-account outcome handling for scheduled syncs and tick-finish events.

use super::*;

pub(super) fn finalize_successful_background_account_sync(
    account: &Account,
    diagnostic_warnings: Vec<AccountSyncWarning>,
    warnings_to_emit: &mut Vec<AccountSyncWarning>,
) {
    tracing::info!(account_id = %account.id.as_ref(), "Background sync completed");
    for warning in &diagnostic_warnings {
        tracing::warn!(
            account_id = %account.id.as_ref(),
            kind = ?warning.kind,
            "Background sync warning"
        );
        push_scheduler_warning(warnings_to_emit, warning.clone());
    }
    log_background_sync_outcome(&account.kind, Ok(()), &diagnostic_warnings);
}

pub(super) fn finalize_failed_background_account_sync(
    db: &Mutex<DbManager>,
    account: &Account,
    error: &AppError,
    warnings_to_emit: &mut Vec<AccountSyncWarning>,
) -> Duration {
    let mut diagnostic_warnings = Vec::new();
    let backoff = complete_failed_account_sync(db, account, error, &mut diagnostic_warnings);
    log_background_sync_outcome(&account.kind, Err(error), &diagnostic_warnings);
    for warning in diagnostic_warnings {
        push_scheduler_warning(warnings_to_emit, warning);
    }
    backoff
}

pub(super) fn handle_scheduled_sync_success(
    db: &Mutex<DbManager>,
    schedules: &mut HashMap<String, AccountSchedule>,
    account: &Account,
    diagnostic_warnings: Vec<AccountSyncWarning>,
    warnings_to_emit: &mut Vec<AccountSyncWarning>,
) -> bool {
    let account_id_str = account.id.as_ref().to_string();
    let mut all_succeeded = true;
    match load_scheduler_account(db, &account.id) {
        Ok(Some(latest_account)) => {
            if let Err(error) = reset_error_count(db, &account.id) {
                tracing::warn!(
                    account_id = %account.id.as_ref(),
                    "Background sync could not reset backoff state: {error}"
                );
                all_succeeded = false;
            }
            schedule_completed_account_sync(schedules, &latest_account, Instant::now());
        }
        Ok(None) => {
            tracing::info!(
                account_id = %account.id.as_ref(),
                "Background sync completed for deleted account; pruning schedule"
            );
            schedules.remove(&account_id_str);
        }
        Err(error) => {
            tracing::warn!(
                account_id = %account.id.as_ref(),
                "Background sync could not refresh account before rescheduling: {error}"
            );
            all_succeeded = false;
        }
    }
    finalize_successful_background_account_sync(account, diagnostic_warnings, warnings_to_emit);
    all_succeeded
}

pub(super) fn handle_scheduled_sync_failure(
    db: &Mutex<DbManager>,
    schedules: &mut HashMap<String, AccountSchedule>,
    account: &Account,
    error: &AppError,
    reporter: &SyncProgressReporter,
    warnings_to_emit: &mut Vec<AccountSyncWarning>,
) {
    tracing::warn!(account_id = %account.id.as_ref(), "Background sync failed: {error}");
    log_sync_failure(SyncTrigger::Background, &account.kind, error);
    reporter.emit_account_finished(account, false);
    let mut finalized_with_backoff = false;
    match load_scheduler_account(db, &account.id) {
        Ok(Some(latest_account)) => {
            let backoff = finalize_failed_background_account_sync(
                db,
                &latest_account,
                error,
                warnings_to_emit,
            );
            finalized_with_backoff = true;
            schedule_failed_account_sync(schedules, &latest_account, Instant::now(), backoff);
        }
        Ok(None) => {
            tracing::info!(
                account_id = %account.id.as_ref(),
                "Background sync failed for deleted account; pruning schedule"
            );
            schedules.remove(&account.id.as_ref().to_string());
        }
        Err(refresh_error) => {
            tracing::warn!(
                account_id = %account.id.as_ref(),
                "Background sync could not refresh account before scheduling retry: {refresh_error}"
            );
        }
    }
    if !finalized_with_backoff {
        log_background_sync_outcome(&account.kind, Err(error), &[]);
    }
}

pub(super) fn handle_scheduled_sync_panic(
    db: &Mutex<DbManager>,
    schedules: &mut HashMap<String, AccountSchedule>,
    account: &Account,
    reporter: &SyncProgressReporter,
    warnings_to_emit: &mut Vec<AccountSyncWarning>,
) {
    tracing::error!("Background sync panicked for account [redacted account], scheduler continues");
    log_sync_panic(SyncTrigger::Background, &account.kind);
    reporter.emit_account_finished(account, false);
    let panic_error = AppError::UserVisible {
        message: "Background sync panicked".to_string(),
    };
    let mut finalized_with_backoff = false;
    match load_scheduler_account(db, &account.id) {
        Ok(Some(latest_account)) => {
            let backoff = finalize_failed_background_account_sync(
                db,
                &latest_account,
                &panic_error,
                warnings_to_emit,
            );
            finalized_with_backoff = true;
            schedule_failed_account_sync(schedules, &latest_account, Instant::now(), backoff);
        }
        Ok(None) => {
            tracing::info!(
                "Background sync panicked for deleted account [redacted account]; pruning schedule"
            );
            schedules.remove(&account.id.as_ref().to_string());
        }
        Err(error) => {
            tracing::warn!(
                "Background sync could not refresh account [redacted account] before scheduling retry after panic: {error}"
            );
        }
    }
    if !finalized_with_backoff {
        log_background_sync_outcome(&account.kind, Err(&panic_error), &[]);
    }
}

pub(super) fn emit_scheduler_tick_finish(
    app_handle: &AppHandle,
    db: &Mutex<DbManager>,
    any_synced: bool,
    all_succeeded: bool,
    warnings_to_emit: Vec<AccountSyncWarning>,
) {
    let plan = plan_finish(
        &FinishInput {
            synced: any_synced,
            succeeded: 0,
            has_failures: false,
            has_warnings: !warnings_to_emit.is_empty(),
            all_succeeded,
            has_startup_targets: false,
        },
        SyncEntry::SchedulerLoop,
    );

    if plan.emit_warning {
        if let Err(e) = app_handle.emit(SYNC_WARNING_EVENT, warnings_to_emit) {
            tracing::warn!("Failed to emit sync-warning event: {e}");
        }
    }

    if plan.emit_completed {
        if let Err(e) = app_handle.emit(SYNC_COMPLETED_EVENT, ()) {
            tracing::warn!("Failed to emit sync-completed event: {e}");
        }
    }
    if plan.emit_succeeded {
        if let Err(e) = app_handle.emit(SYNC_SUCCEEDED_EVENT, ()) {
            tracing::warn!("Failed to emit sync-succeeded event: {e}");
        }
    }
    if plan.purge {
        purge_old_articles(db);
    }
}
