use super::redaction::redacted_path_label;
use crate::RELEASE_LOG_RETENTION_DAYS;

pub(crate) fn cleanup_old_logs(log_dir: &std::path::Path, max_age_days: u64) {
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

pub(crate) fn cleanup_startup_logs(log_dir: &std::path::Path) {
    cleanup_old_logs(log_dir, RELEASE_LOG_RETENTION_DAYS);
}

pub(crate) fn cleanup_old_logs_read_dir_warning(
    log_dir: &std::path::Path,
    error: &std::io::Error,
) -> String {
    format!(
        "Failed to read log directory {} during cleanup: {error}",
        redacted_path_label(log_dir)
    )
}

pub(crate) fn cleanup_old_logs_entry_debug(
    log_dir: &std::path::Path,
    error: &std::io::Error,
) -> String {
    format!(
        "Failed to inspect log directory entry in {}: {error}",
        redacted_path_label(log_dir)
    )
}

pub(crate) fn cleanup_old_logs_metadata_debug(
    path: &std::path::Path,
    error: &std::io::Error,
) -> String {
    format!(
        "Failed to read log file metadata for {}: {error}",
        redacted_path_label(path)
    )
}

pub(crate) fn cleanup_old_logs_modified_debug(
    path: &std::path::Path,
    error: &std::io::Error,
) -> String {
    format!(
        "Failed to read log file modified time for {}: {error}",
        redacted_path_label(path)
    )
}

pub(crate) fn cleanup_old_logs_remove_warning(
    path: &std::path::Path,
    error: &std::io::Error,
) -> String {
    format!(
        "Failed to remove old log file {}: {error}",
        redacted_path_label(path)
    )
}
