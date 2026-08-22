use tauri::Url;

use super::bounds::{
    browser_webview_bounds_diagnostics_payload, child_webview_add_child_bounds,
    child_webview_rect_from_browser_bounds, validated_bounds, BrowserWebviewBounds,
    BrowserWebviewBoundsUnit, INVALID_BROWSER_BOUNDS_ERROR,
};
use super::lifecycle::{
    allow_browser_webview_navigation, browser_webview_initial_url, external_url,
    finish_browser_webview_timeout, is_placeholder_browser_webview_url,
    navigation_failure_emissions, open_new_window_request_in_external_browser,
    should_accept_page_load_finish, should_navigate_existing_browser_webview,
    should_use_placeholder_browser_webview_url, timeout_fallback_emissions,
    tracker_navigation_availability, BrowserWebviewTimeoutFallbackEmission,
};
use super::privacy::browser_webview_log_url;
use super::{
    browser_host_focus_failure_warning, browser_webview_not_open_error, empty_reload_source_error,
    validate_browser_webview_fallback_url, BROWSER_WEBVIEW_EMPTY_RELOAD_SOURCE_ERROR,
    BROWSER_WEBVIEW_NOT_OPEN_ERROR,
};
use crate::browser_webview::{
    set_browser_webview_diagnostics_enabled, BrowserNavigationAvailability,
    BrowserWebviewLogicalRect, BrowserWebviewState, BrowserWebviewTracker,
    BROWSER_WEBVIEW_DIAGNOSTICS_TEST_LOCK,
};
use crate::commands::dto::AppError;
use crate::platform::PlatformKind;

#[test]
fn external_url_accepts_https_urls() {
    let parsed = external_url("https://example.com/article").expect("https URL should parse");

    assert_eq!(parsed.scheme(), "https");
}

#[test]
fn external_url_rejects_javascript_scheme() {
    let result = external_url("javascript:alert('owned')");

    assert!(result.is_err(), "javascript: URLs must be rejected");
}

#[test]
fn external_url_rejects_file_scheme() {
    let result = external_url("file:///tmp/article.html");

    assert!(result.is_err(), "file:// URLs must be rejected");
}

#[test]
fn allow_browser_webview_navigation_allows_https() {
    let target_url = Url::parse("https://example.com/a").expect("test URL should parse");

    assert!(allow_browser_webview_navigation(&target_url, false));
}

#[test]
fn allow_browser_webview_navigation_allows_private_host_http() {
    // Web Preview intentionally does not reject private/loopback hosts (unlike the
    // Article Link Opener). LAN self-hosted publishers must remain previewable.
    let target_url = Url::parse("http://127.0.0.1/").expect("test URL should parse");

    assert!(allow_browser_webview_navigation(&target_url, false));
}

#[test]
fn allow_browser_webview_navigation_denies_javascript_scheme() {
    let target_url = Url::parse("javascript:alert(1)").expect("test URL should parse");

    assert!(!allow_browser_webview_navigation(&target_url, false));
}

#[test]
fn allow_browser_webview_navigation_denies_file_scheme() {
    let target_url = Url::parse("file:///etc/passwd").expect("test URL should parse");

    assert!(!allow_browser_webview_navigation(&target_url, false));
}

#[test]
fn allow_browser_webview_navigation_denies_data_scheme() {
    let target_url =
        Url::parse("data:text/html,<script>alert(1)</script>").expect("test URL should parse");

    assert!(!allow_browser_webview_navigation(&target_url, false));
}

#[test]
fn allow_browser_webview_navigation_denies_credentials() {
    let target_url = Url::parse("https://user:pass@example.com/").expect("test URL should parse");

    assert!(!allow_browser_webview_navigation(&target_url, false));
}

#[test]
fn allow_browser_webview_navigation_allows_placeholder_only_when_flagged() {
    let placeholder_url = Url::parse("about:blank").expect("test URL should parse");

    assert!(allow_browser_webview_navigation(&placeholder_url, true));
    assert!(!allow_browser_webview_navigation(&placeholder_url, false));
}

#[test]
fn open_new_window_request_in_external_browser_rejects_javascript_scheme() {
    let target_url = Url::parse("javascript:alert('owned')").expect("test URL should parse");

    let result = open_new_window_request_in_external_browser(&target_url);

    assert!(
        result.is_err(),
        "javascript: new-window requests must not be forwarded to the OS browser"
    );
}

#[test]
fn browser_webview_shortcut_navigation_action_accepts_known_hosts_only() {
    let close_url = Url::parse("ultra-rss-browser-shortcut://close-browser")
        .expect("shortcut URL should parse");
    let mouse_back_url =
        Url::parse("ultra-rss-browser-shortcut://mouse-back").expect("shortcut URL should parse");
    let mouse_forward_url = Url::parse("ultra-rss-browser-shortcut://mouse-forward")
        .expect("shortcut URL should parse");
    let toggle_read_url =
        Url::parse("ultra-rss-browser-shortcut://toggle-read").expect("shortcut URL should parse");
    let next_article_url =
        Url::parse("ultra-rss-browser-shortcut://next-article").expect("shortcut URL should parse");
    let reload_webview_url = Url::parse("ultra-rss-browser-shortcut://reload-webview")
        .expect("shortcut URL should parse");
    let unknown_host = Url::parse("ultra-rss-browser-shortcut://unknown-action")
        .expect("shortcut URL should parse");
    let other_scheme = Url::parse("https://close-browser").expect("https URL should parse");

    assert_eq!(
        super::lifecycle::browser_webview_shortcut_navigation_action(&close_url),
        Some("close-browser".to_string())
    );
    assert_eq!(
        super::lifecycle::browser_webview_shortcut_navigation_action(&mouse_back_url),
        Some("mouse-back".to_string())
    );
    assert_eq!(
        super::lifecycle::browser_webview_shortcut_navigation_action(&mouse_forward_url),
        Some("mouse-forward".to_string())
    );
    assert_eq!(
        super::lifecycle::browser_webview_shortcut_navigation_action(&toggle_read_url),
        Some("toggle-read".to_string())
    );
    assert_eq!(
        super::lifecycle::browser_webview_shortcut_navigation_action(&next_article_url),
        Some("next-article".to_string())
    );
    assert_eq!(
        super::lifecycle::browser_webview_shortcut_navigation_action(&reload_webview_url),
        Some("reload-webview".to_string())
    );
    assert_eq!(
        super::lifecycle::browser_webview_shortcut_navigation_action(&unknown_host),
        None
    );
    assert_eq!(
        super::lifecycle::browser_webview_shortcut_navigation_action(&other_scheme),
        None
    );
}

#[test]
fn bounds_validation_rejects_invalid_geometry_values() {
    for (label, bounds) in [
        (
            "huge x",
            BrowserWebviewBounds {
                x: f64::from(i32::MAX) + 1.0,
                y: 48.0,
                width: 900.0,
                height: 720.0,
                unit: BrowserWebviewBoundsUnit::Logical,
            },
        ),
        (
            "huge width",
            BrowserWebviewBounds {
                x: 100.0,
                y: 48.0,
                width: f64::from(i32::MAX) + 1.0,
                height: 720.0,
                unit: BrowserWebviewBoundsUnit::Physical,
            },
        ),
        (
            "nan x",
            BrowserWebviewBounds {
                x: f64::NAN,
                y: 48.0,
                width: 900.0,
                height: 720.0,
                unit: BrowserWebviewBoundsUnit::Logical,
            },
        ),
        (
            "infinite y",
            BrowserWebviewBounds {
                x: 100.0,
                y: f64::INFINITY,
                width: 900.0,
                height: 720.0,
                unit: BrowserWebviewBoundsUnit::Logical,
            },
        ),
        (
            "zero width",
            BrowserWebviewBounds {
                x: 100.0,
                y: 48.0,
                width: 0.0,
                height: 720.0,
                unit: BrowserWebviewBoundsUnit::Logical,
            },
        ),
        (
            "negative height",
            BrowserWebviewBounds {
                x: 100.0,
                y: 48.0,
                width: 900.0,
                height: -1.0,
                unit: BrowserWebviewBoundsUnit::Logical,
            },
        ),
    ] {
        match validated_bounds(bounds) {
            Err(AppError::UserVisible { message }) => {
                assert_eq!(message, INVALID_BROWSER_BOUNDS_ERROR, "{label}");
            }
            other => panic!("expected user-visible bounds error for {label}, got {other:?}"),
        }
    }
}

#[test]
fn focus_missing_browser_webview_error_is_user_visible() {
    let error = browser_webview_not_open_error();

    match error {
        AppError::UserVisible { message } => {
            assert_eq!(message, BROWSER_WEBVIEW_NOT_OPEN_ERROR);
        }
        other => panic!("expected user-visible missing webview error, got {other:?}"),
    }
}

#[test]
fn close_host_focus_failure_warning_documents_diagnostics_only_policy() {
    let warning = browser_host_focus_failure_warning("after", &"native focus failed");

    assert!(warning.contains("Failed to restore focus to browser host window after closing"));
    assert!(warning.contains("continuing close flow"));
    assert!(warning.contains("native focus failed"));
}

#[test]
fn empty_reload_source_error_is_user_visible() {
    let error = empty_reload_source_error();

    match error {
        AppError::UserVisible { message } => {
            assert_eq!(message, BROWSER_WEBVIEW_EMPTY_RELOAD_SOURCE_ERROR);
        }
        other => panic!("expected user-visible empty reload source error, got {other:?}"),
    }
}

#[test]
fn browser_webview_log_url_redacts_sensitive_path_segments_and_signed_urls() {
    assert_eq!(
        browser_webview_log_url(
            "https://user:pass@example.com/token-secret/feed.xml?token=raw#fragment"
        ),
        "https://example.com/redacted"
    );
    assert_eq!(
        browser_webview_log_url(
            "https://cdn.example.com/download/signed/AbCdEf1234567890AbCdEf123456?expires=1"
        ),
        "https://cdn.example.com/redacted"
    );
    assert_eq!(
        browser_webview_log_url(
            "https://example.com/files/550e8400-e29b-41d4-a716-446655440000/report"
        ),
        "https://example.com/redacted"
    );
    assert_eq!(
        browser_webview_log_url("https://example.com/feed/2026/05/11/article.html"),
        "https://example.com/feed/2026/05/11/article.html"
    );
}

#[test]
fn empty_browser_webview_fallback_url_is_rejected_before_reload_navigation() {
    for value in ["", "   "] {
        match validate_browser_webview_fallback_url(value.to_string()) {
            Err(AppError::UserVisible { message }) => {
                assert_eq!(message, BROWSER_WEBVIEW_EMPTY_RELOAD_SOURCE_ERROR);
            }
            other => panic!("expected empty fallback URL error, got {other:?}"),
        }
    }

    assert_eq!(
        validate_browser_webview_fallback_url("https://example.com/article".to_string())
            .expect("non-empty fallback URL should pass"),
        "https://example.com/article"
    );
}

#[test]
fn browser_webview_fallback_url_rejects_newline_before_reload_navigation() {
    match validate_browser_webview_fallback_url(
        "https://example.com/article\nhttps://evil.example".to_string(),
    ) {
        Err(AppError::UserVisible { message }) => {
            assert_eq!(message, crate::commands::BROWSER_URL_SCHEME_ERROR);
        }
        other => panic!("expected newline fallback URL error, got {other:?}"),
    }
}

#[test]
fn browser_webview_fallback_url_rejects_non_http_scheme_before_reload_navigation() {
    for value in ["javascript:alert('owned')", "file:///tmp/article.html"] {
        match validate_browser_webview_fallback_url(value.to_string()) {
            Err(AppError::UserVisible { message }) => {
                assert_eq!(message, crate::commands::BROWSER_URL_SCHEME_ERROR);
            }
            other => panic!("expected non-http fallback URL error, got {other:?}"),
        }
    }
}

#[test]
fn browser_webview_fallback_url_rejects_malformed_url_before_reload_navigation() {
    for value in ["not a url", "https://[::1"] {
        match validate_browser_webview_fallback_url(value.to_string()) {
            Err(AppError::UserVisible { message }) => {
                assert_eq!(message, crate::commands::BROWSER_URL_SCHEME_ERROR);
            }
            other => panic!("expected malformed fallback URL error, got {other:?}"),
        }
    }
}

#[test]
fn browser_webview_fallback_url_accepts_http_urls_before_reload_navigation() {
    for value in ["http://example.com/article", "https://example.com/article"] {
        assert_eq!(
            validate_browser_webview_fallback_url(value.to_string())
                .expect("http(s) fallback URL should pass"),
            value
        );
    }
}

#[test]
fn bounds_rect_preserves_geometry() {
    let bounds = validated_bounds(BrowserWebviewBounds {
        x: 380.0,
        y: 48.0,
        width: 900.0,
        height: 720.0,
        unit: BrowserWebviewBoundsUnit::Logical,
    })
    .expect("valid bounds should pass");
    let rect = bounds.rect();

    assert_eq!(rect.position.to_logical::<f64>(1.0).x, 380.0);
    assert_eq!(rect.position.to_logical::<f64>(1.0).y, 48.0);
    assert_eq!(rect.size.to_logical::<f64>(1.0).width, 900.0);
    assert_eq!(rect.size.to_logical::<f64>(1.0).height, 720.0);
}

#[test]
fn child_webview_rect_uses_browser_bounds_origin_unchanged() {
    let bounds = validated_bounds(BrowserWebviewBounds {
        x: 380.0,
        y: 48.0,
        width: 900.0,
        height: 720.0,
        unit: BrowserWebviewBoundsUnit::Logical,
    })
    .expect("valid bounds should pass");

    let rect = child_webview_rect_from_browser_bounds(bounds);

    assert_eq!(rect.position.to_logical::<f64>(1.0).x, 380.0);
    assert_eq!(rect.position.to_logical::<f64>(1.0).y, 48.0);
    assert_eq!(rect.size.to_logical::<f64>(1.0).width, 900.0);
    assert_eq!(rect.size.to_logical::<f64>(1.0).height, 720.0);
}

#[test]
fn add_child_bounds_convert_physical_pixels_to_logical_with_window_scale() {
    let bounds = validated_bounds(BrowserWebviewBounds {
        x: 460.0,
        y: 84.0,
        width: 1766.0,
        height: 948.0,
        unit: BrowserWebviewBoundsUnit::Physical,
    })
    .expect("valid physical bounds should pass");

    let (position, size) = child_webview_add_child_bounds(bounds, 2.0);

    assert_eq!(position.x, 230.0);
    assert_eq!(position.y, 42.0);
    assert_eq!(size.width, 883.0);
    assert_eq!(size.height, 474.0);
}

#[test]
fn add_child_bounds_keep_logical_pixels_independent_from_window_scale() {
    let bounds = validated_bounds(BrowserWebviewBounds {
        x: 230.0,
        y: 42.0,
        width: 883.0,
        height: 474.0,
        unit: BrowserWebviewBoundsUnit::Logical,
    })
    .expect("valid logical bounds should pass");

    let (position, size) = child_webview_add_child_bounds(bounds, 2.0);

    assert_eq!(position.x, 230.0);
    assert_eq!(position.y, 42.0);
    assert_eq!(size.width, 883.0);
    assert_eq!(size.height, 474.0);
}

#[test]
fn diagnostics_payload_is_disabled_when_browser_webview_diagnostics_are_off() {
    let _guard = BROWSER_WEBVIEW_DIAGNOSTICS_TEST_LOCK.lock().unwrap();

    set_browser_webview_diagnostics_enabled(false);
    let bounds = BrowserWebviewBounds {
        x: 12.0,
        y: 34.0,
        width: 560.0,
        height: 320.0,
        unit: BrowserWebviewBoundsUnit::Logical,
    };
    let rect = child_webview_rect_from_browser_bounds(bounds);

    let payload = browser_webview_bounds_diagnostics_payload("resize", bounds, &rect, 2.0, None);

    assert_eq!(payload, None);
}

#[test]
fn diagnostics_payload_includes_requested_applied_and_native_bounds_when_enabled() {
    let _guard = BROWSER_WEBVIEW_DIAGNOSTICS_TEST_LOCK.lock().unwrap();

    set_browser_webview_diagnostics_enabled(true);
    let bounds = BrowserWebviewBounds {
        x: 12.0,
        y: 34.0,
        width: 560.0,
        height: 320.0,
        unit: BrowserWebviewBoundsUnit::Logical,
    };
    let rect = child_webview_rect_from_browser_bounds(bounds);
    let native_bounds = BrowserWebviewLogicalRect {
        x: 14.0,
        y: 36.0,
        width: 558.0,
        height: 318.0,
    };

    let payload = browser_webview_bounds_diagnostics_payload(
        "resize",
        bounds,
        &rect,
        2.0,
        Some(native_bounds),
    )
    .expect("enabled diagnostics should build a payload");

    assert_eq!(payload.action, "resize");
    assert_eq!(
        payload.requested_logical,
        BrowserWebviewLogicalRect {
            x: 16.0,
            y: 32.0,
            width: 560.0,
            height: 320.0,
        }
    );
    assert_eq!(
        payload.applied_logical,
        BrowserWebviewLogicalRect {
            x: 16.0,
            y: 32.0,
            width: 560.0,
            height: 320.0,
        }
    );
    assert_eq!(payload.scale_factor, 2.0);
    assert_eq!(
        payload.native_webview_bounds,
        Some(BrowserWebviewLogicalRect {
            x: 16.0,
            y: 40.0,
            width: 560.0,
            height: 320.0,
        })
    );

    set_browser_webview_diagnostics_enabled(false);
}

#[test]
fn diagnostics_payload_buckets_coordinates_and_caps_rect_values_when_enabled() {
    let _guard = BROWSER_WEBVIEW_DIAGNOSTICS_TEST_LOCK.lock().unwrap();

    set_browser_webview_diagnostics_enabled(true);
    let bounds = BrowserWebviewBounds {
        x: -12_345.0,
        y: -6.0,
        width: 20_001.0,
        height: 319.0,
        unit: BrowserWebviewBoundsUnit::Logical,
    };
    let rect = child_webview_rect_from_browser_bounds(bounds);
    let native_bounds = BrowserWebviewLogicalRect {
        x: 18.0,
        y: 34.0,
        width: 1_234_567.0,
        height: 321.0,
    };

    let payload = browser_webview_bounds_diagnostics_payload(
        "resize",
        bounds,
        &rect,
        1.5,
        Some(native_bounds),
    )
    .expect("enabled diagnostics should build a payload");

    assert_eq!(
        payload.requested_logical,
        BrowserWebviewLogicalRect {
            x: -10_000.0,
            y: -8.0,
            width: 10_000.0,
            height: 320.0,
        }
    );
    assert_eq!(
        payload.native_webview_bounds,
        Some(BrowserWebviewLogicalRect {
            x: 16.0,
            y: 32.0,
            width: 10_000.0,
            height: 320.0,
        })
    );

    set_browser_webview_diagnostics_enabled(false);
}

#[test]
fn timeout_fallback_emits_tracker_clear_fallback_and_closed_in_order() {
    assert_eq!(
        timeout_fallback_emissions(true, true),
        vec![
            BrowserWebviewTimeoutFallbackEmission::ClearTracker,
            BrowserWebviewTimeoutFallbackEmission::Fallback,
            BrowserWebviewTimeoutFallbackEmission::Closed,
        ]
    );
}

#[test]
fn timeout_fallback_does_not_emit_closed_without_tracked_state() {
    assert_eq!(
        timeout_fallback_emissions(true, false),
        vec![
            BrowserWebviewTimeoutFallbackEmission::ClearTracker,
            BrowserWebviewTimeoutFallbackEmission::Fallback,
        ]
    );
}

#[test]
fn timeout_fallback_emits_nothing_when_timeout_is_stale() {
    assert_eq!(timeout_fallback_emissions(false, true), vec![]);
}

#[test]
fn timeout_finishes_loading_without_clearing_tracker() {
    let mut tracker = BrowserWebviewTracker::default();
    let loading = tracker.start("https://example.com/article".to_string());

    let timed_out =
        finish_browser_webview_timeout(&mut tracker, &loading.url, loading.load_generation)
            .expect("matching timeout should stop the loading state");

    assert_eq!(timed_out.url, loading.url);
    assert_eq!(timed_out.load_generation, loading.load_generation);
    assert!(!timed_out.is_loading);
    assert_eq!(tracker.snapshot(), Some(timed_out));
}

#[test]
fn timeout_ignores_stale_generation_without_changing_tracker() {
    let mut tracker = BrowserWebviewTracker::default();
    let loading = tracker.start("https://example.com/article".to_string());

    assert_eq!(
        finish_browser_webview_timeout(&mut tracker, &loading.url, loading.load_generation + 1),
        None
    );
    assert_eq!(tracker.snapshot(), Some(loading));
}

#[test]
fn navigation_failure_emits_tracker_clear_fallback_and_closed_in_order() {
    assert_eq!(
        navigation_failure_emissions(true),
        vec![
            BrowserWebviewTimeoutFallbackEmission::ClearTracker,
            BrowserWebviewTimeoutFallbackEmission::Fallback,
            BrowserWebviewTimeoutFallbackEmission::Closed,
        ]
    );
}

#[test]
fn navigation_failure_without_tracked_state_still_emits_fallback() {
    assert_eq!(
        navigation_failure_emissions(false),
        vec![
            BrowserWebviewTimeoutFallbackEmission::ClearTracker,
            BrowserWebviewTimeoutFallbackEmission::Fallback,
        ]
    );
}

#[test]
fn page_load_finish_is_ignored_after_timeout_clears_tracker() {
    let loading = BrowserWebviewState {
        url: "https://example.com/article".to_string(),
        can_go_back: false,
        can_go_forward: false,
        is_loading: true,
        load_generation: 1,
    };

    assert!(should_accept_page_load_finish(
        Some(&loading),
        "https://example.com/article"
    ));
    assert!(!should_accept_page_load_finish(
        None,
        "https://example.com/article"
    ));
}

#[test]
fn page_load_finish_is_ignored_when_it_is_not_the_current_loading_url() {
    let loading = BrowserWebviewState {
        url: "https://example.com/current".to_string(),
        can_go_back: true,
        can_go_forward: false,
        is_loading: true,
        load_generation: 2,
    };
    let finished = BrowserWebviewState {
        is_loading: false,
        ..loading.clone()
    };

    assert!(!should_accept_page_load_finish(
        Some(&loading),
        "https://example.com/previous"
    ));
    assert!(!should_accept_page_load_finish(
        Some(&finished),
        "https://example.com/current"
    ));
}

#[test]
fn browser_webview_log_url_redacts_query_fragment_and_userinfo() {
    let redacted = browser_webview_log_url(
        "https://user:secret@example.com/articles/1?token=abc&private=true#read",
    );

    assert_eq!(redacted, "https://example.com/articles/1");
    assert!(!redacted.contains("user"));
    assert!(!redacted.contains("secret"));
    assert!(!redacted.contains("token"));
    assert!(!redacted.contains("read"));
}

#[test]
fn browser_webview_log_url_does_not_log_malformed_input() {
    assert_eq!(browser_webview_log_url("https://\u{7f}"), "<invalid-url>");
}

#[test]
fn physical_bounds_rect_preserves_physical_geometry() {
    let bounds = validated_bounds(BrowserWebviewBounds {
        x: 460.0,
        y: 84.0,
        width: 1767.0,
        height: 948.0,
        unit: BrowserWebviewBoundsUnit::Physical,
    })
    .expect("valid bounds should pass");
    let rect = bounds.rect();

    assert_eq!(rect.position.to_physical::<i32>(1.0).x, 460);
    assert_eq!(rect.position.to_physical::<i32>(1.0).y, 84);
    assert_eq!(rect.size.to_physical::<u32>(1.0).width, 1767);
    assert_eq!(rect.size.to_physical::<u32>(1.0).height, 948);
}

#[test]
fn physical_bounds_validation_rejects_dimensions_that_round_to_zero_pixels() {
    for (label, width, height) in [
        ("width rounds to zero", 0.49, 720.0),
        ("height rounds to zero", 900.0, 0.49),
    ] {
        let bounds = BrowserWebviewBounds {
            x: 460.0,
            y: 84.0,
            width,
            height,
            unit: BrowserWebviewBoundsUnit::Physical,
        };

        match validated_bounds(bounds) {
            Err(AppError::UserVisible { message }) => {
                assert_eq!(message, INVALID_BROWSER_BOUNDS_ERROR, "{label}");
            }
            other => panic!(
                "expected physical bounds that round to 0px to be rejected for {label}, got {other:?}"
            ),
        }
    }
}

#[test]
fn physical_bounds_validation_accepts_small_dimensions_that_round_to_one_pixel() {
    let bounds = validated_bounds(BrowserWebviewBounds {
        x: 460.0,
        y: 84.0,
        width: 0.5,
        height: 0.5,
        unit: BrowserWebviewBoundsUnit::Physical,
    })
    .expect("physical bounds that round to at least 1px should pass");
    let rect = bounds.rect();

    assert_eq!(rect.size.to_physical::<u32>(1.0).width, 1);
    assert_eq!(rect.size.to_physical::<u32>(1.0).height, 1);
}

#[test]
fn windows_uses_placeholder_initial_url() {
    let initial_url =
        browser_webview_initial_url("https://example.com/article", PlatformKind::Windows)
            .expect("placeholder URL should parse");

    assert!(should_use_placeholder_browser_webview_url(
        PlatformKind::Windows
    ));
    assert!(is_placeholder_browser_webview_url(initial_url.as_str()));
}

#[test]
fn placeholder_navigation_uses_tracker_history_instead_of_native_history() {
    let native_availability = Some(BrowserNavigationAvailability {
        can_go_back: true,
        can_go_forward: false,
    });

    assert_eq!(
        tracker_navigation_availability(true, native_availability),
        None
    );
    assert_eq!(
        tracker_navigation_availability(false, native_availability),
        native_availability
    );
}

#[test]
fn placeholder_update_skips_navigation_when_target_is_already_tracked() {
    let snapshot = BrowserWebviewState {
        url: "https://example.com/article".to_string(),
        can_go_back: false,
        can_go_forward: false,
        is_loading: false,
        load_generation: 1,
    };

    assert!(!should_navigate_existing_browser_webview(
        "about:blank",
        "https://example.com/article",
        Some(&snapshot),
        PlatformKind::Windows,
    ));
    assert!(should_navigate_existing_browser_webview(
        "about:blank",
        "https://example.com/next",
        Some(&snapshot),
        PlatformKind::Windows,
    ));
    assert!(should_navigate_existing_browser_webview(
        "about:blank",
        "https://example.com/article",
        None,
        PlatformKind::Windows,
    ));
    assert!(should_navigate_existing_browser_webview(
        "about:blank",
        "https://example.com/article",
        Some(&snapshot),
        PlatformKind::Macos,
    ));
}

#[test]
fn placeholder_update_skips_navigation_when_current_url_is_already_target() {
    let snapshot = BrowserWebviewState {
        url: "https://example.com/article".to_string(),
        can_go_back: false,
        can_go_forward: false,
        is_loading: false,
        load_generation: 1,
    };

    assert!(!should_navigate_existing_browser_webview(
        "https://example.com/article",
        "https://example.com/article",
        Some(&snapshot),
        PlatformKind::Windows,
    ));
}

#[test]
fn placeholder_page_load_finish_is_not_accepted_for_target_navigation_state() {
    let loading = BrowserWebviewState {
        url: "https://example.com/article".to_string(),
        can_go_back: false,
        can_go_forward: false,
        is_loading: true,
        load_generation: 1,
    };

    assert!(!should_accept_page_load_finish(
        Some(&loading),
        "about:blank"
    ));
}

#[test]
fn non_windows_use_target_initial_url() {
    let initial_url =
        browser_webview_initial_url("https://example.com/article", PlatformKind::Macos)
            .expect("target URL should parse");

    assert_eq!(initial_url.as_str(), "https://example.com/article");
    assert!(!should_use_placeholder_browser_webview_url(
        PlatformKind::Macos
    ));
}
