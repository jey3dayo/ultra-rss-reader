use std::collections::HashMap;

use tauri::State;

use crate::commands::dto::AppError;
use crate::commands::AppState;
use crate::infra::db::sqlite_preference::SqlitePreferenceRepository;
use crate::repository::preference::PreferenceRepository;

/// Known preference keys. Reject unknown keys to prevent table pollution.
const ALLOWED_KEYS: &[&str] = &[
    "theme",
    "unread_badge",
    "open_links",
    "open_links_background",
    "sort_unread",
    "group_by",
    "cmd_click_browser",
    "ask_before_mark_all",
    "list_selection_style",
    "layout",
    "opaque_sidebars",
    "grayscale_favicons",
    "font_style",
    "font_size",
    "show_starred_count",
    "show_unread_count",
    "show_all_count",
    "image_previews",
    "display_favicons",
    "text_preview",
    "dim_archived",
    "reader_view",
    "reading_sort",
    "after_reading",
    "scroll_to_top_on_change",
    "action_copy_link",
    "action_open_browser",
    "action_share",
];

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
    if !ALLOWED_KEYS.contains(&key.as_str()) {
        return Err(AppError::UserVisible {
            message: format!("Unknown preference key: {key}"),
        });
    }
    if value.len() > 1024 {
        return Err(AppError::UserVisible {
            message: "Preference value too long (max 1024 chars)".to_string(),
        });
    }
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqlitePreferenceRepository::new(db.writer());
    repo.set(&key, &value)?;
    Ok(())
}
