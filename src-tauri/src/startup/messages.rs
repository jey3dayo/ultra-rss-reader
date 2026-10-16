use std::collections::HashMap;

use super::redaction::{redact_sensitive_panic_text, redacted_path_label};
use crate::domain::error::DomainError;

#[cfg(any(test, debug_assertions))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum TracingInitStatus {
    Installed,
    AlreadyInstalled,
}

#[cfg(any(test, debug_assertions))]
pub(crate) fn tracing_init_status(installed: bool) -> TracingInitStatus {
    match installed {
        true => TracingInitStatus::Installed,
        false => TracingInitStatus::AlreadyInstalled,
    }
}

#[cfg(debug_assertions)]
pub(crate) fn init_debug_tracing_subscriber() -> TracingInitStatus {
    let subscriber = tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("warn")),
        )
        .finish();

    // The log plugin owns the global logger; try_init also installs LogTracer.
    let result = tracing::subscriber::set_global_default(subscriber);

    tracing_init_status(result.is_ok())
}

pub(crate) fn database_init_error_message(
    error: &DomainError,
    db_path: &std::path::Path,
) -> String {
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

pub(crate) fn database_init_startup_error_message(
    error: &DomainError,
    db_path: &std::path::Path,
) -> String {
    database_init_error_message(error, db_path)
}

pub(crate) fn startup_app_data_dir_error_message(error: &impl std::fmt::Display) -> String {
    format!(
        "Failed to resolve app data directory during startup filesystem access: {error}. \
         Check OS permissions and restart the application."
    )
}

pub(crate) fn startup_app_data_dir_create_error_message(
    path: &std::path::Path,
    error: &impl std::fmt::Display,
) -> String {
    format!(
        "Failed to create app data directory during startup filesystem access: {error}. \
         Directory: {}. Check OS permissions and available disk space, then restart the application.",
        redacted_path_label(path)
    )
}

pub(crate) fn startup_preferences_or_default(
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

pub(crate) fn startup_preferences_read_warning_message(error: &DomainError) -> String {
    format!(
        "Failed to read startup preferences; using default menu state and diagnostics settings: {error}"
    )
}

pub(crate) fn startup_main_window_show_warning(error: &impl std::fmt::Display) -> String {
    format!("Failed to show main window during startup focus restore: {error}")
}

pub(crate) fn startup_main_window_focus_warning(error: &impl std::fmt::Display) -> String {
    format!("Failed to focus main window during startup focus restore: {error}")
}

pub(crate) fn startup_main_webview_focus_warning(error: &impl std::fmt::Display) -> String {
    format!("Failed to focus main webview during startup focus restore: {error}")
}

pub(crate) fn startup_focus_main_thread_warning(error: &impl std::fmt::Display) -> String {
    format!("Failed to schedule startup focus restore on the main thread: {error}")
}

#[cfg(not(test))]
pub(crate) fn second_launch_main_window_show_warning(error: &impl std::fmt::Display) -> String {
    format!("Failed to show main window after second launch request: {error}")
}

#[cfg(not(test))]
pub(crate) fn second_launch_main_window_focus_warning(error: &impl std::fmt::Display) -> String {
    format!("Failed to focus main window after second launch request: {error}")
}

#[cfg(not(test))]
pub(crate) fn second_launch_main_webview_focus_warning(error: &impl std::fmt::Display) -> String {
    format!("Failed to focus main webview after second launch request: {error}")
}
