//! Browser preview postMessage bridge: the injected scripts that run inside the embedded
//! browser webview, and the message model used to validate/accept a bridge payload against
//! the currently tracked navigation state.

use std::collections::HashMap;

use serde::Deserialize;

use super::prefs::is_supported_browser_preview_bridge_action;
use super::BrowserWebviewState;

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub(super) struct BrowserPreviewBridgeMessage {
    action: String,
    url: String,
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
pub(super) fn normalize_browser_preview_bridge_url(url: &str) -> Option<String> {
    let mut parsed = reqwest::Url::parse(url).ok()?;
    parsed.set_fragment(None);
    Some(normalize_unreserved_percent_encoding(parsed.as_str()))
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
pub(super) fn normalize_unreserved_percent_encoding(value: &str) -> String {
    let mut normalized = String::with_capacity(value.len());
    let bytes = value.as_bytes();
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let high = bytes[index + 1];
            let low = bytes[index + 2];
            if let (Some(high), Some(low)) = (hex_value(high), hex_value(low)) {
                let decoded = (high << 4) | low;
                if decoded.is_ascii_alphanumeric() || matches!(decoded, b'-' | b'.' | b'_' | b'~') {
                    normalized.push(decoded as char);
                } else {
                    normalized.push('%');
                    normalized.push(hex_digit(high));
                    normalized.push(hex_digit(low));
                }
                index += 3;
                continue;
            }
        }

        normalized.push(bytes[index] as char);
        index += 1;
    }

    normalized
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
pub(super) fn hex_value(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        b'A'..=b'F' => Some(value - b'A' + 10),
        _ => None,
    }
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
pub(super) fn hex_digit(value: u8) -> char {
    match value {
        0..=9 => (b'0' + value) as char,
        10..=15 => (b'A' + (value - 10)) as char,
        _ => unreachable!("hex digit should be in range"),
    }
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
pub(super) fn browser_preview_bridge_url_matches(message_url: &str, snapshot_url: &str) -> bool {
    if message_url == snapshot_url {
        return true;
    }

    normalize_browser_preview_bridge_url(message_url)
        .zip(normalize_browser_preview_bridge_url(snapshot_url))
        .is_some_and(|(message_url, snapshot_url)| message_url == snapshot_url)
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
pub(super) fn should_accept_browser_preview_bridge_message(
    message: &BrowserPreviewBridgeMessage,
    snapshot: Option<&BrowserWebviewState>,
) -> bool {
    is_supported_browser_preview_bridge_action(&message.action)
        && snapshot
            .is_some_and(|state| browser_preview_bridge_url_matches(&message.url, &state.url))
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
pub(super) fn browser_preview_bridge_message_action(
    raw_message: &str,
    snapshot: Option<&BrowserWebviewState>,
) -> Option<String> {
    let message: BrowserPreviewBridgeMessage = serde_json::from_str(raw_message).ok()?;
    should_accept_browser_preview_bridge_message(&message, snapshot).then_some(message.action)
}

// Bridge actions this script used to send (scheme navigation) are discarded at the native
// layer (see `handle_browser_webview_shortcut_navigation` in
// `commands/browser_webview_commands.rs`), and the native macOS Escape monitor / Windows
// `AcceleratorKeyPressed` handler already intercepts modified shortcuts and close before the
// WebView sees them. Capturing those keys/buttons here only swallowed them for both the app
// and the page. The one behavior this script still owns is Space-key page scrolling, which is
// not an app action.
#[cfg(any(test, not(windows)))]
pub fn browser_preview_close_bridge_source(_prefs: &HashMap<String, String>) -> Option<String> {
    Some(
        r#"
(() => {
  if (window.__ULTRA_RSS_BROWSER_BRIDGE_INSTALLED__) return;
  Object.defineProperty(window, '__ULTRA_RSS_BROWSER_BRIDGE_INSTALLED__', {
    configurable: false,
    value: true,
  });

  const isEditableTarget = (target) => {
    if (!(target instanceof Element)) return false;
    if (target.closest('[data-disable-global-shortcuts="true"]')) {
      return true;
    }
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
      return true;
    }
    if (target.isContentEditable) {
      return true;
    }
    return Boolean(target.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"], [role="searchbox"]'
    ));
  };
  const getSpaceScrollDirection = (event) => {
    if (event.altKey || event.metaKey || event.ctrlKey || event.key !== ' ') {
      return 0;
    }
    return event.shiftKey ? -1 : 1;
  };
  const scrollByPageStep = (direction) => {
    const scrollTarget = document.scrollingElement || document.documentElement || document.body;
    if (!scrollTarget) {
      return;
    }
    const amount = Math.max(72, Math.round(window.innerHeight * 0.8)) * direction;
    scrollTarget.scrollBy({ top: amount, behavior: 'auto' });
  };
  window.addEventListener('keydown', (event) => {
    if (isEditableTarget(event.target)) {
      return;
    }
    const spaceScrollDirection = getSpaceScrollDirection(event);
    if (!event.defaultPrevented && spaceScrollDirection !== 0) {
      event.preventDefault();
      event.stopPropagation();
      scrollByPageStep(spaceScrollDirection);
    }
  }, true);
})();
"#
        .to_string(),
    )
}

// See the comment above `browser_preview_close_bridge_source`: the bindings/close/mouse
// capture this Windows variant used to `postMessage` to the native side is discarded there
// (`install_escape_accelerator_bridge`'s WebMessageReceived handler intentionally never
// dispatches `MENU_ACTION_EVENT`). Only Space-key page scrolling remains.
#[cfg(any(test, windows))]
pub(super) fn browser_preview_script_bridge_source(
    _prefs: &HashMap<String, String>,
) -> Option<String> {
    Some(
        r#"
(() => {
  if (window.__ULTRA_RSS_BROWSER_BRIDGE_INSTALLED__) return;
  Object.defineProperty(window, '__ULTRA_RSS_BROWSER_BRIDGE_INSTALLED__', {
    configurable: false,
    value: true,
  });

  const isEditableTarget = (target) => {
    if (!(target instanceof Element)) return false;
    if (target.closest('[data-disable-global-shortcuts="true"]')) {
      return true;
    }
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
      return true;
    }
    if (target.isContentEditable) {
      return true;
    }
    return Boolean(target.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"], [role="searchbox"]'
    ));
  };
  const getSpaceScrollDirection = (event) => {
    if (event.altKey || event.metaKey || event.ctrlKey || event.key !== ' ') {
      return 0;
    }
    return event.shiftKey ? -1 : 1;
  };
  const scrollByPageStep = (direction) => {
    const scrollTarget = document.scrollingElement || document.documentElement || document.body;
    if (!scrollTarget) {
      return;
    }
    const amount = Math.max(72, Math.round(window.innerHeight * 0.8)) * direction;
    scrollTarget.scrollBy({ top: amount, behavior: 'auto' });
  };
  window.addEventListener('keydown', (event) => {
    if (isEditableTarget(event.target)) {
      return;
    }
    const spaceScrollDirection = getSpaceScrollDirection(event);
    if (!event.defaultPrevented && spaceScrollDirection !== 0) {
      event.preventDefault();
      event.stopPropagation();
      scrollByPageStep(spaceScrollDirection);
    }
  }, true);
})();
"#
        .to_string(),
    )
}
