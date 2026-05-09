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

#[tauri::command]
pub fn open_log_dir(app: tauri::AppHandle) -> Result<(), AppError> {
    let dir = app
        .path()
        .app_log_dir()
        .map_err(|e| AppError::UserVisible {
            message: log_dir_error_message("resolve", e),
        })?;

    std::fs::create_dir_all(&dir).map_err(|e| AppError::UserVisible {
        message: log_dir_error_message("create", e),
    })?;

    app.opener()
        .open_path(dir.to_string_lossy().into_owned(), None::<String>)
        .map_err(|e| AppError::UserVisible {
            message: log_dir_error_message("open", e),
        })?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{log_dir_error_message, log_dir_privacy_checklist};

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
}
