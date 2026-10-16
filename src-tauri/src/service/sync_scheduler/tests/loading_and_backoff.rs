use super::*;

#[test]
fn load_scheduler_accounts_surfaces_database_lock_errors() {
    let db = std::sync::Mutex::new(test_db());
    let poison_result = std::panic::catch_unwind(|| {
        let _guard = db.lock().unwrap();
        panic!("poison scheduler db lock");
    });
    assert!(poison_result.is_err());

    let error = load_scheduler_accounts(&db).expect_err("poisoned lock should be returned");

    assert!(matches!(error, DomainError::Persistence(_)));
}

#[test]
fn load_scheduler_accounts_skips_invalid_account_rows() {
    let db = std::sync::Mutex::new(test_db());
    {
        let db_guard = db.lock().unwrap();
        db_guard
            .writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                params!["account-with-invalid-kind", "InvalidProvider", "Invalid"],
            )
            .unwrap();
    }

    let accounts = load_scheduler_accounts(&db).expect("invalid account rows should be skipped");

    assert!(accounts.is_empty());
}

#[test]
fn scheduler_load_failure_warning_is_observable_as_generic_scheduler_warning() {
    let error = DomainError::Persistence("Lock error: poisoned".to_string());

    let warning = scheduler_load_failure_warning(&error);

    assert_eq!(warning.account_id, "scheduler");
    assert_eq!(warning.account_name, "Scheduler");
    assert_eq!(warning.kind, AccountSyncWarningKind::Generic);
    assert_eq!(
        warning.message,
        "Scheduled sync skipped because accounts could not be loaded: Persistence error: Lock error: poisoned"
    );
    assert_eq!(warning.retry_at, None);
    assert_eq!(warning.retry_in_seconds, None);
    assert_eq!(
        warning.detail,
        AccountSyncWarningDetail::SchedulerLoadFailed {
            message: "Persistence error: Lock error: poisoned".to_string()
        }
    );
}

#[test]
fn scheduler_load_failure_warning_serializes_to_sync_warning_contract() {
    let error = DomainError::Persistence("Lock error: poisoned".to_string());

    let value = serde_json::to_value(scheduler_load_failure_warning(&error))
        .expect("warning should serialize");

    assert_eq!(value["account_id"], "scheduler");
    assert_eq!(value["account_name"], "Scheduler");
    assert_eq!(value["kind"], "generic");
    assert!(value["message"]
        .as_str()
        .expect("message should be a string")
        .starts_with("Scheduled sync skipped because accounts could not be loaded:"));
    assert!(value["retry_at"].is_null());
    assert!(value["retry_in_seconds"].is_null());
    assert_eq!(value["detail"]["type"], "scheduler_load_failed");
    assert_eq!(
        value["detail"]["message"],
        "Persistence error: Lock error: poisoned"
    );
}

#[test]
fn backoff_persistence_failure_warning_is_observable_as_generic_account_warning() {
    let account = test_account(60);
    let error = DomainError::Persistence("FOREIGN KEY constraint failed".to_string());

    let warning = backoff_persistence_failure_warning(&account, &error);

    assert_eq!(warning.account_id, account.id.as_ref());
    assert_eq!(warning.account_name, account.name);
    assert_eq!(warning.kind, AccountSyncWarningKind::Generic);
    assert_eq!(
        warning.message,
        "Scheduled sync could not persist retry state for 'test': Persistence error: FOREIGN KEY constraint failed"
    );
    assert_eq!(warning.retry_at, None);
    assert_eq!(warning.retry_in_seconds, None);
    assert_eq!(
        warning.detail,
        AccountSyncWarningDetail::BackoffPersistFailed {
            account_name: account.name.clone(),
            message: "Persistence error: FOREIGN KEY constraint failed".to_string(),
        }
    );
}

#[test]
fn calculate_backoff_increases_exponentially() {
    let account = test_account(60);
    assert_eq!(calculate_backoff(&account, 0), Duration::from_secs(60));
    assert_eq!(calculate_backoff(&account, 1), Duration::from_secs(120));
    assert_eq!(calculate_backoff(&account, 2), Duration::from_secs(240));
    assert_eq!(calculate_backoff(&account, 3), Duration::from_secs(480));
}

#[test]
fn calculate_backoff_clamps_negative_error_count_to_initial_delay() {
    let account = test_account(60);

    assert_eq!(calculate_backoff(&account, -1), Duration::from_secs(60));
    assert_eq!(calculate_backoff_secs(&account, -1), 60);
}

#[test]
fn calculate_backoff_secs_uses_account_interval_as_single_source_of_truth() {
    let account = test_account(900);

    assert_eq!(calculate_backoff(&account, 1).as_secs(), 1_800);
    assert_eq!(calculate_backoff_secs(&account, 1), 1_800);
}

#[test]
fn increment_error_count_clamps_negative_stored_error_count_to_first_retry() {
    let db = std::sync::Mutex::new(test_db());
    let mut account = test_account(60);
    {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, &account.id);
        insert_sync_state_error_count(&db_guard, &account.id, -5);
    }

    account.sync_interval_secs = 900;
    let backoff_state = increment_error_count(
        &db,
        &account,
        &AppError::UserVisible {
            message: "sync failed".to_string(),
        },
    )
    .expect("negative stored error count should be clamped before increment");

    assert_eq!(backoff_state.error_count, 1);
    assert_eq!(
        backoff_state.retry_in_seconds,
        calculate_backoff_secs(&account, 1)
    );
}

#[test]
fn calculate_backoff_caps_at_max() {
    let account = test_account(60);
    assert_eq!(calculate_backoff(&account, 20), MAX_BACKOFF);
}

#[test]
fn calculate_backoff_secs_caps_abnormal_high_values_at_max() {
    let account = test_account(60);

    assert!(calculate_backoff_secs(&account, 20) <= MAX_BACKOFF.as_secs());
    assert_eq!(
        calculate_backoff_secs(&account, i32::MAX),
        MAX_BACKOFF.as_secs()
    );
}

#[test]
fn increment_error_count_persists_backoff_state_and_is_in_backoff() {
    let db = std::sync::Mutex::new(test_db());
    let account = test_account(60);
    {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, &account.id);
    }

    let backoff_state = increment_error_count(
        &db,
        &account,
        &AppError::UserVisible {
            message: "sync failed".to_string(),
        },
    )
    .expect("backoff state should save");

    assert_eq!(backoff_state.error_count, 1);
    assert_eq!(
        backoff_state.retry_in_seconds,
        calculate_backoff_secs(&account, 1)
    );
    assert!(backoff_state.next_retry_at.is_some());
    assert!(is_in_backoff(&db, &account.id));
}

#[test]
fn increment_error_count_surfaces_save_errors() {
    let db = std::sync::Mutex::new(test_db());
    let account = test_account(60);

    let error = increment_error_count(
        &db,
        &account,
        &AppError::UserVisible {
            message: "sync failed".to_string(),
        },
    )
    .expect_err("sync state save failure should be returned");

    assert!(matches!(error, DomainError::Persistence(_)));
}

#[test]
fn reset_error_count_surfaces_save_errors() {
    let db = std::sync::Mutex::new(test_db());
    let account_id = AccountId::new();

    let error = reset_error_count(&db, &account_id)
        .expect_err("sync state save failure should be returned");

    assert!(matches!(error, DomainError::Persistence(_)));
}
