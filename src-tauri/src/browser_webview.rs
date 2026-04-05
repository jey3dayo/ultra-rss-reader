use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, Webview};

pub const BROWSER_WEBVIEW_LABEL: &str = "browser-webview";
pub const BROWSER_WEBVIEW_STATE_CHANGED_EVENT: &str = "browser-webview-state-changed";
pub const BROWSER_WEBVIEW_CLOSED_EVENT: &str = "browser-webview-closed";
pub const BROWSER_WEBVIEW_FALLBACK_EVENT: &str = "browser-webview-fallback";
pub const BROWSER_WEBVIEW_DIAGNOSTICS_EVENT: &str = "browser-webview-diagnostics";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct BrowserWebviewState {
    pub url: String,
    pub can_go_back: bool,
    pub can_go_forward: bool,
    pub is_loading: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct BrowserWebviewFallbackPayload {
    pub url: String,
    pub opened_external: bool,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BrowserWebviewDiagnosticsPayload {
    pub action: String,
    pub requested_logical: BrowserWebviewLogicalRect,
    pub applied_logical: BrowserWebviewLogicalRect,
    pub scale_factor: f64,
    pub native_webview_bounds: Option<BrowserWebviewLogicalRect>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
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
        let state = BrowserWebviewState {
            url,
            can_go_back: next_availability.can_go_back,
            can_go_forward: next_availability.can_go_forward,
            is_loading: false,
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

pub fn emit_browser_webview_state<R: Runtime>(
    app_handle: &AppHandle<R>,
    state: &BrowserWebviewState,
) {
    let _ = app_handle.emit(BROWSER_WEBVIEW_STATE_CHANGED_EVENT, state.clone());
}

pub fn emit_browser_webview_closed<R: Runtime>(app_handle: &AppHandle<R>) {
    let _ = app_handle.emit(BROWSER_WEBVIEW_CLOSED_EVENT, ());
}

pub fn emit_browser_webview_fallback<R: Runtime>(
    app_handle: &AppHandle<R>,
    payload: &BrowserWebviewFallbackPayload,
) {
    let _ = app_handle.emit(BROWSER_WEBVIEW_FALLBACK_EVENT, payload.clone());
}

pub fn emit_browser_webview_diagnostics<R: Runtime>(
    app_handle: &AppHandle<R>,
    payload: &BrowserWebviewDiagnosticsPayload,
) {
    let _ = app_handle.emit(BROWSER_WEBVIEW_DIAGNOSTICS_EVENT, payload.clone());
}

pub fn browser_webview_diagnostics_enabled() -> bool {
    matches!(
        std::env::var("ULTRA_RSS_DEBUG_BROWSER_BOUNDS")
            .ok()
            .as_deref(),
        Some("1") | Some("true") | Some("TRUE")
    )
}

pub fn should_trigger_timeout_fallback(
    snapshot: Option<&BrowserWebviewState>,
    expected_url: &str,
) -> bool {
    matches!(snapshot, Some(state) if state.is_loading && state.url == expected_url)
}

fn supports_native_navigation(info: &crate::platform::PlatformInfo) -> bool {
    info.capabilities.supports_native_browser_navigation
}

pub fn navigation_availability<R: Runtime>(
    _browser_webview: &Webview<R>,
) -> Option<BrowserNavigationAvailability> {
    let platform_info = crate::platform::PlatformInfo::current();
    if !supports_native_navigation(&platform_info) {
        return None;
    }

    #[cfg(target_os = "macos")]
    {
        let (tx, rx) = std::sync::mpsc::channel();
        if _browser_webview
            .with_webview(move |platform_webview| unsafe {
                let view: &objc2_web_kit::WKWebView = &*platform_webview.inner().cast();
                let _ = tx.send(BrowserNavigationAvailability {
                    can_go_back: view.canGoBack(),
                    can_go_forward: view.canGoForward(),
                });
            })
            .is_ok()
        {
            if let Ok(availability) = rx.recv() {
                return Some(availability);
            }
        }
    }

    #[cfg(windows)]
    {
        let (tx, rx) = std::sync::mpsc::channel();
        if _browser_webview
            .with_webview(move |platform_webview| unsafe {
                let availability =
                    platform_webview
                        .controller()
                        .CoreWebView2()
                        .ok()
                        .and_then(|core_webview| {
                            let mut can_go_back = Default::default();
                            let mut can_go_forward = Default::default();

                            if core_webview.CanGoBack(&mut can_go_back).is_err()
                                || core_webview.CanGoForward(&mut can_go_forward).is_err()
                            {
                                return None;
                            }

                            Some(BrowserNavigationAvailability {
                                can_go_back: can_go_back.as_bool(),
                                can_go_forward: can_go_forward.as_bool(),
                            })
                        });
                let _ = tx.send(availability);
            })
            .is_ok()
        {
            if let Ok(availability) = rx.recv() {
                return availability;
            }
        }
    }

    None
}

pub fn go_back<R: Runtime>(browser_webview: &Webview<R>) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    {
        browser_webview.with_webview(|platform_webview| unsafe {
            let view: &objc2_web_kit::WKWebView = &*platform_webview.inner().cast();
            let _ = view.goBack();
        })?;
        Ok(())
    }

    #[cfg(windows)]
    {
        let (tx, rx) = std::sync::mpsc::channel();
        browser_webview.with_webview(move |platform_webview| unsafe {
            let result = platform_webview
                .controller()
                .CoreWebView2()
                .and_then(|core_webview| core_webview.GoBack())
                .map_err(|error| error.to_string());
            let _ = tx.send(result);
        })?;

        match rx.recv() {
            Ok(Ok(())) => Ok(()),
            Ok(Err(message)) => Err(std::io::Error::other(message).into()),
            Err(error) => Err(std::io::Error::other(format!(
                "Failed to receive WebView2 back navigation result: {error}"
            ))
            .into()),
        }
    }

    #[cfg(all(not(target_os = "macos"), not(windows)))]
    {
        browser_webview.eval("window.history.back();")
    }
}

pub fn go_forward<R: Runtime>(browser_webview: &Webview<R>) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    {
        browser_webview.with_webview(|platform_webview| unsafe {
            let view: &objc2_web_kit::WKWebView = &*platform_webview.inner().cast();
            let _ = view.goForward();
        })?;
        Ok(())
    }

    #[cfg(windows)]
    {
        let (tx, rx) = std::sync::mpsc::channel();
        browser_webview.with_webview(move |platform_webview| unsafe {
            let result = platform_webview
                .controller()
                .CoreWebView2()
                .and_then(|core_webview| core_webview.GoForward())
                .map_err(|error| error.to_string());
            let _ = tx.send(result);
        })?;

        match rx.recv() {
            Ok(Ok(())) => Ok(()),
            Ok(Err(message)) => Err(std::io::Error::other(message).into()),
            Err(error) => Err(std::io::Error::other(format!(
                "Failed to receive WebView2 forward navigation result: {error}"
            ))
            .into()),
        }
    }

    #[cfg(all(not(target_os = "macos"), not(windows)))]
    {
        browser_webview.eval("window.history.forward();")
    }
}

#[cfg(test)]
mod tests {
    use super::{
        should_trigger_timeout_fallback, supports_native_navigation, BrowserNavigationAvailability,
        BrowserWebviewState, BrowserWebviewTracker,
    };
    use crate::platform::{platform_info_for_kind, PlatformKind};

    #[test]
    fn start_marks_state_as_loading_and_resets_history_flags() {
        let mut tracker = BrowserWebviewTracker::default();

        let state = tracker.start("https://example.com/article".to_string());

        assert_eq!(state.url, "https://example.com/article");
        assert!(state.is_loading);
        assert!(!state.can_go_back);
        assert!(!state.can_go_forward);
    }

    #[test]
    fn finish_applies_navigation_capabilities() {
        let mut tracker = BrowserWebviewTracker::default();
        tracker.start("https://example.com/article".to_string());

        let state = tracker.finish(
            "https://example.com/next".to_string(),
            Some(BrowserNavigationAvailability {
                can_go_back: true,
                can_go_forward: false,
            }),
        );

        assert_eq!(state.url, "https://example.com/next");
        assert!(!state.is_loading);
        assert!(state.can_go_back);
        assert!(!state.can_go_forward);
    }

    #[test]
    fn finish_enables_back_after_new_navigation_on_non_macos_fallback() {
        let mut tracker = BrowserWebviewTracker::default();

        tracker.start("https://example.com/article".to_string());
        tracker.finish("https://example.com/article".to_string(), None);

        tracker.start("https://example.com/next".to_string());
        let state = tracker.finish("https://example.com/next".to_string(), None);

        assert!(state.can_go_back);
        assert!(!state.can_go_forward);
    }

    #[test]
    fn finish_enables_forward_after_back_navigation_on_non_macos_fallback() {
        let mut tracker = BrowserWebviewTracker::default();

        tracker.start("https://example.com/article".to_string());
        tracker.finish("https://example.com/article".to_string(), None);

        tracker.start("https://example.com/next".to_string());
        tracker.finish(
            "https://example.com/next".to_string(),
            Some(BrowserNavigationAvailability {
                can_go_back: true,
                can_go_forward: false,
            }),
        );

        tracker.start("https://example.com/article".to_string());
        let state = tracker.finish("https://example.com/article".to_string(), None);

        assert!(!state.can_go_back);
        assert!(state.can_go_forward);
    }

    #[test]
    fn clear_drops_the_tracked_state() {
        let mut tracker = BrowserWebviewTracker::default();
        tracker.start("https://example.com/article".to_string());

        tracker.clear();

        assert!(tracker.snapshot().is_none());
    }

    #[test]
    fn supports_native_navigation_on_macos_and_windows() {
        let macos = platform_info_for_kind(PlatformKind::Macos);
        let windows = platform_info_for_kind(PlatformKind::Windows);

        assert!(supports_native_navigation(&macos));
        assert!(supports_native_navigation(&windows));
    }

    #[test]
    fn does_not_support_native_navigation_on_linux_or_unknown() {
        let linux = platform_info_for_kind(PlatformKind::Linux);
        let unknown = platform_info_for_kind(PlatformKind::Unknown);

        assert!(!supports_native_navigation(&linux));
        assert!(!supports_native_navigation(&unknown));
    }

    #[test]
    fn timeout_fallback_triggers_only_for_matching_loading_url() {
        let loading = BrowserWebviewState {
            url: "https://example.com/article".to_string(),
            can_go_back: false,
            can_go_forward: false,
            is_loading: true,
        };
        let finished = BrowserWebviewState {
            is_loading: false,
            ..loading.clone()
        };

        assert!(should_trigger_timeout_fallback(
            Some(&loading),
            "https://example.com/article"
        ));
        assert!(!should_trigger_timeout_fallback(
            Some(&loading),
            "https://example.com/other"
        ));
        assert!(!should_trigger_timeout_fallback(
            Some(&finished),
            "https://example.com/article"
        ));
        assert!(!should_trigger_timeout_fallback(
            None,
            "https://example.com/article"
        ));
    }
}
