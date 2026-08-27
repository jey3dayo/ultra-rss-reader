use super::*;

#[test]
fn sync_progress_completed_is_monotonic_and_clamped_to_total() {
    let completed = AtomicUsize::new(0);

    assert_eq!(next_sync_progress_completed(&completed, 2), 1);
    assert_eq!(next_sync_progress_completed(&completed, 2), 2);
    assert_eq!(next_sync_progress_completed(&completed, 2), 2);
    assert_eq!(completed.load(Ordering::SeqCst), 2);
}

#[test]
fn sync_progress_session_id_advances_per_reporter() {
    SYNC_PROGRESS_SESSION_ID.store(0, Ordering::SeqCst);

    assert_eq!(next_sync_progress_session_id(), 1);
    assert_eq!(next_sync_progress_session_id(), 2);
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
            action_owner: None,
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
            detail: AccountSyncWarningDetail::AccountSkippedEntries {
                account_name: "FreshRSS".to_string(),
                count: 1,
            },
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
            detail: AccountSyncWarningDetail::AccountSkippedEntries {
                account_name: "FreshRSS".to_string(),
                count: 1,
            },
        }],
    };

    assert!(should_emit_sync_warning(&result));
}

#[test]
fn purge_contract_runs_for_manual_startup_and_scheduler_sync_successes() {
    assert!(should_purge_old_articles_after_sync(true));
}

#[test]
fn purge_contract_skips_when_scheduler_or_automatic_sync_is_disabled() {
    assert!(!should_purge_old_articles_after_sync(false));
}

// Issue #102: for the manual single-account/single-feed commands
// (`trigger_sync_account` / `trigger_sync_feed`), `emit_finished` is called
// unconditionally while `sync-completed` goes out only when this predicate
// holds. So "sync finished" and "the frontend was told to refresh the feed
// list" are separate signals, and the sidebar must not treat the finished
// progress stage as "the list is up to date". The cases below are the ones the
// other predicate tests do not cover: nothing succeeded without an explicit
// failure, and a run the sync guard rejected outright.
#[test]
fn manual_single_sync_completion_is_suppressed_without_a_successful_item() {
    let nothing_succeeded = SyncResult {
        synced: true,
        total: 1,
        succeeded: 0,
        failed: Vec::new(),
        warnings: Vec::new(),
    };
    let guard_rejected = SyncResult {
        synced: false,
        total: 0,
        succeeded: 0,
        failed: Vec::new(),
        warnings: Vec::new(),
    };

    assert!(!should_emit_manual_single_sync_completion(
        &nothing_succeeded
    ));
    assert!(!should_emit_manual_single_sync_completion(&guard_rejected));
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
            action_owner: None,
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
