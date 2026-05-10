use std::collections::HashMap;

use tauri::State;

use crate::browser_webview::set_browser_webview_diagnostics_enabled;
use crate::commands::dto::AppError;
use crate::commands::AppState;
use crate::domain::preference::preference_row_quarantine_reason;
use crate::infra::db::sqlite_preference::SqlitePreferenceRepository;
use crate::repository::preference::PreferenceRepository;

fn validate_preference_input(key: &str, value: &str) -> Result<(), AppError> {
    if let Some(reason) = preference_row_quarantine_reason(key, value) {
        return Err(AppError::UserVisible {
            message: reason.message(key),
        });
    }

    Ok(())
}

fn should_rebuild_menu_after_saved_preference(key: &str) -> bool {
    key == "language"
}

fn saved_preference_apply_after_save_error(key: &str, error: impl std::fmt::Display) -> AppError {
    let message = match key {
        "language" => format!("Saved language, but failed to update the application menu: {error}"),
        "debug_browser_hud" => {
            format!("Saved debug browser HUD preference, but failed to update browser diagnostics: {error}")
        }
        _ => {
            format!("Saved preference {key}, but failed to apply its runtime side effect: {error}")
        }
    };

    AppError::UserVisible { message }
}

fn apply_saved_preference_runtime_side_effect(key: &str, value: &str) {
    if key == "debug_browser_hud" {
        set_browser_webview_diagnostics_enabled(value == "true");
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

#[cfg(test)]
mod tests {
    use super::{
        apply_saved_preference_runtime_side_effect, save_preference_value,
        saved_preference_apply_after_save_error, should_rebuild_menu_after_saved_preference,
        validate_preference_input,
    };
    use crate::browser_webview::{
        browser_webview_diagnostics_enabled, set_browser_webview_diagnostics_enabled,
        BROWSER_WEBVIEW_DIAGNOSTICS_TEST_LOCK,
    };
    use crate::commands::dto::AppError;
    use crate::domain::preference::is_allowed_preference_key;
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

        let preserved_value: String = db
            .reader()
            .query_row(
                "SELECT value FROM preferences WHERE key = 'custom_backend_preference'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(preserved_value, "preserved");
        assert_eq!(repo.get("theme").unwrap().as_deref(), Some("dark"));
    }

    #[test]
    fn save_preference_accepts_duplicate_shortcut_values_as_settings_collision_responsibility() {
        let db = DbManager::new_in_memory().unwrap();
        let repo = SqlitePreferenceRepository::new(db.writer());

        save_preference_value(&repo, "shortcut_next_article", "x").unwrap();
        save_preference_value(&repo, "shortcut_prev_article", "x").unwrap();

        assert_eq!(
            repo.get("shortcut_next_article").unwrap().as_deref(),
            Some("x")
        );
        assert_eq!(
            repo.get("shortcut_prev_article").unwrap().as_deref(),
            Some("x")
        );
    }

    #[test]
    fn allows_known_shortcut_preference_keys() {
        assert!(is_allowed_preference_key("shortcut_next_article"));
        assert!(is_allowed_preference_key("shortcut_open_command_palette"));
    }

    #[test]
    fn rejects_unknown_shortcut_preference_keys() {
        assert!(!is_allowed_preference_key("shortcut_unknown_action"));
        assert!(!is_allowed_preference_key("shortcut_view_in_browser"));
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
    fn apply_after_save_failure_message_is_classified_by_preference_key() {
        let language_error =
            saved_preference_apply_after_save_error("language", "menu unavailable");
        let debug_hud_error =
            saved_preference_apply_after_save_error("debug_browser_hud", "diagnostics unavailable");
        let future_error =
            saved_preference_apply_after_save_error("future_runtime_pref", "runtime unavailable");

        assert!(matches!(
            language_error,
            AppError::UserVisible { ref message }
                if message == "Saved language, but failed to update the application menu: menu unavailable"
        ));
        assert!(matches!(
            debug_hud_error,
            AppError::UserVisible { ref message }
                if message == "Saved debug browser HUD preference, but failed to update browser diagnostics: diagnostics unavailable"
        ));
        assert!(matches!(
            future_error,
            AppError::UserVisible { ref message }
                if message == "Saved preference future_runtime_pref, but failed to apply its runtime side effect: runtime unavailable"
        ));
    }
}

#[tauri::command]
pub fn get_preferences(state: State<'_, AppState>) -> Result<HashMap<String, String>, AppError> {
    let db = crate::commands::lock_db(&state.db)?;
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
    let db = crate::commands::lock_db(&state.db)?;
    let repo = SqlitePreferenceRepository::new(db.writer());
    let prefs = save_preference_value(&repo, &key, &value)?;
    drop(db);

    if let Some(prefs) = prefs {
        crate::menu::rebuild(&app, &prefs)
            .map_err(|error| saved_preference_apply_after_save_error(&key, error))?;
    }

    apply_saved_preference_runtime_side_effect(&key, &value);

    Ok(())
}
