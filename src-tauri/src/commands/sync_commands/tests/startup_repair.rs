use super::*;

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
async fn sync_account_returns_error_when_freshrss_server_url_is_missing() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let mut account =
        test_sync_command_account("missing-server-url", ProviderKind::FreshRss, false);
    account.server_url = None;

    let error = sync_account(&db, &account)
        .await
        .expect_err("missing FreshRSS server URL should fail sync");

    assert!(matches!(
        error,
        crate::commands::dto::AppError::UserVisible { message }
            if message == "FreshRSS server URL is required"
    ));
}

#[tokio::test]
async fn startup_repair_reports_missing_freshrss_server_url_as_failure() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let syncing = AtomicBool::new(false);
    let mut account =
        test_sync_command_account("missing-server-url-repair", ProviderKind::FreshRss, false);
    account.server_url = None;

    let outcome =
        run_startup_sync_and_repair(&db, &syncing, None, Vec::new(), vec![account], Vec::new())
            .await
            .expect("missing server URL should be reported in the repair result");

    assert!(outcome.repaired_account_ids.is_empty());
    assert_eq!(outcome.sync_result.failed.len(), 1);
    assert_eq!(
        outcome.sync_result.failed[0].message,
        "FreshRSS server URL is required"
    );
    assert!(!syncing.load(Ordering::SeqCst));
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
