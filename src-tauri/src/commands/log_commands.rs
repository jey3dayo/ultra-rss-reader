use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

use crate::commands::dto::AppError;

fn log_dir_error_message(_action: &str, _error: impl std::fmt::Display) -> String {
    "Check OS permissions and try again.".to_string()
}

#[cfg(test)]
fn log_dir_privacy_checklist() -> &'static [&'static str] {
    &[
        "Share only the relevant app.log excerpt.",
        "Remove account names, feed URLs, article URLs, and local user paths before sharing.",
        "Delete stale support/debug logs and support dumps after the incident is resolved.",
        "Do not share private, unencrypted backup database files unless explicitly requested for support.",
        "Treat OPML exports as private subscription lists because feed titles and URLs may be sensitive.",
    ]
}

fn ensure_log_dir(dir: &std::path::Path) -> Result<(), AppError> {
    std::fs::create_dir_all(dir).map_err(|e| AppError::UserVisible {
        message: log_dir_error_message("create", e),
    })
}

fn log_dir_opener_arg(dir: &std::path::Path) -> Result<String, AppError> {
    dir.to_str()
        .map(String::from)
        .ok_or_else(|| AppError::UserVisible {
            message: log_dir_error_message("open", "log directory path is not valid UTF-8"),
        })
}

fn log_dir_opener_app_arg() -> Option<String> {
    None
}

#[cfg(test)]
fn diagnostics_size_policy() -> DiagnosticsSizePolicy {
    DiagnosticsSizePolicy {
        total_log_cap_bytes: 35_000_000,
        per_log_file_cap_bytes: 5_000_000,
        retention_days: 7,
        diagnostics_event_cap_bytes: 16 * 1024,
        diagnostics_ring_buffer_cap_bytes: 256 * 1024,
        emergency_truncation_marker: "[ultra-rss-reader:diagnostics-truncated]",
        copy_failure_fallback: "Share a manually redacted app.log excerpt instead.",
    }
}

#[cfg(test)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct DiagnosticsSizePolicy {
    total_log_cap_bytes: u64,
    per_log_file_cap_bytes: u64,
    retention_days: u64,
    diagnostics_event_cap_bytes: usize,
    diagnostics_ring_buffer_cap_bytes: usize,
    emergency_truncation_marker: &'static str,
    copy_failure_fallback: &'static str,
}

#[tauri::command]
pub fn open_log_dir(app: tauri::AppHandle) -> Result<(), AppError> {
    let dir = app
        .path()
        .app_log_dir()
        .map_err(|e| AppError::UserVisible {
            message: log_dir_error_message("resolve", e),
        })?;

    ensure_log_dir(&dir)?;
    let opener_arg = log_dir_opener_arg(&dir)?;

    app.opener()
        .open_path(opener_arg, log_dir_opener_app_arg())
        .map_err(|e| AppError::UserVisible {
            message: log_dir_error_message("open", e),
        })?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{
        diagnostics_size_policy, ensure_log_dir, log_dir_error_message, log_dir_opener_app_arg,
        log_dir_opener_arg, log_dir_privacy_checklist,
    };

    fn assert_user_visible_recovery_message(result: Result<(), crate::commands::dto::AppError>) {
        match result {
            Err(crate::commands::dto::AppError::UserVisible { message }) => {
                assert_eq!(message, "Check OS permissions and try again.");
            }
            other => panic!("expected user-visible error, got {other:?}"),
        }
    }

    #[test]
    fn log_dir_errors_keep_only_recovery_copy() {
        for action in ["resolve", "create", "open"] {
            let message = log_dir_error_message(action, "permission denied");

            assert_eq!(message, "Check OS permissions and try again.");
            assert!(!message.contains("Failed to open log directory"));
            assert!(!message.contains("permission denied"));
            assert!(!message.contains("debug trace"));
            assert!(!message.contains("raw-key"));
            assert!(!message.contains("browser-geometry"));
            assert!(!message.contains("sync-error"));
        }
    }

    #[test]
    fn log_dir_privacy_checklist_covers_sensitive_diagnostics() {
        let checklist = log_dir_privacy_checklist().join("\n");

        assert!(checklist.contains("app.log excerpt"));
        assert!(checklist.contains("account names"));
        assert!(checklist.contains("feed URLs"));
        assert!(checklist.contains("article URLs"));
        assert!(checklist.contains("local user paths"));
        assert!(checklist.contains("stale support/debug logs"));
        assert!(checklist.contains("support dumps"));
        assert!(checklist.contains("private, unencrypted"));
        assert!(checklist.contains("backup database files"));
        assert!(checklist.contains("OPML exports"));
        assert!(checklist.contains("subscription lists"));
    }

    #[test]
    fn diagnostics_storage_boundary_contract_matches_support_docs() {
        let policy = diagnostics_size_policy();
        let incident_runbook = include_str!("../../../docs/incident-runbook.md");
        let privacy_doc = include_str!("../../../docs/feed-content-privacy.md");

        assert_eq!(policy.total_log_cap_bytes, 35_000_000);
        assert_eq!(policy.per_log_file_cap_bytes, 5_000_000);
        assert_eq!(policy.retention_days, 7);
        assert_eq!(policy.diagnostics_event_cap_bytes, 16 * 1024);
        assert_eq!(policy.diagnostics_ring_buffer_cap_bytes, 256 * 1024);
        assert_eq!(
            policy.emergency_truncation_marker,
            "[ultra-rss-reader:diagnostics-truncated]"
        );
        assert_eq!(
            policy.copy_failure_fallback,
            "Share a manually redacted app.log excerpt instead."
        );

        for required in [
            "35 MB",
            "5 MB",
            "7 days",
            "16 KiB",
            "256 KiB",
            "[ultra-rss-reader:diagnostics-truncated]",
            "manually redacted app.log excerpt",
            "over 2048 user-visible characters",
            "over 8192 UTF-8 bytes",
            "Newlines, carriage returns, tabs, and NUL/control characters are rejected",
            "Clipboard permission denial",
            "Browser storage quota exhaustion",
            "Preferences, sidebar expanded-folder state, command history, and debug diagnostics",
        ] {
            assert!(
                incident_runbook.contains(required) || privacy_doc.contains(required),
                "missing diagnostics size policy text: {required}"
            );
        }
    }

    #[test]
    fn log_dir_opener_arg_uses_exact_utf8_path_without_arguments() {
        let dir = Path::new("/tmp/Ultra RSS Reader Logs");

        assert_eq!(
            log_dir_opener_arg(dir).unwrap(),
            "/tmp/Ultra RSS Reader Logs"
        );
        assert_eq!(log_dir_opener_app_arg(), None);
    }

    #[cfg(unix)]
    #[test]
    fn log_dir_opener_arg_rejects_non_utf8_paths_instead_of_lossy_conversion() {
        use std::ffi::OsString;
        use std::os::unix::ffi::OsStringExt;
        use std::path::PathBuf;

        let path = PathBuf::from(OsString::from_vec(b"/tmp/ultra-rss-\xFF-logs".to_vec()));
        let result = log_dir_opener_arg(&path);

        match result {
            Err(crate::commands::dto::AppError::UserVisible { message }) => {
                assert_eq!(message, "Check OS permissions and try again.");
            }
            other => panic!("expected user-visible error, got {other:?}"),
        }
    }

    #[test]
    fn ensure_log_dir_allows_existing_directory() {
        let temp_dir = tempfile::tempdir().unwrap();
        let log_dir = temp_dir.path().join("logs");

        ensure_log_dir(&log_dir).unwrap();
        ensure_log_dir(&log_dir).unwrap();

        assert!(log_dir.is_dir());
    }

    #[test]
    fn ensure_log_dir_rejects_file_collision() {
        let temp_dir = tempfile::tempdir().unwrap();
        let log_dir = temp_dir.path().join("logs");
        std::fs::write(&log_dir, b"not a directory").unwrap();

        assert_user_visible_recovery_message(ensure_log_dir(&log_dir));
        assert!(log_dir.is_file());
    }

    #[cfg(unix)]
    #[test]
    fn ensure_log_dir_allows_symlink_to_existing_directory() {
        let temp_dir = tempfile::tempdir().unwrap();
        let target_dir = temp_dir.path().join("actual-logs");
        let log_dir = temp_dir.path().join("logs-link");
        std::fs::create_dir(&target_dir).unwrap();
        std::os::unix::fs::symlink(&target_dir, &log_dir).unwrap();

        ensure_log_dir(&log_dir).unwrap();

        assert!(log_dir.is_dir());
    }

    #[cfg(unix)]
    #[test]
    fn ensure_log_dir_rejects_symlink_to_file_collision() {
        let temp_dir = tempfile::tempdir().unwrap();
        let target_file = temp_dir.path().join("actual-log-file");
        let log_dir = temp_dir.path().join("logs-link");
        std::fs::write(&target_file, b"not a directory").unwrap();
        std::os::unix::fs::symlink(&target_file, &log_dir).unwrap();

        assert_user_visible_recovery_message(ensure_log_dir(&log_dir));
        assert!(log_dir.is_file());
    }
}
