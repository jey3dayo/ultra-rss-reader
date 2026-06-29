use serde::Deserialize;
use tauri::{
    webview::{PageLoadEvent, WebviewBuilder},
    Emitter, LogicalPosition, LogicalSize, Manager, PhysicalPosition, PhysicalSize, Position, Rect,
    Size, State, Url, WebviewUrl, Window,
};
use tokio::time::{sleep, Duration};

use crate::browser_webview::{
    browser_preview_initialization_script_from_prefs_result, browser_webview,
    browser_webview_diagnostics_enabled, emit_browser_webview_closed,
    emit_browser_webview_diagnostics, emit_browser_webview_fallback, emit_browser_webview_state,
    go_back, go_forward, install_escape_accelerator_bridge, load_browser_preview_prefs,
    navigation_availability, should_trigger_timeout_fallback, BrowserNavigationAvailability,
    BrowserWebviewDiagnosticsPayload, BrowserWebviewFallbackPayload, BrowserWebviewLogicalRect,
    BrowserWebviewState, BrowserWebviewTracker, BROWSER_WEBVIEW_LABEL,
};
use crate::commands::dto::AppError;
use crate::commands::AppState;
use crate::menu::MENU_ACTION_EVENT;
use crate::platform::PlatformKind;

const BROWSER_WEBVIEW_LOAD_TIMEOUT_MS: u64 = 10_000;
const MAX_BROWSER_WEBVIEW_BOUND_VALUE: f64 = i32::MAX as f64;
const BROWSER_WEBVIEW_DIAGNOSTICS_COORDINATE_BUCKET: f64 = 8.0;
const BROWSER_WEBVIEW_DIAGNOSTICS_MAX_RECT_VALUE: f64 = 10_000.0;
const OPAQUE_BROWSER_WEBVIEW_PATH_SEGMENT_MIN_LEN: usize = 24;
const INVALID_BROWSER_BOUNDS_ERROR: &str =
    "Embedded browser bounds must be finite, within supported coordinate limits, and have positive width/height";
const BROWSER_WEBVIEW_NOT_OPEN_ERROR: &str = "Embedded browser webview is not open";
const BROWSER_WEBVIEW_EMPTY_RELOAD_SOURCE_ERROR: &str =
    "Embedded browser webview has no current URL to reload";
const BROWSER_WEBVIEW_SHORTCUT_NAVIGATION_SCHEME: &str = "ultra-rss-browser-shortcut";
const BROWSER_WEBVIEW_CLOSE_SHORTCUT_NAVIGATION_HOST: &str = "close-browser";

#[cfg_attr(test, derive(Debug, PartialEq, Eq))]
enum BrowserWebviewTimeoutFallbackEmission {
    ClearTracker,
    Fallback,
    Closed,
}

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
    /// Bounds captured from the main webview viewport coordinate space.
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
            || self.x.abs() > MAX_BROWSER_WEBVIEW_BOUND_VALUE
            || self.y.abs() > MAX_BROWSER_WEBVIEW_BOUND_VALUE
            || self.width > MAX_BROWSER_WEBVIEW_BOUND_VALUE
            || self.height > MAX_BROWSER_WEBVIEW_BOUND_VALUE
        {
            return Err(browser_webview_error(INVALID_BROWSER_BOUNDS_ERROR));
        }

        if self.unit == BrowserWebviewBoundsUnit::Physical
            && (self.width.round() < 1.0 || self.height.round() < 1.0)
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

fn empty_reload_source_error() -> AppError {
    browser_webview_error(BROWSER_WEBVIEW_EMPTY_RELOAD_SOURCE_ERROR)
}

fn validate_browser_webview_fallback_url(fallback_url: String) -> Result<String, AppError> {
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

fn validated_bounds(bounds: BrowserWebviewBounds) -> Result<BrowserWebviewBounds, AppError> {
    bounds.validated()
}

fn child_webview_rect_from_browser_bounds(bounds: BrowserWebviewBounds) -> Rect {
    // Child webviews use the main webview viewport coordinate space.
    // Do not add native title bar or menu insets here.
    bounds.rect()
}

fn normalized_scale_factor(scale_factor: f64) -> f64 {
    if scale_factor.is_finite() && scale_factor > 0.0 {
        scale_factor
    } else {
        1.0
    }
}

fn is_uuid_like_browser_webview_path_segment(segment: &str) -> bool {
    let bytes = segment.as_bytes();
    if bytes.len() != 36 {
        return false;
    }

    bytes.iter().enumerate().all(|(index, byte)| match index {
        8 | 13 | 18 | 23 => *byte == b'-',
        _ => byte.is_ascii_hexdigit(),
    })
}

fn is_opaque_browser_webview_path_segment(segment: &str) -> bool {
    segment.len() >= OPAQUE_BROWSER_WEBVIEW_PATH_SEGMENT_MIN_LEN
        && segment.bytes().all(|byte| {
            byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~' | b'=')
        })
        && segment.bytes().any(|byte| byte.is_ascii_alphabetic())
        && segment.bytes().any(|byte| byte.is_ascii_digit())
}

fn is_sensitive_browser_webview_path_segment(segment: &str) -> bool {
    let normalized = segment.to_ascii_lowercase();
    normalized.contains("token")
        || normalized.contains("secret")
        || normalized.contains("password")
        || normalized.contains("credential")
        || normalized.contains("private-key")
        || normalized.contains("private_key")
        || normalized.contains("apikey")
        || normalized.contains("api-key")
        || normalized.contains("api_key")
        || normalized.contains("signature")
        || normalized.contains("signed")
        || is_uuid_like_browser_webview_path_segment(segment)
        || is_opaque_browser_webview_path_segment(segment)
}

fn child_webview_add_child_bounds(
    bounds: BrowserWebviewBounds,
    scale_factor: f64,
) -> (LogicalPosition<f64>, LogicalSize<f64>) {
    let rect = child_webview_rect_from_browser_bounds(bounds);
    let scale_factor = normalized_scale_factor(scale_factor);

    (
        rect.position.to_logical::<f64>(scale_factor),
        rect.size.to_logical::<f64>(scale_factor),
    )
}

fn browser_webview_log_url(url: &str) -> String {
    match Url::parse(url) {
        Ok(mut parsed) => {
            let _ = parsed.set_username("");
            let _ = parsed.set_password(None);
            if parsed.path_segments().is_some_and(|segments| {
                segments
                    .into_iter()
                    .any(is_sensitive_browser_webview_path_segment)
            }) {
                parsed.set_path("/redacted");
            }
            parsed.set_query(None);
            parsed.set_fragment(None);
            parsed.to_string()
        }
        Err(_) => "<invalid-url>".to_string(),
    }
}

fn browser_webview_diagnostics_number(value: f64) -> f64 {
    let bucketed = (value / BROWSER_WEBVIEW_DIAGNOSTICS_COORDINATE_BUCKET).round()
        * BROWSER_WEBVIEW_DIAGNOSTICS_COORDINATE_BUCKET;
    bucketed.clamp(
        -BROWSER_WEBVIEW_DIAGNOSTICS_MAX_RECT_VALUE,
        BROWSER_WEBVIEW_DIAGNOSTICS_MAX_RECT_VALUE,
    )
}

fn browser_webview_diagnostics_rect(
    position: LogicalPosition<f64>,
    size: LogicalSize<f64>,
) -> BrowserWebviewLogicalRect {
    BrowserWebviewLogicalRect {
        x: browser_webview_diagnostics_number(position.x),
        y: browser_webview_diagnostics_number(position.y),
        width: browser_webview_diagnostics_number(size.width),
        height: browser_webview_diagnostics_number(size.height),
    }
}

fn browser_webview_bounds_diagnostics_payload(
    action: &str,
    bounds: BrowserWebviewBounds,
    rect: &Rect,
    scale_factor: f64,
    native_webview_bounds: Option<BrowserWebviewLogicalRect>,
) -> Option<BrowserWebviewDiagnosticsPayload> {
    if !browser_webview_diagnostics_enabled() {
        return None;
    }

    let applied_position = rect.position.to_logical::<f64>(scale_factor);
    let applied_size = rect.size.to_logical::<f64>(scale_factor);
    Some(BrowserWebviewDiagnosticsPayload {
        action: action.to_string(),
        requested_logical: browser_webview_diagnostics_rect(
            bounds.logical_position(),
            bounds.logical_size(),
        ),
        applied_logical: browser_webview_diagnostics_rect(applied_position, applied_size),
        scale_factor,
        native_webview_bounds: native_webview_bounds.map(|bounds| {
            browser_webview_diagnostics_rect(
                LogicalPosition::new(bounds.x, bounds.y),
                LogicalSize::new(bounds.width, bounds.height),
            )
        }),
    })
}

fn log_browser_webview_bounds(
    window: &Window,
    action: &str,
    bounds: BrowserWebviewBounds,
    rect: &Rect,
) {
    let scale_factor = window.scale_factor().unwrap_or(1.0);
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
    let Some(payload) = browser_webview_bounds_diagnostics_payload(
        action,
        bounds,
        rect,
        scale_factor,
        native_webview_bounds,
    ) else {
        return;
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

fn browser_host_focus_failure_warning(phase: &str, error: &impl std::fmt::Display) -> String {
    format!(
        "Failed to restore focus to browser host window {phase} closing embedded browser; continuing close flow: {error}"
    )
}

fn is_browser_webview_close_shortcut_navigation(target_url: &Url) -> bool {
    target_url.scheme() == BROWSER_WEBVIEW_SHORTCUT_NAVIGATION_SCHEME
        && target_url.host_str() == Some(BROWSER_WEBVIEW_CLOSE_SHORTCUT_NAVIGATION_HOST)
}

fn handle_browser_webview_shortcut_navigation(window: &Window, target_url: &Url) -> bool {
    if !is_browser_webview_close_shortcut_navigation(target_url) {
        return false;
    }

    if let Err(error) = focus_browser_host_window(window) {
        tracing::warn!("{}", browser_host_focus_failure_warning("before", &error));
    }
    let _ = window.app_handle().emit(MENU_ACTION_EVENT, "close-browser");
    true
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

fn finish_browser_webview_timeout(
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

fn timeout_fallback_emissions(
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

fn navigation_failure_emissions(
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

fn should_accept_page_load_finish(
    snapshot: Option<&BrowserWebviewState>,
    finished_url: &str,
) -> bool {
    snapshot.is_some_and(|state| state.is_loading && state.url == finished_url)
}

fn external_url(url: &str) -> Result<Url, AppError> {
    crate::commands::parse_browser_http_url(url)
}

fn tracker_start(
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

fn should_use_placeholder_browser_webview_url(platform_kind: PlatformKind) -> bool {
    matches!(platform_kind, PlatformKind::Windows)
}

fn is_placeholder_browser_webview_url(url: &str) -> bool {
    url == "about:blank"
}

fn should_navigate_existing_browser_webview(
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
    let navigation_window = window.clone();
    let navigation_app_handle = app_handle.clone();
    let page_load_app_handle = app_handle.clone();
    let initialization_script = browser_preview_initialization_script_from_prefs_result(
        load_browser_preview_prefs(&app_handle),
    );

    let builder = WebviewBuilder::new(BROWSER_WEBVIEW_LABEL, WebviewUrl::External(initial_url))
        .on_navigation(move |target_url| {
            if handle_browser_webview_shortcut_navigation(&navigation_window, target_url) {
                return false;
            }
            if uses_placeholder_url && is_placeholder_browser_webview_url(target_url.as_str()) {
                return true;
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

#[cfg(test)]
mod tests {
    use super::{
        browser_host_focus_failure_warning, browser_webview_bounds_diagnostics_payload,
        browser_webview_initial_url, browser_webview_log_url, browser_webview_not_open_error,
        child_webview_add_child_bounds, child_webview_rect_from_browser_bounds,
        empty_reload_source_error, external_url, finish_browser_webview_timeout,
        is_placeholder_browser_webview_url, navigation_failure_emissions,
        should_accept_page_load_finish, should_navigate_existing_browser_webview,
        should_use_placeholder_browser_webview_url, timeout_fallback_emissions,
        tracker_navigation_availability, validate_browser_webview_fallback_url, validated_bounds,
        BrowserNavigationAvailability, BrowserWebviewBounds, BrowserWebviewBoundsUnit,
        BrowserWebviewTimeoutFallbackEmission, BROWSER_WEBVIEW_EMPTY_RELOAD_SOURCE_ERROR,
        BROWSER_WEBVIEW_NOT_OPEN_ERROR, INVALID_BROWSER_BOUNDS_ERROR,
    };
    use crate::browser_webview::{
        set_browser_webview_diagnostics_enabled, BrowserWebviewLogicalRect, BrowserWebviewState,
        BrowserWebviewTracker, BROWSER_WEBVIEW_DIAGNOSTICS_TEST_LOCK,
    };
    use crate::commands::dto::AppError;
    use crate::platform::PlatformKind;
    use tauri::Url;

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
    fn browser_webview_shortcut_navigation_accepts_only_close_shortcut_url() {
        let close_url = Url::parse("ultra-rss-browser-shortcut://close-browser")
            .expect("shortcut URL should parse");
        let other_host = Url::parse("ultra-rss-browser-shortcut://reload-webview")
            .expect("shortcut URL should parse");
        let other_scheme = Url::parse("https://close-browser").expect("https URL should parse");

        assert!(super::is_browser_webview_close_shortcut_navigation(
            &close_url
        ));
        assert!(!super::is_browser_webview_close_shortcut_navigation(
            &other_host
        ));
        assert!(!super::is_browser_webview_close_shortcut_navigation(
            &other_scheme
        ));
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

        let payload =
            browser_webview_bounds_diagnostics_payload("resize", bounds, &rect, 2.0, None);

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
}
