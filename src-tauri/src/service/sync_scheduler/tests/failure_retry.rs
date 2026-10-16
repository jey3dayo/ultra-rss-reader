use super::*;

#[test]
fn failed_account_sync_persists_backoff_and_emits_retry_warning() {
    let db = std::sync::Mutex::new(test_db());
    let account = test_account(60);
    {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, &account.id);
    }
    let mut warnings = Vec::new();

    let backoff = complete_failed_account_sync(
        &db,
        &account,
        &AppError::UserVisible {
            message: "Background sync panicked".to_string(),
        },
        &mut warnings,
    );

    assert_eq!(backoff, calculate_backoff(&account, 1));
    assert_eq!(warnings.len(), 1);
    assert_eq!(warnings[0].kind, AccountSyncWarningKind::RetryScheduled);
    assert_eq!(
        warnings[0].retry_in_seconds,
        Some(calculate_backoff_secs(&account, 1))
    );
    assert!(warnings[0].retry_at.is_some());
    assert_eq!(
        warnings[0].detail,
        AccountSyncWarningDetail::BackgroundSyncRetryScheduled {
            account_name: account.name.clone(),
        }
    );
    assert!(is_in_backoff(&db, &account.id));
}

#[test]
fn finalized_background_log_includes_retry_warning_from_backoff() {
    use crate::commands::dto::AccountSyncWarningDetail;
    use crate::infra::log_capture_test_support::{child_scenario, run_in_isolated_process};

    if child_scenario().is_some() {
        let db = std::sync::Mutex::new(test_db());
        let mut account = test_account(60);
        account.id = AccountId("private-account-sentinel".to_string());
        account.name = "private-name-sentinel".to_string();
        {
            let db_guard = db.lock().unwrap();
            insert_test_account(&db_guard, &account.id);
        }
        let mut warnings_to_emit = (0..16)
            .map(|index| AccountSyncWarning {
                account_id: format!("ui-warning-{index}"),
                account_name: "private-name-sentinel".to_string(),
                kind: AccountSyncWarningKind::Generic,
                message: format!("ui-warning-{index}"),
                retry_at: None,
                retry_in_seconds: None,
                detail: AccountSyncWarningDetail::AccountSkippedEntries {
                    account_name: "private-name-sentinel".to_string(),
                    count: 1,
                },
            })
            .collect::<Vec<_>>();
        let error = AppError::UserVisible {
            message: "private-error-sentinel".to_string(),
        };
        let backoff =
            finalize_failed_background_account_sync(&db, &account, &error, &mut warnings_to_emit);
        assert_eq!(warnings_to_emit.len(), 16);
        assert!(backoff > Duration::ZERO);
        return;
    }

    let lines = run_in_isolated_process(
        module_path!(),
        "finalized_background_log_includes_retry_warning_from_backoff",
        "emit",
    );
    assert_eq!(
        lines,
        [
            "event=sync-warning trigger=background provider=local warning_kind=retry_scheduled warning_detail=background_sync_retry_scheduled",
            "event=sync-completed trigger=background provider=local total=1 succeeded=0 failed=1 warnings=1",
        ]
    );
    assert!(lines.iter().all(|line| !line.contains("sentinel")));
}

#[test]
fn finalized_background_log_keeps_provider_warnings_when_ui_list_is_full() {
    use crate::commands::dto::AccountSyncWarningDetail;
    use crate::infra::log_capture_test_support::{child_scenario, run_in_isolated_process};

    if child_scenario().is_some() {
        let account = test_account(60);
        let mut warnings_to_emit = (0..16)
            .map(|index| AccountSyncWarning {
                account_id: format!("ui-warning-{index}"),
                account_name: "private-name-sentinel".to_string(),
                kind: AccountSyncWarningKind::Generic,
                message: format!("ui-warning-{index}"),
                retry_at: None,
                retry_in_seconds: None,
                detail: AccountSyncWarningDetail::AccountSkippedEntries {
                    account_name: "private-name-sentinel".to_string(),
                    count: 1,
                },
            })
            .collect::<Vec<_>>();
        let diagnostic_warnings = (0..17)
            .map(|index| AccountSyncWarning {
                account_id: "private-account-sentinel".to_string(),
                account_name: "private-name-sentinel".to_string(),
                kind: AccountSyncWarningKind::Generic,
                message: format!("private-warning-sentinel-{index}"),
                retry_at: None,
                retry_in_seconds: None,
                detail: AccountSyncWarningDetail::FeedSkippedEntries {
                    feed_title: format!("private-feed-sentinel-{index}"),
                    count: 1,
                },
            })
            .collect();
        finalize_successful_background_account_sync(
            &account,
            diagnostic_warnings,
            &mut warnings_to_emit,
        );
        assert_eq!(warnings_to_emit.len(), 16);
        return;
    }

    let lines = run_in_isolated_process(
        module_path!(),
        "finalized_background_log_keeps_provider_warnings_when_ui_list_is_full",
        "emit",
    );
    assert_eq!(
        lines
            .iter()
            .filter(|line| line.starts_with("event=sync-warning"))
            .count(),
        17
    );
    assert_eq!(
        lines
            .iter()
            .filter(|line| line.starts_with("event=sync-completed"))
            .collect::<Vec<_>>(),
        ["event=sync-completed trigger=background provider=local total=1 succeeded=1 failed=0 warnings=17"]
    );
    assert!(lines.iter().all(|line| !line.contains("sentinel")));
}

#[test]
fn failed_account_sync_uses_provider_retry_after_when_longer_than_backoff() {
    let db = std::sync::Mutex::new(test_db());
    let account = test_account(60);
    {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, &account.id);
    }
    let mut warnings = Vec::new();

    let backoff = complete_failed_account_sync(
        &db,
        &account,
        &AppError::RetryableWithMetadata {
            message: "Rate limit error: HTTP 429 Too Many Requests; retry_after_seconds=600"
                .to_string(),
            retry_after_seconds: Some(600),
        },
        &mut warnings,
    );

    assert_eq!(backoff, Duration::from_secs(600));
    assert_eq!(warnings[0].retry_in_seconds, Some(600));
    assert!(warnings[0].retry_at.is_some());
    assert!(is_in_backoff(&db, &account.id));
}

#[test]
fn expired_retry_after_during_sleep_allows_sync_after_resume() {
    let db = std::sync::Mutex::new(test_db());
    let account = test_account(60);
    {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, &account.id);
        insert_scheduler_sync_state(
            &db_guard,
            &account.id,
            1,
            Some(&(chrono::Utc::now() - chrono::Duration::seconds(1)).to_rfc3339()),
        );
    }

    assert!(
        !is_in_backoff(&db, &account.id),
        "retry windows that expire while the system sleeps must be eligible on resume"
    );
}

#[test]
fn manual_sync_after_resume_clears_expired_scheduler_backoff() {
    let db = std::sync::Mutex::new(test_db());
    let account = test_account(60);
    {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, &account.id);
        insert_scheduler_sync_state(
            &db_guard,
            &account.id,
            3,
            Some(&(chrono::Utc::now() - chrono::Duration::minutes(5)).to_rfc3339()),
        );
    }

    assert!(
        !is_in_backoff(&db, &account.id),
        "manual sync after resume should be allowed once the retry window expired during sleep"
    );

    reset_error_count(&db, &account.id)
        .expect("manual successful sync should clear scheduler retry state");

    let db_guard = db.lock().unwrap();
    let repo = SqliteSyncStateRepository::new(db_guard.reader());
    let state = repo
        .get(&account.id, SyncStateScopeKey::scheduler())
        .expect("sync state lookup should succeed")
        .expect("sync state should exist");
    assert_eq!(state.error_count, 0);
    assert_eq!(state.next_retry_at, None);
}

#[test]
fn failed_account_sync_ignores_invalid_provider_retry_after_marker() {
    let db = std::sync::Mutex::new(test_db());
    let account = test_account(60);
    {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, &account.id);
    }
    let mut warnings = Vec::new();

    let backoff = complete_failed_account_sync(
        &db,
        &account,
        &AppError::RetryableWithMetadata {
            message: "Rate limit error: HTTP 429 Too Many Requests; retry_after_seconds=soon"
                .to_string(),
            retry_after_seconds: None,
        },
        &mut warnings,
    );

    assert_eq!(backoff, calculate_backoff(&account, 1));
    assert_eq!(
        warnings[0].retry_in_seconds,
        Some(calculate_backoff_secs(&account, 1))
    );
}

#[test]
fn retry_after_seconds_ignores_user_visible_and_accidental_markers() {
    assert_eq!(
        retry_after_seconds_from_app_error(&AppError::UserVisible {
            message: "Rate limit error: HTTP 429 Too Many Requests; retry_after_seconds=600"
                .to_string(),
        }),
        None
    );
    assert_eq!(
        retry_after_seconds_from_app_error(&AppError::Retryable {
            message: "provider copy accidentally said retry_after_seconds=600".to_string(),
        }),
        None
    );
}

#[test]
fn retry_after_seconds_accepts_provider_rate_limit_marker() {
    assert_eq!(
        retry_after_seconds_from_app_error(&AppError::RetryableWithMetadata {
            message: "Rate limit error: HTTP 429 Too Many Requests; retry_after_seconds=600"
                .to_string(),
            retry_after_seconds: Some(600),
        }),
        Some(600)
    );
}

#[test]
fn retry_after_seconds_caps_provider_rate_limit_marker() {
    assert_eq!(
        retry_after_seconds_from_app_error(&AppError::RetryableWithMetadata {
            message: "Rate limit error: HTTP 429 Too Many Requests; retry_after_seconds=999999"
                .to_string(),
            retry_after_seconds: Some(999999),
        }),
        Some(PROVIDER_RETRY_AFTER_MAX_SECONDS)
    );
}
