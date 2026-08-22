//! Embedded browser child-webview lifecycle: building the `WebviewBuilder` (navigation
//! allow-list, new-window forwarding, page-load tracking), the Windows `about:blank`
//! placeholder navigation dance, and the load-timeout fallback that recovers from a page
//! that never fires its finish event.

use tauri::{
    webview::{NewWindowResponse, PageLoadEvent, WebviewBuilder},
    Manager, Url, WebviewUrl, Window,
};
use tokio::time::{sleep, Duration};

use crate::browser_webview::{
    browser_preview_initialization_script_from_prefs_result, emit_browser_webview_closed,
    emit_browser_webview_fallback, emit_browser_webview_state, install_escape_accelerator_bridge,
    is_supported_browser_preview_bridge_action, load_browser_preview_prefs,
    navigation_availability, should_trigger_timeout_fallback, BrowserNavigationAvailability,
    BrowserWebviewFallbackPayload, BrowserWebviewState, BrowserWebviewTracker,
};
use crate::commands::dto::AppError;
use crate::commands::AppState;
use crate::platform::PlatformKind;

use super::bounds::{
    child_webview_add_child_bounds, child_webview_rect_from_browser_bounds,
    log_browser_webview_bounds, BrowserWebviewBounds,
};
use super::privacy::browser_webview_log_url;
use super::{
    browser_webview_error, browser_webview_not_open_error, clear_browser_webview_tracker,
    validate_browser_webview_fallback_url,
};

const BROWSER_WEBVIEW_LOAD_TIMEOUT_MS: u64 = 10_000;
const BROWSER_WEBVIEW_SHORTCUT_NAVIGATION_SCHEME: &str = "ultra-rss-browser-shortcut";

#[cfg_attr(test, derive(Debug, PartialEq, Eq))]
pub(super) enum BrowserWebviewTimeoutFallbackEmission {
    ClearTracker,
    Fallback,
    Closed,
}

pub(super) fn browser_webview_shortcut_navigation_action(target_url: &Url) -> Option<String> {
    if target_url.scheme() != BROWSER_WEBVIEW_SHORTCUT_NAVIGATION_SCHEME {
        return None;
    }

    let host = target_url.host_str()?;
    is_supported_browser_preview_bridge_action(host).then(|| host.to_string())
}

/// Cancels navigation to the `ultra-rss-browser-shortcut://` scheme without dispatching an
/// app action. Origin page scripts can synthesize this URL themselves (it is injected as
/// plain, readable JS), so it must never be treated as an authenticated action source. See
/// `docs/feed-content-privacy.md`. Native key/mouse handling (macOS Escape monitor, Windows
/// `AcceleratorKeyPressed`) is the only remaining channel that emits `MENU_ACTION_EVENT` for
/// these actions.
fn handle_browser_webview_shortcut_navigation(_window: &Window, target_url: &Url) -> bool {
    browser_webview_shortcut_navigation_action(target_url).is_some()
}

fn schedule_browser_webview_timeout(
    app_handle: tauri::AppHandle,
    url: String,
    load_generation: u64,
) {
    tauri::async_runtime::spawn(async move {
        let log_url = browser_webview_log_url(&url);
        tracing::info!("embedded-browser timeout armed url={log_url} generation={load_generation}");
        sleep(Duration::from_millis(BROWSER_WEBVIEW_LOAD_TIMEOUT_MS)).await;

        let timeout_state = {
            let app_state = app_handle.state::<AppState>();
            let timeout_state = if let Ok(mut tracker) =
                crate::commands::lock_browser_webview(&app_state.browser_webview)
            {
                finish_browser_webview_timeout(&mut tracker, &url, load_generation)
            } else {
                None
            };
            timeout_state
        };

        let Some(timeout_state) = timeout_state else {
            tracing::info!(
                "embedded-browser timeout skipped url={log_url} generation={load_generation}"
            );
            return;
        };

        tracing::warn!(
            "embedded-browser timeout stopped loading indicator url={log_url} generation={load_generation}"
        );
        emit_browser_webview_state(&app_handle, &timeout_state);
    });
}

pub(super) fn finish_browser_webview_timeout(
    tracker: &mut BrowserWebviewTracker,
    expected_url: &str,
    expected_load_generation: u64,
) -> Option<BrowserWebviewState> {
    if !should_trigger_timeout_fallback(
        tracker.snapshot().as_ref(),
        expected_url,
        expected_load_generation,
    ) {
        return None;
    }

    Some(tracker.finish(expected_url.to_string(), None))
}

pub(super) fn timeout_fallback_emissions(
    should_fallback: bool,
    had_tracked_state: bool,
) -> Vec<BrowserWebviewTimeoutFallbackEmission> {
    if !should_fallback {
        return Vec::new();
    }

    let mut emissions = vec![
        BrowserWebviewTimeoutFallbackEmission::ClearTracker,
        BrowserWebviewTimeoutFallbackEmission::Fallback,
    ];
    if had_tracked_state {
        emissions.push(BrowserWebviewTimeoutFallbackEmission::Closed);
    }
    emissions
}

pub(super) fn navigation_failure_emissions(
    had_tracked_state: bool,
) -> Vec<BrowserWebviewTimeoutFallbackEmission> {
    timeout_fallback_emissions(true, had_tracked_state)
}

fn emit_browser_webview_navigation_failure<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
    state: &AppState,
    url: String,
    error_message: String,
) -> Result<(), AppError> {
    let had_tracked_state = clear_browser_webview_tracker(state)?;
    let payload = BrowserWebviewFallbackPayload {
        url,
        opened_external: false,
        error_message: Some(error_message),
    };
    for emission in navigation_failure_emissions(had_tracked_state) {
        match emission {
            BrowserWebviewTimeoutFallbackEmission::ClearTracker => {}
            BrowserWebviewTimeoutFallbackEmission::Fallback => {
                emit_browser_webview_fallback(app_handle, &payload);
            }
            BrowserWebviewTimeoutFallbackEmission::Closed => {
                emit_browser_webview_closed(app_handle);
            }
        }
    }
    Ok(())
}

pub(super) fn should_accept_page_load_finish(
    snapshot: Option<&BrowserWebviewState>,
    finished_url: &str,
) -> bool {
    snapshot.is_some_and(|state| state.is_loading && state.url == finished_url)
}

pub(super) fn external_url(url: &str) -> Result<Url, AppError> {
    crate::commands::parse_browser_http_url(url)
}

/// Navigation allow-list for the embedded Web Preview webview.
///
/// Callers must run `handle_browser_webview_shortcut_navigation` first and treat that
/// as fully handling shortcut-scheme (`ultra-rss-browser-shortcut://`) navigations; this
/// function is never consulted for those. Everything else is either the Windows
/// `about:blank` placeholder or a plain http(s) URL without embedded credentials.
/// Web Preview intentionally does not reject private/loopback/link-local hosts here —
/// see `docs/feed-content-privacy.md` (Web Preview navigation contract). That rejection is
/// exclusive to the Article Link Opener (`open_in_browser`'s public-host-only URL check).
pub(super) fn allow_browser_webview_navigation(
    target_url: &Url,
    uses_placeholder_url: bool,
) -> bool {
    if uses_placeholder_url && is_placeholder_browser_webview_url(target_url.as_str()) {
        return true;
    }

    matches!(target_url.scheme(), "http" | "https")
        && target_url.username().is_empty()
        && target_url.password().is_none()
}

// The embedded browser preview webview has no Tauri window/tab of its own to host a
// `target="_blank"` / `window.open()` request, so every new-window request is denied and
// forwarded to the OS default browser instead of silently doing nothing.
pub(super) fn open_new_window_request_in_external_browser(
    target_url: &Url,
) -> Result<(), AppError> {
    crate::commands::article_commands::open_in_browser(target_url.to_string(), Some(false))
}

pub(super) fn tracker_start(
    state: &AppState,
    app_handle: &tauri::AppHandle,
    url: String,
) -> Result<BrowserWebviewState, AppError> {
    let next_state = crate::commands::lock_browser_webview(&state.browser_webview)?.start(url);
    emit_browser_webview_state(app_handle, &next_state);
    schedule_browser_webview_timeout(
        app_handle.clone(),
        next_state.url.clone(),
        next_state.load_generation,
    );
    Ok(next_state)
}

fn tracker_finish(
    state: &AppState,
    app_handle: &tauri::AppHandle,
    url: String,
    availability: Option<BrowserNavigationAvailability>,
) -> Result<BrowserWebviewState, AppError> {
    let mut tracker = crate::commands::lock_browser_webview(&state.browser_webview)?;
    if !should_accept_page_load_finish(tracker.snapshot().as_ref(), &url) {
        return Err(browser_webview_not_open_error());
    }
    let next_state = tracker.finish(url, availability);
    emit_browser_webview_state(app_handle, &next_state);
    Ok(next_state)
}

pub(super) fn tracker_navigation_availability(
    uses_placeholder_url: bool,
    availability: Option<BrowserNavigationAvailability>,
) -> Option<BrowserNavigationAvailability> {
    if uses_placeholder_url {
        None
    } else {
        availability
    }
}

pub(super) fn current_or_loading_state(
    state: &AppState,
    app_handle: &tauri::AppHandle,
    fallback_url: String,
) -> Result<BrowserWebviewState, AppError> {
    let snapshot = crate::commands::lock_browser_webview(&state.browser_webview)?.snapshot();

    if let Some(snapshot) = snapshot {
        Ok(snapshot)
    } else {
        tracker_start(
            state,
            app_handle,
            validate_browser_webview_fallback_url(fallback_url)?,
        )
    }
}

pub(super) fn should_use_placeholder_browser_webview_url(platform_kind: PlatformKind) -> bool {
    matches!(platform_kind, PlatformKind::Windows)
}

pub(super) fn is_placeholder_browser_webview_url(url: &str) -> bool {
    url == "about:blank"
}

pub(super) fn should_navigate_existing_browser_webview(
    current_url: &str,
    target_url: &str,
    snapshot: Option<&BrowserWebviewState>,
    platform_kind: PlatformKind,
) -> bool {
    if should_use_placeholder_browser_webview_url(platform_kind)
        && is_placeholder_browser_webview_url(current_url)
        && snapshot.is_some_and(|state| state.url == target_url)
    {
        return false;
    }

    current_url != target_url
}

pub(super) fn browser_webview_initial_url(
    target_url: &str,
    platform_kind: PlatformKind,
) -> Result<Url, AppError> {
    if should_use_placeholder_browser_webview_url(platform_kind) {
        Url::parse("about:blank").map_err(|error| {
            browser_webview_error(format!("Failed to parse placeholder URL: {error}"))
        })
    } else {
        external_url(target_url)
    }
}

pub(super) fn create_browser_webview(
    window: &Window,
    state: &AppState,
    url: String,
    bounds: BrowserWebviewBounds,
) -> Result<BrowserWebviewState, AppError> {
    let rect = child_webview_rect_from_browser_bounds(bounds);
    let platform_kind = crate::platform::PlatformInfo::current().kind;
    let uses_placeholder_url = should_use_placeholder_browser_webview_url(platform_kind);
    let initial_url = browser_webview_initial_url(&url, platform_kind)?;
    let app_handle = window.app_handle().clone();
    let navigation_window = window.clone();
    let navigation_app_handle = app_handle.clone();
    let page_load_app_handle = app_handle.clone();
    let initialization_script = browser_preview_initialization_script_from_prefs_result(
        load_browser_preview_prefs(&app_handle),
    );

    let builder = WebviewBuilder::new(crate::browser_webview::BROWSER_WEBVIEW_LABEL, WebviewUrl::External(initial_url))
        .on_navigation(move |target_url| {
            if handle_browser_webview_shortcut_navigation(&navigation_window, target_url) {
                return false;
            }
            // Restore the pre-refactor early return: the Windows `about:blank` placeholder
            // must skip tracker_start entirely (no transient loading-state emit / timeout
            // arm), so it is checked before the allow/deny gate below.
            if uses_placeholder_url && is_placeholder_browser_webview_url(target_url.as_str()) {
                return true;
            }
            if !allow_browser_webview_navigation(target_url, uses_placeholder_url) {
                // Silent cancel: the webview stays open on its current page. Do not emit
                // `emit_browser_webview_navigation_failure` here — it closes the whole Web
                // Preview overlay (via emit_browser_webview_closed) and its fallback event is
                // dropped by the frontend's exact-match URL comparison anyway, so it would
                // both surprise the user and never actually reach them.
                tracing::warn!(
                    "Blocked embedded browser navigation to disallowed URL: {}",
                    crate::commands::redacted_browser_url_for_display(target_url.as_str())
                );
                return false;
            }
            let app_state = navigation_app_handle.state::<AppState>();
            if let Err(error) =
                tracker_start(&app_state, &navigation_app_handle, target_url.to_string())
            {
                tracing::warn!(
                    "Failed to start embedded browser navigation state on navigation: {error}"
                );
            }
            true
        })
        .on_new_window(|target_url, _features| {
            if let Err(error) = open_new_window_request_in_external_browser(&target_url) {
                tracing::warn!(
                    "Failed to open embedded browser preview new-window request in external browser: {error}"
                );
            }
            NewWindowResponse::Deny
        })
        .on_page_load(move |browser_webview, payload| {
            if uses_placeholder_url && is_placeholder_browser_webview_url(payload.url().as_str()) {
                return;
            }
            let app_state = page_load_app_handle.state::<AppState>();
            let result = match payload.event() {
                PageLoadEvent::Started => {
                    tracker_start(&app_state, &page_load_app_handle, payload.url().to_string())
                }
                PageLoadEvent::Finished => tracker_finish(
                    &app_state,
                    &page_load_app_handle,
                    payload.url().to_string(),
                    tracker_navigation_availability(
                        uses_placeholder_url,
                        navigation_availability(&browser_webview),
                    ),
                ),
            };
            if let Err(error) = result {
                tracing::warn!("Failed to update embedded browser state on page load: {error}");
            }
        });
    let builder = if let Some(script) = initialization_script {
        builder.initialization_script(script)
    } else {
        builder
    };

    let (add_child_position, add_child_size) =
        child_webview_add_child_bounds(bounds, window.scale_factor().unwrap_or(1.0));
    let browser_webview = window
        .add_child(builder, add_child_position, add_child_size)
        .map_err(|error| {
            browser_webview_error(format!(
                "Failed to create embedded browser webview: {error}"
            ))
        })?;
    browser_webview.set_auto_resize(true).map_err(|error| {
        let _ = browser_webview.close();
        browser_webview_error(format!(
            "Failed to enable embedded browser auto resize: {error}"
        ))
    })?;
    install_escape_accelerator_bridge(&browser_webview, &app_handle).map_err(|error| {
        let _ = browser_webview.close();
        browser_webview_error(format!(
            "Failed to install embedded browser Escape handling: {error}"
        ))
    })?;
    log_browser_webview_bounds(window, "create", bounds, &rect);

    let next_state = match tracker_start(state, &app_handle, url.clone()) {
        Ok(next_state) => next_state,
        Err(error) => {
            let _ = browser_webview.close();
            return Err(error);
        }
    };

    if uses_placeholder_url {
        if let Err(error) = browser_webview.navigate(external_url(&url)?) {
            let error_message =
                format!("Failed to navigate embedded browser webview after create: {error}");
            if let Err(emit_error) = emit_browser_webview_navigation_failure(
                &app_handle,
                state,
                url.clone(),
                error_message.clone(),
            ) {
                tracing::warn!(
                    "Failed to emit embedded browser navigation failure events: {emit_error}"
                );
            }
            let _ = browser_webview.close();
            return Err(browser_webview_error(error_message));
        }
    }

    Ok(next_state)
}
