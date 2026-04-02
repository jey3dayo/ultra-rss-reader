use serde::Deserialize;
use tauri::{
    webview::{PageLoadEvent, WebviewBuilder},
    LogicalPosition, LogicalSize, Manager, Position, Rect, Size, State, Url, WebviewUrl, Window,
};
use tokio::time::{sleep, Duration};

use crate::browser_webview::{
    browser_webview, emit_browser_webview_closed, emit_browser_webview_fallback,
    emit_browser_webview_state, go_back, go_forward, navigation_availability,
    should_trigger_timeout_fallback, BrowserNavigationAvailability, BrowserWebviewFallbackPayload,
    BrowserWebviewState, BROWSER_WEBVIEW_LABEL,
};
use crate::commands::dto::AppError;
use crate::commands::AppState;
use crate::platform::PlatformKind;

const BROWSER_WEBVIEW_LOAD_TIMEOUT_MS: u64 = 10_000;
const INVALID_BROWSER_BOUNDS_ERROR: &str =
    "Embedded browser bounds must be finite and have positive width/height";

#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserWebviewBounds {
    /// Bounds captured from the app webview viewport in logical CSS pixels.
    x: f64,
    y: f64,
    width: f64,
    height: f64,
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

    fn rect(self) -> Rect {
        Rect {
            position: Position::Logical(self.logical_position()),
            size: Size::Logical(self.logical_size()),
        }
    }
}

fn browser_webview_error(message: impl Into<String>) -> AppError {
    AppError::UserVisible {
        message: message.into(),
    }
}

fn validated_bounds(bounds: BrowserWebviewBounds) -> Result<BrowserWebviewBounds, AppError> {
    bounds.validated()
}

fn child_webview_rect_from_viewport_bounds(bounds: BrowserWebviewBounds) -> Rect {
    // Child webviews use the same logical coordinate space as `window.inner_size()`.
    // Do not add native title bar or menu insets here.
    bounds.rect()
}

fn log_browser_webview_bounds(
    _window: &Window,
    _action: &str,
    _bounds: BrowserWebviewBounds,
    _rect: &Rect,
) {
}

fn clear_browser_webview_tracker(state: &AppState) -> Result<bool, AppError> {
    let mut tracker = state.browser_webview.lock().map_err(|error| {
        browser_webview_error(format!("Browser webview state lock error: {error}"))
    })?;
    let had_snapshot = tracker.snapshot().is_some();
    tracker.clear();
    Ok(had_snapshot)
}

fn emit_closed_if_tracked(app_handle: &tauri::AppHandle, state: &AppState) -> Result<(), AppError> {
    if clear_browser_webview_tracker(state)? {
        emit_browser_webview_closed(app_handle);
    }
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
    let rect = child_webview_rect_from_viewport_bounds(bounds);
    log_browser_webview_bounds(window, "create", bounds, &rect);
    let platform_kind = crate::platform::PlatformInfo::current().kind;
    let uses_placeholder_url = should_use_placeholder_browser_webview_url(platform_kind);
    let initial_url = browser_webview_initial_url(&url, platform_kind)?;
    let app_handle = window.app_handle().clone();
    let navigation_app_handle = app_handle.clone();
    let page_load_app_handle = app_handle.clone();

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
                    navigation_availability(&browser_webview),
                ),
            };
            if let Err(error) = result {
                tracing::warn!("Failed to update embedded browser state on page load: {error}");
            }
        });

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
        let rect = child_webview_rect_from_viewport_bounds(bounds);
        log_browser_webview_bounds(&window, "update", bounds, &rect);
        browser_webview.set_bounds(rect).map_err(|error| {
            browser_webview_error(format!("Failed to update embedded browser bounds: {error}"))
        })?;
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
pub fn set_browser_webview_bounds(
    window: Window,
    bounds: BrowserWebviewBounds,
) -> Result<(), AppError> {
    let bounds = validated_bounds(bounds)?;
    let browser_webview = browser_webview(&window)
        .ok_or_else(|| browser_webview_error("Embedded browser webview is not open"))?;
    let rect = child_webview_rect_from_viewport_bounds(bounds);
    log_browser_webview_bounds(&window, "resize", bounds, &rect);

    browser_webview.set_bounds(rect).map_err(|error| {
        browser_webview_error(format!("Failed to update embedded browser bounds: {error}"))
    })?;
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
        browser_webview.close().map_err(|error| {
            browser_webview_error(format!("Failed to close embedded browser webview: {error}"))
        })?;
    }

    emit_closed_if_tracked(window.app_handle(), state.inner())
}

#[cfg(test)]
mod tests {
    use super::{
        browser_webview_initial_url, child_webview_rect_from_viewport_bounds, external_url,
        is_placeholder_browser_webview_url, should_use_placeholder_browser_webview_url,
        validated_bounds, BrowserWebviewBounds, INVALID_BROWSER_BOUNDS_ERROR,
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
    fn bounds_validation_rejects_non_positive_dimensions() {
        let result = validated_bounds(BrowserWebviewBounds {
            x: 100.0,
            y: 48.0,
            width: 0.0,
            height: 720.0,
        });

        match result {
            Err(AppError::UserVisible { message }) => {
                assert_eq!(message, INVALID_BROWSER_BOUNDS_ERROR);
            }
            other => panic!("expected user-visible bounds error, got {other:?}"),
        }
    }

    #[test]
    fn bounds_validation_rejects_non_finite_values() {
        let result = validated_bounds(BrowserWebviewBounds {
            x: f64::NAN,
            y: 48.0,
            width: 900.0,
            height: 720.0,
        });

        assert!(matches!(result, Err(AppError::UserVisible { .. })));
    }

    #[test]
    fn bounds_rect_preserves_geometry() {
        let bounds = validated_bounds(BrowserWebviewBounds {
            x: 380.0,
            y: 48.0,
            width: 900.0,
            height: 720.0,
        })
        .expect("valid bounds should pass");
        let rect = bounds.rect();

        assert_eq!(rect.position.to_logical::<f64>(1.0).x, 380.0);
        assert_eq!(rect.position.to_logical::<f64>(1.0).y, 48.0);
        assert_eq!(rect.size.to_logical::<f64>(1.0).width, 900.0);
        assert_eq!(rect.size.to_logical::<f64>(1.0).height, 720.0);
    }

    #[test]
    fn child_webview_rect_uses_viewport_origin_unchanged() {
        let bounds = validated_bounds(BrowserWebviewBounds {
            x: 380.0,
            y: 48.0,
            width: 900.0,
            height: 720.0,
        })
        .expect("valid bounds should pass");

        let rect = child_webview_rect_from_viewport_bounds(bounds);

        assert_eq!(rect.position.to_logical::<f64>(1.0).x, 380.0);
        assert_eq!(rect.position.to_logical::<f64>(1.0).y, 48.0);
        assert_eq!(rect.size.to_logical::<f64>(1.0).width, 900.0);
        assert_eq!(rect.size.to_logical::<f64>(1.0).height, 720.0);
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
