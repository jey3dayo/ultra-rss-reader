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
        "Do not share backup database files unless explicitly requested for support.",
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
        ensure_log_dir, log_dir_error_message, log_dir_opener_app_arg, log_dir_opener_arg,
        log_dir_privacy_checklist,
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
        assert!(checklist.contains("backup database files"));
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
