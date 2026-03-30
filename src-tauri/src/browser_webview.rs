use serde::Serialize;
use tauri::{Emitter, Manager, Runtime, Webview, Window};

pub const INLINE_BROWSER_WEBVIEW_LABEL: &str = "inline-browser";
pub const BROWSER_WEBVIEW_STATE_CHANGED_EVENT: &str = "browser-webview-state-changed";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct BrowserWebviewState {
    pub url: String,
    pub can_go_back: bool,
    pub can_go_forward: bool,
    pub is_loading: bool,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct BrowserNavigationAvailability {
    pub can_go_back: bool,
    pub can_go_forward: bool,
}

#[derive(Debug, Default)]
pub struct BrowserWebviewTracker {
    current: Option<BrowserWebviewState>,
}

impl BrowserWebviewTracker {
    pub fn start(&mut self, url: String) -> BrowserWebviewState {
        let state = BrowserWebviewState {
            url,
            can_go_back: false,
            can_go_forward: false,
            is_loading: true,
        };
        self.current = Some(state.clone());
        state
    }

    pub fn finish(
        &mut self,
        url: String,
        availability: BrowserNavigationAvailability,
    ) -> BrowserWebviewState {
        let state = BrowserWebviewState {
            url,
            can_go_back: availability.can_go_back,
            can_go_forward: availability.can_go_forward,
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
    }
}

pub fn inline_browser_webview<R: Runtime>(window: &Window<R>) -> Option<Webview<R>> {
    window.get_webview(INLINE_BROWSER_WEBVIEW_LABEL)
}

pub fn emit_browser_webview_state<R: Runtime>(window: &Window<R>, state: &BrowserWebviewState) {
    let _ = window.emit(BROWSER_WEBVIEW_STATE_CHANGED_EVENT, state.clone());
}

pub fn navigation_availability<R: Runtime>(
    webview: &Webview<R>,
    tracker: &BrowserWebviewTracker,
) -> BrowserNavigationAvailability {
    #[cfg(target_os = "macos")]
    {
        let (tx, rx) = std::sync::mpsc::channel();
        if webview
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
                return availability;
            }
        }
    }

    tracker
        .snapshot()
        .map(|state| BrowserNavigationAvailability {
            can_go_back: state.can_go_back,
            can_go_forward: state.can_go_forward,
        })
        .unwrap_or_default()
}

pub fn go_back<R: Runtime>(webview: &Webview<R>) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    {
        webview.with_webview(|platform_webview| unsafe {
            let view: &objc2_web_kit::WKWebView = &*platform_webview.inner().cast();
            let _ = view.goBack();
        })?;
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        webview.eval("window.history.back();")
    }
}

pub fn go_forward<R: Runtime>(webview: &Webview<R>) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    {
        webview.with_webview(|platform_webview| unsafe {
            let view: &objc2_web_kit::WKWebView = &*platform_webview.inner().cast();
            let _ = view.goForward();
        })?;
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        webview.eval("window.history.forward();")
    }
}

#[cfg(test)]
mod tests {
    use super::{BrowserNavigationAvailability, BrowserWebviewTracker};

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
            BrowserNavigationAvailability {
                can_go_back: true,
                can_go_forward: false,
            },
        );

        assert_eq!(state.url, "https://example.com/next");
        assert!(!state.is_loading);
        assert!(state.can_go_back);
        assert!(!state.can_go_forward);
    }

    #[test]
    fn clear_drops_the_tracked_state() {
        let mut tracker = BrowserWebviewTracker::default();
        tracker.start("https://example.com/article".to_string());

        tracker.clear();

        assert!(tracker.snapshot().is_none());
    }
}
