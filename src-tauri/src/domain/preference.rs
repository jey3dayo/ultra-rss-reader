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
pub const PREFERENCE_VALUE_MAX_BYTES: usize = 1024;
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PreferenceRowQuarantineReason {
    UnknownKey,
    InvalidBooleanValue,
    InvalidShortcutValue,
    ValueTooLong,
}

impl PreferenceRowQuarantineReason {
    pub fn message(&self, key: &str) -> String {
        match self {
            Self::UnknownKey => format!("Unknown preference key: {key}"),
            Self::InvalidBooleanValue => format!("Invalid boolean preference value for key: {key}"),
            Self::InvalidShortcutValue => {
                format!("Invalid shortcut preference value for key: {key}")
            }
            Self::ValueTooLong => {
                format!("Preference value too long (max {PREFERENCE_VALUE_MAX_BYTES} UTF-8 bytes)")
            }
        }
    }
}

pub fn is_allowed_preference_key(key: &str) -> bool {
    ALLOWED_KEYS.contains(&key) || is_allowed_shortcut_preference_key(key)
}

pub fn is_allowed_shortcut_preference_key(key: &str) -> bool {
    key.strip_prefix(SHORTCUT_KEY_PREFIX)
        .is_some_and(|shortcut_id| ALLOWED_SHORTCUT_IDS.contains(&shortcut_id))
}

pub fn is_valid_shortcut_preference_value(value: &str) -> bool {
    let trimmed = value.trim();
    !trimmed.is_empty() && trimmed.len() <= 128 && !value.chars().any(char::is_control)
}

pub fn preference_row_quarantine_reason(
    key: &str,
    value: &str,
) -> Option<PreferenceRowQuarantineReason> {
    if !is_allowed_preference_key(key) {
        return Some(PreferenceRowQuarantineReason::UnknownKey);
    }

    if key == "debug_browser_hud" && !matches!(value, "true" | "false") {
        return Some(PreferenceRowQuarantineReason::InvalidBooleanValue);
    }

    if is_allowed_shortcut_preference_key(key) && !is_valid_shortcut_preference_value(value) {
        return Some(PreferenceRowQuarantineReason::InvalidShortcutValue);
    }

    if value.len() > PREFERENCE_VALUE_MAX_BYTES {
        return Some(PreferenceRowQuarantineReason::ValueTooLong);
    }

    None
}

#[cfg(test)]
mod tests {
    use super::{
        is_allowed_preference_key, preference_row_quarantine_reason, PreferenceRowQuarantineReason,
    };

    #[test]
    fn allows_known_preferences_and_shortcuts() {
        assert!(is_allowed_preference_key("web_preview_keep_focus"));
        assert!(is_allowed_preference_key("window_always_on_top"));
        assert!(is_allowed_preference_key("shortcut_next_article"));
        assert!(is_allowed_preference_key("shortcut_open_command_palette"));
    }

    #[test]
    fn rejects_unknown_preferences_and_shortcuts() {
        assert!(!is_allowed_preference_key("unknown_web_preview_key"));
        assert!(!is_allowed_preference_key("shortcut_unknown_action"));
        assert!(!is_allowed_preference_key("shortcut_"));
    }

    #[test]
    fn quarantines_corrupted_preference_rows_by_reason() {
        assert_eq!(
            preference_row_quarantine_reason("unknown", "value"),
            Some(PreferenceRowQuarantineReason::UnknownKey)
        );
        assert_eq!(
            preference_row_quarantine_reason("debug_browser_hud", "TRUE"),
            Some(PreferenceRowQuarantineReason::InvalidBooleanValue)
        );
        assert_eq!(
            preference_row_quarantine_reason("shortcut_next_article", "k\n"),
            Some(PreferenceRowQuarantineReason::InvalidShortcutValue)
        );
        assert_eq!(
            preference_row_quarantine_reason("theme", &"a".repeat(1025)),
            Some(PreferenceRowQuarantineReason::ValueTooLong)
        );
        assert_eq!(preference_row_quarantine_reason("theme", "dark"), None);
    }
}
