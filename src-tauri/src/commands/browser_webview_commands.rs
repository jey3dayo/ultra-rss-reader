use serde::Deserialize;
use tauri::{
    webview::PageLoadEvent, Emitter, LogicalPosition, LogicalSize, Manager, State, Url,
    WebviewBuilder, WebviewUrl, Window,
};

use crate::browser_webview::{
    emit_browser_webview_state, go_back, go_forward, inline_browser_webview,
    navigation_availability, BrowserWebviewState, INLINE_BROWSER_WEBVIEW_LABEL,
};
use crate::commands::dto::AppError;
use crate::commands::AppState;

#[derive(Debug, Clone, Copy, Deserialize)]
pub struct BrowserWebviewBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

fn browser_webview_error(message: impl Into<String>) -> AppError {
    AppError::UserVisible {
        message: message.into(),
    }
}

fn external_url(url: &str) -> Result<Url, AppError> {
    url.parse()
        .map_err(|error| browser_webview_error(format!("Invalid browser URL: {error}")))
}

fn apply_bounds(webview: &tauri::Webview, bounds: BrowserWebviewBounds) -> Result<(), AppError> {
    webview
        .set_position(LogicalPosition::new(bounds.x.max(0.0), bounds.y.max(0.0)))
        .map_err(|error| {
            browser_webview_error(format!("Failed to position browser webview: {error}"))
        })?;
    webview
        .set_size(LogicalSize::new(
            bounds.width.max(0.0),
            bounds.height.max(0.0),
        ))
        .map_err(|error| {
            browser_webview_error(format!("Failed to resize browser webview: {error}"))
        })?;
    Ok(())
}

fn tracker_start(
    state: &AppState,
    window: &Window,
    url: String,
) -> Result<BrowserWebviewState, AppError> {
    let next_state = state
        .browser_webview
        .lock()
        .map_err(|error| {
            browser_webview_error(format!("Browser webview state lock error: {error}"))
        })?
        .start(url);
    emit_browser_webview_state(window, &next_state);
    Ok(next_state)
}

fn tracker_finish(
    state: &AppState,
    window: &Window,
    webview: &tauri::Webview,
    url: String,
) -> Result<BrowserWebviewState, AppError> {
    let mut tracker = state.browser_webview.lock().map_err(|error| {
        browser_webview_error(format!("Browser webview state lock error: {error}"))
    })?;
    let availability = navigation_availability(webview, &tracker);
    let next_state = tracker.finish(url, availability);
    emit_browser_webview_state(window, &next_state);
    Ok(next_state)
}

fn current_or_loading_state(
    state: &AppState,
    window: &Window,
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
        tracker_start(state, window, fallback_url)
    }
}

fn create_browser_webview(
    window: &Window,
    state: &AppState,
    url: String,
    bounds: BrowserWebviewBounds,
) -> Result<BrowserWebviewState, AppError> {
    let initial_state = tracker_start(state, window, url.clone())?;
    let external = external_url(&url)?;
    let navigation_window = window.clone();
    let page_load_window = window.clone();

    let builder = WebviewBuilder::new(
        INLINE_BROWSER_WEBVIEW_LABEL,
        WebviewUrl::External(external.clone()),
    )
    .on_navigation(move |target_url| {
        let app_state = navigation_window.app_handle().state::<AppState>();
        if let Ok(mut tracker) = app_state.browser_webview.lock() {
            let next_state = tracker.start(target_url.to_string());
            emit_browser_webview_state(&navigation_window, &next_state);
        }
        true
    })
    .on_page_load(move |webview, payload| {
        let app_state = page_load_window.app_handle().state::<AppState>();
        let next_state = {
            let Ok(mut tracker) = app_state.browser_webview.lock() else {
                return;
            };
            match payload.event() {
                PageLoadEvent::Started => tracker.start(payload.url().to_string()),
                PageLoadEvent::Finished => {
                    let availability = navigation_availability(&webview, &tracker);
                    tracker.finish(payload.url().to_string(), availability)
                }
            }
        };
        let _ = page_load_window.emit(
            crate::browser_webview::BROWSER_WEBVIEW_STATE_CHANGED_EVENT,
            next_state,
        );
    });

    window
        .add_child(
            builder,
            LogicalPosition::new(bounds.x.max(0.0), bounds.y.max(0.0)),
            LogicalSize::new(bounds.width.max(0.0), bounds.height.max(0.0)),
        )
        .map_err(|error| {
            browser_webview_error(format!("Failed to create browser webview: {error}"))
        })?;

    Ok(initial_state)
}

#[tauri::command]
pub fn create_or_update_browser_webview(
    window: Window,
    state: State<'_, AppState>,
    url: String,
    bounds: BrowserWebviewBounds,
) -> Result<BrowserWebviewState, AppError> {
    if let Some(webview) = inline_browser_webview(&window) {
        apply_bounds(&webview, bounds)?;
        let current_url = webview
            .url()
            .map_err(|error| browser_webview_error(format!("Failed to read browser URL: {error}")))?
            .to_string();

        if current_url != url {
            let next_state = tracker_start(&state, &window, url.clone())?;
            webview.navigate(external_url(&url)?).map_err(|error| {
                browser_webview_error(format!("Failed to navigate browser webview: {error}"))
            })?;
            return Ok(next_state);
        }

        return tracker_finish(&state, &window, &webview, current_url);
    }

    create_browser_webview(&window, &state, url, bounds)
}

#[tauri::command]
pub fn set_browser_webview_bounds(
    window: Window,
    bounds: BrowserWebviewBounds,
) -> Result<(), AppError> {
    if let Some(webview) = inline_browser_webview(&window) {
        apply_bounds(&webview, bounds)?;
    }
    Ok(())
}

#[tauri::command]
pub fn go_back_browser_webview(
    window: Window,
    state: State<'_, AppState>,
) -> Result<BrowserWebviewState, AppError> {
    let webview = inline_browser_webview(&window)
        .ok_or_else(|| browser_webview_error("Inline browser webview is not open"))?;
    let fallback_url = webview
        .url()
        .map(|url| url.to_string())
        .unwrap_or_else(|_| String::new());
    let next_state = current_or_loading_state(&state, &window, fallback_url)?;
    go_back(&webview)
        .map_err(|error| browser_webview_error(format!("Failed to navigate back: {error}")))?;
    Ok(next_state)
}

#[tauri::command]
pub fn go_forward_browser_webview(
    window: Window,
    state: State<'_, AppState>,
) -> Result<BrowserWebviewState, AppError> {
    let webview = inline_browser_webview(&window)
        .ok_or_else(|| browser_webview_error("Inline browser webview is not open"))?;
    let fallback_url = webview
        .url()
        .map(|url| url.to_string())
        .unwrap_or_else(|_| String::new());
    let next_state = current_or_loading_state(&state, &window, fallback_url)?;
    go_forward(&webview)
        .map_err(|error| browser_webview_error(format!("Failed to navigate forward: {error}")))?;
    Ok(next_state)
}

#[tauri::command]
pub fn reload_browser_webview(
    window: Window,
    state: State<'_, AppState>,
) -> Result<BrowserWebviewState, AppError> {
    let webview = inline_browser_webview(&window)
        .ok_or_else(|| browser_webview_error("Inline browser webview is not open"))?;
    let fallback_url = webview
        .url()
        .map(|url| url.to_string())
        .unwrap_or_else(|_| String::new());
    let next_state = current_or_loading_state(&state, &window, fallback_url)?;
    webview.reload().map_err(|error| {
        browser_webview_error(format!("Failed to reload browser webview: {error}"))
    })?;
    Ok(next_state)
}

#[tauri::command]
pub fn close_browser_webview(window: Window, state: State<'_, AppState>) -> Result<(), AppError> {
    if let Some(webview) = inline_browser_webview(&window) {
        webview.close().map_err(|error| {
            browser_webview_error(format!("Failed to close browser webview: {error}"))
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
