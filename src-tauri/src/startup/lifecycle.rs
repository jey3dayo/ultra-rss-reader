use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, TryLockError};
use std::time::Duration;

#[cfg(not(test))]
use crate::commands::AppState;
use crate::SHUTDOWN_DRAIN_POLL_INTERVAL;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum StartupFocusRestoreDecision {
    Restore,
    SkipAppUnavailable,
    SkipMainWindowMissing,
    SkipMainWebviewMissing,
}

pub(crate) fn startup_focus_restore_decision(
    app_available: bool,
    main_window_available: bool,
    main_webview_available: bool,
) -> StartupFocusRestoreDecision {
    if !app_available {
        StartupFocusRestoreDecision::SkipAppUnavailable
    } else if !main_window_available {
        StartupFocusRestoreDecision::SkipMainWindowMissing
    } else if !main_webview_available {
        StartupFocusRestoreDecision::SkipMainWebviewMissing
    } else {
        StartupFocusRestoreDecision::Restore
    }
}

pub(crate) fn mark_startup_focus_restore_stopped(active: &Arc<AtomicBool>) {
    active.store(false, Ordering::Release);
}

pub(crate) fn startup_focus_restore_is_active(active: &Arc<AtomicBool>) -> bool {
    active.load(Ordering::Acquire)
}

pub(crate) enum ShutdownDrainAttempt {
    Drained,
    Busy,
    Poisoned(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum MainWindowCloseDecision {
    StartShutdownDrain,
    BlockNativeOperationInFlight,
    IgnoreAlreadyDraining,
}

pub(crate) fn main_window_close_decision(
    shutdown_draining: bool,
    sync_in_flight: bool,
    update_download_in_flight: bool,
) -> MainWindowCloseDecision {
    if shutdown_draining {
        MainWindowCloseDecision::IgnoreAlreadyDraining
    } else if sync_in_flight || update_download_in_flight {
        MainWindowCloseDecision::BlockNativeOperationInFlight
    } else {
        MainWindowCloseDecision::StartShutdownDrain
    }
}

#[cfg(test)]
#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SecondLaunchDecision {
    FocusExistingWindow,
    FocusAndReportNativeOperationInFlight,
}

#[cfg(test)]
#[allow(dead_code)]
pub(crate) fn second_launch_decision(
    sync_in_flight: bool,
    update_download_in_flight: bool,
) -> SecondLaunchDecision {
    if sync_in_flight || update_download_in_flight {
        SecondLaunchDecision::FocusAndReportNativeOperationInFlight
    } else {
        SecondLaunchDecision::FocusExistingWindow
    }
}

pub(crate) fn try_drain_mutex_lock_for_shutdown<T>(mutex: &Mutex<T>) -> ShutdownDrainAttempt {
    match mutex.try_lock() {
        Ok(_guard) => ShutdownDrainAttempt::Drained,
        Err(TryLockError::WouldBlock) => ShutdownDrainAttempt::Busy,
        Err(TryLockError::Poisoned(error)) => ShutdownDrainAttempt::Poisoned(error.to_string()),
    }
}

pub(crate) async fn drain_mutex_lock_for_shutdown<T>(
    mutex: &Mutex<T>,
    timeout: Duration,
    lock_name: &'static str,
) -> bool {
    match tokio::time::timeout(timeout, async {
        loop {
            match try_drain_mutex_lock_for_shutdown(mutex) {
                ShutdownDrainAttempt::Drained => return true,
                ShutdownDrainAttempt::Busy => {
                    tokio::time::sleep(SHUTDOWN_DRAIN_POLL_INTERVAL).await;
                }
                ShutdownDrainAttempt::Poisoned(error) => {
                    tracing::warn!("{lock_name} shutdown drain failed: lock poisoned: {error}");
                    return false;
                }
            }
        }
    })
    .await
    {
        Ok(drained) => drained,
        Err(_) => {
            tracing::warn!("{lock_name} shutdown drain timed out");
            false
        }
    }
}

#[cfg(not(test))]
pub(crate) async fn drain_database_shutdown(state: &AppState, timeout: Duration) -> bool {
    drain_mutex_lock_for_shutdown(&state.db, timeout, "Database").await
}
