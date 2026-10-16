use super::*;

#[tokio::test]
async fn wait_for_automatic_sync_enabled_returns_immediately_when_already_enabled() {
    let automatic_sync_enabled = AtomicBool::new(true);
    let automatic_sync_notify = Notify::new();

    tokio::time::timeout(
        Duration::from_millis(50),
        wait_for_automatic_sync_enabled(&automatic_sync_enabled, &automatic_sync_notify),
    )
    .await
    .expect("should not wait when automatic sync is already enabled");
}

#[tokio::test]
async fn wait_for_automatic_sync_enabled_waits_for_notification() {
    let automatic_sync_enabled = std::sync::Arc::new(AtomicBool::new(false));
    let automatic_sync_notify = std::sync::Arc::new(Notify::new());

    let enabled = automatic_sync_enabled.clone();
    let notify = automatic_sync_notify.clone();
    let waiter = tokio::spawn(async move {
        wait_for_automatic_sync_enabled(enabled.as_ref(), notify.as_ref()).await;
    });

    tokio::time::sleep(Duration::from_millis(10)).await;
    automatic_sync_enabled.store(true, Ordering::SeqCst);
    automatic_sync_notify.notify_waiters();

    tokio::time::timeout(Duration::from_millis(50), waiter)
        .await
        .expect("waiter should complete after notify")
        .expect("wait task should not panic");
}

#[tokio::test]
async fn wait_for_automatic_sync_enabled_does_not_miss_pre_wait_notification() {
    let automatic_sync_enabled = AtomicBool::new(false);
    let automatic_sync_notify = Notify::new();

    // Flip the flag and fire notify_waiters() before any waiter is
    // registered, mirroring enable_automatic_sync()'s single
    // false->true notification. A check-then-wait implementation that
    // registers the waiter only inside notified().await would hang here
    // forever because the notification already fired.
    automatic_sync_enabled.store(true, Ordering::SeqCst);
    automatic_sync_notify.notify_waiters();

    tokio::time::timeout(
        Duration::from_millis(50),
        wait_for_automatic_sync_enabled(&automatic_sync_enabled, &automatic_sync_notify),
    )
    .await
    .expect("pre-wait notification should not be lost");
}

#[test]
fn account_interval_uses_sync_interval_secs() {
    let account = test_account(900);
    assert_eq!(account_interval(&account), Duration::from_secs(900));
}

#[test]
fn account_interval_defaults_to_3600_when_zero() {
    let account = test_account(0);
    assert_eq!(
        account_interval(&account),
        Duration::from_secs(DEFAULT_SYNC_INTERVAL_SECS)
    );
}

#[test]
fn prune_deleted_account_schedules_removes_accounts_missing_from_latest_snapshot() {
    let retained = Account {
        id: AccountId("retained-account".to_string()),
        kind: crate::domain::provider::ProviderKind::Local,
        name: "Retained".to_string(),
        server_url: None,
        username: None,
        sync_interval_secs: 60,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    };
    let mut schedules = HashMap::from([
        (
            retained.id.as_ref().to_string(),
            AccountSchedule {
                next_sync: Instant::now(),
                interval: Duration::from_secs(60),
            },
        ),
        (
            "deleted-account".to_string(),
            AccountSchedule {
                next_sync: Instant::now(),
                interval: Duration::from_secs(60),
            },
        ),
    ]);

    prune_deleted_account_schedules(&mut schedules, &[retained]);

    assert!(schedules.contains_key("retained-account"));
    assert!(!schedules.contains_key("deleted-account"));
}

#[test]
fn upsert_account_schedule_recalculates_existing_entry_when_interval_changes() {
    let mut account = test_account(3_600);
    account.id = AccountId("rescheduled-account".to_string());
    let now = Instant::now();
    let old_next_sync = now + Duration::from_secs(3_600);
    let mut schedules = HashMap::from([(
        account.id.as_ref().to_string(),
        AccountSchedule {
            next_sync: old_next_sync,
            interval: Duration::from_secs(3_600),
        },
    )]);

    account.sync_interval_secs = 60;
    upsert_account_schedule(
        &mut schedules,
        account.id.as_ref().to_string(),
        &account,
        now,
        None,
    );

    let schedule = schedules
        .get(account.id.as_ref())
        .expect("existing schedule should remain");
    assert_eq!(schedule.interval, Duration::from_secs(60));
    assert_eq!(schedule.next_sync, now + Duration::from_secs(60));
}

#[test]
fn interval_change_keeps_active_backoff_as_higher_priority_gate() {
    let db = std::sync::Mutex::new(test_db());
    let mut account = test_account(3_600);
    account.id = AccountId("backoff-account".to_string());
    let now = Instant::now();
    let mut schedules = HashMap::from([(
        account.id.as_ref().to_string(),
        AccountSchedule {
            next_sync: now + Duration::from_secs(3_600),
            interval: Duration::from_secs(3_600),
        },
    )]);
    {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, &account.id);
        insert_scheduler_sync_state(
            &db_guard,
            &account.id,
            2,
            Some(&(chrono::Utc::now() + chrono::Duration::minutes(30)).to_rfc3339()),
        );
    }

    account.sync_interval_secs = 60;
    let retry_next_sync = persisted_retry_next_sync(&db, &account.id, now);
    upsert_account_schedule(
        &mut schedules,
        account.id.as_ref().to_string(),
        &account,
        now,
        retry_next_sync,
    );

    let schedule = schedules
        .get(account.id.as_ref())
        .expect("existing schedule should remain");
    assert_eq!(schedule.interval, Duration::from_secs(60));
    assert!(
        schedule.next_sync > now + Duration::from_secs(60),
        "persisted backoff should remain the stronger scheduling gate than the changed interval"
    );
    assert!(
        is_in_backoff(&db, &account.id),
        "active persisted backoff should still suppress the rescheduled account"
    );
}

#[test]
fn persisted_retry_next_sync_makes_overdue_retry_due_immediately() {
    let db = std::sync::Mutex::new(test_db());
    let mut account = test_account(3_600);
    account.id = AccountId("overdue-retry-account".to_string());
    {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, &account.id);
        insert_scheduler_sync_state(
            &db_guard,
            &account.id,
            1,
            Some(&(chrono::Utc::now() - chrono::Duration::minutes(5)).to_rfc3339()),
        );
    }

    let now = Instant::now();
    let retry_next_sync = persisted_retry_next_sync(&db, &account.id, now)
        .expect("overdue retry should produce an immediate schedule");
    let mut schedules = HashMap::new();

    upsert_account_schedule(
        &mut schedules,
        account.id.as_ref().to_string(),
        &account,
        now,
        Some(retry_next_sync),
    );

    let schedule = schedules
        .get(account.id.as_ref())
        .expect("schedule should be created");
    assert_eq!(
        schedule.next_sync, now,
        "missed retry windows should run on the next scheduler tick instead of waiting a full interval"
    );
}
