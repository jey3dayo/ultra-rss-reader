use super::*;

#[test]
fn select_due_accounts_for_tick_caps_many_accounts_to_one_oldest_due_account() {
    let now = Instant::now();
    let mut newest_due = test_account(60);
    newest_due.id = AccountId("due-b".to_string());
    let mut oldest_due = test_account(60);
    oldest_due.id = AccountId("due-a".to_string());
    let mut not_due = test_account(60);
    not_due.id = AccountId("not-due".to_string());
    let accounts = vec![newest_due.clone(), not_due.clone(), oldest_due.clone()];
    let schedules = HashMap::from([
        (
            newest_due.id.as_ref().to_string(),
            AccountSchedule {
                next_sync: now - Duration::from_secs(10),
                interval: Duration::from_secs(60),
            },
        ),
        (
            not_due.id.as_ref().to_string(),
            AccountSchedule {
                next_sync: now + Duration::from_secs(10),
                interval: Duration::from_secs(60),
            },
        ),
        (
            oldest_due.id.as_ref().to_string(),
            AccountSchedule {
                next_sync: now - Duration::from_secs(20),
                interval: Duration::from_secs(60),
            },
        ),
    ]);

    let selected =
        select_due_accounts_for_tick(&accounts, &schedules, now, MAX_ACCOUNTS_PER_SCHEDULER_TICK);

    assert_eq!(selected.len(), 1);
    assert_eq!(selected[0].id, oldest_due.id);
}

#[test]
fn select_due_accounts_for_tick_uses_account_id_as_stable_tie_breaker() {
    let now = Instant::now();
    let mut first = test_account(60);
    first.id = AccountId("account-a".to_string());
    let mut second = test_account(60);
    second.id = AccountId("account-b".to_string());
    let accounts = vec![second.clone(), first.clone()];
    let schedules = HashMap::from([
        (
            first.id.as_ref().to_string(),
            AccountSchedule {
                next_sync: now,
                interval: Duration::from_secs(60),
            },
        ),
        (
            second.id.as_ref().to_string(),
            AccountSchedule {
                next_sync: now,
                interval: Duration::from_secs(60),
            },
        ),
    ]);

    let selected = select_due_accounts_for_tick(&accounts, &schedules, now, 2);

    assert_eq!(
        selected
            .iter()
            .map(|account| account.id.as_ref())
            .collect::<Vec<_>>(),
        vec!["account-a", "account-b"]
    );
}

#[test]
fn select_due_accounts_for_tick_drains_sleep_resume_without_bursting_all_accounts() {
    let pre_sleep = Instant::now();
    let resume = pre_sleep + Duration::from_secs(3_600);
    let accounts = (0..4)
        .map(|index| {
            let mut account = test_account(60);
            account.id = AccountId(format!("account-{index}"));
            account
        })
        .collect::<Vec<_>>();
    let schedules = accounts
        .iter()
        .map(|account| {
            (
                account.id.as_ref().to_string(),
                AccountSchedule {
                    next_sync: pre_sleep + Duration::from_secs(60),
                    interval: Duration::from_secs(60),
                },
            )
        })
        .collect::<HashMap<_, _>>();

    let selected = select_due_accounts_for_tick(
        &accounts,
        &schedules,
        resume,
        MAX_ACCOUNTS_PER_SCHEDULER_TICK,
    );

    assert_eq!(
        selected.len(),
        1,
        "resume after sleep must drain overdue accounts one per tick to protect battery and CPU"
    );
    assert_eq!(
        selected[0].id.as_ref(),
        "account-0",
        "oldest/tie-broken due account should run first after sleep"
    );
}

#[test]
fn select_due_accounts_for_tick_keeps_one_slow_account_from_blocking_ready_accounts() {
    let now = Instant::now();
    let mut slow_account = test_account(60);
    slow_account.id = AccountId("account-slow".to_string());
    let mut ready_account = test_account(60);
    ready_account.id = AccountId("account-ready".to_string());
    let accounts = vec![slow_account.clone(), ready_account.clone()];
    let schedules = HashMap::from([
        (
            slow_account.id.as_ref().to_string(),
            AccountSchedule {
                next_sync: now + Duration::from_secs(300),
                interval: Duration::from_secs(60),
            },
        ),
        (
            ready_account.id.as_ref().to_string(),
            AccountSchedule {
                next_sync: now - Duration::from_secs(1),
                interval: Duration::from_secs(60),
            },
        ),
    ]);

    let selected =
        select_due_accounts_for_tick(&accounts, &schedules, now, MAX_ACCOUNTS_PER_SCHEDULER_TICK);

    assert_eq!(
        selected
            .iter()
            .map(|account| account.id.as_ref())
            .collect::<Vec<_>>(),
        vec!["account-ready"],
        "a slow or retry-delayed account must not block another ready account in the same scheduler tick"
    );
}

#[test]
fn upsert_account_schedule_clamps_clock_jump_like_far_future_in_memory_schedule() {
    let mut account = test_account(60);
    account.id = AccountId("clock-forward-recovery".to_string());
    let now = Instant::now();
    let mut schedules = HashMap::from([(
        account.id.as_ref().to_string(),
        AccountSchedule {
            next_sync: now + Duration::from_secs(86_400),
            interval: Duration::from_secs(60),
        },
    )]);

    upsert_account_schedule(
        &mut schedules,
        account.id.as_ref().to_string(),
        &account,
        now,
        None,
    );

    let schedule = schedules
        .get(account.id.as_ref())
        .expect("schedule should remain");
    assert_eq!(
        schedule.next_sync,
        now + Duration::from_secs(60),
        "scheduler must not keep an in-memory next_sync farther out than the current interval"
    );
}

#[test]
fn upsert_account_schedule_keeps_clock_backward_like_recent_schedule_until_due() {
    let mut account = test_account(60);
    account.id = AccountId("clock-backward-recovery".to_string());
    let now = Instant::now();
    let next_sync = now + Duration::from_secs(30);
    let mut schedules = HashMap::from([(
        account.id.as_ref().to_string(),
        AccountSchedule {
            next_sync,
            interval: Duration::from_secs(60),
        },
    )]);

    upsert_account_schedule(
        &mut schedules,
        account.id.as_ref().to_string(),
        &account,
        now,
        None,
    );

    let schedule = schedules
        .get(account.id.as_ref())
        .expect("schedule should remain");
    assert_eq!(
        schedule.next_sync, next_sync,
        "scheduler must not pull a still-valid in-memory schedule forward after a small clock correction"
    );
}

#[test]
fn completed_sync_reschedule_uses_refreshed_account_interval() {
    let db = std::sync::Mutex::new(test_db());
    let mut stale_account = test_account(3_600);
    stale_account.id = AccountId("interval-after-success".to_string());
    let due_at = Instant::now();
    let mut schedules = HashMap::from([(
        stale_account.id.as_ref().to_string(),
        AccountSchedule {
            next_sync: due_at,
            interval: account_interval(&stale_account),
        },
    )]);
    {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, &stale_account.id);
        set_test_account_sync_interval(&db_guard, &stale_account.id, 60);
    }

    let latest_account = load_scheduler_account(&db, &stale_account.id)
        .expect("latest account should load")
        .expect("account should still exist");
    let rescheduled_at = Instant::now();
    schedule_completed_account_sync(&mut schedules, &latest_account, rescheduled_at);

    let schedule = schedules
        .get(stale_account.id.as_ref())
        .expect("account schedule should remain");
    assert_eq!(schedule.interval, Duration::from_secs(60));
    assert_eq!(
        schedule.next_sync,
        rescheduled_at + Duration::from_secs(60),
        "completed sync should not reuse the stale due-account interval"
    );
}

#[test]
fn failed_sync_retry_uses_refreshed_account_interval_for_backoff() {
    let db = std::sync::Mutex::new(test_db());
    let mut stale_account = test_account(3_600);
    stale_account.id = AccountId("interval-after-failure".to_string());
    let due_at = Instant::now();
    let mut schedules = HashMap::from([(
        stale_account.id.as_ref().to_string(),
        AccountSchedule {
            next_sync: due_at,
            interval: account_interval(&stale_account),
        },
    )]);
    {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, &stale_account.id);
        set_test_account_sync_interval(&db_guard, &stale_account.id, 60);
    }
    let latest_account = load_scheduler_account(&db, &stale_account.id)
        .expect("latest account should load")
        .expect("account should still exist");
    let mut warnings = Vec::new();

    let backoff = complete_failed_account_sync(
        &db,
        &latest_account,
        &AppError::UserVisible {
            message: "sync failed".to_string(),
        },
        &mut warnings,
    );
    let retry_scheduled_at = Instant::now();
    schedule_failed_account_sync(&mut schedules, &latest_account, retry_scheduled_at, backoff);

    let schedule = schedules
        .get(stale_account.id.as_ref())
        .expect("account schedule should remain");
    assert_eq!(backoff, Duration::from_secs(120));
    assert_eq!(schedule.interval, Duration::from_secs(60));
    assert_eq!(
        schedule.next_sync,
        retry_scheduled_at + Duration::from_secs(120),
        "failed sync should calculate retry from the refreshed account interval"
    );
    assert_eq!(warnings[0].retry_in_seconds, Some(120));
}

#[test]
fn sync_completion_prunes_schedule_when_account_was_deleted_in_flight() {
    let db = std::sync::Mutex::new(test_db());
    let mut account = test_account(60);
    account.id = AccountId("deleted-in-flight".to_string());
    let mut schedules = HashMap::from([(
        account.id.as_ref().to_string(),
        AccountSchedule {
            next_sync: Instant::now(),
            interval: account_interval(&account),
        },
    )]);
    {
        let db_guard = db.lock().unwrap();
        insert_test_account(&db_guard, &account.id);
        delete_test_account(&db_guard, &account.id);
    }

    let latest_account =
        load_scheduler_account(&db, &account.id).expect("deleted account lookup should not fail");
    if latest_account.is_none() {
        schedules.remove(account.id.as_ref());
    }

    assert!(
        !schedules.contains_key(account.id.as_ref()),
        "deleted account should not keep an in-memory schedule after in-flight sync finishes"
    );
}

#[test]
fn sync_completion_does_not_reschedule_from_stale_snapshot_when_refresh_fails() {
    let db = std::sync::Mutex::new(test_db());
    let mut account = test_account(3_600);
    account.id = AccountId("refresh-failure".to_string());
    let due_at = Instant::now();
    let mut schedules = HashMap::from([(
        account.id.as_ref().to_string(),
        AccountSchedule {
            next_sync: due_at,
            interval: account_interval(&account),
        },
    )]);
    let poison_result = std::panic::catch_unwind(|| {
        let _guard = db.lock().unwrap();
        panic!("poison scheduler account refresh");
    });
    assert!(poison_result.is_err());

    let refresh_error = load_scheduler_account(&db, &account.id)
        .expect_err("poisoned lock should prevent account refresh");
    assert!(matches!(refresh_error, DomainError::Persistence(_)));

    let schedule = schedules
        .remove(account.id.as_ref())
        .expect("schedule should remain untouched after refresh failure");
    assert_eq!(schedule.interval, Duration::from_secs(3_600));
    assert_eq!(
        schedule.next_sync, due_at,
        "refresh failure should not overwrite the schedule with a stale snapshot"
    );
}
