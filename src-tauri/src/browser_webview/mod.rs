use std::sync::atomic::{AtomicBool, Ordering};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime, Webview};

mod bridge;
mod escape_accelerator;
mod navigation;
mod prefs;
mod shortcuts;
#[cfg(test)]
mod tests;

// Re-exported at the flat `crate::browser_webview::*` path so
// `commands::browser_webview_commands` and other existing callers keep their contract
// unchanged after this module was split by responsibility.
pub(crate) use escape_accelerator::install_escape_accelerator_bridge;
pub(crate) use navigation::{go_back, go_forward, navigation_availability};
pub(crate) use prefs::{
    browser_preview_initialization_script_from_prefs_result,
    is_supported_browser_preview_bridge_action, load_browser_preview_prefs,
};

pub const BROWSER_WEBVIEW_LABEL: &str = "browser-webview";
pub const BROWSER_WEBVIEW_STATE_CHANGED_EVENT: &str = "browser-webview-state-changed";
pub const BROWSER_WEBVIEW_CLOSED_EVENT: &str = "browser-webview-closed";
pub const BROWSER_WEBVIEW_FALLBACK_EVENT: &str = "browser-webview-fallback";
pub const BROWSER_WEBVIEW_DIAGNOSTICS_EVENT: &str = "browser-webview-diagnostics";
pub const BROWSER_WEBVIEW_DEBUG_INPUT_EVENT: &str = "browser-webview-debug-input";
pub const BROWSER_WEBVIEW_EVENT_NAMES: &[&str] = &[
    BROWSER_WEBVIEW_STATE_CHANGED_EVENT,
    BROWSER_WEBVIEW_CLOSED_EVENT,
    BROWSER_WEBVIEW_FALLBACK_EVENT,
    BROWSER_WEBVIEW_DIAGNOSTICS_EVENT,
    BROWSER_WEBVIEW_DEBUG_INPUT_EVENT,
];

static BROWSER_WEBVIEW_DIAGNOSTICS_ENABLED: AtomicBool = AtomicBool::new(false);
#[cfg(test)]
pub(crate) static BROWSER_WEBVIEW_DIAGNOSTICS_TEST_LOCK: std::sync::Mutex<()> =
    std::sync::Mutex::new(());

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct BrowserWebviewState {
    pub url: String,
    pub can_go_back: bool,
    pub can_go_forward: bool,
    pub is_loading: bool,
    pub load_generation: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct BrowserWebviewFallbackPayload {
    pub url: String,
    pub opened_external: bool,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct BrowserWebviewDiagnosticsPayload {
    pub action: String,
    pub requested_logical: BrowserWebviewLogicalRect,
    pub applied_logical: BrowserWebviewLogicalRect,
    pub scale_factor: f64,
    pub native_webview_bounds: Option<BrowserWebviewLogicalRect>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct BrowserWebviewLogicalRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct BrowserNavigationAvailability {
    pub can_go_back: bool,
    pub can_go_forward: bool,
}

#[derive(Debug, Default)]
pub struct BrowserWebviewTracker {
    current: Option<BrowserWebviewState>,
    history: Vec<String>,
    history_index: usize,
    pending_navigation: PendingNavigation,
    load_generation: u64,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
enum PendingNavigation {
    #[default]
    None,
    New,
    Back,
    Forward,
    Reload,
}

impl BrowserWebviewTracker {
    fn flags_from_history(&self) -> BrowserNavigationAvailability {
        if self.history.is_empty() {
            return BrowserNavigationAvailability::default();
        }

        BrowserNavigationAvailability {
            can_go_back: self.history_index > 0,
            can_go_forward: self.history_index + 1 < self.history.len(),
        }
    }

    pub fn start(&mut self, url: String) -> BrowserWebviewState {
        self.load_generation = self.load_generation.saturating_add(1);
        if self.history.is_empty() {
            self.history.push(url.clone());
            self.history_index = 0;
            self.pending_navigation = PendingNavigation::Reload;
        } else if self.history_index > 0 && self.history[self.history_index - 1] == url {
            self.pending_navigation = PendingNavigation::Back;
        } else if self.history_index + 1 < self.history.len()
            && self.history[self.history_index + 1] == url
        {
            self.pending_navigation = PendingNavigation::Forward;
        } else if self.history[self.history_index] == url {
            self.pending_navigation = PendingNavigation::Reload;
        } else {
            self.pending_navigation = PendingNavigation::New;
        }

        let availability = self.flags_from_history();
        let state = BrowserWebviewState {
            url,
            can_go_back: availability.can_go_back,
            can_go_forward: availability.can_go_forward,
            is_loading: true,
            load_generation: self.load_generation,
        };
        self.current = Some(state.clone());
        state
    }

    pub fn finish(
        &mut self,
        url: String,
        availability: Option<BrowserNavigationAvailability>,
    ) -> BrowserWebviewState {
        match self.pending_navigation {
            PendingNavigation::None | PendingNavigation::Reload => {
                if self.history.is_empty() {
                    self.history.push(url.clone());
                    self.history_index = 0;
                } else {
                    self.history[self.history_index] = url.clone();
                }
            }
            PendingNavigation::New => {
                self.history.truncate(self.history_index + 1);
                self.history.push(url.clone());
                self.history_index = self.history.len() - 1;
            }
            PendingNavigation::Back => {
                if self.history_index > 0 {
                    self.history_index -= 1;
                }
                if self.history.is_empty() {
                    self.history.push(url.clone());
                    self.history_index = 0;
                } else {
                    self.history[self.history_index] = url.clone();
                }
            }
            PendingNavigation::Forward => {
                if self.history_index + 1 < self.history.len() {
                    self.history_index += 1;
                }
                if self.history.is_empty() {
                    self.history.push(url.clone());
                    self.history_index = 0;
                } else {
                    self.history[self.history_index] = url.clone();
                }
            }
        }
        self.pending_navigation = PendingNavigation::None;
        let next_availability = availability.unwrap_or_else(|| self.flags_from_history());
        let load_generation = self
            .current
            .as_ref()
            .map(|state| state.load_generation)
            .unwrap_or(self.load_generation);
        let state = BrowserWebviewState {
            url,
            can_go_back: next_availability.can_go_back,
            can_go_forward: next_availability.can_go_forward,
            is_loading: false,
            load_generation,
        };
        self.current = Some(state.clone());
        state
    }

    pub fn snapshot(&self) -> Option<BrowserWebviewState> {
        self.current.clone()
    }

    pub fn clear(&mut self) {
        self.current = None;
        self.history.clear();
        self.history_index = 0;
        self.pending_navigation = PendingNavigation::None;
    }
}

pub fn browser_webview<R: Runtime, M: Manager<R>>(manager: &M) -> Option<Webview<R>> {
    manager.get_webview(BROWSER_WEBVIEW_LABEL)
}

pub fn cleanup_browser_webview_for_shutdown<R: Runtime>(app_handle: &AppHandle<R>) -> bool {
    let mut closed_webview = true;
    if let Some(webview) = browser_webview(app_handle) {
        if let Err(error) = webview.close() {
            tracing::warn!("Failed to close embedded browser webview during shutdown: {error}");
            closed_webview = false;
        }
    }

    let Some(state) = app_handle.try_state::<crate::commands::AppState>() else {
        return closed_webview;
    };
    let Ok(mut tracker) = crate::commands::lock_browser_webview(&state.browser_webview) else {
        return false;
    };
    let had_tracked_state = tracker.snapshot().is_some();
    tracker.clear();
    if had_tracked_state {
        emit_browser_webview_closed(app_handle);
    }
    closed_webview
}

pub fn emit_browser_webview_state<R: Runtime>(
    app_handle: &AppHandle<R>,
    state: &BrowserWebviewState,
) {
    emit_browser_webview_event(
        app_handle,
        BROWSER_WEBVIEW_STATE_CHANGED_EVENT,
        state.clone(),
    );
}

pub fn emit_browser_webview_closed<R: Runtime>(app_handle: &AppHandle<R>) {
    emit_browser_webview_event(app_handle, BROWSER_WEBVIEW_CLOSED_EVENT, ());
}

pub fn emit_browser_webview_fallback<R: Runtime>(
    app_handle: &AppHandle<R>,
    payload: &BrowserWebviewFallbackPayload,
) {
    emit_browser_webview_event(app_handle, BROWSER_WEBVIEW_FALLBACK_EVENT, payload.clone());
}

pub fn emit_browser_webview_diagnostics<R: Runtime>(
    app_handle: &AppHandle<R>,
    payload: &BrowserWebviewDiagnosticsPayload,
) {
    emit_browser_webview_event(
        app_handle,
        BROWSER_WEBVIEW_DIAGNOSTICS_EVENT,
        payload.clone(),
    );
}

pub fn emit_browser_webview_debug_input<R: Runtime>(app_handle: &AppHandle<R>, message: String) {
    if browser_webview_diagnostics_enabled() {
        emit_browser_webview_event(app_handle, BROWSER_WEBVIEW_DEBUG_INPUT_EVENT, message);
    }
}

fn emit_browser_webview_event<R, S>(app_handle: &AppHandle<R>, event: &'static str, payload: S)
where
    R: Runtime,
    S: Clone + Serialize,
{
    if let Err(error) = app_handle.emit(event, payload) {
        if browser_webview_diagnostics_enabled() {
            tracing::warn!("{}", browser_webview_emit_failure_warning(event, &error));
        }
    }
}

fn browser_webview_emit_failure_warning(event: &str, error: &impl std::fmt::Display) -> String {
    format!("Failed to emit browser webview event `{event}`; continuing without frontend notification: {error}")
}

pub fn browser_webview_diagnostics_enabled() -> bool {
    BROWSER_WEBVIEW_DIAGNOSTICS_ENABLED.load(Ordering::SeqCst)
}

pub fn set_browser_webview_diagnostics_enabled(enabled: bool) {
    BROWSER_WEBVIEW_DIAGNOSTICS_ENABLED.store(enabled, Ordering::SeqCst);
}

pub fn should_trigger_timeout_fallback(
    snapshot: Option<&BrowserWebviewState>,
    expected_url: &str,
    expected_load_generation: u64,
) -> bool {
    matches!(snapshot, Some(state) if state.is_loading
        && state.url == expected_url
        && state.load_generation == expected_load_generation)
}
