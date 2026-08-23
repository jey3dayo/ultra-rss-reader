use std::collections::HashMap;

use crate::menu_i18n::{labels, ResolvedMenuLanguage};

use super::{
    is_check_for_updates_menu_available, is_group_by_feed_checked, is_reading_list_menu_available,
    is_sort_unread_checked, is_toggle_check_menu_item, item_menu_label, item_menu_shortcut_hint,
    menu_action_emit_failure_diagnostic, native_menu_accelerator, redact_menu_id_for_diagnostics,
    resolve_menu_action, should_emit_unknown_menu_id_diagnostic_once,
    should_rollback_check_toggle_after_emit, unknown_menu_id_diagnostic, unknown_menu_id_once_set,
    MENU_ACTION_EVENT,
};

#[test]
fn resolves_menu_actions_for_known_ids() {
    assert_eq!(
        resolve_menu_action("view-unread"),
        Some("set-filter-unread")
    );
    assert_eq!(resolve_menu_action("view-all"), Some("set-filter-all"));
    assert_eq!(
        resolve_menu_action("view-starred"),
        Some("set-filter-starred")
    );
    assert_eq!(
        resolve_menu_action("view-sort-unread"),
        Some("toggle-sort-unread")
    );
    assert_eq!(
        resolve_menu_action("view-group-by-feed"),
        Some("toggle-group-by-feed")
    );
    assert_eq!(
        resolve_menu_action("accounts-add"),
        Some("open-settings-accounts-add")
    );
    assert_eq!(
        resolve_menu_action("check-for-updates"),
        Some("check-for-updates")
    );
}

#[test]
fn menu_action_event_payloads_match_frontend_action_ids() {
    let contracts = [
        ("settings", "open-settings"),
        ("check-for-updates", "check-for-updates"),
        ("view-unread", "set-filter-unread"),
        ("view-all", "set-filter-all"),
        ("view-starred", "set-filter-starred"),
        ("view-sort-unread", "toggle-sort-unread"),
        ("view-group-by-feed", "toggle-group-by-feed"),
        ("view-fullscreen", "toggle-fullscreen"),
        ("accounts-sync", "sync-all"),
        ("accounts-show", "open-settings-accounts"),
        ("accounts-add", "open-settings-accounts-add"),
        ("subs-add", "open-add-feed"),
        ("subs-prev", "prev-feed"),
        ("subs-next", "next-feed"),
        ("item-prev", "prev-article"),
        ("item-next", "next-article"),
        ("item-reader", "open-in-reader"),
        ("item-browser", "open-in-browser"),
        ("item-toggle-star", "toggle-star"),
        ("item-toggle-read", "toggle-read"),
        ("item-mark-all-read", "mark-all-read"),
        ("share-copy-link", "copy-link"),
        ("share-open-browser", "open-in-default-browser"),
        ("share-reading-list", "add-to-reading-list"),
    ];

    assert_eq!(MENU_ACTION_EVENT, "menu-action");
    for (menu_id, action_id) in contracts {
        assert_eq!(resolve_menu_action(menu_id), Some(action_id), "{menu_id}");
    }
}

#[test]
fn action_menu_labels_exist_for_supported_locales() {
    let en = labels(ResolvedMenuLanguage::En);
    let ja = labels(ResolvedMenuLanguage::Ja);
    let contracts = [
        ("settings", "open-settings", en.settings, ja.settings),
        (
            "check-for-updates",
            "check-for-updates",
            en.check_for_updates,
            ja.check_for_updates,
        ),
        ("view-unread", "set-filter-unread", en.unread, ja.unread),
        ("view-all", "set-filter-all", en.all, ja.all),
        ("view-starred", "set-filter-starred", en.starred, ja.starred),
        (
            "view-sort-unread",
            "toggle-sort-unread",
            en.sort_unread_to_top,
            ja.sort_unread_to_top,
        ),
        (
            "view-group-by-feed",
            "toggle-group-by-feed",
            en.group_by_feed,
            ja.group_by_feed,
        ),
        (
            "view-fullscreen",
            "toggle-fullscreen",
            en.full_screen,
            ja.full_screen,
        ),
        ("accounts-sync", "sync-all", en.sync_all, ja.sync_all),
        (
            "accounts-show",
            "open-settings-accounts",
            en.show_accounts,
            ja.show_accounts,
        ),
        (
            "accounts-add",
            "open-settings-accounts-add",
            en.add_account,
            ja.add_account,
        ),
        (
            "subs-add",
            "open-add-feed",
            en.add_subscription,
            ja.add_subscription,
        ),
        ("subs-prev", "prev-feed", en.previous_feed, ja.previous_feed),
        ("subs-next", "next-feed", en.next_feed, ja.next_feed),
        (
            "item-prev",
            "prev-article",
            en.previous_item,
            ja.previous_item,
        ),
        ("item-next", "next-article", en.next_item, ja.next_item),
        (
            "item-reader",
            "open-in-reader",
            en.open_web_preview,
            ja.open_web_preview,
        ),
        (
            "item-browser",
            "open-in-browser",
            en.open_external_browser,
            ja.open_external_browser,
        ),
        (
            "item-toggle-star",
            "toggle-star",
            en.toggle_star,
            ja.toggle_star,
        ),
        (
            "item-toggle-read",
            "toggle-read",
            en.mark_as_read_unread,
            ja.mark_as_read_unread,
        ),
        (
            "item-mark-all-read",
            "mark-all-read",
            en.mark_all_as_read,
            ja.mark_all_as_read,
        ),
        ("share-copy-link", "copy-link", en.copy_link, ja.copy_link),
        (
            "share-open-browser",
            "open-in-default-browser",
            en.open_external_browser,
            ja.open_external_browser,
        ),
        (
            "share-reading-list",
            "add-to-reading-list",
            en.add_to_reading_list,
            ja.add_to_reading_list,
        ),
    ];

    for (menu_id, action_id, en_label, ja_label) in contracts {
        assert_eq!(resolve_menu_action(menu_id), Some(action_id), "{menu_id}");
        assert!(
            !en_label.trim().is_empty(),
            "missing English label for {menu_id}"
        );
        assert!(
            !ja_label.trim().is_empty(),
            "missing Japanese label for {menu_id}"
        );
    }
}

#[test]
fn item_menu_shortcut_hints_are_fixed_display_contracts_for_frontend_shortcuts() {
    let contracts = [
        ("item-prev", "prev-article", "K"),
        ("item-next", "next-article", "J"),
        ("item-reader", "open-in-reader", "V"),
        ("item-browser", "open-in-browser", "B"),
        ("item-toggle-star", "toggle-star", "S"),
        ("item-toggle-read", "toggle-read", "M"),
        ("item-mark-all-read", "mark-all-read", "A"),
    ];

    for (menu_id, action_id, shortcut_hint) in contracts {
        assert_eq!(resolve_menu_action(menu_id), Some(action_id), "{menu_id}");
        assert_eq!(
            item_menu_shortcut_hint(menu_id),
            Some(shortcut_hint),
            "{menu_id}"
        );
        assert_eq!(
            item_menu_label("Menu label", menu_id),
            format!("Menu label\t{shortcut_hint}"),
            "{menu_id}"
        );
    }

    // Native menu labels intentionally show fixed default hints; customizable
    // frontend shortcut preferences do not flow into Rust menu construction.
    assert_eq!(item_menu_shortcut_hint("view-unread"), None);
    assert_eq!(item_menu_label("Menu label", "view-unread"), "Menu label");
}

#[test]
fn sync_all_native_accelerator_is_explicitly_owned_by_menu() {
    assert_eq!(resolve_menu_action("accounts-sync"), Some("sync-all"));
    assert_eq!(
        native_menu_accelerator("accounts-sync"),
        Some("CmdOrCtrl+R")
    );
    assert_eq!(native_menu_accelerator("item-reader"), None);
}

#[test]
fn returns_none_for_unknown_menu_ids() {
    assert_eq!(resolve_menu_action("unknown-menu-id"), None);
}

#[test]
fn unknown_menu_id_diagnostics_are_once_per_redacted_menu_id() {
    let _ = unknown_menu_id_once_set()
        .lock()
        .map(|mut seen| seen.clear());

    assert!(should_emit_unknown_menu_id_diagnostic_once(
        "unknown-menu-id"
    ));
    assert!(!should_emit_unknown_menu_id_diagnostic_once(
        "unknown-menu-id"
    ));
    assert!(should_emit_unknown_menu_id_diagnostic_once(
        "unknown-other-id"
    ));
}

#[test]
fn unknown_menu_id_diagnostic_redacts_unexpected_payload_shape() {
    let redacted = redact_menu_id_for_diagnostics("unknown\nmenu?id=secret&token=abc");

    assert_eq!(redacted, "<redacted-menu-id>");
    assert_eq!(
        unknown_menu_id_diagnostic("unknown\nmenu?id=secret&token=abc"),
        "Frontend action diagnostics: unknown native menu id ignored: <redacted-menu-id>"
    );
}

#[test]
fn toggle_check_menu_items_are_limited_to_preference_toggles() {
    assert!(is_toggle_check_menu_item("view-sort-unread"));
    assert!(is_toggle_check_menu_item("view-group-by-feed"));
    assert!(!is_toggle_check_menu_item("view-unread"));
    assert!(!is_toggle_check_menu_item("view-all"));
    assert!(!is_toggle_check_menu_item("view-starred"));
}

#[test]
fn checked_menu_items_emit_preference_toggle_actions() {
    let contracts = [
        ("view-sort-unread", "toggle-sort-unread"),
        ("view-group-by-feed", "toggle-group-by-feed"),
    ];

    for (menu_id, action_id) in contracts {
        assert!(is_toggle_check_menu_item(menu_id), "{menu_id}");
        assert_eq!(resolve_menu_action(menu_id), Some(action_id), "{menu_id}");
    }
}

#[test]
fn checked_menu_items_are_rolled_back_when_frontend_emit_fails() {
    let contracts = [
        ("view-sort-unread", "toggle-sort-unread"),
        ("view-group-by-feed", "toggle-group-by-feed"),
    ];

    for (menu_id, action_id) in contracts {
        assert!(is_toggle_check_menu_item(menu_id), "{menu_id}");
        assert_eq!(resolve_menu_action(menu_id), Some(action_id), "{menu_id}");

        let diagnostic = menu_action_emit_failure_diagnostic(action_id, &"emit failed");
        assert!(diagnostic.contains("native menu failed to emit action"));
        assert!(should_rollback_check_toggle_after_emit(true, true));
    }

    assert!(!should_rollback_check_toggle_after_emit(false, true));
    assert!(!should_rollback_check_toggle_after_emit(true, false));
}

#[test]
fn check_for_updates_menu_availability_follows_manual_updater_config_availability() {
    assert!(is_check_for_updates_menu_available(true));
    assert!(!is_check_for_updates_menu_available(false));
    assert_eq!(
        resolve_menu_action("check-for-updates"),
        Some("check-for-updates")
    );
    assert!(!is_toggle_check_menu_item("check-for-updates"));
}

#[test]
fn reading_list_menu_availability_matches_native_platform_capability() {
    assert_eq!(is_reading_list_menu_available(), cfg!(target_os = "macos"));
    assert_eq!(
        resolve_menu_action("share-reading-list"),
        Some("add-to-reading-list")
    );
    assert!(!is_toggle_check_menu_item("share-reading-list"));
}

#[test]
fn native_menu_emit_failure_uses_frontend_action_diagnostics_category() {
    let message = menu_action_emit_failure_diagnostic("sync-all", &"emit failed");

    assert!(message.contains("Frontend action diagnostics"));
    assert!(message.contains("native menu failed to emit action"));
    assert!(message.contains("sync-all"));
    assert!(message.contains("emit failed"));
}

#[test]
fn sort_unread_checked_state_uses_current_reading_sort_before_legacy_key() {
    let mut prefs = HashMap::from([
        ("sort_unread".to_string(), "newest_first".to_string()),
        ("reading_sort".to_string(), "oldest_first".to_string()),
    ]);
    assert!(is_sort_unread_checked(&prefs));

    prefs.insert("reading_sort".to_string(), "newest_first".to_string());
    prefs.insert("sort_unread".to_string(), "oldest_first".to_string());
    assert!(!is_sort_unread_checked(&prefs));

    prefs.remove("reading_sort");
    assert!(is_sort_unread_checked(&prefs));
}

#[test]
fn sort_unread_checked_state_uses_unchecked_fallback_for_unknown_values() {
    let mut prefs = HashMap::from([("reading_sort".to_string(), "unexpected".to_string())]);
    assert!(!is_sort_unread_checked(&prefs));

    prefs.insert("sort_unread".to_string(), "oldest_first".to_string());
    assert!(!is_sort_unread_checked(&prefs));

    prefs.remove("reading_sort");
    assert!(is_sort_unread_checked(&prefs));

    prefs.insert("sort_unread".to_string(), "unexpected".to_string());
    assert!(!is_sort_unread_checked(&prefs));
}

#[test]
fn group_by_feed_checked_state_only_tracks_feed_grouping() {
    let mut prefs = HashMap::from([("group_by".to_string(), "feed".to_string())]);
    assert!(is_group_by_feed_checked(&prefs));

    prefs.insert("group_by".to_string(), "date".to_string());
    assert!(!is_group_by_feed_checked(&prefs));

    prefs.insert("group_by".to_string(), "none".to_string());
    assert!(!is_group_by_feed_checked(&prefs));
}
