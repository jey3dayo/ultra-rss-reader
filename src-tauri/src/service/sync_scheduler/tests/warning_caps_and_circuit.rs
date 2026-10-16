use super::*;

#[test]
fn scheduler_warning_push_dedupes_and_caps_warning_count() {
    let mut warnings = Vec::new();
    let duplicate = AccountSyncWarning {
        account_id: "account-1".to_string(),
        account_name: "Account 1".to_string(),
        kind: AccountSyncWarningKind::RetryScheduled,
        message: "retry later".to_string(),
        retry_at: Some("2099-01-01T00:00:00Z".to_string()),
        retry_in_seconds: Some(60),
        detail: AccountSyncWarningDetail::BackgroundSyncRetryScheduled {
            account_name: "Account 1".to_string(),
        },
    };

    push_scheduler_warning(&mut warnings, duplicate.clone());
    push_scheduler_warning(&mut warnings, duplicate);

    assert_eq!(warnings.len(), 1);

    for index in 0..(MAX_SCHEDULER_WARNINGS_PER_TICK + 4) {
        push_scheduler_warning(
            &mut warnings,
            AccountSyncWarning {
                account_id: format!("account-{index}"),
                account_name: format!("Account {index}"),
                kind: AccountSyncWarningKind::Generic,
                message: format!("provider warning {index}"),
                retry_at: None,
                retry_in_seconds: None,
                detail: AccountSyncWarningDetail::SchedulerLoadFailed {
                    message: format!("provider warning {index}"),
                },
            },
        );
    }

    assert_eq!(warnings.len(), MAX_SCHEDULER_WARNINGS_PER_TICK);
}

#[test]
fn many_account_repeated_failures_keep_one_due_account_and_capped_warning_surface() {
    let now = Instant::now();
    let accounts = (0..32)
        .map(|index| {
            let mut account = test_account(60);
            account.id = AccountId(format!("failure-account-{index:02}"));
            account
        })
        .collect::<Vec<_>>();
    let schedules = accounts
        .iter()
        .map(|account| {
            (
                account.id.as_ref().to_string(),
                AccountSchedule {
                    next_sync: now - Duration::from_secs(60),
                    interval: Duration::from_secs(60),
                },
            )
        })
        .collect::<HashMap<_, _>>();
    let mut warnings = Vec::new();

    let selected =
        select_due_accounts_for_tick(&accounts, &schedules, now, MAX_ACCOUNTS_PER_SCHEDULER_TICK);
    for account in &accounts {
        push_scheduler_warning(
            &mut warnings,
            AccountSyncWarning {
                account_id: account.id.as_ref().to_string(),
                account_name: account.name.clone(),
                kind: AccountSyncWarningKind::RetryScheduled,
                message: format!("retry later for {}", account.name),
                retry_at: Some("2099-01-01T00:00:00Z".to_string()),
                retry_in_seconds: Some(MAX_BACKOFF.as_secs()),
                detail: AccountSyncWarningDetail::BackgroundSyncRetryScheduled {
                    account_name: account.name.clone(),
                },
            },
        );
    }

    assert_eq!(
        selected.len(),
        1,
        "many failing accounts must not all wake/sync on the same scheduler tick"
    );
    assert_eq!(
        warnings.len(),
        MAX_SCHEDULER_WARNINGS_PER_TICK,
        "many-account repeated failure diagnostics must stay rate limited per tick"
    );
}

#[test]
fn scheduler_backoff_keeps_retryable_classification_snapshot() {
    let cases = [
        (
            "network",
            AppError::Retryable {
                message: "Network error: Request timed out. Check the server URL or your network connection."
                    .to_string(),
            },
            calculate_backoff_secs(&test_account(60), 1),
        ),
        (
            "rate-limit",
            AppError::RetryableWithMetadata {
                message: "Rate limit error: HTTP 429 Too Many Requests; retry_after_seconds=600"
                    .to_string(),
                retry_after_seconds: Some(600),
            },
            600,
        ),
        (
            "provider-forbidden-user-action",
            AppError::UserVisible {
                message: "Auth error: HTTP 403 Forbidden".to_string(),
            },
            calculate_backoff_secs(&test_account(60), 1),
        ),
        (
            "provider-legal-block-user-action",
            AppError::UserVisible {
                message: "Validation error: HTTP 451 Unavailable For Legal Reasons".to_string(),
            },
            calculate_backoff_secs(&test_account(60), 1),
        ),
        (
            "provider-temporary-block-retryable",
            AppError::Retryable {
                message: "Network error: HTTP 503 Service Unavailable".to_string(),
            },
            calculate_backoff_secs(&test_account(60), 1),
        ),
        (
            "auth",
            AppError::UserVisible {
                message: "Auth error: HTTP 401 Unauthorized".to_string(),
            },
            calculate_backoff_secs(&test_account(60), 1),
        ),
        (
            "sqlite",
            AppError::UserVisible {
                message: "Persistence error: Query returned no rows".to_string(),
            },
            calculate_backoff_secs(&test_account(60), 1),
        ),
        (
            "malformed-provider-payload",
            AppError::UserVisible {
                message: "Parse error: malformed provider response".to_string(),
            },
            calculate_backoff_secs(&test_account(60), 1),
        ),
    ];

    for (case_name, error, expected_retry_in_seconds) in cases {
        let db = std::sync::Mutex::new(test_db());
        let mut account = test_account(60);
        account.id = AccountId(format!("backoff-{case_name}"));
        {
            let db_guard = db.lock().unwrap();
            insert_test_account(&db_guard, &account.id);
        }
        let mut warnings = Vec::new();

        let backoff = complete_failed_account_sync(&db, &account, &error, &mut warnings);

        assert_eq!(
            backoff,
            Duration::from_secs(expected_retry_in_seconds),
            "backoff changed for {case_name}"
        );
        assert_eq!(warnings.len(), 1, "warning count changed for {case_name}");
        assert_eq!(warnings[0].kind, AccountSyncWarningKind::RetryScheduled);
        assert_eq!(
            warnings[0].retry_in_seconds,
            Some(expected_retry_in_seconds),
            "retry warning changed for {case_name}"
        );
        assert!(
            is_in_backoff(&db, &account.id),
            "backoff missing for {case_name}"
        );
        assert_eq!(
            warnings[0].kind,
            AccountSyncWarningKind::RetryScheduled,
            "scheduler retry warning must stay separate from provider user-action classification for {case_name}"
        );
    }
}

#[test]
fn auth_failure_storm_is_capped_by_scheduler_backoff() {
    for status in ["401 Unauthorized", "403 Forbidden"] {
        let db = std::sync::Mutex::new(test_db());
        let mut account = test_account(60);
        account.id = AccountId(format!("auth-storm-{status}"));
        {
            let db_guard = db.lock().unwrap();
            insert_test_account(&db_guard, &account.id);
        }
        let auth_error = AppError::UserVisible {
            message: format!("Auth error: HTTP {status}"),
        };
        let mut last_backoff = Duration::ZERO;

        for _ in 0..20 {
            let mut warnings = Vec::new();
            last_backoff = complete_failed_account_sync(&db, &account, &auth_error, &mut warnings);
            assert_eq!(
                warnings.len(),
                1,
                "auth failure should emit one retry warning per persisted retry change"
            );
        }

        assert_eq!(last_backoff, MAX_BACKOFF);
        assert!(is_in_backoff(&db, &account.id));
        let db_guard = db.lock().unwrap();
        let repo = SqliteSyncStateRepository::new(db_guard.reader());
        let state = repo
            .get(&account.id, SyncStateScopeKey::scheduler())
            .expect("sync state lookup should succeed")
            .expect("sync state should exist");
        assert_eq!(state.error_count, (MAX_BACKOFF_SHIFT_BITS as i32) + 1);
        assert!(state.next_retry_at.is_some());
    }
}

#[test]
fn scheduler_backoff_reset_reopens_auth_failure_circuit() {
    let db = std::sync::Mutex::new(test_db());
    let account = test_account(60);
    {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, &account.id);
    }
    let auth_error = AppError::UserVisible {
        message: "Auth error: HTTP 401 Unauthorized".to_string(),
    };
    let mut warnings = Vec::new();

    complete_failed_account_sync(&db, &account, &auth_error, &mut warnings);
    assert!(is_in_backoff(&db, &account.id));

    reset_error_count(&db, &account.id).expect("auth recovery should reset scheduler backoff");

    assert!(!is_in_backoff(&db, &account.id));
    let db_guard = db.lock().unwrap();
    let repo = SqliteSyncStateRepository::new(db_guard.reader());
    let state = repo
        .get(&account.id, SyncStateScopeKey::scheduler())
        .expect("sync state lookup should succeed")
        .expect("sync state should exist");
    assert_eq!(state.error_count, 0);
    assert_eq!(state.last_error, None);
    assert_eq!(state.next_retry_at, None);
    assert!(state.last_success_at.is_some());
}

#[test]
fn is_in_backoff_clears_invalid_next_retry_at_and_allows_retry() {
    let db = std::sync::Mutex::new(test_db());
    let account = test_account(60);
    {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, &account.id);
        insert_scheduler_sync_state(&db_guard, &account.id, 2, Some("not-a-date"));
    }

    assert!(!is_in_backoff(&db, &account.id));

    let db_guard = db.lock().unwrap();
    let repo = SqliteSyncStateRepository::new(db_guard.reader());
    let state = repo
        .get(&account.id, SyncStateScopeKey::scheduler())
        .unwrap()
        .unwrap();
    assert_eq!(state.error_count, 2);
    assert_eq!(state.next_retry_at, None);
}

#[test]
fn invalid_next_retry_cleanup_save_failure_is_not_retried_for_same_invalid_value() {
    let save_attempts = Cell::new(0);
    let repo = FailingCleanupRepo {
        save_attempts: &save_attempts,
    };
    let mut state = SyncState {
        account_id: AccountId("cleanup-failure-account".to_string()),
        scope_key: SyncStateScopeKey::scheduler().as_string(),
        timestamp_usec: None,
        continuation: None,
        etag: None,
        last_modified: None,
        last_success_at: None,
        last_error: Some("old error".to_string()),
        error_count: 2,
        next_retry_at: Some("not-a-date".to_string()),
    };

    clear_invalid_next_retry_at(&repo, &mut state);
    assert_eq!(save_attempts.get(), 1);
    assert_eq!(state.next_retry_at, None);

    state.next_retry_at = Some("not-a-date".to_string());
    clear_invalid_next_retry_at(&repo, &mut state);

    assert_eq!(
        save_attempts.get(),
        1,
        "same invalid cleanup failure should be suppressed after the first save failure"
    );
    assert_eq!(state.next_retry_at, None);
}
