use std::collections::HashMap;

use tauri::State;

use crate::commands::dto::AppError;
use crate::commands::AppState;
use crate::infra::db::sqlite_preference::SqlitePreferenceRepository;
use crate::repository::preference::PreferenceRepository;

#[tauri::command]
pub fn get_preferences(state: State<'_, AppState>) -> Result<HashMap<String, String>, AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqlitePreferenceRepository::new(db.reader());
    let prefs = repo.get_all()?;
    Ok(prefs)
}

#[tauri::command]
pub fn set_preference(
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqlitePreferenceRepository::new(db.writer());
    repo.set(&key, &value)?;
    Ok(())
}
