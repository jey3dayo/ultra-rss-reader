//! Native back/forward navigation for the embedded browser preview webview, and querying
//! whether the current platform's webview exposes native `canGoBack`/`canGoForward` state.

use tauri::{Runtime, Webview};

use super::BrowserNavigationAvailability;

pub(super) fn supports_native_navigation(info: &crate::platform::PlatformInfo) -> bool {
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
