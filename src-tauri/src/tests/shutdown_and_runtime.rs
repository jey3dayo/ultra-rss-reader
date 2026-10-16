use super::*;

#[tokio::test]
async fn startup_shutdown_contract_db_drain_waits_for_in_flight_lock_to_release() {
    let db_lock = Arc::new(Mutex::new(()));
    let lock_for_thread = db_lock.clone();
    let (ready_tx, ready_rx) = std::sync::mpsc::channel();

    let releaser = std::thread::spawn(move || {
        let _held_lock = lock_for_thread
            .lock()
            .expect("test lock should be acquired");
        ready_tx.send(()).expect("ready signal should be sent");
        std::thread::sleep(Duration::from_millis(10));
    });
    ready_rx.recv().expect("ready signal should be received");

    let drained =
        drain_mutex_lock_for_shutdown(db_lock.as_ref(), Duration::from_secs(1), "Database").await;

    releaser.join().expect("lock releaser should not panic");
    assert!(drained, "shutdown drain should wait for the DB lock");
}

#[tokio::test]
async fn startup_shutdown_contract_db_drain_times_out_when_lock_stays_busy() {
    let db_lock = Arc::new(Mutex::new(()));
    let lock_for_thread = db_lock.clone();
    let (ready_tx, ready_rx) = std::sync::mpsc::channel();
    let releaser = std::thread::spawn(move || {
        let _held_lock = lock_for_thread
            .lock()
            .expect("test lock should be acquired");
        ready_tx.send(()).expect("ready signal should be sent");
        std::thread::sleep(Duration::from_millis(50));
    });
    ready_rx.recv().expect("ready signal should be received");

    let drained =
        drain_mutex_lock_for_shutdown(db_lock.as_ref(), Duration::from_millis(1), "Database").await;

    releaser.join().expect("lock releaser should not panic");
    assert!(
        !drained,
        "shutdown drain should report timeout before forced app exit"
    );
}

#[test]
fn main_window_close_blocks_native_sync_or_update_before_shutdown_drain() {
    assert_eq!(
        main_window_close_decision(false, false, false),
        MainWindowCloseDecision::StartShutdownDrain
    );
    assert_eq!(
        main_window_close_decision(false, true, false),
        MainWindowCloseDecision::BlockNativeOperationInFlight
    );
    assert_eq!(
        main_window_close_decision(false, false, true),
        MainWindowCloseDecision::BlockNativeOperationInFlight
    );
    assert_eq!(
        main_window_close_decision(true, true, true),
        MainWindowCloseDecision::IgnoreAlreadyDraining
    );
}

#[test]
fn second_launch_reports_native_operations_after_focus_restore() {
    assert_eq!(
        second_launch_decision(false, false),
        SecondLaunchDecision::FocusExistingWindow
    );
    assert_eq!(
        second_launch_decision(true, false),
        SecondLaunchDecision::FocusAndReportNativeOperationInFlight
    );
    assert_eq!(
        second_launch_decision(false, true),
        SecondLaunchDecision::FocusAndReportNativeOperationInFlight
    );
}

#[test]
fn runtime_boundary_tracing_init_conflict_is_non_fatal() {
    let first = tracing_init_status(true);
    let conflict = tracing_init_status(false);

    assert_eq!(first, TracingInitStatus::Installed);
    assert!(
        matches!(
            conflict,
            TracingInitStatus::Installed | TracingInitStatus::AlreadyInstalled
        ),
        "test-global subscriber state should never force a panic"
    );
}

#[cfg(debug_assertions)]
#[test]
fn debug_tracing_leaves_the_persisted_logger_slot_available() {
    use crate::infra::log_capture_test_support::{child_scenario, run_in_isolated_process};

    if let Ok(scenario) = std::env::var("URR_LOG_CAPTURE_SCENARIO") {
        if scenario == "legacy" {
            tracing_subscriber::fmt()
                .try_init()
                .expect("legacy subscriber fixture should initialize");
            assert!(log::set_logger(log::logger()).is_err());
            return;
        }

        assert_eq!(
            crate::init_debug_tracing_subscriber(),
            TracingInitStatus::Installed
        );
        assert_eq!(
            crate::init_debug_tracing_subscriber(),
            TracingInitStatus::AlreadyInstalled
        );
        child_scenario().expect("isolated child should install the log logger after tracing");
        tracing::warn!("tracing-only-sentinel");
        log::warn!(target: "sync", "safe-log-record");
        return;
    }

    assert!(run_in_isolated_process(
        module_path!(),
        "debug_tracing_leaves_the_persisted_logger_slot_available",
        "legacy",
    )
    .is_empty());
    assert_eq!(
        run_in_isolated_process(
            module_path!(),
            "debug_tracing_leaves_the_persisted_logger_slot_available",
            "fixed",
        ),
        ["safe-log-record"]
    );
}

#[test]
fn runtime_boundary_panic_redaction_covers_startup_and_background_sync_payloads() {
    let message = redact_sensitive_panic_text(
        "startup failed at https://user:token@example.com/feed?api_key=secret#frag and /Users/example/app/ultra-rss-reader.db",
    );

    assert!(message.contains("https://example.com/feed?redacted#redacted"));
    assert!(message.contains("[redacted parent]/ultra-rss-reader.db"));
    assert!(!message.contains("user:token"));
    assert!(!message.contains("api_key=secret"));
    assert!(!message.contains("/Users/example"));

    let background_message = redact_sensitive_panic_text(
        "background sync panicked for account Personal at https://secret@example.com/rss?token=raw",
    );

    assert!(background_message.contains("[redacted account]"));
    assert!(background_message.contains("https://example.com/rss?redacted"));
    assert!(!background_message.contains("Personal"));
    assert!(!background_message.contains("secret@"));
    assert!(!background_message.contains("token=raw"));
}

#[test]
fn runtime_boundary_panic_payload_text_does_not_debug_format_non_string_payloads() {
    let payload = 42_i32;

    assert_eq!(
        panic_payload_text(&payload),
        "[non-string panic payload]",
        "panic hook should not expose arbitrary payload debug output"
    );
}

#[test]
fn startup_filesystem_messages_are_recoverable_and_path_redacted() {
    let resolve_error =
        std::io::Error::new(std::io::ErrorKind::NotFound, "base directory unavailable");
    let create_error =
        std::io::Error::new(std::io::ErrorKind::PermissionDenied, "permission denied");

    let resolve_message = startup_app_data_dir_error_message(&resolve_error);
    let create_message = startup_app_data_dir_create_error_message(
        Path::new("/Users/example/Library/Application Support/app"),
        &create_error,
    );

    assert!(resolve_message.contains("startup filesystem access"));
    assert!(resolve_message.contains("Check OS permissions"));
    assert!(create_message.contains("[redacted parent]/app"));
    assert!(create_message.contains("available disk space"));
    assert!(!create_message.contains("/Users/example"));
}

#[test]
fn redacted_path_label_uses_only_final_component() {
    assert_eq!(
        redacted_path_label(Path::new("/Users/example/app/app.log")),
        "[redacted parent]/app.log"
    );
}
