use std::panic;

use super::next_download_progress_percent;
use super::policy::{
    is_prerelease_version, is_strictly_newer_version, is_updater_manual_check_configured,
    parse_semantic_version_parts, pending_update_metadata_matches_parts, update_event_emit_warning,
    update_policy_error_parts, updater_endpoint_error_message,
    updater_initialization_error_message,
};
use super::state::{
    is_update_download_in_flight, next_download_session_id, resolve_post_download_install,
    DownloadGuard, PendingUpdateSlot, PostDownloadInstall, SyncInstallGuard,
    ACTIVE_DOWNLOAD_SESSION_ID, DOWNLOADING, DOWNLOAD_SESSION_ID,
};
use crate::commands::dto::AppError;
use crate::commands::DATABASE_MAINTENANCE_BUSY_ERROR;
use std::sync::atomic::AtomicBool;
use std::sync::atomic::Ordering;
use std::sync::Mutex as StdMutex;
use tauri::utils::config::Config;

static UPDATER_COMMAND_TEST_LOCK: StdMutex<()> = StdMutex::new(());

#[test]
fn pending_update_restores_after_a_take_when_no_newer_state_exists() {
    let mut pending = PendingUpdateSlot::with_value(Some("original-update"));
    let (take_generation, taken) = pending.take();

    assert!(pending.restore_if_unchanged(take_generation, taken.expect("fixture value")));

    let (_, restored) = pending.take();
    assert_eq!(restored, Some("original-update"));
}

#[test]
fn pending_update_does_not_restore_after_a_concurrent_take() {
    let mut pending = PendingUpdateSlot::with_value(Some("original-update"));
    let (restart_generation, taken) = pending.take();

    let (download_generation, downloaded) = pending.take();

    assert_ne!(restart_generation, download_generation);
    assert_eq!(downloaded, None);
    assert!(!pending.restore_if_unchanged(restart_generation, taken.expect("fixture value")));

    let (_, current) = pending.take();
    assert_eq!(current, None);
}

#[test]
fn pending_update_does_not_restore_after_a_clear() {
    let mut pending = PendingUpdateSlot::with_value(Some("original-update"));
    let (take_generation, taken) = pending.take();

    pending.clear();

    assert!(!pending.restore_if_unchanged(take_generation, taken.expect("fixture value")));

    let (_, current) = pending.take();
    assert_eq!(current, None);
}

#[test]
fn pending_update_does_not_restore_over_a_replacement() {
    let mut pending = PendingUpdateSlot::with_value(Some("original-update"));
    let (take_generation, taken) = pending.take();

    pending.replace(Some("newer-update"));

    assert!(!pending.restore_if_unchanged(take_generation, taken.expect("fixture value")));

    let (_, current) = pending.take();
    assert_eq!(current, Some("newer-update"));
}

#[test]
fn pending_update_metadata_contract_rejects_changed_version_or_source() {
    assert!(pending_update_metadata_matches_parts(
        "1.2.4",
        "github-latest-json",
        "1.2.4",
        "github-latest-json"
    ));
    assert!(!pending_update_metadata_matches_parts(
        "1.2.4",
        "github-latest-json",
        "1.2.5",
        "github-latest-json"
    ));
    assert!(!pending_update_metadata_matches_parts(
        "1.2.4",
        "github-latest-json",
        "1.2.4",
        "stale-cache"
    ));
}

#[test]
fn manual_update_check_availability_follows_updater_plugin_config() {
    let mut config = Config::default();
    assert!(!is_updater_manual_check_configured(&config));

    config.plugins.0.insert(
        "updater".to_string(),
        serde_json::json!({
            "endpoints": ["https://example.com/latest.json"],
            "pubkey": "test-pubkey"
        }),
    );
    assert!(is_updater_manual_check_configured(&config));

    config.plugins.0.insert(
        "updater".to_string(),
        serde_json::json!({
            "endpoints": ["   "],
            "pubkey": "test-pubkey"
        }),
    );
    assert!(!is_updater_manual_check_configured(&config));

    config.plugins.0.insert(
        "updater".to_string(),
        serde_json::json!({
            "endpoints": ["https://example.com/latest.json"],
            "pubkey": "   "
        }),
    );
    assert!(!is_updater_manual_check_configured(&config));
}

#[test]
fn update_event_emit_warning_names_failed_event_without_failing_update() {
    let warning = update_event_emit_warning("update-ready", &"listener unavailable");

    assert_eq!(
        warning,
        "Failed to emit update-ready event during update flow: listener unavailable"
    );
}

#[test]
fn updater_runtime_unavailable_errors_are_retryable_command_surface_copy() {
    assert_eq!(
        updater_initialization_error_message("plugin missing"),
        "Updater unavailable during manual update check: plugin missing"
    );
    assert_eq!(
        updater_endpoint_error_message("endpoint refused connection"),
        "Update endpoint unavailable during manual update check: endpoint refused connection"
    );
}

#[test]
fn prerelease_version_detection_requires_non_empty_suffix() {
    assert!(is_prerelease_version("1.2.3-beta.1"));
    assert!(!is_prerelease_version("1.2.3"));
    assert!(!is_prerelease_version("1.2.3-"));
}

#[test]
fn semantic_version_policy_rejects_same_version_and_downgrade() {
    assert_eq!(is_strictly_newer_version("1.10.0", "1.9.9"), Some(true));
    assert_eq!(is_strictly_newer_version("1.2.3", "1.2.3"), Some(false));
    assert_eq!(is_strictly_newer_version("1.2.2", "1.2.3"), Some(false));
}

#[test]
fn semantic_version_policy_ignores_build_metadata_for_precedence() {
    assert_eq!(
        parse_semantic_version_parts("1.2.3+build.7"),
        Some([1, 2, 3])
    );
    assert_eq!(
        is_strictly_newer_version("1.2.3+build.7", "1.2.3"),
        Some(false)
    );
    assert_eq!(
        is_strictly_newer_version("1.2.4+build.7", "1.2.3"),
        Some(true)
    );
}

#[test]
fn semantic_version_policy_rejects_malformed_versions_instead_of_string_fallback() {
    for version in [
        "v1.2.3", "1.2", "1.2.3.4", "01.2.3", "1.02.3", "1.2.03", "1.2.3+", "1.2.3-",
    ] {
        assert_eq!(parse_semantic_version_parts(version), None);
        assert_eq!(
            update_policy_error_parts(version, "1.2.3", "stable", false),
            Some(format!(
                "Malformed semantic update version is not allowed: {version} <= 1.2.3"
            ))
        );
    }
}

#[test]
fn update_policy_accepts_stable_newer_release_only() {
    assert_eq!(
        update_policy_error_parts("1.2.4", "1.2.3", "stable", false),
        None
    );
    assert_eq!(
        update_policy_error_parts("1.2.4", "1.2.3", "beta", false),
        Some("Unsupported update channel: beta".to_string())
    );
    assert_eq!(
        update_policy_error_parts("1.2.4-beta.1", "1.2.3", "stable", true),
        Some("Prerelease update is not allowed: 1.2.4-beta.1".to_string())
    );
    assert_eq!(
        update_policy_error_parts("1.2.3", "1.2.3", "stable", false),
        Some("Downgrade or same-version update is not allowed: 1.2.3 <= 1.2.3".to_string())
    );
    assert_eq!(
        update_policy_error_parts("1.2.2", "1.2.3", "stable", false),
        Some("Downgrade or same-version update is not allowed: 1.2.2 <= 1.2.3".to_string())
    );
}

#[test]
fn download_guard_releases_flag_on_drop() {
    let _test_lock = UPDATER_COMMAND_TEST_LOCK
        .lock()
        .expect("test lock poisoned");
    DOWNLOADING.store(false, Ordering::SeqCst);

    {
        let _guard = DownloadGuard::acquire(1).expect("guard should acquire idle flag");
        assert!(DOWNLOADING.load(Ordering::SeqCst));
        assert!(is_update_download_in_flight());
        assert!(DownloadGuard::acquire(2).is_err());
    }

    assert!(!DOWNLOADING.load(Ordering::SeqCst));
    assert!(!is_update_download_in_flight());
}

#[test]
fn download_guard_exposes_in_flight_state_for_native_close_recovery() {
    let _test_lock = UPDATER_COMMAND_TEST_LOCK
        .lock()
        .expect("test lock poisoned");
    DOWNLOADING.store(false, Ordering::SeqCst);

    let guard = DownloadGuard::acquire(3).expect("guard should acquire idle flag");

    assert!(is_update_download_in_flight());

    drop(guard);

    assert!(!is_update_download_in_flight());
}

#[test]
fn download_guard_releases_flag_after_panic_unwind() {
    let _test_lock = UPDATER_COMMAND_TEST_LOCK
        .lock()
        .expect("test lock poisoned");
    DOWNLOADING.store(false, Ordering::SeqCst);

    let result = panic::catch_unwind(|| {
        let _guard = DownloadGuard::acquire(1).expect("guard should acquire idle flag");
        panic!("simulated panic while downloading");
    });

    assert!(result.is_err());
    assert!(!DOWNLOADING.load(Ordering::SeqCst));
}

#[test]
fn download_guard_clears_only_the_active_session_on_drop() {
    let _test_lock = UPDATER_COMMAND_TEST_LOCK
        .lock()
        .expect("test lock poisoned");
    DOWNLOADING.store(false, Ordering::SeqCst);
    ACTIVE_DOWNLOAD_SESSION_ID.store(0, Ordering::SeqCst);

    {
        let guard = DownloadGuard::acquire(7).expect("guard should acquire idle flag");
        assert_eq!(ACTIVE_DOWNLOAD_SESSION_ID.load(Ordering::SeqCst), 7);
        ACTIVE_DOWNLOAD_SESSION_ID.store(8, Ordering::SeqCst);
        drop(guard);
    }

    assert_eq!(
        ACTIVE_DOWNLOAD_SESSION_ID.load(Ordering::SeqCst),
        8,
        "stale download guard must not clear a superseding session"
    );
    ACTIVE_DOWNLOAD_SESSION_ID.store(0, Ordering::SeqCst);
}

#[test]
fn post_download_install_defers_to_restart_when_sync_install_guard_is_busy() {
    // Contract: a busy sync/maintenance flag when the download finishes
    // must not fail the download. The bytes fall back to the deferred
    // install path (`restart_app` installs them later), and the other
    // operation's flag stays untouched.
    let _test_lock = UPDATER_COMMAND_TEST_LOCK
        .lock()
        .expect("test lock poisoned");
    let busy = AtomicBool::new(true);

    match resolve_post_download_install(SyncInstallGuard::acquire(&busy)) {
        PostDownloadInstall::DeferUntilRestart => {}
        PostDownloadInstall::Immediate(_) => {
            panic!("busy sync flag must defer install to restart_app instead of failing")
        }
    }
    assert!(
        busy.load(Ordering::SeqCst),
        "deferred fallback must not clear another operation's flag"
    );

    let idle = AtomicBool::new(false);
    match resolve_post_download_install(SyncInstallGuard::acquire(&idle)) {
        PostDownloadInstall::Immediate(guard) => {
            assert!(
                idle.load(Ordering::SeqCst),
                "immediate install must hold the sync/install guard"
            );
            drop(guard);
            assert!(
                !idle.load(Ordering::SeqCst),
                "immediate install must release the guard after the install step"
            );
        }
        PostDownloadInstall::DeferUntilRestart => {
            panic!("idle sync flag should install immediately after download")
        }
    };
}

#[test]
fn download_guard_does_not_hold_sync_install_guard_during_download() {
    // Contract: `download_update` acquires `DownloadGuard` for the whole
    // network transfer but must not acquire `SyncInstallGuard` until the
    // brief install step. Verify the two guards are independent locks so
    // sync/database-maintenance operations are never blocked for the full
    // download duration, only for the install itself.
    let _test_lock = UPDATER_COMMAND_TEST_LOCK
        .lock()
        .expect("test lock poisoned");
    DOWNLOADING.store(false, Ordering::SeqCst);
    let syncing = AtomicBool::new(false);

    let download_guard = DownloadGuard::acquire(1).expect("guard should acquire idle flag");
    assert!(is_update_download_in_flight());

    let sync_guard = SyncInstallGuard::acquire(&syncing)
        .expect("sync/install guard must remain acquirable while a download is in flight");
    assert!(syncing.load(Ordering::SeqCst));

    drop(sync_guard);
    assert!(!syncing.load(Ordering::SeqCst));
    drop(download_guard);
    assert!(!is_update_download_in_flight());
}

#[test]
fn sync_install_guard_blocks_sync_and_db_writes_until_released() {
    let _test_lock = UPDATER_COMMAND_TEST_LOCK
        .lock()
        .expect("test lock poisoned");
    let syncing = AtomicBool::new(false);

    {
        let _guard =
            SyncInstallGuard::acquire(&syncing).expect("guard should acquire idle sync flag");
        assert!(syncing.load(Ordering::SeqCst));
        assert!(SyncInstallGuard::acquire(&syncing).is_err());
    }

    assert!(!syncing.load(Ordering::SeqCst));
}

#[test]
fn sync_install_guard_returns_shared_busy_error_when_flag_is_reserved() {
    let _test_lock = UPDATER_COMMAND_TEST_LOCK
        .lock()
        .expect("test lock poisoned");
    let syncing = AtomicBool::new(true);

    let error = SyncInstallGuard::acquire(&syncing)
        .expect_err("reserved sync flag should block update install and restart");

    match error {
        AppError::UserVisible { message } => {
            assert_eq!(message, DATABASE_MAINTENANCE_BUSY_ERROR);
        }
        other => panic!("expected user-visible shared busy error, got {other:?}"),
    }
    assert!(
        syncing.load(Ordering::SeqCst),
        "failed updater guard acquire should not clear another operation's flag"
    );
}

#[test]
fn sync_install_guard_releases_flag_after_panic_unwind() {
    let _test_lock = UPDATER_COMMAND_TEST_LOCK
        .lock()
        .expect("test lock poisoned");
    let syncing = AtomicBool::new(false);

    let result = panic::catch_unwind(|| {
        let _guard =
            SyncInstallGuard::acquire(&syncing).expect("guard should acquire idle sync flag");
        panic!("simulated panic while install gate is held");
    });

    assert!(result.is_err());
    assert!(!syncing.load(Ordering::SeqCst));
}

#[test]
fn download_session_id_advances_per_download_attempt() {
    let _test_lock = UPDATER_COMMAND_TEST_LOCK
        .lock()
        .expect("test lock poisoned");
    DOWNLOAD_SESSION_ID.store(0, Ordering::SeqCst);

    assert_eq!(next_download_session_id(), 1);
    assert_eq!(next_download_session_id(), 2);
}

#[test]
fn download_progress_percent_is_monotonic_when_content_length_changes() {
    assert_eq!(
        next_download_progress_percent(50, Some(100), None),
        Some(50)
    );
    assert_eq!(
        next_download_progress_percent(60, Some(200), Some(50)),
        Some(50)
    );
    assert_eq!(
        next_download_progress_percent(250, Some(200), Some(50)),
        Some(100)
    );
}

#[test]
fn download_progress_percent_keeps_last_value_when_total_is_unknown() {
    assert_eq!(next_download_progress_percent(50, None, Some(40)), Some(40));
    assert_eq!(
        next_download_progress_percent(50, Some(0), Some(40)),
        Some(40)
    );
    assert_eq!(next_download_progress_percent(50, None, None), None);
}
