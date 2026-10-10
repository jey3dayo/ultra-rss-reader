use super::*;
use crate::commands::sync_commands::finish_plan::FinishPlan;
use crate::commands::sync_commands::{plan_finish, FinishInput, SyncEntry};

fn input(synced: bool, succeeded: usize, failed: bool, warned: bool) -> FinishInput {
    FinishInput {
        synced,
        succeeded,
        has_failures: failed,
        has_warnings: warned,
        all_succeeded: !failed,
        has_startup_targets: false,
    }
}

const fn plan(
    emit_warning: bool,
    emit_completed: bool,
    emit_succeeded: bool,
    purge: bool,
    enable_automatic: bool,
) -> FinishPlan {
    FinishPlan {
        emit_warning,
        emit_completed,
        emit_succeeded,
        purge,
        enable_automatic,
    }
}

const NOTHING: FinishPlan = plan(false, false, false, false, false);

fn assert_cases(entry: SyncEntry, cases: &[(&str, FinishInput, FinishPlan)]) {
    for (name, case, expected) in cases {
        assert_eq!(plan_finish(case, entry), *expected, "{entry:?} / {name}");
    }
}

#[test]
fn manual_all_plan_requires_a_successful_account_to_complete_purge_and_enable_automatic_sync() {
    assert_cases(
        SyncEntry::ManualAll,
        &[
            ("guard rejected", input(false, 0, false, false), NOTHING),
            ("zero succeeded", input(true, 0, false, false), NOTHING),
            ("all failed", input(true, 0, true, false), NOTHING),
            (
                "all failed with warnings still warns",
                input(true, 0, true, true),
                plan(true, false, false, false, false),
            ),
            (
                "partial success",
                input(true, 1, true, false),
                plan(false, true, false, true, true),
            ),
            (
                "all succeeded",
                input(true, 2, false, false),
                plan(false, true, true, true, true),
            ),
            (
                "succeeded with warnings",
                input(true, 2, false, true),
                plan(true, true, false, true, true),
            ),
        ],
    );
}

#[test]
fn manual_account_plan_requires_a_successful_item_and_never_purges() {
    assert_cases(
        SyncEntry::ManualAccount,
        &[
            ("guard rejected", input(false, 0, false, false), NOTHING),
            ("zero succeeded", input(true, 0, false, false), NOTHING),
            ("failed", input(true, 0, true, false), NOTHING),
            (
                "succeeded",
                input(true, 1, false, false),
                plan(false, true, true, false, true),
            ),
            (
                "succeeded with warnings",
                input(true, 1, false, true),
                plan(true, true, false, false, true),
            ),
        ],
    );
}

#[test]
fn manual_feed_plan_matches_manual_account_except_it_does_not_enable_automatic_sync() {
    assert_cases(
        SyncEntry::ManualFeed,
        &[
            ("guard rejected", input(false, 0, false, false), NOTHING),
            ("zero succeeded", input(true, 0, false, false), NOTHING),
            ("failed", input(true, 0, true, false), NOTHING),
            (
                "succeeded",
                input(true, 1, false, false),
                plan(false, true, true, false, false),
            ),
            (
                "succeeded with warnings",
                input(true, 1, false, true),
                plan(true, true, false, false, false),
            ),
        ],
    );
}

#[test]
fn automatic_plan_purges_when_synced_and_never_enables_automatic_sync() {
    assert_cases(
        SyncEntry::Automatic,
        &[
            ("skipped", input(false, 0, false, false), NOTHING),
            (
                "zero succeeded still completes and purges",
                input(true, 0, false, false),
                plan(false, true, false, true, false),
            ),
            (
                "partial success",
                input(true, 1, true, false),
                plan(false, true, false, true, false),
            ),
            (
                "all succeeded",
                input(true, 2, false, false),
                plan(false, true, true, true, false),
            ),
            (
                "succeeded with warnings",
                input(true, 2, false, true),
                plan(true, true, false, true, false),
            ),
        ],
    );
}

#[test]
fn startup_plan_emits_warning_when_synced_and_result_has_warnings() {
    let with_targets = |case: FinishInput| FinishInput {
        has_startup_targets: true,
        ..case
    };
    assert_cases(
        SyncEntry::Startup,
        &[
            (
                "guard rejected",
                with_targets(input(false, 0, false, false)),
                NOTHING,
            ),
            (
                "all succeeded",
                with_targets(input(true, 2, false, false)),
                plan(false, true, true, true, true),
            ),
            (
                "succeeded with warnings",
                with_targets(input(true, 2, false, true)),
                plan(true, true, false, true, true),
            ),
            (
                "partial success",
                with_targets(input(true, 1, true, false)),
                plan(false, true, false, true, true),
            ),
            (
                "zero succeeded",
                with_targets(input(true, 0, false, false)),
                plan(false, true, false, true, true),
            ),
            (
                "repair only run has no startup targets",
                input(true, 1, false, false),
                plan(false, true, true, true, false),
            ),
        ],
    );
}

#[test]
fn scheduler_loop_plan_warns_without_sync_and_succeeds_only_when_every_account_succeeded() {
    let scheduler_input = |synced: bool, all_succeeded: bool, warned: bool| FinishInput {
        synced,
        succeeded: 0,
        has_failures: false,
        has_warnings: warned,
        all_succeeded,
        has_startup_targets: false,
    };
    assert_cases(
        SyncEntry::SchedulerLoop,
        &[
            ("nothing due", scheduler_input(false, true, false), NOTHING),
            (
                "warning without any sync",
                scheduler_input(false, true, true),
                plan(true, false, false, false, false),
            ),
            (
                "all succeeded",
                scheduler_input(true, true, false),
                plan(false, true, true, true, false),
            ),
            (
                "some account failed",
                scheduler_input(true, false, false),
                plan(false, true, false, true, false),
            ),
            (
                "all succeeded but warnings present",
                scheduler_input(true, true, true),
                plan(true, true, false, true, false),
            ),
        ],
    );
}

#[test]
fn from_result_maps_sync_result_fields() {
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

    let mapped = FinishInput::from_result(&result);

    assert!(mapped.synced);
    assert_eq!(mapped.succeeded, 1);
    assert!(mapped.has_failures);
    assert!(!mapped.has_warnings);
}

#[test]
fn manual_all_sync_result_with_warnings_emits_warning_instead_of_succeeded() {
    let result = SyncResult {
        synced: true,
        total: 1,
        succeeded: 1,
        failed: Vec::new(),
        warnings: vec![AccountSyncWarning {
            account_id: "acc-1".to_string(),
            account_name: "FreshRSS".to_string(),
            kind: AccountSyncWarningKind::Generic,
            message: "retry pending".to_string(),
            retry_at: None,
            retry_in_seconds: None,
            detail: AccountSyncWarningDetail::PendingMutationRetry {
                mutation: "mark_read".to_string(),
            },
        }],
    };

    let planned = plan_finish(&FinishInput::from_result(&result), SyncEntry::ManualAll);

    assert!(planned.emit_warning);
    assert!(!planned.emit_succeeded);
}
