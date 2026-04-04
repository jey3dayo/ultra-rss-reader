use std::collections::HashMap;

use tauri::State;

use crate::commands::dto::AppError;
use crate::commands::AppState;
use crate::infra::db::sqlite_preference::SqlitePreferenceRepository;
use crate::repository::preference::PreferenceRepository;

/// Known preference keys. Reject unknown keys to prevent table pollution.
const ALLOWED_KEYS: &[&str] = &[
    "theme",
    "language",
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
    "show_sidebar_unread",
    "show_sidebar_starred",
    "show_sidebar_tags",
    "image_previews",
    "display_favicons",
    "text_preview",
    "dim_archived",
    "reader_mode_default",
    "web_preview_mode_default",
    "reading_sort",
    "after_reading",
    "scroll_to_top_on_change",
    "sort_subscriptions",
    "sync_on_startup",
    "action_copy_link",
    "action_open_browser",
    "action_share",
    "action_share_menu",
    "inoreader_app_id",
    "inoreader_app_key",
    "selected_account_id",
];

/// Key prefixes that are allowed dynamically (e.g. shortcut_next_article).
const ALLOWED_PREFIXES: &[&str] = &["shortcut_"];

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
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), AppError> {
    let is_allowed = ALLOWED_KEYS.contains(&key.as_str())
        || ALLOWED_PREFIXES
            .iter()
            .any(|prefix| key.starts_with(prefix));
    if !is_allowed {
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

    let prefs = if key == "language" {
        Some(repo.get_all()?)
    } else {
        None
    };
    drop(db);

    if let Some(prefs) = prefs {
        crate::menu::rebuild(&app, &prefs).map_err(|e| AppError::UserVisible {
            message: format!("Saved language, but failed to update the application menu: {e}"),
        })?;
    }

    Ok(())
}
