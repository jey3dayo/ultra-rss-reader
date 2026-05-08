use serde::Deserialize;
use tauri::{
    webview::{PageLoadEvent, WebviewBuilder},
    LogicalPosition, LogicalSize, Manager, PhysicalPosition, PhysicalSize, Position, Rect, Size,
    State, Url, WebviewUrl, Window,
};
use tokio::time::{sleep, Duration};

use crate::browser_webview::{
    browser_preview_initialization_script, browser_webview, browser_webview_diagnostics_enabled,
    emit_browser_webview_closed, emit_browser_webview_diagnostics, emit_browser_webview_fallback,
    emit_browser_webview_state, go_back, go_forward, install_escape_accelerator_bridge,
    load_browser_preview_prefs, navigation_availability, should_trigger_timeout_fallback,
    BrowserNavigationAvailability, BrowserWebviewDiagnosticsPayload, BrowserWebviewFallbackPayload,
    BrowserWebviewLogicalRect, BrowserWebviewState, BROWSER_WEBVIEW_LABEL,
};
use crate::commands::dto::AppError;
use crate::commands::AppState;
use crate::platform::PlatformKind;

const BROWSER_WEBVIEW_LOAD_TIMEOUT_MS: u64 = 10_000;
const INVALID_BROWSER_BOUNDS_ERROR: &str =
    "Embedded browser bounds must be finite and have positive width/height";
const BROWSER_WEBVIEW_NOT_OPEN_ERROR: &str = "Embedded browser webview is not open";

#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum BrowserWebviewBoundsUnit {
    #[default]
    Logical,
    Physical,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserWebviewBounds {
    /// Bounds captured from the browser overlay client root.
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    #[serde(default)]
    unit: BrowserWebviewBoundsUnit,
}

impl BrowserWebviewBounds {
    fn validated(self) -> Result<Self, AppError> {
        if !self.x.is_finite()
            || !self.y.is_finite()
            || !self.width.is_finite()
            || !self.height.is_finite()
            || self.width <= 0.0
            || self.height <= 0.0
        {
            return Err(browser_webview_error(INVALID_BROWSER_BOUNDS_ERROR));
        }

        Ok(self)
    }

    fn logical_position(self) -> LogicalPosition<f64> {
        LogicalPosition::new(self.x, self.y)
    }

    fn logical_size(self) -> LogicalSize<f64> {
        LogicalSize::new(self.width, self.height)
    }

    fn physical_position(self) -> PhysicalPosition<i32> {
        PhysicalPosition::new(self.x.round() as i32, self.y.round() as i32)
    }

    fn physical_size(self) -> PhysicalSize<u32> {
        PhysicalSize::new(self.width.round() as u32, self.height.round() as u32)
    }

    fn rect(self) -> Rect {
        match self.unit {
            BrowserWebviewBoundsUnit::Logical => Rect {
                position: Position::Logical(self.logical_position()),
                size: Size::Logical(self.logical_size()),
            },
            BrowserWebviewBoundsUnit::Physical => Rect {
                position: Position::Physical(self.physical_position()),
                size: Size::Physical(self.physical_size()),
            },
        }
    }
}

fn browser_webview_error(message: impl Into<String>) -> AppError {
    AppError::UserVisible {
        message: message.into(),
    }
}

fn browser_webview_not_open_error() -> AppError {
    browser_webview_error(BROWSER_WEBVIEW_NOT_OPEN_ERROR)
}

fn validated_bounds(bounds: BrowserWebviewBounds) -> Result<BrowserWebviewBounds, AppError> {
    bounds.validated()
}

fn child_webview_rect_from_browser_bounds(bounds: BrowserWebviewBounds) -> Rect {
    // Child webviews use the browser overlay client root coordinate space.
    // Do not add native title bar or menu insets here.
    bounds.rect()
}

fn log_browser_webview_bounds(
    window: &Window,
    action: &str,
    bounds: BrowserWebviewBounds,
    rect: &Rect,
) {
    if !browser_webview_diagnostics_enabled() {
        return;
    }

    let scale_factor = window.scale_factor().unwrap_or(1.0);
    let applied_position = rect.position.to_logical::<f64>(scale_factor);
    let applied_size = rect.size.to_logical::<f64>(scale_factor);
    let native_webview_bounds = browser_webview(window).and_then(|browser_webview| {
        browser_webview.bounds().ok().map(|bounds| {
            let position = bounds.position.to_logical::<f64>(scale_factor);
            let size = bounds.size.to_logical::<f64>(scale_factor);
            BrowserWebviewLogicalRect {
                x: position.x,
                y: position.y,
                width: size.width,
                height: size.height,
            }
        })
    });
    let payload = BrowserWebviewDiagnosticsPayload {
        action: action.to_string(),
        requested_logical: BrowserWebviewLogicalRect {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
        },
        applied_logical: BrowserWebviewLogicalRect {
            x: applied_position.x,
            y: applied_position.y,
            width: applied_size.width,
            height: applied_size.height,
        },
        scale_factor,
        native_webview_bounds,
    };
    tracing::warn!(
        "embedded-browser diagnostics action={} requested=({},{} {}x{}) applied=({},{} {}x{}) native_webview={:?} scale_factor={}",
        payload.action,
        payload.requested_logical.x,
        payload.requested_logical.y,
        payload.requested_logical.width,
        payload.requested_logical.height,
        payload.applied_logical.x,
        payload.applied_logical.y,
        payload.applied_logical.width,
        payload.applied_logical.height,
        payload.native_webview_bounds,
        payload.scale_factor,
    );
    emit_browser_webview_diagnostics(window.app_handle(), &payload);
}

fn clear_browser_webview_tracker(state: &AppState) -> Result<bool, AppError> {
    let mut tracker = state.browser_webview.lock().map_err(|error| {
        browser_webview_error(format!("Browser webview state lock error: {error}"))
    })?;
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
        emit_browser_webview_closed(app_handle);
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

fn schedule_browser_webview_timeout(app_handle: tauri::AppHandle, url: String) {
    tauri::async_runtime::spawn(async move {
        tracing::info!("embedded-browser timeout armed url={url}");
        sleep(Duration::from_millis(BROWSER_WEBVIEW_LOAD_TIMEOUT_MS)).await;

        let should_fallback = {
            let app_state = app_handle.state::<AppState>();
            let decision = if let Ok(tracker) = app_state.browser_webview.lock() {
                should_trigger_timeout_fallback(tracker.snapshot().as_ref(), &url)
            } else {
                false
            };
            decision
        };

        if !should_fallback {
            tracing::info!("embedded-browser timeout skipped url={url}");
            return;
        }

        tracing::warn!("embedded-browser timeout triggered url={url}");

        let payload = BrowserWebviewFallbackPayload {
            url: url.clone(),
            opened_external: false,
            error_message: Some("Timed out waiting for the embedded browser to load.".to_string()),
        };

        if let Some(browser_webview) = browser_webview(&app_handle) {
            let _ = browser_webview.close();
        }

        let app_state = app_handle.state::<AppState>();
        let _ = clear_browser_webview_tracker(&app_state);
        emit_browser_webview_fallback(&app_handle, &payload);
    });
}

fn external_url(url: &str) -> Result<Url, AppError> {
    crate::commands::parse_browser_http_url(url)
}

fn tracker_start(
    state: &AppState,
    app_handle: &tauri::AppHandle,
    url: String,
) -> Result<BrowserWebviewState, AppError> {
    let next_state = state
        .browser_webview
        .lock()
        .map_err(|error| {
            browser_webview_error(format!("Browser webview state lock error: {error}"))
        })?
        .start(url);
    emit_browser_webview_state(app_handle, &next_state);
    schedule_browser_webview_timeout(app_handle.clone(), next_state.url.clone());
    Ok(next_state)
}

fn tracker_finish(
    state: &AppState,
    app_handle: &tauri::AppHandle,
    url: String,
    availability: Option<BrowserNavigationAvailability>,
) -> Result<BrowserWebviewState, AppError> {
    let mut tracker = state.browser_webview.lock().map_err(|error| {
        browser_webview_error(format!("Browser webview state lock error: {error}"))
    })?;
    let next_state = tracker.finish(url, availability);
    emit_browser_webview_state(app_handle, &next_state);
    Ok(next_state)
}

fn tracker_navigation_availability(
    uses_placeholder_url: bool,
    availability: Option<BrowserNavigationAvailability>,
) -> Option<BrowserNavigationAvailability> {
    if uses_placeholder_url {
        None
    } else {
        availability
    }
}

fn current_or_loading_state(
    state: &AppState,
    app_handle: &tauri::AppHandle,
    fallback_url: String,
) -> Result<BrowserWebviewState, AppError> {
    let snapshot = state
        .browser_webview
        .lock()
        .map_err(|error| {
            browser_webview_error(format!("Browser webview state lock error: {error}"))
        })?
        .snapshot();

    if let Some(snapshot) = snapshot {
        Ok(snapshot)
    } else {
        tracker_start(state, app_handle, fallback_url)
    }
}

fn should_use_placeholder_browser_webview_url(platform_kind: PlatformKind) -> bool {
    matches!(platform_kind, PlatformKind::Windows)
}

fn is_placeholder_browser_webview_url(url: &str) -> bool {
    url == "about:blank"
}

fn browser_webview_initial_url(
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

fn create_browser_webview(
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
    let navigation_app_handle = app_handle.clone();
    let page_load_app_handle = app_handle.clone();
    let initialization_script = load_browser_preview_prefs(&app_handle)
        .map_err(|error| {
            browser_webview_error(format!(
                "Failed to load embedded browser preferences: {error}"
            ))
        })
        .map(|prefs| browser_preview_initialization_script(&prefs))?;

    let builder = WebviewBuilder::new(BROWSER_WEBVIEW_LABEL, WebviewUrl::External(initial_url))
        .on_navigation(move |target_url| {
            if uses_placeholder_url && is_placeholder_browser_webview_url(target_url.as_str()) {
                return true;
            }
            let app_state = navigation_app_handle.state::<AppState>();
            if let Ok(mut tracker) = app_state.browser_webview.lock() {
                let next_state = tracker.start(target_url.to_string());
                emit_browser_webview_state(&navigation_app_handle, &next_state);
            }
            true
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

    let browser_webview = window
        .add_child(
            builder,
            rect.position.to_logical::<f64>(1.0),
            rect.size.to_logical::<f64>(1.0),
        )
        .map_err(|error| {
            browser_webview_error(format!(
                "Failed to create embedded browser webview: {error}"
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
            let _ = clear_browser_webview_tracker(state);
            let _ = browser_webview.close();
            return Err(browser_webview_error(format!(
                "Failed to navigate embedded browser webview after create: {error}"
            )));
        }
    }

    Ok(next_state)
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
        browser_webview.set_bounds(rect).map_err(|error| {
            browser_webview_error(format!("Failed to update embedded browser bounds: {error}"))
        })?;
        log_browser_webview_bounds(&window, "update", bounds, &rect);
        let current_url = browser_webview
            .url()
            .map_err(|error| browser_webview_error(format!("Failed to read browser URL: {error}")))?
            .to_string();

        if current_url != url {
            let next_state = tracker_start(state.inner(), app_handle, url.clone())?;
            if let Err(error) = browser_webview.navigate(external_url(&url)?) {
                let _ = clear_browser_webview_tracker(state.inner());
                return Err(browser_webview_error(format!(
                    "Failed to navigate embedded browser webview: {error}"
                )));
            }
            return Ok(next_state);
        }

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
            tracing::warn!(
                "Failed to restore focus to browser host window before closing embedded browser: {error}"
            );
        }
        browser_webview.close().map_err(|error| {
            browser_webview_error(format!("Failed to close embedded browser webview: {error}"))
        })?;
    }

    if let Err(error) = focus_browser_host_window(&window) {
        tracing::warn!("Failed to restore focus to browser host window after closing embedded browser: {error}");
    }

    emit_closed_if_tracked(window.app_handle(), state.inner())
}

#[cfg(test)]
mod tests {
    use super::{
        browser_webview_initial_url, browser_webview_not_open_error,
        child_webview_rect_from_browser_bounds, external_url, is_placeholder_browser_webview_url,
        should_use_placeholder_browser_webview_url, tracker_navigation_availability,
        validated_bounds, BrowserNavigationAvailability, BrowserWebviewBounds,
        BrowserWebviewBoundsUnit, BROWSER_WEBVIEW_NOT_OPEN_ERROR, INVALID_BROWSER_BOUNDS_ERROR,
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
    fn bounds_validation_rejects_invalid_geometry_values() {
        for (label, bounds) in [
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
    fn non_windows_use_target_initial_url() {
        let initial_url =
            browser_webview_initial_url("https://example.com/article", PlatformKind::Macos)
                .expect("target URL should parse");

        assert_eq!(initial_url.as_str(), "https://example.com/article");
        assert!(!should_use_placeholder_browser_webview_url(
            PlatformKind::Macos
        ));
    }
}
