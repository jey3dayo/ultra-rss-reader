pub mod browser_webview;
pub mod commands;
pub mod domain;
pub mod infra;
pub mod menu;
pub mod menu_i18n;
pub mod platform;
pub mod repository;
pub mod service;

use std::any::Any;
use std::collections::HashMap;
#[cfg(not(test))]
use std::panic::PanicHookInfo;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::{Mutex, TryLockError};
use std::time::Duration;

#[cfg(not(test))]
use commands::updater_commands::PendingUpdate;

#[cfg(not(test))]
use commands::AppState;
use domain::error::DomainError;
#[cfg(not(test))]
use infra::db::connection::DbManager;
#[cfg(not(test))]
use infra::db::sqlite_preference::SqlitePreferenceRepository;
#[cfg(not(test))]
use repository::preference::PreferenceRepository;
#[cfg(not(test))]
use tauri::Emitter;
#[cfg(not(test))]
use tauri::Manager;

#[cfg(not(test))]
const SHUTDOWN_DRAIN_TIMEOUT: Duration = Duration::from_secs(5);
const SHUTDOWN_DRAIN_POLL_INTERVAL: Duration = Duration::from_millis(25);
#[cfg(not(test))]
const MAIN_WINDOW_CLOSE_BLOCKED_EVENT: &str = "main-window-close-blocked";
/// Only the size is persisted.
///
/// `POSITION` would let a saved geometry reopen the window on a disconnected
/// monitor or at negative coordinates, and `FULLSCREEN` would reopen fullscreen
/// on a display that no longer exists, so both stay off and the window keeps its
/// centered placement.
///
/// `MAXIMIZED` is excluded because the restored maximized state is not readable
/// from the window while the size guards run: the platform has not committed the
/// restored frame yet, so `is_maximized` reports `false` and the guards would
/// un-maximize the window. The plugin also skips recording the size while the
/// window is maximized or minimized, so quitting maximized reopens at the last
/// non-maximized size rather than at the size the maximized window covered.
#[cfg(all(desktop, not(test)))]
const MAIN_WINDOW_STATE_FLAGS: tauri_plugin_window_state::StateFlags =
    tauri_plugin_window_state::StateFlags::SIZE;
const MAIN_WINDOW_MIN_WIDTH: u64 = 520;
const MAIN_WINDOW_MIN_HEIGHT: u64 = 420;
#[cfg(any(not(debug_assertions), test))]
const RELEASE_LOG_MAX_FILE_SIZE_BYTES: u128 = 5_000_000;
#[cfg(any(not(debug_assertions), test))]
const RELEASE_LOG_RETENTION_DAYS: u64 = 7;
#[cfg(test)]
const RELEASE_LOG_ROTATION_STRATEGY: &str = "KeepAll";
#[cfg(test)]
const RELEASE_LOG_TIMEZONE_STRATEGY: &str = "UseLocal";

fn main_window_title_bar_uses_overlay() -> bool {
    cfg!(target_os = "macos")
}

#[cfg(not(test))]
fn main_window_title_bar_style() -> tauri::TitleBarStyle {
    if main_window_title_bar_uses_overlay() {
        tauri::TitleBarStyle::Overlay
    } else {
        tauri::TitleBarStyle::Visible
    }
}

fn redacted_path_label(path: &std::path::Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| format!("[redacted parent]/{name}"))
        .unwrap_or_else(|| "[redacted path]".to_string())
}

fn redact_sensitive_url_token(token: &str) -> String {
    let trimmed_start = token.trim_start_matches(['"', '\'', '(', '[']);
    let prefix_len = token.len() - trimmed_start.len();
    let trimmed = trimmed_start.trim_end_matches([
        '"', '\'', ')', ']', ',', '.', ';', ':', '。', '、', '，', '．', '！', '？',
    ]);
    let suffix_len = trimmed_start.len() - trimmed.len();

    let Ok(mut url) = reqwest::Url::parse(trimmed) else {
        return token.to_string();
    };

    if url.scheme() != "http" && url.scheme() != "https" {
        return token.to_string();
    }

    if !url.username().is_empty() || url.password().is_some() {
        let _ = url.set_username("");
        let _ = url.set_password(None);
    }
    url.set_query(url.query().map(|_| "redacted"));
    if url.fragment().is_some() {
        url.set_fragment(Some("redacted"));
    }

    format!(
        "{}{}{}",
        &token[..prefix_len],
        url,
        &token[token.len() - suffix_len..]
    )
}

fn redact_sensitive_path_token(token: &str) -> String {
    let trimmed_start = token.trim_start_matches(['"', '\'', '(', '[']);
    let prefix_len = token.len() - trimmed_start.len();
    let trimmed = trimmed_start.trim_end_matches(['"', '\'', ')', ']', ',', '.', ';', ':', '。']);
    let suffix_len = trimmed_start.len() - trimmed.len();

    if !(trimmed.starts_with('/') || trimmed.starts_with("~/") || trimmed.contains(":\\"))
        || trimmed.len() <= 1
    {
        return token.to_string();
    }

    format!(
        "{}{}{}",
        &token[..prefix_len],
        redacted_path_label(std::path::Path::new(trimmed)),
        &token[token.len() - suffix_len..]
    )
}

fn redact_sensitive_panic_text(message: &str) -> String {
    let mut redact_next_account_value = false;

    message
        .split_whitespace()
        .map(redact_sensitive_url_token)
        .map(|token| redact_sensitive_path_token(&token))
        .map(|token| {
            if redact_next_account_value {
                redact_next_account_value = false;
                "[redacted account]".to_string()
            } else {
                let normalized = token.trim_end_matches(':').to_ascii_lowercase();
                redact_next_account_value = normalized == "account" || normalized == "account_name";
                token
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn panic_payload_text(payload: &(dyn Any + Send)) -> String {
    if let Some(message) = payload.downcast_ref::<&str>() {
        (*message).to_string()
    } else if let Some(message) = payload.downcast_ref::<String>() {
        message.clone()
    } else {
        "[non-string panic payload]".to_string()
    }
}

#[cfg(not(test))]
fn redacted_panic_hook_message(info: &PanicHookInfo<'_>) -> String {
    let message = redact_sensitive_panic_text(&panic_payload_text(info.payload()));
    match info.location() {
        Some(location) => format!(
            "Rust panic captured at {}:{}: {message}",
            location.file(),
            location.line()
        ),
        None => format!("Rust panic captured: {message}"),
    }
}

#[cfg(not(test))]
fn install_redacting_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        let message = redacted_panic_hook_message(info);
        tracing::error!("{message}");
        eprintln!("{message}");
    }));
}

#[cfg(any(test, debug_assertions))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TracingInitStatus {
    Installed,
    AlreadyInstalled,
}

#[cfg(any(test, debug_assertions))]
fn tracing_init_status(installed: bool) -> TracingInitStatus {
    match installed {
        true => TracingInitStatus::Installed,
        false => TracingInitStatus::AlreadyInstalled,
    }
}

#[cfg(not(test))]
#[cfg(debug_assertions)]
fn init_debug_tracing_subscriber() -> TracingInitStatus {
    let result = tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("warn")),
        )
        .try_init();

    tracing_init_status(result.is_ok())
}

fn database_init_error_message(error: &DomainError, db_path: &std::path::Path) -> String {
    let redacted_error = redact_sensitive_panic_text(&error.to_string());
    let backups_dir = db_path
        .parent()
        .map(|p| p.join("backups"))
        .unwrap_or_default();
    match error {
        DomainError::Migration(_) => format!(
            "Failed to initialize database: {redacted_error}\n\
             Database file: {}\n\
             Backup directory: {}\n\
             The database may already have been restored automatically. Do not delete the database file.\n\
             If the application still does not start, close it and restore the newest backup from the backup directory to the database path.\n\
             Please update the application or contact support with this startup error text.",
            redacted_path_label(db_path),
            redacted_path_label(&backups_dir)
        ),
        _ => format!(
            "Failed to initialize database: {redacted_error}\n\
             Database file: {}\n\
             Check OS permissions and available disk space, then restart the application. \
             If the error persists, contact support with this startup error text.",
            redacted_path_label(db_path)
        ),
    }
}

fn database_init_startup_error_message(error: &DomainError, db_path: &std::path::Path) -> String {
    database_init_error_message(error, db_path)
}

fn startup_app_data_dir_error_message(error: &impl std::fmt::Display) -> String {
    format!(
        "Failed to resolve app data directory during startup filesystem access: {error}. \
         Check OS permissions and restart the application."
    )
}

fn startup_app_data_dir_create_error_message(
    path: &std::path::Path,
    error: &impl std::fmt::Display,
) -> String {
    format!(
        "Failed to create app data directory during startup filesystem access: {error}. \
         Directory: {}. Check OS permissions and available disk space, then restart the application.",
        redacted_path_label(path)
    )
}

fn startup_preferences_or_default(
    result: Result<HashMap<String, String>, DomainError>,
) -> HashMap<String, String> {
    match result {
        Ok(prefs) => prefs,
        Err(error) => {
            tracing::warn!("{}", startup_preferences_read_warning_message(&error));
            HashMap::new()
        }
    }
}

fn startup_preferences_read_warning_message(error: &DomainError) -> String {
    format!(
        "Failed to read startup preferences; using default menu state and diagnostics settings: {error}"
    )
}

fn startup_main_window_show_warning(error: &impl std::fmt::Display) -> String {
    format!("Failed to show main window during startup focus restore: {error}")
}

fn startup_main_window_focus_warning(error: &impl std::fmt::Display) -> String {
    format!("Failed to focus main window during startup focus restore: {error}")
}

fn startup_main_webview_focus_warning(error: &impl std::fmt::Display) -> String {
    format!("Failed to focus main webview during startup focus restore: {error}")
}

fn startup_focus_main_thread_warning(error: &impl std::fmt::Display) -> String {
    format!("Failed to schedule startup focus restore on the main thread: {error}")
}

#[cfg(not(test))]
fn second_launch_main_window_show_warning(error: &impl std::fmt::Display) -> String {
    format!("Failed to show main window after second launch request: {error}")
}

#[cfg(not(test))]
fn second_launch_main_window_focus_warning(error: &impl std::fmt::Display) -> String {
    format!("Failed to focus main window after second launch request: {error}")
}

#[cfg(not(test))]
fn second_launch_main_webview_focus_warning(error: &impl std::fmt::Display) -> String {
    format!("Failed to focus main webview after second launch request: {error}")
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum StartupFocusRestoreDecision {
    Restore,
    SkipAppUnavailable,
    SkipMainWindowMissing,
    SkipMainWebviewMissing,
}

fn startup_focus_restore_decision(
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

fn mark_startup_focus_restore_stopped(active: &Arc<AtomicBool>) {
    active.store(false, Ordering::Release);
}

fn startup_focus_restore_is_active(active: &Arc<AtomicBool>) -> bool {
    active.load(Ordering::Acquire)
}

enum ShutdownDrainAttempt {
    Drained,
    Busy,
    Poisoned(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MainWindowCloseDecision {
    StartShutdownDrain,
    BlockNativeOperationInFlight,
    IgnoreAlreadyDraining,
}

fn main_window_close_decision(
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
enum SecondLaunchDecision {
    FocusExistingWindow,
    FocusAndReportNativeOperationInFlight,
}

#[cfg(test)]
#[allow(dead_code)]
fn second_launch_decision(
    sync_in_flight: bool,
    update_download_in_flight: bool,
) -> SecondLaunchDecision {
    if sync_in_flight || update_download_in_flight {
        SecondLaunchDecision::FocusAndReportNativeOperationInFlight
    } else {
        SecondLaunchDecision::FocusExistingWindow
    }
}

fn try_drain_mutex_lock_for_shutdown<T>(mutex: &Mutex<T>) -> ShutdownDrainAttempt {
    match mutex.try_lock() {
        Ok(_guard) => ShutdownDrainAttempt::Drained,
        Err(TryLockError::WouldBlock) => ShutdownDrainAttempt::Busy,
        Err(TryLockError::Poisoned(error)) => ShutdownDrainAttempt::Poisoned(error.to_string()),
    }
}

async fn drain_mutex_lock_for_shutdown<T>(
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
async fn drain_database_shutdown(state: &AppState, timeout: Duration) -> bool {
    drain_mutex_lock_for_shutdown(&state.db, timeout, "Database").await
}

#[cfg(not(test))]
fn focus_main_webview_on_startup<R: tauri::Runtime>(
    app_handle: tauri::AppHandle<R>,
    active: Arc<AtomicBool>,
) {
    tauri::async_runtime::spawn(async move {
        // On macOS overlay titlebar windows, the native webview can start unfocused
        // even though the app window is visible. Delay one tick so the window is
        // fully realized before restoring focus.
        tokio::time::sleep(Duration::from_millis(150)).await;

        if !startup_focus_restore_is_active(&active) {
            return;
        }

        let app_handle_for_main_thread = app_handle.clone();
        let active_for_main_thread = active.clone();
        if let Err(error) = app_handle.run_on_main_thread(move || {
            let main_window = app_handle_for_main_thread.get_webview_window("main");
            let main_webview = app_handle_for_main_thread.get_webview("main");
            if startup_focus_restore_decision(
                startup_focus_restore_is_active(&active_for_main_thread),
                main_window.is_some(),
                main_webview.is_some(),
            ) != StartupFocusRestoreDecision::Restore
            {
                return;
            }

            let Some(window) = main_window else {
                return;
            };
            let Some(webview) = main_webview else {
                return;
            };

            if let Err(error) = window.show() {
                tracing::warn!("{}", startup_main_window_show_warning(&error));
            }
            if let Err(error) = window.set_focus() {
                tracing::warn!("{}", startup_main_window_focus_warning(&error));
            }
            if let Err(error) = webview.set_focus() {
                tracing::warn!("{}", startup_main_webview_focus_warning(&error));
            }
        }) {
            if startup_focus_restore_is_active(&active) {
                tracing::warn!("{}", startup_focus_main_thread_warning(&error));
            }
        }
    });
}

#[cfg(not(test))]
fn focus_main_webview_on_second_launch<R: tauri::Runtime>(app_handle: &tauri::AppHandle<R>) {
    if let Some(window) = app_handle.get_webview_window("main") {
        if let Err(error) = window.show() {
            tracing::warn!("{}", second_launch_main_window_show_warning(&error));
        }
        if let Err(error) = window.set_focus() {
            tracing::warn!("{}", second_launch_main_window_focus_warning(&error));
        }
    }

    if let Some(webview) = app_handle.get_webview("main") {
        if let Err(error) = webview.set_focus() {
            tracing::warn!("{}", second_launch_main_webview_focus_warning(&error));
        }
    }
}

#[cfg(not(test))]
fn emit_main_window_close_blocked(app_handle: &tauri::AppHandle) {
    if let Err(error) = app_handle.emit(MAIN_WINDOW_CLOSE_BLOCKED_EVENT, ()) {
        tracing::warn!("Failed to emit main window close blocked lifecycle event: {error}");
    }
}

#[cfg(not(test))]
fn main_window_min_size() -> tauri::Size {
    tauri::Size::Logical(tauri::LogicalSize::new(
        MAIN_WINDOW_MIN_WIDTH as f64,
        MAIN_WINDOW_MIN_HEIGHT as f64,
    ))
}

/// Window-state restore saves the physical inner size, so a size captured on a
/// large or high-DPI display can exceed the work area the app reopens on.
/// Returns the corrected inner size, or `None` when the restored size already
/// fits.
///
/// `decoration` is `outer - inner`, so the clamp keeps the *outer* window inside
/// the work area instead of letting decorations push the bottom edge off-screen.
/// `work_area_size` is `None` when the monitor is unknown.
fn clamped_main_window_physical_inner_size(
    restored_inner: (u32, u32),
    decoration: (u32, u32),
    work_area_size: Option<(u32, u32)>,
    min_inner: (u32, u32),
) -> Option<(u32, u32)> {
    let (min_width, min_height) = min_inner;
    // `clamp` panics when min > max, and `.max(min_*)` is what prevents it: a
    // work area smaller than the minimum layout size must not shrink the window
    // below the size the ultra-compact layout needs.
    let (max_width, max_height) = match work_area_size {
        Some((work_width, work_height)) => (
            work_width.saturating_sub(decoration.0).max(min_width),
            work_height.saturating_sub(decoration.1).max(min_height),
        ),
        None => (u32::MAX, u32::MAX),
    };

    let clamped = (
        restored_inner.0.clamp(min_width, max_width),
        restored_inner.1.clamp(min_height, max_height),
    );
    if clamped == restored_inner {
        return None;
    }
    Some(clamped)
}

/// Centers a window of `outer_size` inside the work area.
///
/// The math stays in physical pixels: converting the monitor rect with the
/// monitor scale factor and then applying a logical position, which Tauri
/// converts back with the *window* scale factor, does not round-trip on a
/// mixed-DPI multi-monitor setup and can land the window on the wrong display.
fn centered_main_window_physical_position(
    work_area_position: (i32, i32),
    work_area_size: (u32, u32),
    outer_size: (u32, u32),
) -> (i32, i32) {
    let inset =
        |work: u32, window: u32| i32::try_from(work.saturating_sub(window) / 2).unwrap_or(i32::MAX);
    (
        work_area_position
            .0
            .saturating_add(inset(work_area_size.0, outer_size.0)),
        work_area_position
            .1
            .saturating_add(inset(work_area_size.1, outer_size.1)),
    )
}

/// Applies the size guards for a window whose state was just restored, then
/// re-centers it: `set_size` pins the top-left corner, so a restored size that
/// differs from the configured default would otherwise leave the window visibly
/// off-center.
///
/// The centered position is computed from the size this function is applying
/// rather than read back from the window, because the platform may not have
/// committed the new frame yet: `Window::center` observed here would still use
/// the size the window had before the guard ran.
#[cfg(all(desktop, not(test)))]
fn clamp_main_window_size_after_state_restore<R: tauri::Runtime>(window: &tauri::Window<R>) {
    let Ok(scale_factor) = window.scale_factor() else {
        tracing::warn!("Failed to read main window scale factor while clamping restored size");
        return;
    };
    let Ok(inner) = window.inner_size() else {
        tracing::warn!("Failed to read main window inner size while clamping restored size");
        return;
    };
    let Ok(outer) = window.outer_size() else {
        tracing::warn!("Failed to read main window outer size while clamping restored size");
        return;
    };

    let decoration = (
        outer.width.saturating_sub(inner.width),
        outer.height.saturating_sub(inner.height),
    );
    // The work area excludes the macOS menu bar and the Windows taskbar, so a
    // restored full-height window keeps a draggable title bar on screen.
    let work_area = window
        .current_monitor()
        .ok()
        .flatten()
        .map(|monitor| *monitor.work_area());
    let min_inner = (
        (MAIN_WINDOW_MIN_WIDTH as f64 * scale_factor).round() as u32,
        (MAIN_WINDOW_MIN_HEIGHT as f64 * scale_factor).round() as u32,
    );

    let applied_inner = match clamped_main_window_physical_inner_size(
        (inner.width, inner.height),
        decoration,
        work_area.map(|rect| (rect.size.width, rect.size.height)),
        min_inner,
    ) {
        Some((width, height)) => {
            let clamped_size = tauri::Size::Physical(tauri::PhysicalSize::new(width, height));
            if let Err(error) = window.set_size(clamped_size) {
                tracing::warn!("Failed to clamp restored main window size: {error}");
            }
            (width, height)
        }
        None => (inner.width, inner.height),
    };

    let Some(rect) = work_area else {
        if let Err(error) = window.center() {
            tracing::warn!("Failed to re-center main window after size restore: {error}");
        }
        return;
    };
    let (x, y) = centered_main_window_physical_position(
        (rect.position.x, rect.position.y),
        (rect.size.width, rect.size.height),
        (
            applied_inner.0.saturating_add(decoration.0),
            applied_inner.1.saturating_add(decoration.1),
        ),
    );
    let position = tauri::Position::Physical(tauri::PhysicalPosition::new(x, y));
    if let Err(error) = window.set_position(position) {
        tracing::warn!("Failed to center main window after size restore: {error}");
    }
}

#[cfg(not(test))]
fn enforce_main_window_min_size_after_window_resize<R: tauri::Runtime>(
    window: &tauri::Window<R>,
    size: tauri::PhysicalSize<u32>,
) {
    let Ok(scale_factor) = window.scale_factor() else {
        tracing::warn!("Failed to read main window scale factor while enforcing minimum size");
        return;
    };
    let logical_width = f64::from(size.width) / scale_factor;
    let logical_height = f64::from(size.height) / scale_factor;
    if logical_width >= MAIN_WINDOW_MIN_WIDTH as f64
        && logical_height >= MAIN_WINDOW_MIN_HEIGHT as f64
    {
        return;
    }

    let next_size = tauri::Size::Logical(tauri::LogicalSize::new(
        logical_width.max(MAIN_WINDOW_MIN_WIDTH as f64),
        logical_height.max(MAIN_WINDOW_MIN_HEIGHT as f64),
    ));
    if let Err(error) = window.set_size(next_size) {
        tracing::warn!("Failed to restore main window minimum size after resize: {error}");
    }
}

#[cfg(any(not(debug_assertions), test))]
fn cleanup_old_logs(log_dir: &std::path::Path, max_age_days: u64) {
    use std::time::{Duration, SystemTime};

    let cutoff = match SystemTime::now().checked_sub(Duration::from_secs(max_age_days * 86400)) {
        Some(t) => t,
        None => return,
    };
    let entries = match std::fs::read_dir(log_dir) {
        Ok(e) => e,
        Err(error) => {
            tracing::warn!("{}", cleanup_old_logs_read_dir_warning(log_dir, &error));
            return;
        }
    };
    for entry_result in entries {
        let entry = match entry_result {
            Ok(entry) => entry,
            Err(error) => {
                tracing::debug!("{}", cleanup_old_logs_entry_debug(log_dir, &error));
                continue;
            }
        };
        let path = entry.path();
        if path.file_name().is_some_and(|name| name == "app.log") {
            continue;
        }
        let meta = match entry.metadata() {
            Ok(meta) => meta,
            Err(error) => {
                tracing::debug!("{}", cleanup_old_logs_metadata_debug(&path, &error));
                continue;
            }
        };
        if !meta.is_file() {
            continue;
        }
        let modified = match meta.modified() {
            Ok(modified) => modified,
            Err(error) => {
                tracing::debug!("{}", cleanup_old_logs_modified_debug(&path, &error));
                continue;
            }
        };
        if modified < cutoff {
            if let Err(error) = std::fs::remove_file(&path) {
                tracing::warn!("{}", cleanup_old_logs_remove_warning(&path, &error));
            }
        }
    }
}

#[cfg(any(not(debug_assertions), test))]
fn cleanup_old_logs_read_dir_warning(log_dir: &std::path::Path, error: &std::io::Error) -> String {
    format!(
        "Failed to read log directory {} during cleanup: {error}",
        redacted_path_label(log_dir)
    )
}

#[cfg(any(not(debug_assertions), test))]
fn cleanup_old_logs_entry_debug(log_dir: &std::path::Path, error: &std::io::Error) -> String {
    format!(
        "Failed to inspect log directory entry in {}: {error}",
        redacted_path_label(log_dir)
    )
}

#[cfg(any(not(debug_assertions), test))]
fn cleanup_old_logs_metadata_debug(path: &std::path::Path, error: &std::io::Error) -> String {
    format!(
        "Failed to read log file metadata for {}: {error}",
        redacted_path_label(path)
    )
}

#[cfg(any(not(debug_assertions), test))]
fn cleanup_old_logs_modified_debug(path: &std::path::Path, error: &std::io::Error) -> String {
    format!(
        "Failed to read log file modified time for {}: {error}",
        redacted_path_label(path)
    )
}

#[cfg(any(not(debug_assertions), test))]
fn cleanup_old_logs_remove_warning(path: &std::path::Path, error: &std::io::Error) -> String {
    format!(
        "Failed to remove old log file {}: {error}",
        redacted_path_label(path)
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
#[cfg(not(test))]
pub fn run() {
    #[cfg(debug_assertions)]
    {
        let _ = init_debug_tracing_subscriber();
    }
    install_redacting_panic_hook();

    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        focus_main_webview_on_second_launch(app);
    }));

    // The main window is restored explicitly in `setup` so the size guards and
    // re-centering run before the window is shown, instead of racing the
    // plugin's own on-ready restore.
    #[cfg(desktop)]
    let builder = builder.plugin(
        tauri_plugin_window_state::Builder::default()
            .with_state_flags(MAIN_WINDOW_STATE_FLAGS)
            .skip_initial_state("main")
            .build(),
    );

    #[cfg(debug_assertions)]
    let builder = builder.plugin(
        tauri_plugin_mcp_bridge::Builder::new()
            .bind_address("127.0.0.1")
            .build(),
    );

    #[cfg(not(debug_assertions))]
    let builder = builder.plugin(
        tauri_plugin_log::Builder::new()
            .target(tauri_plugin_log::Target::new(
                tauri_plugin_log::TargetKind::LogDir {
                    file_name: Some("app".into()),
                },
            ))
            .max_file_size(RELEASE_LOG_MAX_FILE_SIZE_BYTES)
            .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
            .level(log::LevelFilter::Info)
            .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
            .build(),
    );

    builder
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let tauri::WindowEvent::Resized(size) = event {
                enforce_main_window_min_size_after_window_resize(window, *size);
            }
        })
        .setup(|app| {
            // Initialize database first so preferences are available for menu construction
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| startup_app_data_dir_error_message(&error))?;
            std::fs::create_dir_all(&app_data_dir).map_err(|error| {
                startup_app_data_dir_create_error_message(&app_data_dir, &error)
            })?;
            let db_path = app_data_dir.join("ultra-rss-reader.db");
            let db = match DbManager::new(&db_path) {
                Ok(db) => db,
                Err(e) => {
                    tracing::error!("Database initialization failed: {e}");
                    return Err(database_init_startup_error_message(&e, &db_path).into());
                }
            };

            // Read initial preferences for menu CheckMenuItem states
            let prefs = {
                let repo = SqlitePreferenceRepository::new(db.reader());
                startup_preferences_or_default(repo.get_all())
            };

            browser_webview::set_browser_webview_diagnostics_enabled(
                prefs
                    .get("debug_browser_hud")
                    .is_some_and(|value| value == "true"),
            );

            let handle = app.handle().clone();
            menu::rebuild(&handle, &prefs)?;
            app.on_menu_event(move |app_handle, event| {
                menu::handle_event(app_handle, event);
            });

            let startup_focus_restore_active = Arc::new(AtomicBool::new(true));
            if let Some(window) = app.get_webview_window("main") {
                window
                    .set_title(" ")
                    .expect("Failed to clear main window title");
                window
                    .set_title_bar_style(main_window_title_bar_style())
                    .expect("Failed to configure main window title bar style");
                window
                    .set_min_size(Some(main_window_min_size()))
                    .expect("Failed to configure main window minimum size");

                #[cfg(desktop)]
                {
                    use tauri_plugin_window_state::WindowExt;

                    if let Err(error) = window
                        .as_ref()
                        .window()
                        .restore_state(MAIN_WINDOW_STATE_FLAGS)
                    {
                        tracing::warn!("Failed to restore main window state: {error}");
                    }
                    // The size guards run from the delayed startup task instead of
                    // here: the restored resize is queued on the event loop, so a
                    // size read back inside `setup` still reports the configured
                    // default.
                }

                let startup_focus_restore_active_for_window = startup_focus_restore_active.clone();
                window.on_window_event(move |event| match event {
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        let Some(state) = handle.try_state::<AppState>() else {
                            return;
                        };
                        let sync_in_flight = state.syncing.load(Ordering::SeqCst);
                        let update_download_in_flight =
                            commands::updater_commands::is_update_download_in_flight();
                        match main_window_close_decision(
                            state.shutdown_draining.load(Ordering::SeqCst),
                            sync_in_flight,
                            update_download_in_flight,
                        ) {
                            MainWindowCloseDecision::StartShutdownDrain => {
                                if state
                                    .shutdown_draining
                                    .compare_exchange(
                                        false,
                                        true,
                                        Ordering::SeqCst,
                                        Ordering::SeqCst,
                                    )
                                    .is_err()
                                {
                                    api.prevent_close();
                                    return;
                                }
                            }
                            MainWindowCloseDecision::BlockNativeOperationInFlight => {
                                api.prevent_close();
                                emit_main_window_close_blocked(&handle);
                                return;
                            }
                            MainWindowCloseDecision::IgnoreAlreadyDraining => {
                                api.prevent_close();
                                return;
                            }
                        }
                        service::sync_scheduler::request_sync_scheduler_shutdown();
                        mark_startup_focus_restore_stopped(
                            &startup_focus_restore_active_for_window,
                        );
                        api.prevent_close();
                        let app_handle = handle.clone();
                        tauri::async_runtime::spawn(async move {
                            let browser_drained =
                                browser_webview::cleanup_browser_webview_for_shutdown(&app_handle);
                            let sync_drained =
                                service::sync_scheduler::drain_sync_scheduler_shutdown(
                                    SHUTDOWN_DRAIN_TIMEOUT,
                                )
                                .await;
                            let db_drained = if let Some(state) = app_handle.try_state::<AppState>()
                            {
                                drain_database_shutdown(state.inner(), SHUTDOWN_DRAIN_TIMEOUT).await
                            } else {
                                false
                            };
                            if !(browser_drained && sync_drained && db_drained) {
                                tracing::warn!(
                                    browser_drained,
                                    sync_drained,
                                    db_drained,
                                    "App shutdown forced before all runtime drains completed"
                                );
                            }
                            // The custom drain path prevents the default close,
                            // so persist the window size here instead of
                            // relying only on the plugin's exit hook.
                            #[cfg(desktop)]
                            {
                                use tauri_plugin_window_state::AppHandleExt;

                                if let Err(error) =
                                    app_handle.save_window_state(MAIN_WINDOW_STATE_FLAGS)
                                {
                                    tracing::warn!("Failed to save main window state: {error}");
                                }
                            }
                            app_handle.exit(0);
                        });
                    }
                    tauri::WindowEvent::Destroyed => {
                        service::sync_scheduler::request_sync_scheduler_shutdown();
                        mark_startup_focus_restore_stopped(
                            &startup_focus_restore_active_for_window,
                        );
                    }
                    _ => {}
                });
            }

            let app_handle_for_startup_size = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(250)).await;
                let Some(window) = app_handle_for_startup_size.get_window("main") else {
                    tracing::warn!("Failed to find main window while enforcing startup size");
                    return;
                };
                #[cfg(desktop)]
                clamp_main_window_size_after_state_restore(&window);
                match window.inner_size() {
                    Ok(size) => enforce_main_window_min_size_after_window_resize(&window, size),
                    Err(error) => {
                        tracing::warn!("Failed to read main window size after startup: {error}");
                    }
                }
            });

            focus_main_webview_on_startup(app.handle().clone(), startup_focus_restore_active);

            app.manage(AppState {
                db: Mutex::new(db),
                syncing: Arc::new(AtomicBool::new(false)),
                shutdown_draining: Arc::new(AtomicBool::new(false)),
                automatic_sync_enabled: Arc::new(AtomicBool::new(false)),
                automatic_sync_notify: Arc::new(tokio::sync::Notify::new()),
                browser_webview: Mutex::new(browser_webview::BrowserWebviewTracker::default()),
            });
            app.manage(PendingUpdate(Arc::new(tokio::sync::Mutex::new(None))));

            // Start background periodic sync
            let state = app.state::<AppState>();
            service::sync_scheduler::start_sync_scheduler(&state.db, app.handle().clone());

            // Clean up old log files (release only)
            #[cfg(not(debug_assertions))]
            {
                if let Ok(log_dir) = app.path().app_log_dir() {
                    cleanup_old_logs(&log_dir, RELEASE_LOG_RETENTION_DAYS);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::account_commands::list_accounts,
            commands::account_commands::add_account,
            commands::account_commands::update_account_sync,
            commands::account_commands::update_account_credentials,
            commands::account_commands::rename_account,
            commands::account_commands::test_account_connection,
            commands::account_commands::delete_account,
            commands::feed_commands::list_folders,
            commands::feed_commands::create_folder,
            commands::feed_commands::list_feeds,
            commands::feed_commands::add_local_feed,
            commands::feed_commands::delete_feed,
            commands::feed_commands::rename_feed,
            commands::feed_commands::update_feed_folder,
            commands::feed_commands::update_feed_display_settings,
            commands::feed_commands::discover_feeds,
            commands::sync_commands::trigger_sync,
            commands::sync_commands::trigger_startup_sync,
            commands::sync_commands::get_account_sync_status,
            commands::sync_commands::trigger_sync_account,
            commands::sync_commands::trigger_sync_feed,
            commands::sync_commands::trigger_automatic_sync,
            commands::article_commands::get_article,
            commands::article_commands::list_articles,
            commands::article_commands::list_account_articles,
            commands::article_commands::list_feed_article_summaries,
            commands::article_commands::list_folder_articles,
            commands::article_commands::list_starred_articles,
            commands::article_commands::list_recent_articles,
            commands::article_commands::count_account_unread_articles,
            commands::article_commands::count_account_starred_articles,
            commands::article_commands::mark_account_read,
            commands::article_commands::mark_account_starred_read,
            commands::article_commands::count_old_unread_articles,
            commands::article_commands::mark_old_unread_read,
            commands::article_commands::unstar_account_articles,
            commands::article_commands::get_feed_integrity_report,
            commands::article_commands::cleanup_feed_integrity_orphans,
            commands::article_commands::mark_article_read,
            commands::article_commands::record_article_view,
            commands::article_commands::clear_article_view_history,
            commands::article_commands::mark_articles_read,
            commands::article_commands::mark_feed_read,
            commands::article_commands::mark_folder_read,
            commands::article_commands::toggle_article_star,
            commands::article_commands::open_in_browser,
            commands::article_commands::check_browser_embed_support,
            commands::browser_webview_commands::create_or_update_browser_webview,
            commands::browser_webview_commands::set_browser_webview_bounds,
            commands::browser_webview_commands::focus_browser_webview,
            commands::browser_webview_commands::go_back_browser_webview,
            commands::browser_webview_commands::go_forward_browser_webview,
            commands::browser_webview_commands::reload_browser_webview,
            commands::browser_webview_commands::close_browser_webview,
            commands::opml_commands::import_opml,
            commands::opml_commands::export_opml_to_file,
            commands::article_commands::search_articles,
            commands::mute_keyword_commands::list_mute_keywords,
            commands::mute_keyword_commands::create_mute_keyword,
            commands::mute_keyword_commands::update_mute_keyword,
            commands::mute_keyword_commands::delete_mute_keyword,
            commands::mute_keyword_commands::set_mute_auto_mark_read,
            commands::local_account_sync_commands::get_local_account_sync_settings,
            commands::local_account_sync_commands::set_local_account_sync_settings,
            commands::local_account_sync_commands::export_local_account_sync_operations,
            commands::local_account_sync_commands::import_local_account_sync_operations,
            commands::preference_commands::get_preferences,
            commands::preference_commands::set_preference,
            commands::settings_profile_commands::export_settings_profile,
            commands::settings_profile_commands::export_settings_profile_to_file,
            commands::settings_profile_commands::import_settings_profile,
            commands::tag_commands::list_tags,
            commands::tag_commands::create_tag,
            commands::tag_commands::rename_tag,
            commands::tag_commands::delete_tag,
            commands::tag_commands::create_tag_and_assign_article,
            commands::tag_commands::tag_article,
            commands::tag_commands::untag_article,
            commands::tag_commands::get_article_tags,
            commands::tag_commands::list_articles_by_tag,
            commands::tag_commands::get_tag_article_counts,
            commands::share_commands::copy_to_clipboard,
            commands::share_commands::add_to_reading_list,
            commands::platform_commands::get_platform_info,
            commands::platform_commands::get_dev_runtime_options,
            commands::platform_commands::get_platform_permission_denied_recovery,
            commands::platform_commands::reset_oversized_dev_credentials_store,
            commands::updater_commands::check_for_update,
            commands::updater_commands::download_update,
            commands::updater_commands::restart_app,
            commands::database_commands::get_database_info,
            commands::database_commands::vacuum_database,
            commands::database_commands::backup_database,
            commands::log_commands::open_log_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use std::collections::HashMap;
    use std::sync::atomic::AtomicBool;
    use std::sync::{Arc, Mutex};
    use std::time::Duration;

    use super::{
        centered_main_window_physical_position, clamped_main_window_physical_inner_size,
        cleanup_old_logs, cleanup_old_logs_entry_debug, cleanup_old_logs_metadata_debug,
        cleanup_old_logs_modified_debug, cleanup_old_logs_read_dir_warning,
        cleanup_old_logs_remove_warning, database_init_error_message,
        database_init_startup_error_message, drain_mutex_lock_for_shutdown,
        main_window_close_decision, main_window_title_bar_uses_overlay,
        mark_startup_focus_restore_stopped, panic_payload_text, redact_sensitive_panic_text,
        redacted_path_label, second_launch_decision, startup_app_data_dir_create_error_message,
        startup_app_data_dir_error_message, startup_focus_main_thread_warning,
        startup_focus_restore_decision, startup_focus_restore_is_active,
        startup_main_webview_focus_warning, startup_main_window_focus_warning,
        startup_main_window_show_warning, startup_preferences_or_default,
        startup_preferences_read_warning_message, tracing_init_status, MainWindowCloseDecision,
        SecondLaunchDecision, StartupFocusRestoreDecision, TracingInitStatus,
        MAIN_WINDOW_MIN_HEIGHT, MAIN_WINDOW_MIN_WIDTH, RELEASE_LOG_MAX_FILE_SIZE_BYTES,
        RELEASE_LOG_RETENTION_DAYS, RELEASE_LOG_ROTATION_STRATEGY, RELEASE_LOG_TIMEZONE_STRATEGY,
    };
    use crate::domain::error::DomainError;

    #[test]
    fn migration_error_message_does_not_suggest_deleting_restored_database() {
        let message = database_init_error_message(
            &DomainError::Migration(
                "Migration to v5 failed: duplicate column. Database restored to v4.".to_string(),
            ),
            Path::new("/tmp/ultra-rss-reader.db"),
        );

        assert!(
            !message.contains("try deleting the database file"),
            "migration recovery message should not suggest deleting the restored database: {message}"
        );
    }

    #[test]
    fn migration_error_message_includes_restore_steps() {
        let message = database_init_error_message(
            &DomainError::Migration(
                "Migration to v5 failed: duplicate column. Database restored to v4.".to_string(),
            ),
            Path::new("/tmp/ultra-rss-reader.db"),
        );

        assert!(
            message.contains("restore the newest backup"),
            "migration recovery message should explain how to restore manually: {message}"
        );
    }

    #[test]
    fn non_migration_error_message_keeps_database_deletion_guidance() {
        let message = database_init_error_message(
            &DomainError::Persistence("database is locked".to_string()),
            Path::new("/tmp/ultra-rss-reader.db"),
        );

        assert!(
            message.contains("Check OS permissions and available disk space"),
            "non-migration init errors should explain filesystem recovery: {message}"
        );
    }

    #[test]
    fn user_facing_startup_paths_are_redacted_to_file_labels() {
        let path = Path::new("/Users/example/Library/Application Support/app/ultra-rss-reader.db");
        let message = database_init_error_message(
            &DomainError::Migration("migration failed".to_string()),
            path,
        );

        assert!(message.contains("[redacted parent]/ultra-rss-reader.db"));
        assert!(message.contains("[redacted parent]/backups"));
        assert!(!message.contains("/Users/example"));
    }

    #[test]
    fn startup_shutdown_contract_database_init_error_is_recoverable_copy() {
        let db_path = Path::new("/Users/example/app/ultra-rss-reader.db");
        let migration = database_init_startup_error_message(
            &DomainError::Migration("duplicate column".to_string()),
            db_path,
        );
        let persistence = database_init_startup_error_message(
            &DomainError::Persistence("permission denied".to_string()),
            db_path,
        );

        assert!(migration.contains("restore the newest backup"));
        assert!(migration.contains("Backup directory"));
        assert!(migration.contains("contact support with this startup error text"));
        assert!(!migration.contains("startup filesystem access"));
        assert!(persistence.contains("Check OS permissions and available disk space"));
        assert!(persistence.contains("permission denied"));
        assert!(persistence.contains("contact support with this startup error text"));
        assert!(!persistence.contains("/Users/example"));
    }

    #[test]
    fn startup_migration_recovery_message_matches_backup_restore_runbook_contract() {
        let db_path = Path::new("/Users/example/app/ultra-rss-reader.db");
        let message = database_init_startup_error_message(
            &DomainError::Migration(
                "duplicate column at /Users/example/app/private.db".to_string(),
            ),
            db_path,
        );
        let incident_runbook = include_str!("../../docs/incident-runbook.md");

        assert!(message.contains("Backup directory"));
        assert!(message.contains("Do not delete the database file"));
        assert!(message.contains("close it and restore the newest backup"));
        assert!(message.contains("[redacted parent]/ultra-rss-reader.db"));
        assert!(message.contains("[redacted parent]/backups"));
        assert!(!message.contains("/Users/example"));
        assert!(incident_runbook.contains("redacted database or backup label"));
        assert!(incident_runbook.contains("backup directory label"));
        assert!(incident_runbook.contains("Do not delete backup files"));
        assert!(incident_runbook.contains("complete backup set with the app closed"));
        assert!(incident_runbook.contains("do not edit `schema_version`"));
    }

    #[test]
    fn db_recovery_startup_messages_keep_restore_copy_redacted() {
        let db_path = Path::new("/Users/example/app/ultra-rss-reader.db");

        for error in [
            DomainError::Migration(
                "Migration to v18 failed: duplicate column. Database restored to v17. Backup: [redacted parent]/ultra-rss-reader_v17_20260511T010203.db."
                    .to_string(),
            ),
            DomainError::Persistence("permission denied".to_string()),
            DomainError::Migration(
                "SQLite integrity_check failed before restore for [redacted parent]/ultra-rss-reader_v17_20260511T010203.db: database disk image is malformed"
                    .to_string(),
            ),
        ] {
            let message = database_init_startup_error_message(&error, db_path);

            assert!(
                message.contains("[redacted parent]/ultra-rss-reader.db"),
                "startup recovery message should show only a redacted database label: {message}"
            );
            assert!(
                !message.contains("/Users/example"),
                "startup recovery message must not expose raw local paths: {message}"
            );
            assert!(
                !message.contains("try deleting the database file"),
                "startup recovery message must not recommend deleting the database: {message}"
            );
        }
    }

    #[test]
    fn incident_runbook_keeps_database_recovery_path_redaction_contract() {
        let incident_runbook = include_str!("../../docs/incident-runbook.md");

        assert!(incident_runbook.contains("redacted database or backup label"));
        assert!(incident_runbook.contains("backup directory label"));
        assert!(!incident_runbook.contains("note the reported database or backup path"));
        assert!(!incident_runbook.contains("find the backup path"));
    }

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
            drain_mutex_lock_for_shutdown(db_lock.as_ref(), Duration::from_secs(1), "Database")
                .await;

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
            drain_mutex_lock_for_shutdown(db_lock.as_ref(), Duration::from_millis(1), "Database")
                .await;

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
    fn cleanup_old_logs_removes_expired_files_and_preserves_current_app_log() {
        let temp_dir = tempfile::tempdir().expect("log tempdir should be created");
        let old_log = temp_dir.path().join("app.log.1");
        let current_log = temp_dir.path().join("app.log");
        std::fs::write(&old_log, "old").expect("old rotated log should be written");
        std::fs::write(&current_log, "current").expect("current app log should be written");

        cleanup_old_logs(temp_dir.path(), 0);

        assert!(!old_log.exists(), "expired rotated log should be removed");
        assert!(
            current_log.exists(),
            "current app.log should never be removed"
        );
    }

    #[test]
    fn release_log_rotation_contract_matches_support_docs() {
        let lib_rs = include_str!("lib.rs");
        let file_logging_design =
            include_str!("../../docs/superpowers/specs/2026-03-30-file-logging-design.md");
        let release_manual = include_str!("../../docs/release-manual-verification.md");

        assert_eq!(RELEASE_LOG_MAX_FILE_SIZE_BYTES, 5_000_000);
        assert_eq!(RELEASE_LOG_RETENTION_DAYS, 7);
        assert_eq!(RELEASE_LOG_ROTATION_STRATEGY, "KeepAll");
        assert_eq!(RELEASE_LOG_TIMEZONE_STRATEGY, "UseLocal");
        assert!(lib_rs.contains(".max_file_size(RELEASE_LOG_MAX_FILE_SIZE_BYTES)"));
        assert!(lib_rs.contains("RotationStrategy::KeepAll"));
        assert!(lib_rs.contains("TimezoneStrategy::UseLocal"));
        assert!(lib_rs.contains("cleanup_old_logs(&log_dir, RELEASE_LOG_RETENTION_DAYS)"));
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
        let remove_error =
            std::io::Error::new(std::io::ErrorKind::PermissionDenied, "remove denied");

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
        let lib_rs = include_str!("lib.rs");
        let cargo_toml = include_str!("../Cargo.toml");

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

    const TEST_DECORATION: (u32, u32) = (0, 28);
    const TEST_MIN_INNER: (u32, u32) =
        (MAIN_WINDOW_MIN_WIDTH as u32, MAIN_WINDOW_MIN_HEIGHT as u32);

    #[test]
    fn restored_main_window_size_within_the_work_area_is_kept() {
        assert_eq!(
            clamped_main_window_physical_inner_size(
                (1100, 800),
                TEST_DECORATION,
                Some((1512, 920)),
                TEST_MIN_INNER
            ),
            None
        );
    }

    #[test]
    fn restored_main_window_size_larger_than_the_work_area_is_shrunk() {
        // Saved on a 2560x1440 external display, reopened on a 1512x920 work area.
        assert_eq!(
            clamped_main_window_physical_inner_size(
                (2400, 1300),
                TEST_DECORATION,
                Some((1512, 920)),
                TEST_MIN_INNER
            ),
            Some((1512, 892))
        );
    }

    #[test]
    fn restored_main_window_size_leaves_room_for_window_decorations() {
        // The outer window, not the inner size, has to fit the work area.
        assert_eq!(
            clamped_main_window_physical_inner_size(
                (1512, 920),
                TEST_DECORATION,
                Some((1512, 920)),
                TEST_MIN_INNER
            ),
            Some((1512, 892))
        );
    }

    #[test]
    fn restored_main_window_size_below_minimum_is_grown() {
        assert_eq!(
            clamped_main_window_physical_inner_size(
                (200, 100),
                TEST_DECORATION,
                Some((1512, 920)),
                TEST_MIN_INNER
            ),
            Some(TEST_MIN_INNER)
        );
    }

    #[test]
    fn restored_main_window_size_keeps_minimum_on_a_work_area_smaller_than_the_minimum() {
        assert_eq!(
            clamped_main_window_physical_inner_size(
                (1400, 900),
                TEST_DECORATION,
                Some((400, 300)),
                TEST_MIN_INNER
            ),
            Some(TEST_MIN_INNER)
        );
    }

    #[test]
    fn restored_main_window_size_only_enforces_the_minimum_when_the_monitor_is_unknown() {
        assert_eq!(
            clamped_main_window_physical_inner_size(
                (1400, 900),
                TEST_DECORATION,
                None,
                TEST_MIN_INNER
            ),
            None
        );
        assert_eq!(
            clamped_main_window_physical_inner_size(
                (300, 900),
                TEST_DECORATION,
                None,
                TEST_MIN_INNER
            ),
            Some((TEST_MIN_INNER.0, 900))
        );
    }

    #[test]
    fn restored_main_window_is_centered_for_the_size_being_applied() {
        // Regression: centering read back from the window used the configured
        // 1400x900 default because the restored frame had not been committed yet,
        // which left the window offset on a 3440x1440 display.
        assert_eq!(
            centered_main_window_physical_position((0, 0), (3440, 1440), (900, 700)),
            (1270, 370)
        );
    }

    #[test]
    fn restored_main_window_centering_keeps_the_title_bar_below_the_menu_bar() {
        // macOS-shaped work area: origin below the menu bar, height reduced.
        // A window as tall as the work area must not be placed at y = 0.
        assert_eq!(
            centered_main_window_physical_position((0, 25), (1512, 920), (1512, 920)),
            (0, 25)
        );
    }

    #[test]
    fn restored_main_window_is_centered_on_the_monitor_it_reopens_on() {
        assert_eq!(
            centered_main_window_physical_position((-1512, -200), (1512, 900), (900, 700)),
            (-1206, -100)
        );
    }

    #[test]
    fn main_window_centering_keeps_the_work_area_origin_when_the_window_is_larger() {
        assert_eq!(
            centered_main_window_physical_position((0, 25), (800, 600), (900, 700)),
            (0, 25)
        );
    }

    #[test]
    fn main_window_restores_only_size_without_monitor_bound_state() {
        let lib_rs = include_str!("lib.rs");
        let tauri_config = include_str!("../tauri.conf.json");
        let dev_tauri_config = include_str!("../tauri.dev.conf.json");
        let cargo_toml = include_str!("../Cargo.toml");
        let release_manual = include_str!("../../docs/release-manual-verification.md");

        for config in [tauri_config, dev_tauri_config] {
            let config_json: serde_json::Value =
                serde_json::from_str(config).expect("tauri config should remain valid json");
            let window_config = config_json
                .get("app")
                .and_then(|app| app.get("windows"))
                .and_then(|windows| windows.as_array())
                .and_then(|windows| windows.first())
                .expect("main window config should be present");

            assert_eq!(
                window_config
                    .get("center")
                    .and_then(serde_json::Value::as_bool),
                Some(true),
                "main window should use Tauri's visible-display center fallback"
            );
            assert_eq!(
                window_config.get("width").and_then(serde_json::Value::as_u64),
                Some(1400),
                "main window should keep a logical default width instead of restoring DPI-bound physical size"
            );
            assert_eq!(
                window_config
                    .get("height")
                    .and_then(serde_json::Value::as_u64),
                Some(900),
                "main window should keep a logical default height instead of restoring DPI-bound physical size"
            );
            assert_eq!(
                window_config
                    .get("minWidth")
                    .and_then(serde_json::Value::as_u64),
                Some(MAIN_WINDOW_MIN_WIDTH),
                "main window should preserve enough logical width for the ultra-compact browser layout"
            );
            assert_eq!(
                window_config
                    .get("minHeight")
                    .and_then(serde_json::Value::as_u64),
                Some(MAIN_WINDOW_MIN_HEIGHT),
                "main window should preserve enough logical height for the embedded browser webview"
            );
            assert!(
                !config.contains("\"x\""),
                "main window config must not restore persisted x coordinates"
            );
            assert!(
                !config.contains("\"y\""),
                "main window config must not restore persisted y coordinates"
            );
            assert!(
                !config.contains("position"),
                "main window config must not restore a fixed position"
            );
            assert!(
                window_config.get("maximized").is_none(),
                "main window config must not restore maximized state across monitor topology changes"
            );
            assert!(
                window_config.get("fullscreen").is_none(),
                "main window config must not restore fullscreen state across disconnected monitors"
            );
        }
        assert!(cargo_toml.contains("tauri-plugin-window-state"));
        // Search only production code: this test's own assertion strings would
        // otherwise satisfy the call-site assertions below.
        let test_module_index = lib_rs
            .find("#[cfg(test)]\nmod tests {")
            .expect("lib.rs should keep its test module boundary");
        let lib_rs = &lib_rs[..test_module_index];
        let state_flags_index = lib_rs
            .find("const MAIN_WINDOW_STATE_FLAGS")
            .expect("main window state flags should be declared in one place");
        let state_flags = &lib_rs[state_flags_index
            ..state_flags_index
                + lib_rs[state_flags_index..]
                    .find(';')
                    .expect("state flags declaration should be terminated")];
        assert!(
            state_flags.contains("StateFlags::SIZE"),
            "main window size should be restored across launches"
        );
        assert!(
            !state_flags.contains("MAXIMIZED"),
            "the restored maximized state is not readable while the size guards run, so restoring it would un-maximize the window; the last non-maximized size is restored instead"
        );
        assert!(
            !state_flags.contains("POSITION"),
            "restoring position could place the window on a disconnected monitor or at negative coordinates"
        );
        assert!(
            !state_flags.contains("FULLSCREEN"),
            "restoring fullscreen could reopen on a display that no longer exists"
        );
        assert!(
            lib_rs.contains(".with_state_flags(MAIN_WINDOW_STATE_FLAGS)"),
            "the flags constant must be the only place that chooses what is restored"
        );
        assert!(
            lib_rs.contains(".restore_state(MAIN_WINDOW_STATE_FLAGS)"),
            "the flags constant must be the only place that chooses what is restored"
        );
        assert!(
            lib_rs.contains(".skip_initial_state(\"main\")"),
            "the plugin's on-ready restore must stay off so the size guards own the restored geometry"
        );
        assert!(
            lib_rs.contains("clamp_main_window_size_after_state_restore(&window)"),
            "restored physical sizes need a DPI-change and monitor-shrink guard to actually run"
        );
        assert!(
            lib_rs.contains("save_window_state(MAIN_WINDOW_STATE_FLAGS)"),
            "the custom shutdown drain path prevents the default close, so window state must be saved explicitly"
        );
        assert!(release_manual.contains("disconnecting any external monitor"));
        assert!(release_manual.contains("Saved negative or off-screen window coordinates"));
        assert!(release_manual.contains("A window size saved on an external high-DPI display"));
    }

    #[test]
    fn release_bundle_identifier_contract_matches_app_data_migration_policy() {
        let tauri_config = include_str!("../tauri.conf.json");
        let release_tauri_config = include_str!("../tauri.release.conf.json");
        let release_manual = include_str!("../../docs/release-manual-verification.md");

        assert!(tauri_config.contains("\"identifier\": \"com.jey3dayo.ultra-rss-reader\""));
        assert!(release_tauri_config.contains("\"identifier\": \"com.jey3dayo.ultra-rss-reader\""));
        assert!(release_manual.contains("Keep the release bundle identifier stable"));
        assert!(release_manual.contains("No automatic app data directory rename"));
        assert!(release_manual.contains("OS keyring credentials may need user re-entry"));
    }

    #[test]
    fn rust_test_cfg_inventory_records_production_only_release_gaps() {
        let release_manual = include_str!("../../docs/release-manual-verification.md");

        assert!(
            release_manual.contains("Rust Test cfg(test) And Production-Only Coverage Inventory")
        );
        assert!(release_manual.contains("Tauri runtime startup"));
        assert!(release_manual.contains("Panic and logging"));
        assert!(release_manual.contains("Native updater install"));
        assert!(release_manual.contains("macOS titlebar/focus"));
        assert!(release_manual.contains("Do not treat a `cargo test` pass as evidence"));
    }

    #[test]
    fn privacy_docs_record_local_database_encryption_decision() {
        let privacy_doc = include_str!("../../docs/feed-content-privacy.md");

        assert!(privacy_doc.contains("do not add app-managed local database encryption at rest"));
        assert!(privacy_doc.contains("Credentials remain outside the database in the OS keyring"));
        assert!(privacy_doc.contains("OS disk encryption such as FileVault or BitLocker"));
        assert!(privacy_doc.contains("backup/export encryption rules"));
    }

    #[test]
    fn support_artifact_retention_contract_covers_reset_and_uninstall_docs() {
        let privacy_doc = include_str!("../../docs/feed-content-privacy.md");
        let release_manual = include_str!("../../docs/release-manual-verification.md");
        let incident_runbook = include_str!("../../docs/incident-runbook.md");

        for doc in [privacy_doc, release_manual, incident_runbook] {
            assert!(doc.contains("support/debug logs"));
            assert!(doc.contains("support dumps"));
        }

        assert!(release_manual.contains("Uninstalling or deleting the app binary"));
        assert!(release_manual.contains("Private data reset guidance covers"));
        assert!(release_manual.contains("Manual log deletion and support dump deletion"));
        assert!(release_manual.contains("reset is incomplete"));
        assert!(incident_runbook.contains("Reset and uninstall are not the same privacy operation"));
        assert!(
            incident_runbook.contains("Before telling a user that private data has been cleared")
        );
    }

    #[test]
    fn support_debug_copy_fingerprint_decision_excludes_stable_identifiers() {
        let privacy_doc = include_str!("../../docs/feed-content-privacy.md");
        let release_manual = include_str!("../../docs/release-manual-verification.md");

        for doc in [privacy_doc, release_manual] {
            assert!(doc.contains("app version"));
            assert!(doc.contains("OS family"));
            assert!(doc.contains("CPU architecture"));
            assert!(doc.contains("locale"));
            assert!(doc.contains("timezone offset"));
            assert!(doc.contains("hostname"));
            assert!(doc.contains("local filesystem paths"));
            assert!(doc.contains("OS username"));
            assert!(doc.contains("stable device identifier"));
        }

        assert!(privacy_doc.contains(
            "do not include a stable app/environment fingerprint in support or debug copy by default"
        ));
        assert!(privacy_doc.contains("user consent and redaction preview flow"));
        assert!(release_manual.contains("does not automatically include"));
        assert!(release_manual.contains("instead of adding a stable fingerprint"));
    }

    #[test]
    fn support_dump_policy_requires_consent_and_redaction_preview() {
        let privacy_doc = include_str!("../../docs/feed-content-privacy.md");

        assert!(privacy_doc.contains("explicit user consent and a redaction preview"));
        assert!(privacy_doc.contains("before the artifact is generated"));
        assert!(privacy_doc.contains("support dump generation must fail closed"));
        assert!(privacy_doc.contains("manually redacted app.log excerpt"));
    }

    #[test]
    fn support_error_correlation_policy_avoids_stable_diagnostics_identifiers() {
        let privacy_doc = include_str!("../../docs/feed-content-privacy.md");

        assert!(privacy_doc.contains("stable support code"));
        assert!(privacy_doc.contains("ephemeral log-correlation values"));
        assert!(privacy_doc.contains("must not be reused across unrelated support tickets"));
        assert!(privacy_doc.contains("must not encode private data"));
    }

    #[test]
    fn incident_runbook_covers_runtime_database_recovery_surface() {
        let incident_runbook = include_str!("../../docs/incident-runbook.md");

        assert!(incident_runbook.contains("runtime database recovery"));
        assert!(incident_runbook.contains("read-only degraded mode"));
        assert!(incident_runbook.contains("integrity check action"));
        assert!(incident_runbook.contains("DB lock failure, permission denied, and disk full"));
    }

    #[test]
    fn main_window_title_bar_overlay_flag_matches_platform_expectation() {
        assert_eq!(
            main_window_title_bar_uses_overlay(),
            cfg!(target_os = "macos")
        );
    }
}
