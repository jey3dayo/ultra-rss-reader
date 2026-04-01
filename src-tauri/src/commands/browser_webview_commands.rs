use tauri::{
    webview::PageLoadEvent, Manager, State, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
    Window, WindowEvent,
};
use tokio::time::{sleep, Duration};

use crate::browser_webview::{
    browser_window, emit_browser_webview_closed, emit_browser_webview_fallback,
    emit_browser_webview_state, go_back, go_forward, navigation_availability,
    should_trigger_timeout_fallback, BrowserWebviewFallbackPayload, BrowserWebviewState,
    BROWSER_WINDOW_LABEL,
};
use crate::commands::dto::AppError;
use crate::commands::AppState;
use crate::platform::PlatformKind;

const BROWSER_WINDOW_LOAD_TIMEOUT_MS: u64 = 10_000;

fn browser_webview_error(message: impl Into<String>) -> AppError {
    AppError::UserVisible {
        message: message.into(),
    }
}

fn schedule_browser_window_timeout(app_handle: tauri::AppHandle, url: String) {
    tauri::async_runtime::spawn(async move {
        tracing::info!("browser-window timeout armed url={url}");
        sleep(Duration::from_millis(BROWSER_WINDOW_LOAD_TIMEOUT_MS)).await;

        let should_fallback = {
            let app_state = app_handle.state::<AppState>();
            let fallback = if let Ok(tracker) = app_state.browser_webview.lock() {
                should_trigger_timeout_fallback(tracker.snapshot().as_ref(), &url)
            } else {
                false
            };
            fallback
        };

        if !should_fallback {
            tracing::info!("browser-window timeout skipped url={url}");
            return;
        }

        tracing::warn!("browser-window timeout triggered url={url}");
        let fallback_result = open::that(&url).map_err(|error| error.to_string());
        let payload = match fallback_result {
            Ok(()) => BrowserWebviewFallbackPayload {
                url: url.clone(),
                opened_external: true,
                error_message: None,
            },
            Err(message) => BrowserWebviewFallbackPayload {
                url: url.clone(),
                opened_external: false,
                error_message: Some(format!("Failed to open browser: {message}")),
            },
        };

        tracing::warn!(
            "browser-window fallback result url={} opened_external={} error={:?}",
            payload.url,
            payload.opened_external,
            payload.error_message
        );
        if let Some(browser_window) = browser_window(&app_handle) {
            let _ = browser_window.destroy();
        }

        if let Ok(mut tracker) = app_handle.state::<AppState>().browser_webview.lock() {
            tracker.clear();
        }

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
    schedule_browser_window_timeout(app_handle.clone(), next_state.url.clone());
    Ok(next_state)
}

fn tracker_finish(
    state: &AppState,
    app_handle: &tauri::AppHandle,
    url: String,
    availability: Option<crate::browser_webview::BrowserNavigationAvailability>,
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

fn notify_browser_window_closed(app_handle: &tauri::AppHandle) {
    let should_emit = {
        let app_state = app_handle.state::<AppState>();
        let should_emit = if let Ok(mut tracker) = app_state.browser_webview.lock() {
            if tracker.snapshot().is_none() {
                false
            } else {
                tracker.clear();
                true
            }
        } else {
            false
        };
        should_emit
    };

    if should_emit {
        emit_browser_webview_closed(app_handle);
    }
}

fn should_focus_browser_window_on_create(platform_kind: PlatformKind) -> bool {
    !matches!(platform_kind, PlatformKind::Windows)
}

fn should_use_placeholder_browser_window_url(platform_kind: PlatformKind) -> bool {
    matches!(platform_kind, PlatformKind::Windows)
}

fn is_placeholder_browser_window_url(url: &str) -> bool {
    url == "about:blank"
}

fn browser_window_initial_url(
    target_url: &str,
    platform_kind: PlatformKind,
) -> Result<Url, AppError> {
    if should_use_placeholder_browser_window_url(platform_kind) {
        Url::parse("about:blank").map_err(|error| {
            browser_webview_error(format!("Failed to parse placeholder URL: {error}"))
        })
    } else {
        external_url(target_url)
    }
}

fn show_browser_window(browser_window: &WebviewWindow) -> Result<(), AppError> {
    let is_minimized = browser_window.is_minimized().map_err(|error| {
        browser_webview_error(format!("Failed to inspect browser window state: {error}"))
    })?;
    if is_minimized {
        browser_window.unminimize().map_err(|error| {
            browser_webview_error(format!("Failed to restore browser window: {error}"))
        })?;
    }

    let is_visible = browser_window.is_visible().map_err(|error| {
        browser_webview_error(format!(
            "Failed to inspect browser window visibility: {error}"
        ))
    })?;
    if !is_visible {
        browser_window.show().map_err(|error| {
            browser_webview_error(format!("Failed to show browser window: {error}"))
        })?;
    }
    Ok(())
}

fn focus_browser_window(browser_window: &WebviewWindow) -> Result<(), AppError> {
    browser_window.set_focus().map_err(|error| {
        browser_webview_error(format!("Failed to focus browser window: {error}"))
    })?;
    Ok(())
}

fn show_and_focus_browser_window(browser_window: &WebviewWindow) -> Result<(), AppError> {
    show_browser_window(browser_window)?;
    focus_browser_window(browser_window)
}

fn create_browser_window(
    window: &Window,
    state: &AppState,
    url: String,
) -> Result<BrowserWebviewState, AppError> {
    tracing::info!("browser-window create requested url={url}");
    let platform_kind = crate::platform::PlatformInfo::current().kind;
    let uses_placeholder_url = should_use_placeholder_browser_window_url(platform_kind);
    let initial_url = browser_window_initial_url(&url, platform_kind)?;
    let app_handle = window.app_handle().clone();
    let navigation_app_handle = app_handle.clone();
    let page_load_app_handle = app_handle.clone();
    let close_app_handle = app_handle.clone();

    let builder = WebviewWindowBuilder::new(
        &app_handle,
        BROWSER_WINDOW_LABEL,
        WebviewUrl::External(initial_url),
    )
    .title("Article Browser")
    .inner_size(1200.0, 860.0)
    .on_navigation(move |target_url| {
        if uses_placeholder_url && is_placeholder_browser_window_url(target_url.as_str()) {
            tracing::info!("browser-window ignoring placeholder navigation");
            return true;
        }
        tracing::info!("browser-window on_navigation url={target_url}");
        let app_state = navigation_app_handle.state::<AppState>();
        if let Ok(mut tracker) = app_state.browser_webview.lock() {
            let next_state = tracker.start(target_url.to_string());
            emit_browser_webview_state(&navigation_app_handle, &next_state);
        }
        true
    })
    .on_page_load(move |browser_window, payload| {
        if uses_placeholder_url && is_placeholder_browser_window_url(payload.url().as_str()) {
            tracing::info!(
                "browser-window ignoring placeholder page_load event={:?}",
                payload.event()
            );
            return;
        }
        tracing::info!(
            "browser-window on_page_load event={:?} url={}",
            payload.event(),
            payload.url()
        );
        let app_state = page_load_app_handle.state::<AppState>();
        let result = match payload.event() {
            PageLoadEvent::Started => {
                tracker_start(&app_state, &page_load_app_handle, payload.url().to_string())
            }
            PageLoadEvent::Finished => tracker_finish(
                &app_state,
                &page_load_app_handle,
                payload.url().to_string(),
                navigation_availability(&browser_window),
            ),
        };
        if let Err(error) = result {
            tracing::warn!("Failed to update browser webview state on page load: {error}");
        }
    });

    #[cfg(windows)]
    let builder = builder.focused(false);

    let browser_window = builder.build().map_err(|error| {
        browser_webview_error(format!("Failed to create browser window: {error}"))
    })?;
    tracing::info!("browser-window created url={url}");

    browser_window.on_window_event(move |event| {
        if matches!(
            event,
            WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed
        ) {
            notify_browser_window_closed(&close_app_handle);
        }
    });

    show_browser_window(&browser_window)?;
    if should_focus_browser_window_on_create(crate::platform::PlatformInfo::current().kind) {
        focus_browser_window(&browser_window)?;
    }
    tracing::info!("browser-window shown url={url}");

    let next_state = match tracker_start(state, &app_handle, url.clone()) {
        Ok(next_state) => next_state,
        Err(error) => {
            let _ = browser_window.destroy();
            return Err(error);
        }
    };

    if uses_placeholder_url {
        tracing::info!("browser-window navigating after create url={url}");
        if let Err(error) = browser_window.navigate(external_url(&url)?) {
            if let Ok(mut tracker) = state.browser_webview.lock() {
                tracker.clear();
            }
            let _ = browser_window.destroy();
            return Err(browser_webview_error(format!(
                "Failed to navigate browser window after create: {error}"
            )));
        }
    }

    Ok(next_state)
}

#[tauri::command]
pub fn create_or_update_browser_webview(
    window: Window,
    state: State<'_, AppState>,
    url: String,
) -> Result<BrowserWebviewState, AppError> {
    crate::commands::parse_browser_http_url(&url)?;
    tracing::info!("browser-window create_or_update requested url={url}");
    let app_handle = window.app_handle();

    if let Some(browser_window) = browser_window(app_handle) {
        show_and_focus_browser_window(&browser_window)?;
        let current_url = browser_window
            .url()
            .map_err(|error| browser_webview_error(format!("Failed to read browser URL: {error}")))?
            .to_string();
        tracing::info!("browser-window reuse current_url={current_url} requested_url={url}");

        if current_url != url {
            let next_state = tracker_start(state.inner(), app_handle, url.clone())?;
            if let Err(error) = browser_window.navigate(external_url(&url)?) {
                if let Ok(mut tracker) = state.browser_webview.lock() {
                    tracker.clear();
                }
                return Err(browser_webview_error(format!(
                    "Failed to navigate browser window: {error}"
                )));
            }
            return Ok(next_state);
        }

        return current_or_loading_state(state.inner(), app_handle, current_url);
    }

    create_browser_window(&window, state.inner(), url)
}

#[tauri::command]
pub fn go_back_browser_webview(
    window: Window,
    state: State<'_, AppState>,
) -> Result<BrowserWebviewState, AppError> {
    let app_handle = window.app_handle();
    let browser_window = browser_window(app_handle)
        .ok_or_else(|| browser_webview_error("Browser window is not open"))?;
    show_and_focus_browser_window(&browser_window)?;
    let fallback_url = browser_window
        .url()
        .map(|url| url.to_string())
        .unwrap_or_else(|_| String::new());
    let next_state = current_or_loading_state(state.inner(), app_handle, fallback_url)?;
    go_back(&browser_window)
        .map_err(|error| browser_webview_error(format!("Failed to navigate back: {error}")))?;
    Ok(next_state)
}

#[tauri::command]
pub fn go_forward_browser_webview(
    window: Window,
    state: State<'_, AppState>,
) -> Result<BrowserWebviewState, AppError> {
    let app_handle = window.app_handle();
    let browser_window = browser_window(app_handle)
        .ok_or_else(|| browser_webview_error("Browser window is not open"))?;
    show_and_focus_browser_window(&browser_window)?;
    let fallback_url = browser_window
        .url()
        .map(|url| url.to_string())
        .unwrap_or_else(|_| String::new());
    let next_state = current_or_loading_state(state.inner(), app_handle, fallback_url)?;
    go_forward(&browser_window)
        .map_err(|error| browser_webview_error(format!("Failed to navigate forward: {error}")))?;
    Ok(next_state)
}

#[tauri::command]
pub fn reload_browser_webview(
    window: Window,
    state: State<'_, AppState>,
) -> Result<BrowserWebviewState, AppError> {
    let app_handle = window.app_handle();
    let browser_window = browser_window(app_handle)
        .ok_or_else(|| browser_webview_error("Browser window is not open"))?;
    show_and_focus_browser_window(&browser_window)?;
    let fallback_url = browser_window
        .url()
        .map(|url| url.to_string())
        .unwrap_or_else(|_| String::new());
    let next_state = current_or_loading_state(state.inner(), app_handle, fallback_url)?;
    browser_window.reload().map_err(|error| {
        browser_webview_error(format!("Failed to reload browser window: {error}"))
    })?;
    Ok(next_state)
}

#[cfg(test)]
mod tests {
    use super::{
        browser_window_initial_url, external_url, is_placeholder_browser_window_url,
        should_focus_browser_window_on_create, should_use_placeholder_browser_window_url,
    };
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
    fn windows_does_not_focus_new_browser_window_immediately() {
        assert!(!should_focus_browser_window_on_create(
            PlatformKind::Windows
        ));
    }

    #[test]
    fn non_windows_focus_new_browser_window_immediately() {
        assert!(should_focus_browser_window_on_create(PlatformKind::Macos));
        assert!(should_focus_browser_window_on_create(PlatformKind::Linux));
        assert!(should_focus_browser_window_on_create(PlatformKind::Unknown));
    }

    #[test]
    fn windows_uses_placeholder_initial_url() {
        let initial_url =
            browser_window_initial_url("https://example.com/article", PlatformKind::Windows)
                .expect("placeholder URL should parse");

        assert!(should_use_placeholder_browser_window_url(
            PlatformKind::Windows
        ));
        assert!(is_placeholder_browser_window_url(initial_url.as_str()));
    }

    #[test]
    fn non_windows_use_target_initial_url() {
        let initial_url =
            browser_window_initial_url("https://example.com/article", PlatformKind::Macos)
                .expect("target URL should parse");

        assert_eq!(initial_url.as_str(), "https://example.com/article");
        assert!(!should_use_placeholder_browser_window_url(
            PlatformKind::Macos
        ));
    }
}

#[tauri::command]
pub fn close_browser_webview(window: Window, state: State<'_, AppState>) -> Result<(), AppError> {
    if let Some(browser_window) = browser_window(window.app_handle()) {
        browser_window.destroy().map_err(|error| {
            browser_webview_error(format!("Failed to destroy browser window: {error}"))
        })?;
    }

    state
        .browser_webview
        .lock()
        .map_err(|error| {
            browser_webview_error(format!("Browser webview state lock error: {error}"))
        })?
        .clear();
    Ok(())
}
