use std::collections::HashMap;

use super::bridge::{browser_preview_bridge_message_action, browser_preview_close_bridge_source};
use super::escape_accelerator::should_handle_macos_browser_escape_key;
use super::navigation::supports_native_navigation;
use super::prefs::{
    browser_preview_action_for_macos_key_event, browser_preview_action_for_shortcut,
    browser_preview_action_for_virtual_key_from_prefs_result,
    browser_preview_focus_override_source, browser_preview_initialization_script,
    browser_preview_initialization_script_from_prefs_result,
    browser_preview_shortcut_preferences_read_warning,
    browser_shortcut_key_from_macos_event_characters, browser_shortcut_key_from_virtual_key,
    browser_shortcut_key_from_virtual_key_name, synthesize_shift_only_key_state,
    try_load_browser_preview_prefs_from_db, KEY_STATE_DOWN_BIT, VIRTUAL_KEY_SHIFT_INDEX,
};
use super::{
    browser_webview_diagnostics_enabled, browser_webview_emit_failure_warning,
    set_browser_webview_diagnostics_enabled, should_trigger_timeout_fallback,
    BrowserNavigationAvailability, BrowserWebviewDiagnosticsPayload, BrowserWebviewFallbackPayload,
    BrowserWebviewLogicalRect, BrowserWebviewState, BrowserWebviewTracker,
    BROWSER_WEBVIEW_DIAGNOSTICS_EVENT, BROWSER_WEBVIEW_DIAGNOSTICS_TEST_LOCK,
    BROWSER_WEBVIEW_LABEL,
};
use crate::platform::{platform_info_for_kind, PlatformKind};

#[test]
fn start_marks_state_as_loading_and_resets_history_flags() {
    let mut tracker = BrowserWebviewTracker::default();

    let state = tracker.start("https://example.com/article".to_string());

    assert_eq!(state.url, "https://example.com/article");
    assert!(state.is_loading);
    assert!(!state.can_go_back);
    assert!(!state.can_go_forward);
}

#[test]
fn finish_applies_navigation_capabilities() {
    let mut tracker = BrowserWebviewTracker::default();
    tracker.start("https://example.com/article".to_string());

    let state = tracker.finish(
        "https://example.com/next".to_string(),
        Some(BrowserNavigationAvailability {
            can_go_back: true,
            can_go_forward: false,
        }),
    );

    assert_eq!(state.url, "https://example.com/next");
    assert!(!state.is_loading);
    assert!(state.can_go_back);
    assert!(!state.can_go_forward);
}

#[test]
fn finish_prefers_native_navigation_availability_over_fallback_history() {
    let mut tracker = BrowserWebviewTracker::default();

    tracker.start("https://example.com/article".to_string());
    tracker.finish("https://example.com/article".to_string(), None);

    tracker.start("https://example.com/next".to_string());
    let state = tracker.finish(
        "https://example.com/next".to_string(),
        Some(BrowserNavigationAvailability {
            can_go_back: false,
            can_go_forward: true,
        }),
    );

    assert!(!state.can_go_back);
    assert!(state.can_go_forward);
}

#[test]
fn finish_enables_back_after_new_navigation_on_non_macos_fallback() {
    let mut tracker = BrowserWebviewTracker::default();

    tracker.start("https://example.com/article".to_string());
    tracker.finish("https://example.com/article".to_string(), None);

    tracker.start("https://example.com/next".to_string());
    let state = tracker.finish("https://example.com/next".to_string(), None);

    assert!(state.can_go_back);
    assert!(!state.can_go_forward);
}

#[test]
fn finish_enables_forward_after_back_navigation_on_non_macos_fallback() {
    let mut tracker = BrowserWebviewTracker::default();

    tracker.start("https://example.com/article".to_string());
    tracker.finish("https://example.com/article".to_string(), None);

    tracker.start("https://example.com/next".to_string());
    tracker.finish(
        "https://example.com/next".to_string(),
        Some(BrowserNavigationAvailability {
            can_go_back: true,
            can_go_forward: false,
        }),
    );

    tracker.start("https://example.com/article".to_string());
    let state = tracker.finish("https://example.com/article".to_string(), None);

    assert!(!state.can_go_back);
    assert!(state.can_go_forward);
}

#[test]
fn finish_replaces_new_navigation_history_with_redirected_url() {
    let mut tracker = BrowserWebviewTracker::default();

    tracker.start("https://example.com/article".to_string());
    tracker.finish("https://example.com/article".to_string(), None);

    tracker.start("https://example.com/requested".to_string());
    let state = tracker.finish("https://example.com/redirected".to_string(), None);

    assert_eq!(state.url, "https://example.com/redirected");
    assert_eq!(
        tracker.history,
        vec![
            "https://example.com/article".to_string(),
            "https://example.com/redirected".to_string(),
        ]
    );
    assert_eq!(tracker.history_index, 1);
    assert!(state.can_go_back);
    assert!(!state.can_go_forward);
}

#[test]
fn finish_replaces_reload_history_with_redirected_url() {
    let mut tracker = BrowserWebviewTracker::default();

    tracker.start("https://example.com/article".to_string());
    tracker.finish("https://example.com/article".to_string(), None);

    tracker.start("https://example.com/article".to_string());
    let state = tracker.finish("https://example.com/reloaded".to_string(), None);

    assert_eq!(state.url, "https://example.com/reloaded");
    assert_eq!(
        tracker.history,
        vec!["https://example.com/reloaded".to_string()]
    );
    assert_eq!(tracker.history_index, 0);
    assert!(!state.can_go_back);
    assert!(!state.can_go_forward);
}

#[test]
fn finish_replaces_back_and_forward_history_with_redirected_url() {
    let mut tracker = BrowserWebviewTracker::default();

    tracker.start("https://example.com/article".to_string());
    tracker.finish("https://example.com/article".to_string(), None);

    tracker.start("https://example.com/next".to_string());
    tracker.finish("https://example.com/next".to_string(), None);

    tracker.start("https://example.com/article".to_string());
    let back_state = tracker.finish("https://example.com/back-redirected".to_string(), None);

    assert_eq!(back_state.url, "https://example.com/back-redirected");
    assert_eq!(
        tracker.history,
        vec![
            "https://example.com/back-redirected".to_string(),
            "https://example.com/next".to_string(),
        ]
    );
    assert_eq!(tracker.history_index, 0);
    assert!(!back_state.can_go_back);
    assert!(back_state.can_go_forward);

    tracker.start("https://example.com/next".to_string());
    let forward_state = tracker.finish("https://example.com/forward-redirected".to_string(), None);

    assert_eq!(forward_state.url, "https://example.com/forward-redirected");
    assert_eq!(
        tracker.history,
        vec![
            "https://example.com/back-redirected".to_string(),
            "https://example.com/forward-redirected".to_string(),
        ]
    );
    assert_eq!(tracker.history_index, 1);
    assert!(forward_state.can_go_back);
    assert!(!forward_state.can_go_forward);
}

#[test]
fn clear_drops_the_tracked_state() {
    let mut tracker = BrowserWebviewTracker::default();
    tracker.start("https://example.com/article".to_string());

    tracker.clear();

    assert!(tracker.snapshot().is_none());
}

#[test]
fn supports_native_navigation_on_macos_and_windows() {
    let macos = platform_info_for_kind(PlatformKind::Macos);
    let windows = platform_info_for_kind(PlatformKind::Windows);

    assert!(supports_native_navigation(&macos));
    assert!(supports_native_navigation(&windows));
}

#[test]
fn does_not_support_native_navigation_on_linux_or_unknown() {
    let linux = platform_info_for_kind(PlatformKind::Linux);
    let unknown = platform_info_for_kind(PlatformKind::Unknown);

    assert!(!supports_native_navigation(&linux));
    assert!(!supports_native_navigation(&unknown));
}

#[test]
fn timeout_fallback_triggers_only_for_matching_loading_url() {
    let loading = BrowserWebviewState {
        url: "https://example.com/article".to_string(),
        can_go_back: false,
        can_go_forward: false,
        is_loading: true,
        load_generation: 1,
    };
    let finished = BrowserWebviewState {
        is_loading: false,
        ..loading.clone()
    };

    assert!(should_trigger_timeout_fallback(
        Some(&loading),
        "https://example.com/article",
        1
    ));
    assert!(!should_trigger_timeout_fallback(
        Some(&loading),
        "https://example.com/other",
        1
    ));
    assert!(!should_trigger_timeout_fallback(
        Some(&loading),
        "https://example.com/article",
        2
    ));
    assert!(!should_trigger_timeout_fallback(
        Some(&finished),
        "https://example.com/article",
        1
    ));
    assert!(!should_trigger_timeout_fallback(
        None,
        "https://example.com/article",
        1
    ));
}

#[test]
fn timeout_fallback_generation_advances_for_same_url_reload() {
    let mut tracker = BrowserWebviewTracker::default();

    let first_load = tracker.start("https://example.com/article".to_string());
    tracker.finish("https://example.com/article".to_string(), None);
    let reload = tracker.start("https://example.com/article".to_string());

    assert_eq!(first_load.url, reload.url);
    assert!(reload.load_generation > first_load.load_generation);
    assert!(!should_trigger_timeout_fallback(
        tracker.snapshot().as_ref(),
        &first_load.url,
        first_load.load_generation
    ));
    assert!(should_trigger_timeout_fallback(
        tracker.snapshot().as_ref(),
        &reload.url,
        reload.load_generation
    ));
}

#[test]
fn timeout_fallback_generation_advances_for_same_url_reopen_after_clear() {
    let mut tracker = BrowserWebviewTracker::default();

    let first_load = tracker.start("https://example.com/article".to_string());
    tracker.clear();
    let reopened = tracker.start("https://example.com/article".to_string());

    assert_eq!(first_load.url, reopened.url);
    assert!(reopened.load_generation > first_load.load_generation);
    assert!(!should_trigger_timeout_fallback(
        tracker.snapshot().as_ref(),
        &first_load.url,
        first_load.load_generation
    ));
    assert!(should_trigger_timeout_fallback(
        tracker.snapshot().as_ref(),
        &reopened.url,
        reopened.load_generation
    ));
}

#[test]
fn browser_webview_diagnostics_flag_tracks_runtime_setting() {
    let _guard = BROWSER_WEBVIEW_DIAGNOSTICS_TEST_LOCK.lock().unwrap();

    set_browser_webview_diagnostics_enabled(false);
    assert!(!browser_webview_diagnostics_enabled());

    set_browser_webview_diagnostics_enabled(true);
    assert!(browser_webview_diagnostics_enabled());

    set_browser_webview_diagnostics_enabled(false);
}

#[test]
fn browser_webview_emit_failure_warning_is_diagnostics_only() {
    let warning = browser_webview_emit_failure_warning(
        BROWSER_WEBVIEW_DIAGNOSTICS_EVENT,
        &"listener unavailable",
    );

    assert!(warning.contains("Failed to emit browser webview event"));
    assert!(warning.contains(BROWSER_WEBVIEW_DIAGNOSTICS_EVENT));
    assert!(warning.contains("continuing without frontend notification"));
    assert!(warning.contains("listener unavailable"));
}

#[test]
fn browser_webview_state_event_payload_rejects_unknown_or_malformed_fields() {
    let valid = serde_json::json!({
        "url": "https://example.com/article",
        "can_go_back": false,
        "can_go_forward": true,
        "is_loading": false,
        "load_generation": 1
    });

    let state: BrowserWebviewState =
        serde_json::from_value(valid).expect("valid state event payload should parse");
    assert_eq!(state.url, "https://example.com/article");
    assert_eq!(state.load_generation, 1);

    let wrong_boolean_type = serde_json::json!({
        "url": "https://example.com/article",
        "can_go_back": "false",
        "can_go_forward": true,
        "is_loading": false,
        "load_generation": 1
    });
    assert!(serde_json::from_value::<BrowserWebviewState>(wrong_boolean_type).is_err());

    let missing_generation = serde_json::json!({
        "url": "https://example.com/article",
        "can_go_back": false,
        "can_go_forward": true,
        "is_loading": false
    });
    assert!(serde_json::from_value::<BrowserWebviewState>(missing_generation).is_err());
}

#[test]
fn browser_webview_fallback_event_payload_rejects_unknown_or_malformed_fields() {
    let valid = serde_json::json!({
        "url": "https://example.com/fallback",
        "opened_external": false,
        "error_message": null
    });

    let payload: BrowserWebviewFallbackPayload =
        serde_json::from_value(valid).expect("valid fallback event payload should parse");
    assert_eq!(payload.url, "https://example.com/fallback");
    assert!(!payload.opened_external);
    assert_eq!(payload.error_message, None);

    let unknown_field = serde_json::json!({
        "url": "https://example.com/fallback",
        "opened_external": false,
        "error_message": null,
        "extra": true
    });
    assert!(serde_json::from_value::<BrowserWebviewFallbackPayload>(unknown_field).is_err());

    let wrong_opened_external_type = serde_json::json!({
        "url": "https://example.com/fallback",
        "opened_external": "false",
        "error_message": null
    });
    assert!(
        serde_json::from_value::<BrowserWebviewFallbackPayload>(wrong_opened_external_type)
            .is_err()
    );
}

#[test]
fn default_capability_includes_child_webview_for_injected_command_invokes() {
    let capabilities: serde_json::Value =
        serde_json::from_str(include_str!("../../capabilities/default.json"))
            .expect("default capability should be valid JSON");
    let capabilities = capabilities
        .as_array()
        .expect("default capability should be an array");
    let main_webviews = capabilities
        .iter()
        .find(|capability| capability["identifier"] == "main")
        .and_then(|capability| capability["webviews"].as_array())
        .expect("main capability webviews should be an array");
    let browser_webviews = capabilities
        .iter()
        .find(|capability| capability["identifier"] == BROWSER_WEBVIEW_LABEL)
        .and_then(|capability| capability["webviews"].as_array())
        .expect("browser webview capability webviews should be an array");

    assert!(
        main_webviews.iter().any(|value| value == "main"),
        "main webview must keep command/plugin permissions"
    );
    assert!(
        browser_webviews
            .iter()
            .any(|value| value == BROWSER_WEBVIEW_LABEL),
        "{BROWSER_WEBVIEW_LABEL} must keep a capability entry so injected browser preview scripts can invoke its own commands"
    );
}

#[test]
fn browser_webview_diagnostics_event_payload_rejects_unknown_or_malformed_fields() {
    let valid = serde_json::json!({
        "action": "resize",
        "requestedLogical": { "x": 1.0, "y": 2.0, "width": 300.0, "height": 200.0 },
        "appliedLogical": { "x": 1.0, "y": 2.0, "width": 300.0, "height": 200.0 },
        "scaleFactor": 2.0,
        "nativeWebviewBounds": null
    });

    let payload: BrowserWebviewDiagnosticsPayload =
        serde_json::from_value(valid).expect("valid diagnostics event payload should parse");
    assert_eq!(payload.action, "resize");
    assert_eq!(
        payload.requested_logical,
        BrowserWebviewLogicalRect {
            x: 1.0,
            y: 2.0,
            width: 300.0,
            height: 200.0
        }
    );

    let unknown_rect_field = serde_json::json!({
        "action": "resize",
        "requestedLogical": {
            "x": 1.0,
            "y": 2.0,
            "width": 300.0,
            "height": 200.0,
            "right": 301.0
        },
        "appliedLogical": { "x": 1.0, "y": 2.0, "width": 300.0, "height": 200.0 },
        "scaleFactor": 2.0,
        "nativeWebviewBounds": null
    });
    assert!(
        serde_json::from_value::<BrowserWebviewDiagnosticsPayload>(unknown_rect_field).is_err()
    );

    let wrong_scale_type = serde_json::json!({
        "action": "resize",
        "requestedLogical": { "x": 1.0, "y": 2.0, "width": 300.0, "height": 200.0 },
        "appliedLogical": { "x": 1.0, "y": 2.0, "width": 300.0, "height": 200.0 },
        "scaleFactor": "2",
        "nativeWebviewBounds": null
    });
    assert!(serde_json::from_value::<BrowserWebviewDiagnosticsPayload>(wrong_scale_type).is_err());
}

#[test]
fn browser_preview_shortcuts_use_defaults_when_no_override_exists() {
    let prefs = HashMap::new();

    assert_eq!(
        browser_preview_action_for_shortcut(&prefs, "m", false, false, false),
        Some("toggle-read")
    );
    assert_eq!(
        browser_preview_action_for_shortcut(&prefs, "s", false, false, false),
        Some("toggle-star")
    );
    assert_eq!(
        browser_preview_action_for_shortcut(&prefs, "b", false, false, false),
        Some("open-in-default-browser")
    );
    assert_eq!(
        browser_preview_action_for_shortcut(&prefs, "j", false, false, false),
        Some("next-article")
    );
    assert_eq!(
        browser_preview_action_for_shortcut(&prefs, "k", false, false, false),
        Some("prev-article")
    );
    assert_eq!(
        browser_preview_action_for_shortcut(&prefs, "l", false, false, false),
        Some("next-feed")
    );
    assert_eq!(
        browser_preview_action_for_shortcut(&prefs, "h", false, false, false),
        Some("prev-feed")
    );
    assert_eq!(
        browser_preview_action_for_shortcut(&prefs, "r", false, false, false),
        Some("reload-webview")
    );
}

#[test]
fn browser_preview_shortcuts_follow_saved_overrides() {
    let prefs = HashMap::from([
        ("shortcut_toggle_read".to_string(), "x".to_string()),
        ("shortcut_toggle_star".to_string(), "Shift+S".to_string()),
        (
            "shortcut_open_external_browser".to_string(),
            "⌘+B".to_string(),
        ),
        ("shortcut_next_article".to_string(), "n".to_string()),
        ("shortcut_prev_article".to_string(), "p".to_string()),
        ("shortcut_next_feed".to_string(), "Shift+F".to_string()),
        ("shortcut_prev_feed".to_string(), "⌘+H".to_string()),
        ("shortcut_reload_webview".to_string(), "Shift+R".to_string()),
    ]);

    assert_eq!(
        browser_preview_action_for_shortcut(&prefs, "x", false, false, false),
        Some("toggle-read")
    );
    assert_eq!(
        browser_preview_action_for_shortcut(&prefs, "S", false, true, false),
        Some("toggle-star")
    );
    assert_eq!(
        browser_preview_action_for_shortcut(&prefs, "b", true, false, false),
        Some("open-in-default-browser")
    );
    assert_eq!(
        browser_preview_action_for_shortcut(&prefs, "n", false, false, false),
        Some("next-article")
    );
    assert_eq!(
        browser_preview_action_for_shortcut(&prefs, "p", false, false, false),
        Some("prev-article")
    );
    assert_eq!(
        browser_preview_action_for_shortcut(&prefs, "F", false, true, false),
        Some("next-feed")
    );
    assert_eq!(
        browser_preview_action_for_shortcut(&prefs, "h", true, false, false),
        Some("prev-feed")
    );
    assert_eq!(
        browser_preview_action_for_shortcut(&prefs, "R", false, true, false),
        Some("reload-webview")
    );
    assert_eq!(
        browser_preview_action_for_shortcut(&prefs, "j", false, false, false),
        None
    );
}

#[test]
fn browser_preview_shortcut_matching_supports_command_control_and_alt_bindings() {
    let prefs = HashMap::from([
        ("shortcut_toggle_read".to_string(), "⌘+M".to_string()),
        ("shortcut_toggle_star".to_string(), "Alt+S".to_string()),
        (
            "shortcut_next_article".to_string(),
            "Option+Shift+J".to_string(),
        ),
    ]);

    assert_eq!(
        browser_preview_action_for_shortcut(&prefs, "m", true, false, false),
        Some("toggle-read")
    );
    assert_eq!(
        browser_preview_action_for_shortcut(&prefs, "s", false, false, true),
        Some("toggle-star")
    );
    assert_eq!(
        browser_preview_action_for_shortcut(&prefs, "J", false, true, true),
        Some("next-article")
    );
}

#[test]
fn macos_native_shortcut_matching_requires_a_browser_and_non_shift_modifier() {
    let prefs = HashMap::from([
        ("shortcut_toggle_read".to_string(), "m".to_string()),
        ("shortcut_toggle_star".to_string(), "⌘+S".to_string()),
        (
            "shortcut_open_external_browser".to_string(),
            "Alt+B".to_string(),
        ),
    ]);

    assert_eq!(
        browser_preview_action_for_macos_key_event(&prefs, "m", false, false, false, true),
        None,
        "bare key bindings must stay in the hosted page"
    );
    assert_eq!(
        browser_preview_action_for_macos_key_event(&prefs, "s", false, false, false, true),
        None,
        "an unmatched key must not be handled natively"
    );
    assert_eq!(
        browser_preview_action_for_macos_key_event(&prefs, "s", true, false, false, true),
        Some("toggle-star")
    );
    assert_eq!(
        browser_preview_action_for_macos_key_event(&prefs, "b", false, false, true, true),
        Some("open-in-default-browser")
    );
    assert_eq!(
        browser_preview_action_for_macos_key_event(&prefs, "m", false, false, false, false),
        None,
        "native shortcuts must not run when the browser webview is closed"
    );
}

#[test]
fn macos_shortcut_key_from_event_characters_normalizes_control_and_function_keys() {
    assert_eq!(
        browser_shortcut_key_from_macos_event_characters("m"),
        Some("m".to_string()),
        "plain printable characters pass through unchanged"
    );
    assert_eq!(
        browser_shortcut_key_from_macos_event_characters("\u{F700}"),
        Some("ArrowUp".to_string())
    );
    assert_eq!(
        browser_shortcut_key_from_macos_event_characters("\u{F701}"),
        Some("ArrowDown".to_string())
    );
    assert_eq!(
        browser_shortcut_key_from_macos_event_characters("\u{F702}"),
        Some("ArrowLeft".to_string())
    );
    assert_eq!(
        browser_shortcut_key_from_macos_event_characters("\u{F703}"),
        Some("ArrowRight".to_string())
    );
    for (index, expected) in [
        "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
    ]
    .into_iter()
    .enumerate()
    {
        let characters = char::from_u32(0xF704 + index as u32)
            .expect("NSFunctionKey F1-F12 values should be valid characters")
            .to_string();
        assert_eq!(
            browser_shortcut_key_from_macos_event_characters(&characters),
            Some(expected.to_string())
        );
    }
    assert_eq!(
        browser_shortcut_key_from_macos_event_characters("\r"),
        Some("Enter".to_string())
    );
    assert_eq!(
        browser_shortcut_key_from_macos_event_characters(" "),
        Some("Space".to_string())
    );
    assert_eq!(
        browser_shortcut_key_from_macos_event_characters("\t"),
        Some("Tab".to_string())
    );
    assert_eq!(
        browser_shortcut_key_from_macos_event_characters("\u{7f}"),
        Some("Backspace".to_string())
    );
    assert_eq!(
        browser_shortcut_key_from_macos_event_characters("\u{1b}"),
        Some("Escape".to_string())
    );
    assert_eq!(
        browser_shortcut_key_from_macos_event_characters(""),
        None,
        "an empty characters string has no logical key"
    );
    assert_eq!(
        browser_shortcut_key_from_macos_event_characters("ab"),
        None,
        "multi-character IME/dead-key output is not a single logical shortcut key"
    );
    assert_eq!(
        browser_shortcut_key_from_macos_event_characters("\u{F729}"),
        None,
        "unmapped NSFunctionKey characters must not fall through as literal text"
    );
}

#[test]
fn windows_virtual_key_name_mapping_covers_recorder_named_keys() {
    let cases = [
        (0x0D, "Enter"),
        (0x09, "Tab"),
        (0x08, "Backspace"),
        (0x20, "Space"),
        (0x25, "ArrowLeft"),
        (0x26, "ArrowUp"),
        (0x27, "ArrowRight"),
        (0x28, "ArrowDown"),
        (0x70, "F1"),
        (0x71, "F2"),
        (0x72, "F3"),
        (0x73, "F4"),
        (0x74, "F5"),
        (0x75, "F6"),
        (0x76, "F7"),
        (0x77, "F8"),
        (0x78, "F9"),
        (0x79, "F10"),
        (0x7A, "F11"),
        (0x7B, "F12"),
        (0x1B, "Escape"),
    ];

    for (virtual_key, expected) in cases {
        assert_eq!(
            browser_shortcut_key_from_virtual_key_name(virtual_key),
            Some(expected),
            "virtual key 0x{virtual_key:02X} should normalize to {expected}"
        );
    }
}

#[test]
fn synthesized_shift_key_state_only_marks_shift_down() {
    let unshifted = synthesize_shift_only_key_state(false);
    assert!(
        unshifted.iter().all(|&byte| byte == 0),
        "unshifted key state should leave every virtual key up"
    );

    let shifted = synthesize_shift_only_key_state(true);
    assert_eq!(
        shifted[VIRTUAL_KEY_SHIFT_INDEX], KEY_STATE_DOWN_BIT,
        "shifted key state should mark VK_SHIFT down"
    );
    assert!(
        shifted
            .iter()
            .enumerate()
            .filter(|&(index, _)| index != VIRTUAL_KEY_SHIFT_INDEX)
            .all(|(_, &byte)| byte == 0),
        "synthesized key state must not mark Ctrl/Alt down, since AltGr composition \
         would otherwise change the resolved character on some layouts"
    );
}

#[test]
fn shifted_digit_virtual_keys_do_not_use_the_fixed_unshifted_table() {
    // Regression for PR #71 review: `Shift+1` must not resolve to the fixed "1" table
    // entry, because the frontend recorder saves the shift-applied glyph (e.g. "!" on a
    // US layout) and a fixed digit would never match it. Real layout translation goes
    // through `ToUnicode`, which is only callable on Windows; here we assert the pure
    // dispatch no longer takes the fixed-table shortcut once Shift is held.
    for virtual_key in 0x30..=0x39u32 {
        assert_ne!(
            browser_shortcut_key_from_virtual_key(virtual_key, true),
            char::from_u32(virtual_key).map(|ch| ch.to_string()),
            "virtual key 0x{virtual_key:02X} with Shift held must not fall back to the \
             fixed unshifted digit table"
        );
    }

    for virtual_key in 0x30..=0x39u32 {
        assert_eq!(
            browser_shortcut_key_from_virtual_key(virtual_key, false),
            char::from_u32(virtual_key).map(|ch| ch.to_string()),
            "virtual key 0x{virtual_key:02X} without Shift should keep the fixed digit \
             table"
        );
    }
}

#[test]
fn browser_preview_preferences_try_lock_skips_busy_database() {
    let db = std::sync::Mutex::new(
        crate::infra::db::connection::DbManager::new_in_memory()
            .expect("in-memory database should be available for lock test"),
    );
    let _guard = db
        .lock()
        .expect("database lock should be available for setup");

    assert!(try_load_browser_preview_prefs_from_db(&db).is_none());
}

#[test]
fn browser_preview_virtual_key_uses_default_shortcuts_when_preferences_fail_to_load() {
    let action = browser_preview_action_for_virtual_key_from_prefs_result(
        Err(std::io::Error::other("preference read failed")),
        0x4D,
        false,
        false,
        false,
    );

    assert_eq!(action, Some("toggle-read"));
}

#[test]
fn browser_preview_virtual_key_preference_read_failure_warning_documents_fallback() {
    let error = std::io::Error::other("preference read failed");
    let warning = browser_preview_shortcut_preferences_read_warning(&error);

    assert!(warning.contains("Failed to load embedded browser shortcut preferences"));
    assert!(warning.contains("using default preview shortcuts"));
    assert!(warning.contains("preference read failed"));
}

#[test]
fn browser_preview_virtual_key_keeps_saved_overrides_when_preferences_load() {
    let prefs = HashMap::from([("shortcut_toggle_read".to_string(), "x".to_string())]);

    assert_eq!(
        browser_preview_action_for_virtual_key_from_prefs_result(
            Ok(prefs),
            0x58,
            false,
            false,
            false,
        ),
        Some("toggle-read")
    );
}

#[test]
fn macos_escape_monitor_handles_escape_only_when_browser_webview_is_open() {
    assert!(should_handle_macos_browser_escape_key(53, true));
    assert!(!should_handle_macos_browser_escape_key(53, false));
    assert!(!should_handle_macos_browser_escape_key(36, true));
}

#[test]
fn browser_preview_script_bridge_message_ignores_stale_url_payloads() {
    let current_state = BrowserWebviewState {
        url: "https://example.com/current".to_string(),
        can_go_back: false,
        can_go_forward: false,
        is_loading: false,
        load_generation: 2,
    };
    let current_payload = r#"{"action":"toggle-read","url":"https://example.com/current"}"#;
    let stale_payload = r#"{"action":"toggle-read","url":"https://example.com/stale"}"#;

    assert_eq!(
        browser_preview_bridge_message_action(current_payload, Some(&current_state)),
        Some("toggle-read".to_string())
    );
    assert_eq!(
        browser_preview_bridge_message_action(stale_payload, Some(&current_state)),
        None
    );
    assert_eq!(
        browser_preview_bridge_message_action(current_payload, None),
        None
    );
}

#[test]
fn browser_preview_script_bridge_message_accepts_canonical_current_url_payloads() {
    let redirected_state = BrowserWebviewState {
        url: "https://example.com/redirected".to_string(),
        can_go_back: false,
        can_go_forward: false,
        is_loading: false,
        load_generation: 2,
    };
    let trailing_slash_state = BrowserWebviewState {
        url: "https://example.com/".to_string(),
        ..redirected_state.clone()
    };
    let percent_encoded_state = BrowserWebviewState {
        url: "https://example.com/~reader/%2Farticle".to_string(),
        ..redirected_state.clone()
    };
    let hash_changed_state = BrowserWebviewState {
        url: "https://example.com/article".to_string(),
        ..redirected_state.clone()
    };

    assert_eq!(
        browser_preview_bridge_message_action(
            r#"{"action":"toggle-read","url":"https://example.com/redirected"}"#,
            Some(&redirected_state)
        ),
        Some("toggle-read".to_string())
    );
    assert_eq!(
        browser_preview_bridge_message_action(
            r#"{"action":"mouse-back","url":"https://example.com/redirected"}"#,
            Some(&redirected_state)
        ),
        Some("mouse-back".to_string())
    );
    assert_eq!(
        browser_preview_bridge_message_action(
            r#"{"action":"toggle-read","url":"https://example.com"}"#,
            Some(&trailing_slash_state)
        ),
        Some("toggle-read".to_string())
    );
    assert_eq!(
        browser_preview_bridge_message_action(
            r#"{"action":"toggle-read","url":"https://example.com/%7ereader/%2farticle"}"#,
            Some(&percent_encoded_state)
        ),
        Some("toggle-read".to_string())
    );
    assert_eq!(
        browser_preview_bridge_message_action(
            r##"{"action":"toggle-read","url":"https://example.com/article#comments"}"##,
            Some(&hash_changed_state)
        ),
        Some("toggle-read".to_string())
    );
}

#[test]
fn browser_preview_script_bridge_message_rejects_stale_url_after_redirect() {
    let redirected_state = BrowserWebviewState {
        url: "https://example.com/redirected".to_string(),
        can_go_back: false,
        can_go_forward: false,
        is_loading: false,
        load_generation: 2,
    };

    assert_eq!(
        browser_preview_bridge_message_action(
            r#"{"action":"toggle-read","url":"https://example.com/requested"}"#,
            Some(&redirected_state)
        ),
        None
    );
    assert_eq!(
        browser_preview_bridge_message_action(
            r#"{"action":"mouse-back","url":"https://example.com/requested"}"#,
            Some(&redirected_state)
        ),
        None
    );
}

#[test]
fn browser_preview_script_bridge_message_rejects_unknown_or_malformed_payloads() {
    let current_state = BrowserWebviewState {
        url: "https://example.com/current".to_string(),
        can_go_back: false,
        can_go_forward: false,
        is_loading: false,
        load_generation: 2,
    };

    assert_eq!(
        browser_preview_bridge_message_action(
            r#"{"action":"open-settings","url":"https://example.com/current"}"#,
            Some(&current_state)
        ),
        None
    );
    assert_eq!(
        browser_preview_bridge_message_action(
            r#"{"action":"toggle-read","url":"https://example.com/current","extra":true}"#,
            Some(&current_state)
        ),
        None
    );
    assert_eq!(
        browser_preview_bridge_message_action("toggle-read", Some(&current_state)),
        None
    );
}

#[test]
fn browser_preview_close_bridge_only_captures_space_scroll() {
    let prefs = HashMap::new();

    let script =
        browser_preview_close_bridge_source(&prefs).expect("close bridge script should exist");

    // Bridge actions this script used to send (bindings dispatch, close capture, and mouse
    // button 3/4 capture) are discarded at the native layer, so the page must see those
    // keys/buttons uninterrupted. Only Space-key scrolling remains captured.
    assert!(script.contains("getSpaceScrollDirection"));
    assert!(script.contains("window.innerHeight * 0.8"));
    assert!(script.contains("data-disable-global-shortcuts=\"true\""));
    assert!(script.contains("if (isEditableTarget(event.target))"));
    assert!(script.contains("if (!event.defaultPrevented && spaceScrollDirection !== 0)"));
    assert!(!script.contains("close_browser_webview"));
    assert!(!script.contains("closeBrowserPreview"));
    assert!(!script.contains("closeBinding"));
    assert!(!script.contains("ultra-rss-browser-shortcut://"));
    assert!(!script.contains("bindings["));
    assert!(!script.contains("queueBridgeAction"));
    assert!(!script.contains("requestActionViaNavigation"));
    assert!(!script.contains("mousedown"));
    assert!(!script.contains("mouseup"));
    assert!(!script.contains("event.button"));
    assert!(!script.contains("go_back_browser_webview"));
    assert!(!script.contains("go_forward_browser_webview"));
}

#[test]
fn browser_preview_close_bridge_guards_against_duplicate_listener_installation() {
    let prefs = HashMap::new();

    let script =
        browser_preview_close_bridge_source(&prefs).expect("close bridge script should exist");

    assert!(script.contains("__ULTRA_RSS_BROWSER_BRIDGE_INSTALLED__"));
    assert!(script.contains("if (window.__ULTRA_RSS_BROWSER_BRIDGE_INSTALLED__) return;"));
    assert!(script.contains("configurable: false"));
}

#[test]
fn browser_preview_focus_override_is_disabled_by_default() {
    let prefs = HashMap::new();

    assert!(browser_preview_focus_override_source(&prefs).is_none());
}

#[test]
fn browser_preview_focus_override_masks_visibility_and_focus_when_enabled() {
    let prefs = HashMap::from([("web_preview_keep_focus".to_string(), "true".to_string())]);

    let script = browser_preview_focus_override_source(&prefs)
        .expect("focus override script should exist when preference is enabled");

    assert!(script.contains("'hidden'"));
    assert!(script.contains("'visibilityState'"));
    assert!(script.contains("'webkitHidden'"));
    assert!(script.contains("'webkitVisibilityState'"));
    assert!(script.contains("'hasFocus'"));
    assert!(script.contains("ignoreEventHandlerProperty(window, 'onblur');"));
    assert!(script.contains("ignoreEventHandlerProperty(window, 'onfocus');"));
    assert!(script.contains("ignoreEventHandlerProperty(document, 'onvisibilitychange');"));
    assert!(script.contains("stopImmediatePropagation"));
    assert!(script.contains("originalAddEventListener.call(window"));
    assert!(script.contains("typeof listener === 'object'"));
    assert!(script.contains("visibilitychange"));
    assert!(script.contains("blur"));
}

#[test]
fn browser_preview_focus_override_keeps_event_target_patch_idempotent_and_symmetric() {
    let prefs = HashMap::from([("web_preview_keep_focus".to_string(), "true".to_string())]);

    let script = browser_preview_focus_override_source(&prefs)
        .expect("focus override script should exist when preference is enabled");

    assert!(script.contains(
        "if (window.__ULTRA_RSS_FOCUS_OVERRIDE_INSTALLED__ || window.__MBU_FOCUS_OVERRIDE_APPLIED__) return;"
    ));
    assert!(script.contains("data-mbu-focus-override-applied"));
    assert!(
        script.contains("const originalAddEventListener = EventTarget.prototype.addEventListener;")
    );
    assert!(script.contains(
        "const originalRemoveEventListener = EventTarget.prototype.removeEventListener;"
    ));
    assert!(script.contains("return originalAddEventListener.call(this, type, listener, options);"));
    assert!(
        script.contains("return originalRemoveEventListener.call(this, type, listener, options);")
    );
    assert!(script.contains("listeners.add(listener);"));
    assert!(script.contains("listeners?.has(listener)"));
}

#[test]
fn browser_preview_focus_override_tolerates_site_property_descriptor_failures() {
    let prefs = HashMap::from([("web_preview_keep_focus".to_string(), "true".to_string())]);

    let script = browser_preview_focus_override_source(&prefs)
        .expect("focus override script should exist when preference is enabled");

    assert!(
        script.contains("Object.defineProperty(window, '__ULTRA_RSS_FOCUS_OVERRIDE_INSTALLED__'")
    );
    assert!(script.contains("Object.defineProperty(window, '__MBU_FOCUS_OVERRIDE_APPLIED__'"));
    assert!(script.contains("configurable: false"));
    assert!(script.contains("const defineGetter = (target, property, value) => {"));
    assert!(script.contains("const defineValue = (target, property, value) => {"));
    assert!(script.contains("const ignoreEventHandlerProperty = (target, property) => {"));
    assert!(script.contains("try {"));
    assert!(script.contains("} catch (_) {}"));
    assert!(script.contains("defineGetter(document, 'hidden', false);"));
    assert!(script.contains("defineValue(document, 'hasFocus', () => true);"));
}

#[test]
fn browser_preview_script_bridge_source_snapshot_keeps_minimal_command_contract() {
    let prefs = HashMap::from([("shortcut_toggle_read".to_string(), "x".to_string())]);

    let script = super::bridge::browser_preview_script_bridge_source(&prefs)
        .expect("script bridge should exist");

    // Bindings dispatch (postMessage) and mouse button 3/4 capture used to be sent to a
    // native side that discards them; only Space-key scrolling remains captured here.
    assert!(script.contains("__ULTRA_RSS_BROWSER_BRIDGE_INSTALLED__"));
    assert!(script.contains("window.addEventListener('keydown'"));
    assert!(script.contains("data-disable-global-shortcuts=\"true\""));
    assert!(script.contains("if (isEditableTarget(event.target))"));
    assert!(script.contains("if (!event.defaultPrevented && spaceScrollDirection !== 0)"));
    assert!(!script.contains("postBridgeAction"));
    assert!(!script.contains("postMessage"));
    assert!(!script.contains("bindings"));
    assert!(!script.contains("mousedown"));
    assert!(!script.contains("mouseup"));
    assert!(!script.contains("event.button"));
}

#[test]
fn browser_preview_initialization_script_includes_focus_override_only_when_preference_is_true() {
    let enabled_prefs = HashMap::from([("web_preview_keep_focus".to_string(), "true".to_string())]);
    let disabled_prefs =
        HashMap::from([("web_preview_keep_focus".to_string(), "false".to_string())]);
    let missing_prefs = HashMap::new();

    let enabled_script = browser_preview_initialization_script(&enabled_prefs)
        .expect("initialization script should exist when focus override is enabled");
    let disabled_script = browser_preview_initialization_script(&disabled_prefs)
        .expect("close bridge script should still exist when focus override is disabled");
    let missing_script = browser_preview_initialization_script(&missing_prefs)
        .expect("close bridge script should still exist when focus override is unset");

    assert!(enabled_script.contains("__ULTRA_RSS_FOCUS_OVERRIDE_INSTALLED__"));
    assert!(enabled_script.contains("__MBU_FOCUS_OVERRIDE_APPLIED__"));
    assert!(enabled_script.contains("Document.prototype, 'hidden', false"));
    assert!(enabled_script.contains("Document.prototype, 'visibilityState', 'visible'"));
    assert!(enabled_script.contains("Document.prototype, 'webkitVisibilityState', 'visible'"));
    assert!(enabled_script.contains("Document.prototype, 'hasFocus', () => true"));
    assert!(disabled_script.contains("getSpaceScrollDirection"));
    assert!(missing_script.contains("getSpaceScrollDirection"));
    assert!(!disabled_script.contains("__ULTRA_RSS_FOCUS_OVERRIDE_INSTALLED__"));
    assert!(!disabled_script.contains("__MBU_FOCUS_OVERRIDE_APPLIED__"));
    assert!(!missing_script.contains("__ULTRA_RSS_FOCUS_OVERRIDE_INSTALLED__"));
    assert!(!missing_script.contains("__MBU_FOCUS_OVERRIDE_APPLIED__"));
    assert!(!disabled_script.contains("Document.prototype, 'visibilityState', 'visible'"));
    assert!(!missing_script.contains("Document.prototype, 'visibilityState', 'visible'"));
}

#[test]
fn browser_preview_initialization_script_uses_only_explicit_preview_preferences() {
    let prefs = HashMap::from([
        (
            "web_preview_keep_focus".to_string(),
            "true;window.__ultraRssInjected=true".to_string(),
        ),
        (
            "unknown_browser_preview_script".to_string(),
            "window.__ultraRssInjected=true".to_string(),
        ),
    ]);

    let script = browser_preview_initialization_script(&prefs)
        .expect("close bridge script should still exist without focus override");

    assert!(!script.contains("__ULTRA_RSS_FOCUS_OVERRIDE_INSTALLED__"));
    assert!(!script.contains("window.__ultraRssInjected=true"));
    assert!(script.contains("getSpaceScrollDirection"));
}

#[test]
fn browser_preview_initialization_script_falls_back_when_preferences_fail_to_load() {
    let script = browser_preview_initialization_script_from_prefs_result(Err(
        std::io::Error::other("preference read failed"),
    ));

    assert_eq!(script, None);
}
