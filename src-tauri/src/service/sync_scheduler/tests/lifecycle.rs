use super::*;

#[test]
fn scheduler_sync_guard_sets_and_releases_syncing_flag() {
    let syncing = AtomicBool::new(false);

    {
        let guard = acquire_scheduler_sync_guard(&syncing)
            .expect("scheduler should acquire an idle sync flag");
        assert!(syncing.load(Ordering::SeqCst));
        assert!(
            acquire_scheduler_sync_guard(&syncing).is_none(),
            "scheduler guard should exclude overlapping sync and vacuum work"
        );
        drop(guard);
    }

    assert!(!syncing.load(Ordering::SeqCst));
}

#[test]
fn scheduler_sync_guard_respects_credential_rotation_pause_contract() {
    let syncing = AtomicBool::new(true);

    assert!(
        acquire_scheduler_sync_guard(&syncing).is_none(),
        "credential rotation reserves the shared sync flag so automatic sync and pending mutation replay stay paused"
    );
    assert!(
        syncing.load(Ordering::SeqCst),
        "scheduler must not release a pause it did not acquire"
    );
}

#[test]
fn scheduler_sync_guard_releases_syncing_flag_when_sync_panics() {
    let syncing = AtomicBool::new(false);

    let panic_result = std::panic::catch_unwind(|| {
        let _guard = acquire_scheduler_sync_guard(&syncing)
            .expect("scheduler should acquire an idle sync flag");
        panic!("simulated background sync panic");
    });

    assert!(panic_result.is_err());
    assert!(
        !syncing.load(Ordering::SeqCst),
        "scheduler guard should release the sync flag during panic unwinding"
    );
}

#[tokio::test]
async fn scheduler_shutdown_wakes_waiting_lifecycle_task() {
    let shutdown = SchedulerShutdown::new();
    let waiter_shutdown = shutdown.clone();
    let waiter = tokio::spawn(async move {
        waiter_shutdown.wait().await;
    });

    tokio::time::sleep(Duration::from_millis(10)).await;
    shutdown.request();

    tokio::time::timeout(Duration::from_millis(50), waiter)
        .await
        .expect("shutdown waiter should complete after request")
        .expect("shutdown waiter task should not panic");
}

#[tokio::test]
async fn scheduler_shutdown_wait_completes_when_requested_before_wait() {
    let shutdown = SchedulerShutdown::new();
    shutdown.request();

    tokio::time::timeout(Duration::from_millis(50), shutdown.wait())
        .await
        .expect("wait() should return immediately when shutdown was already requested");
}

#[tokio::test]
async fn scheduler_lifecycle_rejects_duplicate_running_task_start() {
    let mut lifecycle = SchedulerLifecycle::default();
    let first_start =
        prepare_scheduler_start(&mut lifecycle).expect("first start should be accepted");
    let first_shutdown = first_start.shutdown;
    let first_running = first_start.running;
    let first_task = tauri::async_runtime::spawn(async move {
        let _running_guard = SchedulerTaskRunningGuard(first_running);
        first_shutdown.wait().await;
    });
    register_scheduler_task(&mut lifecycle, first_task);

    let duplicate_start = prepare_scheduler_start(&mut lifecycle);

    assert!(
        duplicate_start.is_none(),
        "running scheduler task should make duplicate start a no-op"
    );
    lifecycle.shutdown.request();
    let task = lifecycle
        .task
        .take()
        .expect("registered scheduler task should remain available for shutdown drain");
    tokio::time::timeout(Duration::from_millis(50), task)
        .await
        .expect("registered scheduler task should drain after shutdown request")
        .expect("registered scheduler task should not panic");
}

#[tokio::test]
async fn scheduler_shutdown_drain_requests_and_awaits_registered_task() {
    let mut lifecycle = scheduler_lifecycle()
        .lock()
        .expect("scheduler lifecycle test lock should be available");
    *lifecycle = SchedulerLifecycle::default();
    let scheduler_start =
        prepare_scheduler_start(&mut lifecycle).expect("test scheduler should start");
    let shutdown = scheduler_start.shutdown;
    let running = scheduler_start.running;
    let task = tauri::async_runtime::spawn(async move {
        let _running_guard = SchedulerTaskRunningGuard(running);
        shutdown.wait().await;
    });
    register_scheduler_task(&mut lifecycle, task);
    drop(lifecycle);

    assert!(drain_sync_scheduler_shutdown(Duration::from_millis(50)).await);

    let mut lifecycle = scheduler_lifecycle()
        .lock()
        .expect("scheduler lifecycle test lock should be available after drain");
    assert!(lifecycle.task.is_none());
    *lifecycle = SchedulerLifecycle::default();
}

#[tokio::test]
async fn scheduler_lifecycle_allows_restart_after_task_cancellation() {
    let mut lifecycle = SchedulerLifecycle::default();
    let scheduler_start =
        prepare_scheduler_start(&mut lifecycle).expect("first start should be accepted");
    let shutdown = scheduler_start.shutdown;
    let running = scheduler_start.running;
    let task = tauri::async_runtime::spawn(async move {
        let _running_guard = SchedulerTaskRunningGuard(running);
        shutdown.wait().await;
    });
    register_scheduler_task(&mut lifecycle, task);

    lifecycle
        .task
        .as_ref()
        .expect("registered scheduler task should exist")
        .abort();
    let task = lifecycle
        .task
        .take()
        .expect("registered scheduler task should remain available after abort");
    task.await.expect_err("aborted scheduler task should stop");
    lifecycle.running.store(false, Ordering::SeqCst);

    assert!(
        prepare_scheduler_start(&mut lifecycle).is_some(),
        "aborted scheduler task should not permanently block restart"
    );
}

#[tokio::test]
async fn scheduler_lifecycle_allows_restart_after_task_panic() {
    let mut lifecycle = SchedulerLifecycle::default();
    let scheduler_start =
        prepare_scheduler_start(&mut lifecycle).expect("first start should be accepted");
    let running = scheduler_start.running;
    let task = tauri::async_runtime::spawn(async move {
        let _running_guard = SchedulerTaskRunningGuard(running);
        panic!("simulated scheduler task panic");
    });
    register_scheduler_task(&mut lifecycle, task);

    let task = lifecycle
        .task
        .take()
        .expect("registered scheduler task should remain available after panic");
    task.await.expect_err("panicked scheduler task should stop");

    assert!(
        prepare_scheduler_start(&mut lifecycle).is_some(),
        "panicked scheduler task should be cleared before duplicate-start checks"
    );
}
