use tauri::{
    webview::PageLoadEvent, Manager, State, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
    Window, WindowEvent,
};

use crate::browser_webview::{
    browser_window, emit_browser_webview_closed, emit_browser_webview_state, go_back, go_forward,
    navigation_availability, BrowserWebviewState, BROWSER_WINDOW_LABEL,
};
use crate::commands::dto::AppError;
use crate::commands::AppState;

fn browser_webview_error(message: impl Into<String>) -> AppError {
    AppError::UserVisible {
        message: message.into(),
    }
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

fn show_and_focus_browser_window(browser_window: &WebviewWindow) -> Result<(), AppError> {
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

    browser_window.set_focus().map_err(|error| {
        browser_webview_error(format!("Failed to focus browser window: {error}"))
    })?;
    Ok(())
}

fn create_browser_window(
    window: &Window,
    state: &AppState,
    url: String,
) -> Result<BrowserWebviewState, AppError> {
    let app_handle = window.app_handle().clone();
    let navigation_app_handle = app_handle.clone();
    let page_load_app_handle = app_handle.clone();
    let close_app_handle = app_handle.clone();

    let browser_window = WebviewWindowBuilder::new(
        &app_handle,
        BROWSER_WINDOW_LABEL,
        WebviewUrl::External(external_url(&url)?),
    )
    .title("Article Browser")
    .inner_size(1200.0, 860.0)
    .on_navigation(move |target_url| {
        let app_state = navigation_app_handle.state::<AppState>();
        if let Ok(mut tracker) = app_state.browser_webview.lock() {
            let next_state = tracker.start(target_url.to_string());
            emit_browser_webview_state(&navigation_app_handle, &next_state);
        }
        true
    })
    .on_page_load(move |browser_window, payload| {
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
    })
    .build()
    .map_err(|error| browser_webview_error(format!("Failed to create browser window: {error}")))?;

    browser_window.on_window_event(move |event| {
        if matches!(
            event,
            WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed
        ) {
            notify_browser_window_closed(&close_app_handle);
        }
    });

    show_and_focus_browser_window(&browser_window)?;

    let result = tracker_start(state, &app_handle, url);
    if result.is_err() {
        let _ = browser_window.destroy();
    }
    result
}

#[tauri::command]
pub fn create_or_update_browser_webview(
    window: Window,
    state: State<'_, AppState>,
    url: String,
) -> Result<BrowserWebviewState, AppError> {
    crate::commands::parse_browser_http_url(&url)?;
    let app_handle = window.app_handle();

    if let Some(browser_window) = browser_window(app_handle) {
        show_and_focus_browser_window(&browser_window)?;
        let current_url = browser_window
            .url()
            .map_err(|error| browser_webview_error(format!("Failed to read browser URL: {error}")))?
            .to_string();

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
    use super::external_url;

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
