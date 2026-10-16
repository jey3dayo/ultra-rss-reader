use super::*;

#[test]
fn startup_preferences_keep_loaded_values() {
    let prefs = startup_preferences_or_default(Ok(HashMap::from([(
        "debug_browser_hud".to_string(),
        "true".to_string(),
    )])));

    assert_eq!(
        prefs.get("debug_browser_hud").map(String::as_str),
        Some("true")
    );
}

#[test]
fn startup_preferences_fall_back_to_defaults_on_read_error() {
    let error = DomainError::Persistence("database is locked".to_string());
    let warning = startup_preferences_read_warning_message(&error);
    let prefs = startup_preferences_or_default(Err(error));

    assert!(
        prefs.is_empty(),
        "startup should continue with default menu state and diagnostics settings"
    );
    assert!(warning.contains("Failed to read startup preferences"));
    assert!(warning.contains("using default menu state and diagnostics settings"));
    assert!(warning.contains("database is locked"));
}

#[test]
fn cleanup_old_logs_read_dir_failure_keeps_cleanup_non_fatal() {
    let missing_dir = Path::new("/tmp/ultra-rss-reader-missing-log-dir");

    cleanup_old_logs(missing_dir, RELEASE_LOG_RETENTION_DAYS);
}

#[test]
fn startup_log_cleanup_removes_expired_files_and_preserves_current_app_log() {
    let temp_dir = tempfile::tempdir().expect("log tempdir should be created");
    let old_log = temp_dir.path().join("app.log.1");
    let current_log = temp_dir.path().join("app.log");
    std::fs::write(&old_log, "old").expect("old rotated log should be written");
    std::fs::write(&current_log, "current").expect("current app log should be written");
    let old_modified = std::time::SystemTime::now()
        - Duration::from_secs((RELEASE_LOG_RETENTION_DAYS + 1) * 86_400);
    std::fs::File::open(&old_log)
        .expect("old rotated log should be opened")
        .set_times(std::fs::FileTimes::new().set_modified(old_modified))
        .expect("old rotated log timestamp should be updated");

    cleanup_startup_logs(temp_dir.path());

    assert!(!old_log.exists(), "expired rotated log should be removed");
    assert!(
        current_log.exists(),
        "current app.log should never be removed"
    );
}

#[test]
fn release_log_rotation_contract_matches_support_docs() {
    let lib_rs = include_str!("../lib.rs");
    let file_logging_design =
        include_str!("../../../docs/superpowers/specs/2026-03-30-file-logging-design.md");
    let release_manual = include_str!("../../../docs/release-manual-verification.md");

    assert_eq!(RELEASE_LOG_MAX_FILE_SIZE_BYTES, 5_000_000);
    assert_eq!(RELEASE_LOG_RETENTION_DAYS, 7);
    assert_eq!(RELEASE_LOG_ROTATION_STRATEGY, "KeepAll");
    assert_eq!(RELEASE_LOG_TIMEZONE_STRATEGY, "UseLocal");
    assert!(lib_rs.contains(".max_file_size(RELEASE_LOG_MAX_FILE_SIZE_BYTES)"));
    assert!(lib_rs.contains("RotationStrategy::KeepAll"));
    assert!(lib_rs.contains("TimezoneStrategy::UseLocal"));
    let startup_cleanup = lib_rs
        .split("service::sync_scheduler::start_sync_scheduler(&state.db, app.handle().clone());")
        .nth(1)
        .and_then(|setup| setup.split("            Ok(())").next())
        .expect("startup cleanup should follow scheduler startup");
    assert!(startup_cleanup.contains("cleanup_startup_logs(&log_dir);"));
    assert!(!startup_cleanup.contains("#[cfg(not(debug_assertions))]"));
    assert!(file_logging_design.contains("max_file_size = 5_000_000"));
    assert!(file_logging_design.contains("7 days"));
    assert!(file_logging_design.contains("KeepAll"));
    assert!(file_logging_design.contains("TimezoneStrategy::UseLocal"));
    assert!(release_manual.contains("TimezoneStrategy::UseLocal"));
    assert!(release_manual.contains("OS timezone and UTC offset"));
}

#[test]
fn cleanup_old_logs_observability_messages_redact_paths_and_include_reason() {
    let read_dir_error = std::io::Error::new(std::io::ErrorKind::NotFound, "missing directory");
    let metadata_error =
        std::io::Error::new(std::io::ErrorKind::PermissionDenied, "metadata denied");
    let remove_error = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "remove denied");

    let read_dir_warning =
        cleanup_old_logs_read_dir_warning(Path::new("/tmp/logs"), &read_dir_error);
    let entry_debug = cleanup_old_logs_entry_debug(Path::new("/tmp/logs"), &metadata_error);
    let metadata_debug =
        cleanup_old_logs_metadata_debug(Path::new("/tmp/logs/old.log"), &metadata_error);
    let modified_debug =
        cleanup_old_logs_modified_debug(Path::new("/tmp/logs/old.log"), &metadata_error);
    let remove_warning =
        cleanup_old_logs_remove_warning(Path::new("/tmp/logs/old.log"), &remove_error);

    assert!(read_dir_warning.contains("[redacted parent]/logs"));
    assert!(read_dir_warning.contains("missing directory"));
    assert!(!read_dir_warning.contains("/tmp"));
    assert!(entry_debug.contains("[redacted parent]/logs"));
    assert!(entry_debug.contains("metadata denied"));
    assert!(!entry_debug.contains("/tmp"));
    assert!(metadata_debug.contains("[redacted parent]/old.log"));
    assert!(metadata_debug.contains("metadata denied"));
    assert!(!metadata_debug.contains("/tmp"));
    assert!(modified_debug.contains("[redacted parent]/old.log"));
    assert!(modified_debug.contains("metadata denied"));
    assert!(!modified_debug.contains("/tmp"));
    assert!(remove_warning.contains("[redacted parent]/old.log"));
    assert!(remove_warning.contains("remove denied"));
    assert!(!remove_warning.contains("/tmp"));
}

#[test]
fn startup_focus_restore_failures_are_diagnostics_only() {
    let show_error = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "show denied");
    let window_focus_error =
        std::io::Error::new(std::io::ErrorKind::PermissionDenied, "window focus denied");
    let webview_focus_error =
        std::io::Error::new(std::io::ErrorKind::PermissionDenied, "webview focus denied");
    let schedule_error = std::io::Error::new(
        std::io::ErrorKind::PermissionDenied,
        "main thread unavailable",
    );

    let show_warning = startup_main_window_show_warning(&show_error);
    let window_focus_warning = startup_main_window_focus_warning(&window_focus_error);
    let webview_focus_warning = startup_main_webview_focus_warning(&webview_focus_error);
    let schedule_warning = startup_focus_main_thread_warning(&schedule_error);

    assert!(show_warning.contains("Failed to show main window"));
    assert!(show_warning.contains("startup focus restore"));
    assert!(show_warning.contains("show denied"));
    assert!(window_focus_warning.contains("Failed to focus main window"));
    assert!(window_focus_warning.contains("window focus denied"));
    assert!(webview_focus_warning.contains("Failed to focus main webview"));
    assert!(webview_focus_warning.contains("webview focus denied"));
    assert!(schedule_warning.contains("Failed to schedule startup focus restore"));
    assert!(schedule_warning.contains("main thread unavailable"));
}

#[test]
fn startup_focus_restore_runs_only_when_app_window_and_webview_are_available() {
    assert_eq!(
        startup_focus_restore_decision(false, true, true),
        StartupFocusRestoreDecision::SkipAppUnavailable
    );
    assert_eq!(
        startup_focus_restore_decision(true, false, true),
        StartupFocusRestoreDecision::SkipMainWindowMissing
    );
    assert_eq!(
        startup_focus_restore_decision(true, true, false),
        StartupFocusRestoreDecision::SkipMainWebviewMissing
    );
    assert_eq!(
        startup_focus_restore_decision(true, true, true),
        StartupFocusRestoreDecision::Restore
    );
}

#[test]
fn startup_focus_restore_stop_flag_cancels_delayed_task() {
    let active = Arc::new(AtomicBool::new(true));
    assert!(startup_focus_restore_is_active(&active));

    mark_startup_focus_restore_stopped(&active);

    assert!(!startup_focus_restore_is_active(&active));
}

#[test]
fn single_instance_plugin_is_registered_before_other_plugins() {
    let lib_rs = include_str!("../lib.rs");
    let cargo_toml = include_str!("../../Cargo.toml");

    assert!(cargo_toml.contains("tauri-plugin-single-instance"));

    let single_instance_index = lib_rs
        .find("tauri_plugin_single_instance::init")
        .expect("single-instance plugin should be initialized");
    let window_state_index = lib_rs
        .find("tauri_plugin_window_state::Builder")
        .expect("window-state plugin should be initialized");
    let mcp_bridge_index = lib_rs
        .find("tauri_plugin_mcp_bridge::Builder")
        .expect("MCP bridge plugin should remain initialized");
    let release_log_index = lib_rs
        .find("tauri_plugin_log::Builder")
        .expect("release log plugin should remain initialized");

    assert!(
        single_instance_index < window_state_index,
        "single-instance must exit the second process before window-state rewrites the saved size"
    );
    assert!(
        single_instance_index < mcp_bridge_index,
        "single-instance plugin must be registered before debug-only plugins"
    );
    assert!(
        single_instance_index < release_log_index,
        "single-instance plugin must be registered before release plugins"
    );
}
