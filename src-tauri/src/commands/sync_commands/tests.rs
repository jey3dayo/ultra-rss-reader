use super::*;
use crate::commands::start_database_maintenance;
use crate::domain::account::ConnectionVerificationStatus;
use crate::domain::feed::Feed;
use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::repository::feed::FeedRepository;
use mockito::Server;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Mutex;

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

#[tokio::test]
async fn run_full_sync_skips_when_already_syncing() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let syncing = AtomicBool::new(true); // already syncing

    let result = run_full_sync(&db, &syncing).await;

    assert!(result.is_ok());
    let sync_result = result.unwrap();
    assert!(!sync_result.synced, "should skip when sync in progress");
}

/// Regression test for the startup remote-state repair race: the repair
/// loop must be gated by the same `syncing` guard as manual/scheduler
/// syncs, checked *before* the repair loop starts (not only around the
/// later `run_sync_for_accounts_*` call). Before the fix,
/// `trigger_startup_sync` awaited `repair_greader_remote_state` for
/// `repair_only_accounts` without ever consulting `state.syncing`, so a
/// concurrent manual/scheduler sync could run its `apply_remote_state`
/// alongside the repair's. See
/// `.claude/rules/remote-state-reconciliation.md`.
#[tokio::test]
async fn run_startup_sync_and_repair_skips_repair_when_sync_already_in_progress() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    // Simulate a manual/scheduler sync already holding the guard.
    let syncing = AtomicBool::new(true);
    let repair_only_account =
        test_sync_command_account("repair-only-fresh", ProviderKind::FreshRss, false);
    let warnings = vec![AccountSyncWarning {
        account_id: "local-account".to_string(),
        account_name: "Local".to_string(),
        kind: AccountSyncWarningKind::Generic,
        message: "warn".to_string(),
        retry_at: None,
        retry_in_seconds: None,
        detail: AccountSyncWarningDetail::LocalAccountSyncOperationFailed {
            operation: "import".to_string(),
            message: "warn".to_string(),
        },
    }];

    let outcome = run_startup_sync_and_repair(
        &db,
        &syncing,
        None,
        Vec::new(),
        vec![repair_only_account],
        warnings.clone(),
    )
    .await
    .expect("startup sync/repair helper should not error when guard is contended");

    assert!(
        !outcome.sync_result.synced,
        "startup repair should not run while another sync holds the guard"
    );
    assert_eq!(outcome.sync_result.total, 0);
    assert_eq!(outcome.sync_result.succeeded, 0);
    assert!(
        outcome.sync_result.failed.is_empty(),
        "repair loop must not have executed at all: {:?}",
        outcome.sync_result.failed
    );
    assert!(
        outcome.repaired_account_ids.is_empty(),
        "no account should be reported as repaired when the guard was contended"
    );
    assert_eq!(
        outcome.sync_result.warnings.len(),
        warnings.len(),
        "local import warnings should still be surfaced on the skipped path"
    );
    assert!(
        syncing.load(Ordering::SeqCst),
        "the other sync's guard must remain held; the skipped startup path must not touch it"
    );
}

#[tokio::test]
async fn run_startup_sync_and_repair_holds_guard_during_repair_and_releases_after() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let syncing = AtomicBool::new(false);
    let mut repair_only_account =
        test_sync_command_account("repair-only-fresh", ProviderKind::FreshRss, false);
    // No username: `repair_greader_remote_state` returns `Ok(())` without
    // any network/keyring call, keeping this test hermetic while still
    // exercising the guarded repair path end to end.
    repair_only_account.username = None;

    let outcome = run_startup_sync_and_repair(
        &db,
        &syncing,
        None,
        Vec::new(),
        vec![repair_only_account.clone()],
        Vec::new(),
    )
    .await
    .expect("repair-only startup pass should succeed");

    assert_eq!(
        outcome.repaired_account_ids,
        vec![repair_only_account.id.as_ref().to_string()]
    );
    assert!(outcome.sync_result.synced);
    assert_eq!(outcome.sync_result.total, 1);
    assert_eq!(outcome.sync_result.succeeded, 1);
    assert!(
        !syncing.load(Ordering::SeqCst),
        "guard must be released after the startup repair completes"
    );
}

#[tokio::test]
async fn run_full_sync_skips_while_database_maintenance_is_reserved() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let syncing = AtomicBool::new(false);
    let _maintenance_guard =
        start_database_maintenance(&syncing).expect("maintenance should reserve sync guard");

    let result = run_full_sync(&db, &syncing)
        .await
        .expect("sync should skip instead of failing");

    assert!(!result.synced);
    assert_eq!(result.total, 0);
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

#[tokio::test]
async fn run_full_sync_quarantines_invalid_account_rows_like_account_list() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let syncing = AtomicBool::new(false);

    {
        let db_guard = db.lock().unwrap();
        db_guard
            .writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                rusqlite::params!["invalid-provider-account", "InvalidProvider", "Invalid"],
            )
            .unwrap();
    }

    let result = run_full_sync(&db, &syncing)
        .await
        .expect("invalid account rows should be quarantined from sync");

    assert!(result.synced);
    assert_eq!(result.total, 0);
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

#[test]
fn manual_single_sync_completion_emits_when_at_least_one_item_succeeded() {
    let result = SyncResult {
        synced: true,
        total: 1,
        succeeded: 1,
        failed: Vec::new(),
        warnings: Vec::new(),
    };

    assert!(should_emit_manual_single_sync_completion(&result));
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

#[test]
fn prioritize_startup_sync_accounts_moves_preferred_account_to_the_front() {
    let account_a = Account {
        id: AccountId("acc-1".to_string()),
        kind: ProviderKind::Local,
        name: "Local".to_string(),
        server_url: None,
        username: None,
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    };
    let account_b = Account {
        id: AccountId("acc-2".to_string()),
        kind: ProviderKind::FreshRss,
        name: "FreshRSS".to_string(),
        server_url: Some("https://example.com".to_string()),
        username: Some("user".to_string()),
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    };

    let prioritized =
        prioritize_startup_sync_accounts(vec![account_a.clone(), account_b.clone()], Some("acc-2"));

    assert_eq!(
        prioritized
            .iter()
            .map(|account| account.id.as_ref())
            .collect::<Vec<_>>(),
        vec!["acc-2", "acc-1"]
    );
}

#[test]
fn prioritize_startup_sync_accounts_keeps_original_order_when_preferred_account_is_missing() {
    let account_a = Account {
        id: AccountId("acc-1".to_string()),
        kind: ProviderKind::Local,
        name: "Local".to_string(),
        server_url: None,
        username: None,
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    };
    let account_b = Account {
        id: AccountId("acc-2".to_string()),
        kind: ProviderKind::FreshRss,
        name: "FreshRSS".to_string(),
        server_url: Some("https://example.com".to_string()),
        username: Some("user".to_string()),
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    };

    let prioritized = prioritize_startup_sync_accounts(
        vec![account_a.clone(), account_b.clone()],
        Some("acc-missing"),
    );

    assert_eq!(
        prioritized
            .iter()
            .map(|account| account.id.as_ref())
            .collect::<Vec<_>>(),
        vec!["acc-1", "acc-2"]
    );
}

fn test_sync_command_account(id: &str, kind: ProviderKind, sync_on_startup: bool) -> Account {
    Account {
        id: AccountId(id.to_string()),
        kind,
        name: id.to_string(),
        server_url: Some("https://example.com".to_string()),
        username: Some("user".to_string()),
        sync_interval_secs: 3600,
        sync_on_startup,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    }
}

fn sync_result_with_failed_ids(failed_ids: &[&str]) -> SyncResult {
    SyncResult {
        synced: true,
        total: failed_ids.len(),
        succeeded: 0,
        failed: failed_ids
            .iter()
            .map(|id| AccountSyncError {
                account_id: id.to_string(),
                account_name: id.to_string(),
                action_owner: None,
                message: "failed".to_string(),
            })
            .collect(),
        warnings: Vec::new(),
    }
}

#[test]
fn startup_remote_state_repair_complete_allows_repair_only_success_with_normal_sync_failure() {
    let startup_account = test_sync_command_account("startup-fresh", ProviderKind::FreshRss, true);
    let repair_only_account =
        test_sync_command_account("repair-only-fresh", ProviderKind::FreshRss, false);
    let sync_result = sync_result_with_failed_ids(&["startup-fresh"]);

    assert!(startup_remote_state_repair_succeeded(
        &[startup_account],
        &[repair_only_account],
        &["repair-only-fresh".to_string()],
        &sync_result,
    ));
}

#[test]
fn startup_remote_state_repair_complete_allows_repair_only_success_with_mixed_provider_failure() {
    let startup_account = test_sync_command_account("startup-local", ProviderKind::Local, true);
    let repair_only_account =
        test_sync_command_account("repair-only-fresh", ProviderKind::FreshRss, false);
    let sync_result = sync_result_with_failed_ids(&["startup-local"]);

    assert!(startup_remote_state_repair_succeeded(
        &[startup_account],
        &[repair_only_account],
        &["repair-only-fresh".to_string()],
        &sync_result,
    ));
}

#[test]
fn startup_remote_state_repair_complete_allows_startup_freshrss_success_with_local_failure() {
    let startup_fresh = test_sync_command_account("startup-fresh", ProviderKind::FreshRss, true);
    let startup_local = test_sync_command_account("startup-local", ProviderKind::Local, true);
    let sync_result = sync_result_with_failed_ids(&["startup-local"]);

    assert!(startup_remote_state_repair_succeeded(
        &[startup_fresh, startup_local],
        &[],
        &[],
        &sync_result,
    ));
}

#[test]
fn startup_remote_state_repair_complete_requires_repair_only_success() {
    let repair_only_account =
        test_sync_command_account("repair-only-fresh", ProviderKind::FreshRss, false);
    let sync_result = sync_result_with_failed_ids(&[]);

    assert!(!startup_remote_state_repair_succeeded(
        &[],
        &[repair_only_account],
        &[],
        &sync_result,
    ));
}

#[test]
fn startup_remote_state_repair_marker_failure_is_reported_as_result_warning() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let mut result = SyncResult {
        synced: true,
        total: 1,
        succeeded: 1,
        failed: Vec::new(),
        warnings: Vec::new(),
    };

    let poison_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _guard = db.lock().unwrap();
        panic!("poison startup repair marker db lock");
    }));
    assert!(poison_result.is_err());

    record_startup_remote_state_repair_complete(&db, &mut result);

    assert!(result.synced);
    assert_eq!(result.succeeded, 1);
    assert!(result.failed.is_empty());
    assert_eq!(result.warnings.len(), 1);
    assert_eq!(result.warnings[0].account_id, "startup");
    assert_eq!(result.warnings[0].account_name, "Startup sync");
    assert_eq!(
        result.warnings[0].kind,
        crate::commands::dto::AccountSyncWarningKind::Generic
    );
    assert!(result.warnings[0]
        .message
        .contains("completion marker could not be saved"));
    assert!(matches!(
        &result.warnings[0].detail,
        AccountSyncWarningDetail::StartupRepairMarkerFailed { message }
            if result.warnings[0].message.contains(message.as_str())
    ));
}

#[test]
fn startup_sync_enables_automatic_sync_after_any_startup_run_even_with_repair_only_failure() {
    let startup_account = test_sync_command_account("startup-local", ProviderKind::Local, true);
    let repair_only_account =
        test_sync_command_account("repair-only-fresh", ProviderKind::FreshRss, false);
    let result = SyncResult {
        synced: true,
        total: 2,
        succeeded: 1,
        failed: vec![AccountSyncError {
            account_id: "repair-only-fresh".to_string(),
            account_name: "repair-only-fresh".to_string(),
            action_owner: None,
            message: "repair failed".to_string(),
        }],
        warnings: Vec::new(),
    };

    assert!(should_enable_automatic_sync_after_startup(
        &result,
        &[startup_account],
        &[repair_only_account],
    ));
}

#[test]
fn startup_sync_keeps_automatic_sync_disabled_for_repair_only_run() {
    let repair_only_account =
        test_sync_command_account("repair-only-fresh", ProviderKind::FreshRss, false);
    let result = SyncResult {
        synced: true,
        total: 1,
        succeeded: 1,
        failed: Vec::new(),
        warnings: Vec::new(),
    };

    assert!(!should_enable_automatic_sync_after_startup(
        &result,
        &[],
        &[repair_only_account],
    ));
}

#[test]
fn map_account_sync_status_includes_last_success_at() {
    let account_id = AccountId::new();
    let status = map_account_sync_status(Some(SyncState {
        account_id,
        scope_key: SyncStateScopeKey::scheduler().as_string(),
        timestamp_usec: None,
        continuation: None,
        etag: None,
        last_modified: None,
        last_success_at: Some("2026-04-16T12:34:00Z".to_string()),
        last_error: Some("old error".to_string()),
        error_count: 2,
        next_retry_at: Some("2026-04-16T12:40:00Z".to_string()),
    }));

    assert_eq!(
        status.last_success_at.as_deref(),
        Some("2026-04-16T12:34:00Z")
    );
    assert_eq!(status.last_error.as_deref(), Some("old error"));
    assert_eq!(status.error_count, 2);
    assert_eq!(
        status.next_retry_at.as_deref(),
        Some("2026-04-16T12:40:00Z")
    );
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

#[tokio::test]
async fn account_parallel_sync_reports_local_feed_warnings_in_requested_account_order() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let syncing = AtomicBool::new(false);
    let first_account = test_sync_command_account("first-account", ProviderKind::Local, true);
    let second_account = test_sync_command_account("second-account", ProviderKind::Local, true);

    {
        let db_guard = db.lock().unwrap();
        for account in [&first_account, &second_account] {
            db_guard
                    .writer()
                    .execute(
                        "INSERT INTO accounts (id, kind, name, sync_interval_secs, sync_on_startup, sync_on_wake, keep_read_items_days) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        rusqlite::params![
                            account.id.as_ref(),
                            "Local",
                            account.name,
                            account.sync_interval_secs,
                            account.sync_on_startup,
                            account.sync_on_wake,
                            account.keep_read_items_days,
                        ],
                    )
                    .unwrap();
        }
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        feed_repo
            .save(&Feed {
                id: FeedId::new(),
                account_id: first_account.id.clone(),
                folder_id: None,
                remote_id: None,
                title: "First invalid feed".to_string(),
                url: "not-a-url".to_string(),
                site_url: "https://example.com".to_string(),
                icon: None,
                icon_url: None,
                unread_count: 0,
                reader_mode: "inherit".to_string(),
                web_preview_mode: "inherit".to_string(),
            })
            .unwrap();
        feed_repo
            .save(&Feed {
                id: FeedId::new(),
                account_id: second_account.id.clone(),
                folder_id: None,
                remote_id: None,
                title: "Second invalid feed".to_string(),
                url: "not-a-url".to_string(),
                site_url: "https://example.com".to_string(),
                icon: None,
                icon_url: None,
                unread_count: 0,
                reader_mode: "inherit".to_string(),
                web_preview_mode: "inherit".to_string(),
            })
            .unwrap();
    }

    let result = run_sync_for_accounts_with_progress(
        &db,
        &syncing,
        vec![second_account, first_account],
        None,
    )
    .await
    .unwrap();

    assert!(result.failed.is_empty());
    assert_eq!(result.succeeded, 2);
    assert_eq!(
        result
            .warnings
            .iter()
            .map(|warning| warning.account_id.as_str())
            .collect::<Vec<_>>(),
        vec!["second-account", "first-account"]
    );
    assert!(result
        .warnings
        .iter()
        .all(|warning| warning.message.contains("Local feed")));
}

#[tokio::test]
async fn local_account_sync_continues_after_one_feed_fails() {
    let mut server = Server::new_async().await;
    let good_feed_url = format!("{}/good.xml", server.url());
    let good_mock = server
        .mock("GET", "/good.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_body(
            r#"<?xml version="1.0" encoding="UTF-8"?>
                <rss version="2.0">
                  <channel>
                    <title>Good Feed</title>
                    <item>
                      <guid>good-1</guid>
                      <title>Good Article</title>
                      <link>https://example.com/good</link>
                    </item>
                  </channel>
                </rss>"#,
        )
        .create_async()
        .await;
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account = test_sync_command_account("local-account", ProviderKind::Local, true);
    let bad_feed = Feed {
        id: FeedId::new(),
        account_id: account.id.clone(),
        folder_id: None,
        remote_id: None,
        title: "Bad Feed".to_string(),
        url: "not-a-url".to_string(),
        site_url: "https://example.com".to_string(),
        icon: None,
        icon_url: None,
        unread_count: 0,
        reader_mode: "inherit".to_string(),
        web_preview_mode: "inherit".to_string(),
    };
    let good_feed = Feed {
        id: FeedId::new(),
        account_id: account.id.clone(),
        folder_id: None,
        remote_id: None,
        title: "Good Feed".to_string(),
        url: good_feed_url,
        site_url: "https://example.com".to_string(),
        icon: None,
        icon_url: None,
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
                    rusqlite::params![
                        account.id.as_ref(),
                        "Local",
                        account.name,
                        account.sync_interval_secs,
                        account.sync_on_startup,
                        account.sync_on_wake,
                        account.keep_read_items_days,
                    ],
                )
                .unwrap();
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        feed_repo.save(&bad_feed).unwrap();
        feed_repo.save(&good_feed).unwrap();
    }

    let outcome = sync_account(&db, &account).await.unwrap();

    good_mock.assert_async().await;
    assert_eq!(outcome.warnings.len(), 1);
    assert!(outcome.warnings[0].message.contains("Bad Feed"));
    let saved_article_count: i64 = db
        .lock()
        .unwrap()
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE feed_id = ?1",
            rusqlite::params![good_feed.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(saved_article_count, 1);
}

fn insert_local_account_row(db: &Mutex<DbManager>, account: &Account) {
    let db_guard = db.lock().unwrap();
    db_guard
            .writer()
            .execute(
                "INSERT INTO accounts (id, kind, name, sync_interval_secs, sync_on_startup, sync_on_wake, keep_read_items_days) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![
                    account.id.as_ref(),
                    "Local",
                    account.name,
                    account.sync_interval_secs,
                    account.sync_on_startup,
                    account.sync_on_wake,
                    account.keep_read_items_days,
                ],
            )
            .unwrap();
}

fn save_local_sync_settings(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    sync_folder_path: &str,
    enabled: bool,
) -> crate::repository::local_account_sync_settings::LocalAccountSyncSettings {
    use crate::domain::local_account_sync::{LocalSyncAccountId, LocalSyncDeviceId};
    use crate::repository::local_account_sync_settings::LocalAccountSyncSettings;

    let settings = LocalAccountSyncSettings {
        account_id: account_id.clone(),
        sync_folder_path: sync_folder_path.to_string(),
        sync_account_id: LocalSyncAccountId("sync-account-a".to_string()),
        device_id: LocalSyncDeviceId("this-device".to_string()),
        enabled,
        last_export_digest: None,
    };
    let db_guard = db.lock().unwrap();
    let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db_guard.writer());
    settings_repo.save(&settings).unwrap();
    settings
}

#[tokio::test]
async fn local_sync_account_imports_folder_op_from_another_device_and_exports_after_sync() {
    use crate::domain::local_account_sync::{
        normalize_tag_name, LocalAccountSyncOperation, LocalSyncAccountId, LocalSyncAction,
        LocalSyncDeviceId, LocalSyncEntityKey, LocalSyncOperationId,
    };
    use crate::infra::local_account_sync_files::{
        load_local_sync_operation_dir, write_local_sync_operation_file,
    };

    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account = test_sync_command_account("local-import-export", ProviderKind::Local, false);
    insert_local_account_row(&db, &account);

    let dir = tempfile::tempdir().unwrap();
    let other_device_op = LocalAccountSyncOperation {
        sync_account_id: LocalSyncAccountId("sync-account-a".to_string()),
        device_id: LocalSyncDeviceId("other-device".to_string()),
        operation_id: LocalSyncOperationId::new(),
        occurred_at: chrono::Utc::now(),
        entity_key: LocalSyncEntityKey::Folder {
            normalized_name: normalize_tag_name("Tech").unwrap(),
        },
        action: LocalSyncAction::UpsertFolder {
            display_name: "Tech".to_string(),
            sort_order: 1,
        },
    };
    write_local_sync_operation_file(dir.path(), &other_device_op, 1).unwrap();
    save_local_sync_settings(&db, &account.id, &dir.path().to_string_lossy(), true);

    let outcome = sync_account(&db, &account).await.unwrap();

    assert!(
        outcome.warnings.is_empty(),
        "unexpected warnings: {:?}",
        outcome.warnings
    );

    let folder_count: i64 = db
        .lock()
        .unwrap()
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM folders WHERE account_id = ?1 AND name = 'Tech'",
            rusqlite::params![account.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        folder_count, 1,
        "folder op written by another device should be imported"
    );

    let load_report = load_local_sync_operation_dir(dir.path()).unwrap();
    assert!(
        load_report
            .operations
            .iter()
            .any(|operation| operation.device_id == LocalSyncDeviceId("this-device".to_string())),
        "export should have written operation files for this device after sync"
    );
}

#[tokio::test]
async fn local_sync_account_with_missing_settings_leaves_sync_folder_untouched() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account = test_sync_command_account("local-no-settings", ProviderKind::Local, false);
    insert_local_account_row(&db, &account);

    let outcome = sync_account(&db, &account).await.unwrap();

    assert!(outcome.warnings.is_empty());
}

#[tokio::test]
async fn local_sync_account_with_disabled_settings_leaves_sync_folder_untouched() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account = test_sync_command_account("local-disabled", ProviderKind::Local, false);
    insert_local_account_row(&db, &account);
    let dir = tempfile::tempdir().unwrap();
    save_local_sync_settings(&db, &account.id, &dir.path().to_string_lossy(), false);

    let outcome = sync_account(&db, &account).await.unwrap();

    assert!(outcome.warnings.is_empty());
    assert!(
        !dir.path().join("ops").exists(),
        "disabled sync folder should not be touched"
    );
}

#[tokio::test]
async fn local_sync_account_returns_warning_when_sync_folder_path_is_unreachable() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account = test_sync_command_account("local-unreachable", ProviderKind::Local, false);
    insert_local_account_row(&db, &account);
    {
        let db_guard = db.lock().unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO folders (id, account_id, name, sort_order) VALUES ('folder-1', ?1, 'Tech', 1)",
                    rusqlite::params![account.id.as_ref()],
                )
                .unwrap();
    }

    let dir = tempfile::tempdir().unwrap();
    let blocking_file = dir.path().join("blocker");
    std::fs::write(&blocking_file, b"not a directory").unwrap();
    let unreachable_folder = blocking_file.join("account-root");
    save_local_sync_settings(
        &db,
        &account.id,
        &unreachable_folder.to_string_lossy(),
        true,
    );

    let outcome = sync_account(&db, &account).await.unwrap();

    assert!(
        outcome
            .warnings
            .iter()
            .any(|warning| warning.message.contains("Local sync folder export failed")),
        "unexpected warnings: {:?}",
        outcome.warnings
    );
    assert!(
        outcome.warnings.iter().any(|warning| matches!(
            &warning.detail,
            AccountSyncWarningDetail::LocalAccountSyncOperationFailed { operation, .. }
                if operation == "export"
        )),
        "unexpected warnings: {:?}",
        outcome.warnings
    );
}

/// Pins current behavior for the auto-import error branch: when reading
/// the local sync folder fails, `run_local_account_auto_import` surfaces
/// a warning instead of aborting the sync. The account's feed pull and
/// auto-export still run afterward.
///
/// The failure is induced in a platform-independent way: the configured
/// sync folder path points at a plain file instead of a directory, so
/// `load_local_sync_operation_dir` calls `fs::read_dir` on a non-directory
/// and fails with the same I/O error class (`NotADirectory` / equivalent)
/// on every OS, without relying on Unix permission bits.
#[tokio::test]
async fn local_sync_account_returns_warning_when_auto_import_read_fails() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account = test_sync_command_account("local-import-error", ProviderKind::Local, false);
    insert_local_account_row(&db, &account);

    let dir = tempfile::tempdir().unwrap();
    let sync_folder_path = dir.path().join("sync-root-is-actually-a-file");
    std::fs::write(&sync_folder_path, b"not a directory").unwrap();

    save_local_sync_settings(&db, &account.id, &sync_folder_path.to_string_lossy(), true);

    let outcome = sync_account(&db, &account).await.unwrap();

    assert!(
        outcome
            .warnings
            .iter()
            .any(|warning| warning.message.contains("Local sync folder import failed")),
        "unexpected warnings: {:?}",
        outcome.warnings
    );
    assert!(
        outcome.warnings.iter().any(|warning| matches!(
            &warning.detail,
            AccountSyncWarningDetail::LocalAccountSyncOperationFailed { operation, .. }
                if operation == "import"
        )),
        "unexpected warnings: {:?}",
        outcome.warnings
    );
}

/// Verifies that the auto-import rejected-only branch reports a warning:
/// when merge-level operation validation rejects one operation (mismatched
/// entity key/action), the merge still applies the remaining valid
/// operations and `run_local_account_auto_import` surfaces the rejected
/// operation count.
#[tokio::test]
async fn local_sync_account_returns_warning_for_merge_rejected_operations() {
    use crate::domain::local_account_sync::{
        normalize_tag_name, LocalAccountSyncOperation, LocalSyncAccountId, LocalSyncAction,
        LocalSyncDeviceId, LocalSyncEntityKey, LocalSyncOperationId,
    };
    use crate::infra::local_account_sync_files::write_local_sync_operation_file;

    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account = test_sync_command_account("local-import-rejected", ProviderKind::Local, false);
    insert_local_account_row(&db, &account);

    let dir = tempfile::tempdir().unwrap();

    let valid_op = LocalAccountSyncOperation {
        sync_account_id: LocalSyncAccountId("sync-account-a".to_string()),
        device_id: LocalSyncDeviceId("other-device".to_string()),
        operation_id: LocalSyncOperationId::new(),
        occurred_at: chrono::Utc::now(),
        entity_key: LocalSyncEntityKey::Folder {
            normalized_name: normalize_tag_name("Tech").unwrap(),
        },
        action: LocalSyncAction::UpsertFolder {
            display_name: "Tech".to_string(),
            sort_order: 1,
        },
    };
    // Mismatched entity key/action: `apply_operation` rejects this at the
    // merge layer (`Local sync operation action does not match entity
    // key`), which is a merge-level rejection, not a rejected *file*.
    let mismatched_op = LocalAccountSyncOperation {
        sync_account_id: LocalSyncAccountId("sync-account-a".to_string()),
        device_id: LocalSyncDeviceId("other-device".to_string()),
        operation_id: LocalSyncOperationId::new(),
        occurred_at: chrono::Utc::now(),
        entity_key: LocalSyncEntityKey::Folder {
            normalized_name: normalize_tag_name("Tech").unwrap(),
        },
        action: LocalSyncAction::SetRead { is_read: true },
    };
    write_local_sync_operation_file(dir.path(), &valid_op, 1).unwrap();
    write_local_sync_operation_file(dir.path(), &mismatched_op, 2).unwrap();

    save_local_sync_settings(&db, &account.id, &dir.path().to_string_lossy(), true);

    let outcome = sync_account(&db, &account).await.unwrap();

    assert_eq!(outcome.warnings.len(), 1);
    assert!(outcome.warnings[0]
        .message
        .contains("1 rejected operation(s)"));
    assert_eq!(
        outcome.warnings[0].detail,
        AccountSyncWarningDetail::LocalImportResult {
            conflicted: 0,
            rejected_files: 0,
            rejected_operations: 1,
        }
    );

    let folder_count: i64 = db
        .lock()
        .unwrap()
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM folders WHERE account_id = ?1 AND name = 'Tech'",
            rusqlite::params![account.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        folder_count, 1,
        "the valid operation should still be applied despite the rejected sibling"
    );
}

#[tokio::test]
async fn local_sync_account_returns_warning_and_skips_projection_when_conflicted_copy_present() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account = test_sync_command_account("local-conflicted", ProviderKind::Local, false);
    insert_local_account_row(&db, &account);

    let dir = tempfile::tempdir().unwrap();
    let op_dir = dir.path().join("ops").join("other-device");
    std::fs::create_dir_all(&op_dir).unwrap();
    std::fs::write(op_dir.join("00000001 (conflicted copy).json"), "{not-json").unwrap();
    std::fs::write(
        op_dir.join("00000002.json"),
        serde_json::to_string(&crate::domain::local_account_sync::operation_file(
            crate::domain::local_account_sync::LocalAccountSyncOperation {
                sync_account_id: crate::domain::local_account_sync::LocalSyncAccountId(
                    "sync-account-a".to_string(),
                ),
                device_id: crate::domain::local_account_sync::LocalSyncDeviceId(
                    "other-device".to_string(),
                ),
                operation_id: crate::domain::local_account_sync::LocalSyncOperationId::new(),
                occurred_at: chrono::Utc::now(),
                entity_key: crate::domain::local_account_sync::LocalSyncEntityKey::Folder {
                    normalized_name: crate::domain::local_account_sync::normalize_tag_name("Tech")
                        .unwrap(),
                },
                action: crate::domain::local_account_sync::LocalSyncAction::UpsertFolder {
                    display_name: "Tech".to_string(),
                    sort_order: 1,
                },
            },
        ))
        .unwrap(),
    )
    .unwrap();
    save_local_sync_settings(&db, &account.id, &dir.path().to_string_lossy(), true);

    let outcome = sync_account(&db, &account).await.unwrap();

    assert!(
        outcome
            .warnings
            .iter()
            .any(|warning| warning.message.contains("conflicted")),
        "unexpected warnings: {:?}",
        outcome.warnings
    );

    let folder_count: i64 = db
        .lock()
        .unwrap()
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM folders WHERE account_id = ?1 AND name = 'Tech'",
            rusqlite::params![account.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        folder_count, 0,
        "projection should not be applied while a conflicted copy is present"
    );
}

#[tokio::test]
async fn trigger_startup_sync_import_supplement_covers_excluded_local_accounts_only() {
    use crate::domain::local_account_sync::{
        normalize_tag_name, LocalAccountSyncOperation, LocalSyncAccountId, LocalSyncAction,
        LocalSyncDeviceId, LocalSyncEntityKey, LocalSyncOperationId,
    };
    use crate::infra::local_account_sync_files::write_local_sync_operation_file;

    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let startup_account = test_sync_command_account("startup-local", ProviderKind::Local, true);
    let excluded_account = test_sync_command_account("excluded-local", ProviderKind::Local, false);
    insert_local_account_row(&db, &startup_account);
    insert_local_account_row(&db, &excluded_account);

    let excluded_dir = tempfile::tempdir().unwrap();
    let other_device_op = LocalAccountSyncOperation {
        sync_account_id: LocalSyncAccountId("sync-account-a".to_string()),
        device_id: LocalSyncDeviceId("other-device".to_string()),
        operation_id: LocalSyncOperationId::new(),
        occurred_at: chrono::Utc::now(),
        entity_key: LocalSyncEntityKey::Folder {
            normalized_name: normalize_tag_name("Tech").unwrap(),
        },
        action: LocalSyncAction::UpsertFolder {
            display_name: "Tech".to_string(),
            sort_order: 1,
        },
    };
    write_local_sync_operation_file(excluded_dir.path(), &other_device_op, 1).unwrap();
    save_local_sync_settings(
        &db,
        &excluded_account.id,
        &excluded_dir.path().to_string_lossy(),
        true,
    );

    let warnings = run_local_account_startup_import_supplement(
        &db,
        &[startup_account.clone(), excluded_account.clone()],
        &[startup_account],
    );

    assert!(
        warnings.is_empty(),
        "clean import should not produce warnings: {warnings:?}"
    );

    let folder_count: i64 = db
        .lock()
        .unwrap()
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM folders WHERE account_id = ?1 AND name = 'Tech'",
            rusqlite::params![excluded_account.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        folder_count, 1,
        "excluded local account should still be imported as a startup supplement"
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
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
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
        icon_url: None,
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
        icon_url: None,
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

#[test]
fn clear_scheduler_sync_status_clears_account_level_backoff() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account_id = AccountId::new();
    {
        let db_guard = db.lock().unwrap();
        db_guard
            .writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                rusqlite::params![account_id.as_ref(), "Local", "Local"],
            )
            .unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO sync_state (account_id, scope_key, last_error, error_count, next_retry_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                    rusqlite::params![
                        account_id.as_ref(),
                        SyncStateScopeKey::scheduler().as_string(),
                        "old failure",
                        2,
                        "2099-01-01T00:00:00Z",
                    ],
                )
                .unwrap();
    }

    clear_scheduler_sync_status(&db, &account_id).unwrap();

    let db_guard = db.lock().unwrap();
    let repo = SqliteSyncStateRepository::new(db_guard.reader());
    let state = repo
        .get(&account_id, SyncStateScopeKey::scheduler())
        .unwrap()
        .unwrap();
    assert_eq!(state.error_count, 0);
    assert_eq!(state.last_error, None);
    assert_eq!(state.next_retry_at, None);
    assert!(state.last_success_at.is_some());
}

#[test]
fn purge_old_articles_deletes_old_read_items_when_retention_is_enabled() {
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
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    };
    let feed_id = FeedId::new();
    let old = chrono::Utc::now() - chrono::Duration::days(60);
    {
        let db_guard = db.lock().unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO accounts (id, kind, name, keep_read_items_days) VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![account.id.as_ref(), "Local", account.name, account.keep_read_items_days],
                )
                .unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO feeds (id, account_id, title, url, site_url) VALUES (?1, ?2, ?3, ?4, ?5)",
                    rusqlite::params![
                        feed_id.as_ref(),
                        account.id.as_ref(),
                        "Feed",
                        "https://example.com/feed.xml",
                        "https://example.com",
                    ],
                )
                .unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO articles (id, feed_id, title, published_at, fetched_at, is_read) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    rusqlite::params![
                        "old-read",
                        feed_id.as_ref(),
                        "Old read",
                        old.to_rfc3339(),
                        old.to_rfc3339(),
                        true,
                    ],
                )
                .unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO articles (id, feed_id, title, published_at, fetched_at, is_read) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    rusqlite::params![
                        "older-read",
                        feed_id.as_ref(),
                        "Older read",
                        (old - chrono::Duration::minutes(1)).to_rfc3339(),
                        (old - chrono::Duration::minutes(1)).to_rfc3339(),
                        true,
                    ],
                )
                .unwrap();
    }

    purge_old_articles(&db);

    let older_remaining: i64 = db
        .lock()
        .unwrap()
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE id = ?1",
            rusqlite::params!["older-read"],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(older_remaining, 0);

    let latest_remaining: i64 = db
        .lock()
        .unwrap()
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE id = ?1",
            rusqlite::params!["old-read"],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(latest_remaining, 1);
}

#[test]
fn purge_old_articles_preserves_old_read_items_within_retention_window() {
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
        keep_read_items_days: 3650,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    };
    let feed_id = FeedId::new();
    let old = chrono::Utc::now() - chrono::Duration::days(60);
    {
        let db_guard = db.lock().unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO accounts (id, kind, name, keep_read_items_days) VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![account.id.as_ref(), "Local", account.name, account.keep_read_items_days],
                )
                .unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO feeds (id, account_id, title, url, site_url) VALUES (?1, ?2, ?3, ?4, ?5)",
                    rusqlite::params![
                        feed_id.as_ref(),
                        account.id.as_ref(),
                        "Feed",
                        "https://example.com/feed.xml",
                        "https://example.com",
                    ],
                )
                .unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO articles (id, feed_id, title, published_at, fetched_at, is_read) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    rusqlite::params![
                        "old-read",
                        feed_id.as_ref(),
                        "Old read",
                        old.to_rfc3339(),
                        old.to_rfc3339(),
                        true,
                    ],
                )
                .unwrap();
    }

    purge_old_articles(&db);

    let remaining: i64 = db
        .lock()
        .unwrap()
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE id = ?1",
            rusqlite::params!["old-read"],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(remaining, 1);
}

#[test]
fn purge_old_articles_preserves_old_read_items_when_legacy_retention_is_disabled() {
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
        keep_read_items_days: 0,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    };
    let feed_id = FeedId::new();
    let old = chrono::Utc::now() - chrono::Duration::days(60);
    {
        let db_guard = db.lock().unwrap();
        db_guard
            .writer()
            .execute("PRAGMA ignore_check_constraints = ON", [])
            .unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO accounts (id, kind, name, keep_read_items_days) VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![account.id.as_ref(), "Local", account.name, account.keep_read_items_days],
                )
                .unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO feeds (id, account_id, title, url, site_url) VALUES (?1, ?2, ?3, ?4, ?5)",
                    rusqlite::params![
                        feed_id.as_ref(),
                        account.id.as_ref(),
                        "Feed",
                        "https://example.com/feed.xml",
                        "https://example.com",
                    ],
                )
                .unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO articles (id, feed_id, title, published_at, fetched_at, is_read) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    rusqlite::params![
                        "old-read",
                        feed_id.as_ref(),
                        "Old read",
                        old.to_rfc3339(),
                        old.to_rfc3339(),
                        true,
                    ],
                )
                .unwrap();
    }

    purge_old_articles(&db);

    let remaining: i64 = db
        .lock()
        .unwrap()
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE id = ?1",
            rusqlite::params!["old-read"],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(remaining, 1);
}

#[test]
fn purge_old_articles_failure_does_not_change_sync_result_contract() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let poison_result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _guard = db.lock().unwrap();
        panic!("poison purge db lock");
    }));
    assert!(poison_result.is_err());

    purge_old_articles(&db);
    assert!(should_purge_old_articles_after_sync(true));
}
