use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

use crate::commands::dto::AppError;

fn log_dir_error_message(_action: &str, _error: impl std::fmt::Display) -> String {
    "Failed to open log directory. Check OS permissions and try again.".to_string()
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
    use super::log_dir_error_message;

    #[test]
    fn log_dir_errors_are_scoped_to_production_log_directory() {
        let message = log_dir_error_message("open", "permission denied");

        assert_eq!(
            message,
            "Failed to open log directory. Check OS permissions and try again."
        );
        assert!(message.contains("log directory"));
        assert!(!message.contains("permission denied"));
        assert!(!message.contains("debug trace"));
    }
}
