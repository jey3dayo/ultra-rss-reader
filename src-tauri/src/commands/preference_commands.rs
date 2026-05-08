use std::collections::HashMap;

use tauri::State;

use crate::browser_webview::set_browser_webview_diagnostics_enabled;
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
    "sidebar_density",
    "layout",
    "opaque_sidebars",
    "grayscale_favicons",
    "font_style",
    "font_size",
    "show_starred_count",
    "show_unread_count",
    "show_sidebar_unread",
    "show_sidebar_starred",
    "show_sidebar_recent_articles",
    "show_sidebar_tags",
    "startup_folder_expansion",
    "image_previews",
    "display_favicons",
    "text_preview",
    "dim_archived",
    "reader_mode_default",
    "web_preview_mode_default",
    "web_preview_keep_focus",
    "window_always_on_top",
    "reading_sort",
    "after_reading",
    "scroll_to_top_on_change",
    "open_first_article_on_feed_selection",
    "sort_subscriptions",
    "sync_on_startup",
    "action_copy_link",
    "action_open_browser",
    "mute_auto_mark_read",
    "recent_articles_history_enabled",
    "debug_browser_hud",
    "debug_web_preview_url",
    "selected_account_id",
];

const SHORTCUT_KEY_PREFIX: &str = "shortcut_";
const ALLOWED_SHORTCUT_IDS: &[&str] = &[
    "next_article",
    "prev_article",
    "next_feed",
    "prev_feed",
    "reload_webview",
    "focus_sidebar",
    "toggle_sidebar",
    "toggle_read",
    "toggle_star",
    "open_in_app_browser",
    "open_external_browser",
    "mark_all_read",
    "show_unread",
    "show_all",
    "show_starred",
    "cycle_filter",
    "search",
    "open_command_palette",
    "close_or_clear",
    "open_settings",
];

fn is_allowed_preference_key(key: &str) -> bool {
    ALLOWED_KEYS.contains(&key) || is_allowed_shortcut_preference_key(key)
}

fn is_allowed_shortcut_preference_key(key: &str) -> bool {
    key.strip_prefix(SHORTCUT_KEY_PREFIX)
        .is_some_and(|shortcut_id| ALLOWED_SHORTCUT_IDS.contains(&shortcut_id))
}

fn is_valid_shortcut_preference_value(value: &str) -> bool {
    let trimmed = value.trim();
    !trimmed.is_empty() && trimmed.len() <= 128
}

fn validate_preference_input(key: &str, value: &str) -> Result<(), AppError> {
    if !is_allowed_preference_key(key) {
        return Err(AppError::UserVisible {
            message: format!("Unknown preference key: {key}"),
        });
    }

    if is_allowed_shortcut_preference_key(key) && !is_valid_shortcut_preference_value(value) {
        return Err(AppError::UserVisible {
            message: format!("Invalid shortcut preference value for key: {key}"),
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{is_allowed_preference_key, validate_preference_input};

    #[test]
    fn allows_web_preview_focus_preference() {
        assert!(is_allowed_preference_key("web_preview_keep_focus"));
    }

    #[test]
    fn allows_window_always_on_top_preference() {
        assert!(is_allowed_preference_key("window_always_on_top"));
    }

    #[test]
    fn rejects_unknown_preference_keys() {
        assert!(!is_allowed_preference_key("unknown_web_preview_key"));
    }

    #[test]
    fn allows_known_shortcut_preference_keys() {
        assert!(is_allowed_preference_key("shortcut_next_article"));
        assert!(is_allowed_preference_key("shortcut_open_command_palette"));
    }

    #[test]
    fn rejects_unknown_shortcut_preference_keys() {
        assert!(!is_allowed_preference_key("shortcut_unknown_action"));
        assert!(!is_allowed_preference_key("shortcut_"));
    }

    #[test]
    fn validates_shortcut_preference_values() {
        assert!(validate_preference_input("shortcut_next_article", "j").is_ok());
        assert!(validate_preference_input("shortcut_next_article", "Shift+J").is_ok());
        assert!(validate_preference_input("shortcut_open_command_palette", "⌘+k").is_ok());
        assert!(validate_preference_input("shortcut_next_article", "").is_err());
        assert!(validate_preference_input("shortcut_next_article", "   ").is_err());
    }
}

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
    validate_preference_input(&key, &value)?;
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

    if key == "debug_browser_hud" {
        set_browser_webview_diagnostics_enabled(value == "true");
    }

    Ok(())
}
