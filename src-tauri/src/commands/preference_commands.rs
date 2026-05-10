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
const PREFERENCE_VALUE_MAX_BYTES: usize = 1024;
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
    !trimmed.is_empty() && trimmed.len() <= 128 && !value.chars().any(char::is_control)
}

fn validate_preference_input(key: &str, value: &str) -> Result<(), AppError> {
    if !is_allowed_preference_key(key) {
        return Err(AppError::UserVisible {
            message: format!("Unknown preference key: {key}"),
        });
    }

    if key == "debug_browser_hud" && !matches!(value, "true" | "false") {
        return Err(AppError::UserVisible {
            message: format!("Invalid boolean preference value for key: {key}"),
        });
    }

    if is_allowed_shortcut_preference_key(key) && !is_valid_shortcut_preference_value(value) {
        return Err(AppError::UserVisible {
            message: format!("Invalid shortcut preference value for key: {key}"),
        });
    }

    if value.len() > PREFERENCE_VALUE_MAX_BYTES {
        return Err(AppError::UserVisible {
            message: format!(
                "Preference value too long (max {PREFERENCE_VALUE_MAX_BYTES} UTF-8 bytes)"
            ),
        });
    }

    Ok(())
}

fn should_rebuild_menu_after_saved_preference(key: &str) -> bool {
    key == "language"
}

fn saved_language_menu_update_error(error: impl std::fmt::Display) -> AppError {
    AppError::UserVisible {
        message: format!("Saved language, but failed to update the application menu: {error}"),
    }
}

fn save_preference_value(
    repo: &impl PreferenceRepository,
    key: &str,
    value: &str,
) -> Result<Option<HashMap<String, String>>, AppError> {
    validate_preference_input(key, value)?;
    repo.set(key, value)?;

    if should_rebuild_menu_after_saved_preference(key) {
        Ok(Some(repo.get_all()?))
    } else {
        Ok(None)
    }
}

fn apply_saved_preference_runtime_side_effect(key: &str, value: &str) {
    if key == "debug_browser_hud" {
        set_browser_webview_diagnostics_enabled(value == "true");
    }
}

#[cfg(test)]
mod tests {
    use super::{
        apply_saved_preference_runtime_side_effect, is_allowed_preference_key,
        save_preference_value, saved_language_menu_update_error,
        should_rebuild_menu_after_saved_preference, validate_preference_input,
    };
    use crate::browser_webview::{
        browser_webview_diagnostics_enabled, set_browser_webview_diagnostics_enabled,
        BROWSER_WEBVIEW_DIAGNOSTICS_TEST_LOCK,
    };
    use crate::commands::dto::AppError;
    use crate::infra::db::connection::DbManager;
    use crate::infra::db::sqlite_preference::SqlitePreferenceRepository;
    use crate::repository::preference::PreferenceRepository;

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
    fn saving_known_preference_retains_existing_backend_passthrough_keys() {
        let db = DbManager::new_in_memory().unwrap();
        let repo = SqlitePreferenceRepository::new(db.writer());
        repo.set("custom_backend_preference", "preserved").unwrap();

        save_preference_value(&repo, "theme", "dark").unwrap();

        assert_eq!(
            repo.get("custom_backend_preference").unwrap().as_deref(),
            Some("preserved")
        );
        assert_eq!(repo.get("theme").unwrap().as_deref(), Some("dark"));
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
        assert!(validate_preference_input("shortcut_next_article", "k\n").is_err());
        assert!(validate_preference_input("shortcut_next_article", "k\0").is_err());
        assert!(validate_preference_input("shortcut_next_article", "\u{1b}").is_err());
    }

    #[test]
    fn rejects_preference_values_over_backend_utf8_byte_limit() {
        assert!(validate_preference_input("debug_web_preview_url", &"a".repeat(1024)).is_ok());
        assert!(validate_preference_input("debug_web_preview_url", &"a".repeat(1025)).is_err());
        assert!(validate_preference_input("debug_web_preview_url", &"あ".repeat(342)).is_err());
    }

    #[test]
    fn validates_debug_browser_hud_as_boolean_string() {
        assert!(validate_preference_input("debug_browser_hud", "true").is_ok());
        assert!(validate_preference_input("debug_browser_hud", "false").is_ok());

        for value in ["sometimes", "TRUE", "0", " true ", ""] {
            let error = validate_preference_input("debug_browser_hud", value)
                .expect_err("debug browser HUD should reject non-boolean strings");

            match error {
                AppError::UserVisible { message } => {
                    assert_eq!(
                        message,
                        "Invalid boolean preference value for key: debug_browser_hud"
                    );
                }
                other => panic!("unexpected error category: {other:?}"),
            }
        }
    }

    #[test]
    fn save_preference_rejects_invalid_debug_browser_hud_without_persisting_or_toggling_diagnostics(
    ) {
        let _guard = BROWSER_WEBVIEW_DIAGNOSTICS_TEST_LOCK.lock().unwrap();
        let db = DbManager::new_in_memory().unwrap();
        let repo = SqlitePreferenceRepository::new(db.writer());
        repo.set("debug_browser_hud", "true").unwrap();
        set_browser_webview_diagnostics_enabled(true);

        let error = save_preference_value(&repo, "debug_browser_hud", "sometimes")
            .expect_err("invalid debug HUD preference should be rejected before write");

        match error {
            AppError::UserVisible { message } => {
                assert_eq!(
                    message,
                    "Invalid boolean preference value for key: debug_browser_hud"
                );
            }
            other => panic!("unexpected error category: {other:?}"),
        }
        assert_eq!(
            repo.get("debug_browser_hud").unwrap().as_deref(),
            Some("true")
        );
        assert!(browser_webview_diagnostics_enabled());

        set_browser_webview_diagnostics_enabled(false);
    }

    #[test]
    fn saved_debug_browser_hud_preference_updates_diagnostics_from_canonical_boolean_strings() {
        let _guard = BROWSER_WEBVIEW_DIAGNOSTICS_TEST_LOCK.lock().unwrap();

        set_browser_webview_diagnostics_enabled(false);
        apply_saved_preference_runtime_side_effect("debug_browser_hud", "true");
        assert!(browser_webview_diagnostics_enabled());

        apply_saved_preference_runtime_side_effect("debug_browser_hud", "false");
        assert!(!browser_webview_diagnostics_enabled());
    }

    #[test]
    fn language_preference_rebuilds_menu_after_the_value_is_saved() {
        assert!(should_rebuild_menu_after_saved_preference("language"));
        assert!(!should_rebuild_menu_after_saved_preference("theme"));
    }

    #[test]
    fn language_menu_update_failure_reports_saved_preference_context() {
        let error = saved_language_menu_update_error("menu unavailable");

        match error {
            AppError::UserVisible { message } => {
                assert_eq!(
                    message,
                    "Saved language, but failed to update the application menu: menu unavailable"
                );
            }
            other => panic!("unexpected error category: {other:?}"),
        }
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
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqlitePreferenceRepository::new(db.writer());
    let prefs = save_preference_value(&repo, &key, &value)?;
    drop(db);

    if let Some(prefs) = prefs {
        crate::menu::rebuild(&app, &prefs).map_err(saved_language_menu_update_error)?;
    }

    apply_saved_preference_runtime_side_effect(&key, &value);

    Ok(())
}
