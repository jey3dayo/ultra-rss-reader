use tauri::{Manager, State, Window};

use crate::browser_webview::{browser_webview, go_back, go_forward, BrowserWebviewState};
use crate::commands::dto::AppError;
use crate::commands::AppState;

mod bounds;
mod lifecycle;
mod privacy;
#[cfg(test)]
mod tests;

use bounds::{
    child_webview_rect_from_browser_bounds, log_browser_webview_bounds, validated_bounds,
    BrowserWebviewBounds,
};
use lifecycle::{
    create_browser_webview, current_or_loading_state, external_url,
    should_navigate_existing_browser_webview, tracker_start,
};

const BROWSER_WEBVIEW_NOT_OPEN_ERROR: &str = "Embedded browser webview is not open";
const BROWSER_WEBVIEW_EMPTY_RELOAD_SOURCE_ERROR: &str =
    "Embedded browser webview has no current URL to reload";

pub(super) fn browser_webview_error(message: impl Into<String>) -> AppError {
    AppError::UserVisible {
        message: message.into(),
    }
}

pub(super) fn browser_webview_not_open_error() -> AppError {
    browser_webview_error(BROWSER_WEBVIEW_NOT_OPEN_ERROR)
}

fn empty_reload_source_error() -> AppError {
    browser_webview_error(BROWSER_WEBVIEW_EMPTY_RELOAD_SOURCE_ERROR)
}

pub(super) fn validate_browser_webview_fallback_url(
    fallback_url: String,
) -> Result<String, AppError> {
    if fallback_url.trim().is_empty() {
        return Err(empty_reload_source_error());
    }

    if fallback_url.chars().any(char::is_control) {
        return Err(browser_webview_error(
            crate::commands::BROWSER_URL_SCHEME_ERROR,
        ));
    }

    crate::commands::parse_browser_http_url(&fallback_url)?;

    Ok(fallback_url)
}

pub(super) fn clear_browser_webview_tracker(state: &AppState) -> Result<bool, AppError> {
    let mut tracker = crate::commands::lock_browser_webview(&state.browser_webview)?;
    let had_snapshot = tracker.snapshot().is_some();
    tracker.clear();
    Ok(had_snapshot)
}

fn focus_existing_browser_webview(window: &Window) -> Result<(), AppError> {
    let browser_webview = browser_webview(window).ok_or_else(browser_webview_not_open_error)?;

    browser_webview.set_focus().map_err(|error| {
        browser_webview_error(format!("Failed to focus embedded browser webview: {error}"))
    })
}

fn emit_closed_if_tracked(app_handle: &tauri::AppHandle, state: &AppState) -> Result<(), AppError> {
    if clear_browser_webview_tracker(state)? {
        crate::browser_webview::emit_browser_webview_closed(app_handle);
    }
    Ok(())
}

#[cfg(windows)]
fn focus_browser_host_window(window: &Window) -> Result<(), AppError> {
    use windows::Win32::UI::{
        Input::KeyboardAndMouse::SetFocus,
        WindowsAndMessaging::{BringWindowToTop, SetForegroundWindow},
    };

    if let Some(webview) = window.app_handle().get_webview("main") {
        let _ = webview.set_focus();
    }

    let hwnd = window.hwnd().map_err(|error| {
        browser_webview_error(format!("Failed to get browser host HWND: {error}"))
    })?;
    unsafe {
        let _ = BringWindowToTop(hwnd);
        let _ = SetForegroundWindow(hwnd);
        SetFocus(Some(hwnd)).map_err(|error| {
            browser_webview_error(format!("Failed to refocus browser host window: {error}"))
        })?;
    }

    if let Some(webview) = window.app_handle().get_webview("main") {
        let _ = webview.set_focus();
    }
    Ok(())
}

#[cfg(not(windows))]
fn focus_browser_host_window(_window: &Window) -> Result<(), AppError> {
    Ok(())
}

fn browser_host_focus_failure_warning(phase: &str, error: &impl std::fmt::Display) -> String {
    format!(
        "Failed to restore focus to browser host window {phase} closing embedded browser; continuing close flow: {error}"
    )
}

#[tauri::command]
pub async fn create_or_update_browser_webview(
    window: Window,
    state: State<'_, AppState>,
    url: String,
    bounds: BrowserWebviewBounds,
) -> Result<BrowserWebviewState, AppError> {
    crate::commands::parse_browser_http_url(&url)?;
    let bounds = validated_bounds(bounds)?;
    let app_handle = window.app_handle();

    if let Some(browser_webview) = browser_webview(&window) {
        let rect = child_webview_rect_from_browser_bounds(bounds);
        let current_url = browser_webview
            .url()
            .map_err(|error| browser_webview_error(format!("Failed to read browser URL: {error}")))?
            .to_string();
        let snapshot = crate::commands::lock_browser_webview(&state.browser_webview)?.snapshot();

        if should_navigate_existing_browser_webview(
            &current_url,
            &url,
            snapshot.as_ref(),
            crate::platform::PlatformInfo::current().kind,
        ) {
            let next_state = tracker_start(state.inner(), app_handle, url.clone())?;
            if let Err(error) = browser_webview.navigate(external_url(&url)?) {
                let _ = clear_browser_webview_tracker(state.inner());
                return Err(browser_webview_error(format!(
                    "Failed to navigate embedded browser webview: {error}"
                )));
            }
            browser_webview.set_bounds(rect).map_err(|error| {
                browser_webview_error(format!("Failed to update embedded browser bounds: {error}"))
            })?;
            log_browser_webview_bounds(&window, "update", bounds, &rect);
            return Ok(next_state);
        }

        browser_webview.set_bounds(rect).map_err(|error| {
            browser_webview_error(format!("Failed to update embedded browser bounds: {error}"))
        })?;
        log_browser_webview_bounds(&window, "update", bounds, &rect);
        return current_or_loading_state(state.inner(), app_handle, current_url);
    }

    create_browser_webview(&window, state.inner(), url, bounds)
}

#[tauri::command]
pub fn focus_browser_webview(window: Window) -> Result<(), AppError> {
    focus_existing_browser_webview(&window)
}

#[tauri::command]
pub fn set_browser_webview_bounds(
    window: Window,
    bounds: BrowserWebviewBounds,
) -> Result<(), AppError> {
    let bounds = validated_bounds(bounds)?;
    let browser_webview = browser_webview(&window)
        .ok_or_else(|| browser_webview_error("Embedded browser webview is not open"))?;
    let rect = child_webview_rect_from_browser_bounds(bounds);

    browser_webview.set_bounds(rect).map_err(|error| {
        browser_webview_error(format!("Failed to update embedded browser bounds: {error}"))
    })?;
    log_browser_webview_bounds(&window, "resize", bounds, &rect);
    Ok(())
}

#[tauri::command]
pub fn go_back_browser_webview(
    window: Window,
    state: State<'_, AppState>,
) -> Result<BrowserWebviewState, AppError> {
    let app_handle = window.app_handle();
    let browser_webview = browser_webview(&window)
        .ok_or_else(|| browser_webview_error("Embedded browser webview is not open"))?;
    let fallback_url = browser_webview
        .url()
        .map(|url| url.to_string())
        .unwrap_or_else(|_| String::new());
    let next_state = current_or_loading_state(state.inner(), app_handle, fallback_url)?;
    if !next_state.can_go_back {
        return Ok(next_state);
    }
    go_back(&browser_webview)
        .map_err(|error| browser_webview_error(format!("Failed to navigate back: {error}")))?;
    Ok(next_state)
}

#[tauri::command]
pub fn go_forward_browser_webview(
    window: Window,
    state: State<'_, AppState>,
) -> Result<BrowserWebviewState, AppError> {
    let app_handle = window.app_handle();
    let browser_webview = browser_webview(&window)
        .ok_or_else(|| browser_webview_error("Embedded browser webview is not open"))?;
    let fallback_url = browser_webview
        .url()
        .map(|url| url.to_string())
        .unwrap_or_else(|_| String::new());
    let next_state = current_or_loading_state(state.inner(), app_handle, fallback_url)?;
    if !next_state.can_go_forward {
        return Ok(next_state);
    }
    go_forward(&browser_webview)
        .map_err(|error| browser_webview_error(format!("Failed to navigate forward: {error}")))?;
    Ok(next_state)
}

#[tauri::command]
pub fn reload_browser_webview(
    window: Window,
    state: State<'_, AppState>,
) -> Result<BrowserWebviewState, AppError> {
    let app_handle = window.app_handle();
    let browser_webview = browser_webview(&window)
        .ok_or_else(|| browser_webview_error("Embedded browser webview is not open"))?;
    let fallback_url = browser_webview
        .url()
        .map(|url| url.to_string())
        .unwrap_or_else(|_| String::new());
    let next_state = current_or_loading_state(state.inner(), app_handle, fallback_url)?;
    browser_webview.reload().map_err(|error| {
        browser_webview_error(format!(
            "Failed to reload embedded browser webview: {error}"
        ))
    })?;
    Ok(next_state)
}

#[tauri::command]
pub fn close_browser_webview(window: Window, state: State<'_, AppState>) -> Result<(), AppError> {
    if let Some(browser_webview) = browser_webview(&window) {
        if let Err(error) = focus_browser_host_window(&window) {
            tracing::warn!("{}", browser_host_focus_failure_warning("before", &error));
        }
        browser_webview.close().map_err(|error| {
            browser_webview_error(format!("Failed to close embedded browser webview: {error}"))
        })?;
    }

    if let Err(error) = focus_browser_host_window(&window) {
        tracing::warn!("{}", browser_host_focus_failure_warning("after", &error));
    }

    emit_closed_if_tracked(window.app_handle(), state.inner())
}
