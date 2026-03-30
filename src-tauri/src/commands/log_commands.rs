use tauri::Manager;

use crate::commands::dto::AppError;

#[tauri::command]
pub fn get_log_dir(app: tauri::AppHandle) -> Result<String, AppError> {
    let dir = app
        .path()
        .app_log_dir()
        .map_err(|e| AppError::UserVisible {
            message: format!("Failed to resolve log directory: {e}"),
        })?;
    Ok(dir.to_string_lossy().into_owned())
}
