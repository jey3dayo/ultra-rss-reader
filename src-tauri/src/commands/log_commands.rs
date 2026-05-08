use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

use crate::commands::dto::AppError;

#[tauri::command]
pub fn open_log_dir(app: tauri::AppHandle) -> Result<(), AppError> {
    let dir = app
        .path()
        .app_log_dir()
        .map_err(|e| AppError::UserVisible {
            message: format!("Failed to resolve log directory: {e}"),
        })?;

    std::fs::create_dir_all(&dir).map_err(|e| AppError::UserVisible {
        message: format!("Failed to create log directory: {e}"),
    })?;

    app.opener()
        .open_path(dir.to_string_lossy().into_owned(), None::<String>)
        .map_err(|e| AppError::UserVisible {
            message: format!("Failed to open log directory: {e}"),
        })?;

    Ok(())
}
