use std::{
    collections::HashMap,
    sync::atomic::{AtomicBool, Ordering},
};

#[cfg(windows)]
use std::{
    sync::atomic::AtomicU64,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, Webview};

#[cfg(windows)]
use crate::menu::MENU_ACTION_EVENT;

pub const BROWSER_WEBVIEW_LABEL: &str = "browser-webview";
pub const BROWSER_WEBVIEW_STATE_CHANGED_EVENT: &str = "browser-webview-state-changed";
pub const BROWSER_WEBVIEW_CLOSED_EVENT: &str = "browser-webview-closed";
pub const BROWSER_WEBVIEW_FALLBACK_EVENT: &str = "browser-webview-fallback";
pub const BROWSER_WEBVIEW_DIAGNOSTICS_EVENT: &str = "browser-webview-diagnostics";
pub const BROWSER_WEBVIEW_DEBUG_INPUT_EVENT: &str = "browser-webview-debug-input";

static BROWSER_WEBVIEW_DIAGNOSTICS_ENABLED: AtomicBool = AtomicBool::new(false);
#[cfg(test)]
pub(crate) static BROWSER_WEBVIEW_DIAGNOSTICS_TEST_LOCK: std::sync::Mutex<()> =
    std::sync::Mutex::new(());
#[cfg(windows)]
static BROWSER_CLOSE_GRACE_UNTIL_MS: AtomicU64 = AtomicU64::new(0);
#[cfg(windows)]
const BROWSER_CLOSE_GRACE_WINDOW_MS: u64 = 800;

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
struct BrowserPreviewShortcutSpec {
    pref_key: &'static str,
    default_binding: &'static str,
    app_action: &'static str,
    #[cfg_attr(not(any(test, windows)), allow(dead_code))]
    supports_script_bridge: bool,
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
const BROWSER_PREVIEW_SHORTCUT_SPECS: &[BrowserPreviewShortcutSpec] = &[
    BrowserPreviewShortcutSpec {
        pref_key: "shortcut_close_or_clear",
        default_binding: "Escape",
        app_action: "close-browser",
        supports_script_bridge: false,
    },
    BrowserPreviewShortcutSpec {
        pref_key: "shortcut_toggle_read",
        default_binding: "m",
        app_action: "toggle-read",
        supports_script_bridge: true,
    },
    BrowserPreviewShortcutSpec {
        pref_key: "shortcut_toggle_star",
        default_binding: "s",
        app_action: "toggle-star",
        supports_script_bridge: true,
    },
    BrowserPreviewShortcutSpec {
        pref_key: "shortcut_open_external_browser",
        default_binding: "b",
        app_action: "open-in-default-browser",
        supports_script_bridge: true,
    },
    BrowserPreviewShortcutSpec {
        pref_key: "shortcut_next_article",
        default_binding: "j",
        app_action: "next-article",
        supports_script_bridge: true,
    },
    BrowserPreviewShortcutSpec {
        pref_key: "shortcut_prev_article",
        default_binding: "k",
        app_action: "prev-article",
        supports_script_bridge: true,
    },
    BrowserPreviewShortcutSpec {
        pref_key: "shortcut_next_feed",
        default_binding: "l",
        app_action: "next-feed",
        supports_script_bridge: true,
    },
    BrowserPreviewShortcutSpec {
        pref_key: "shortcut_prev_feed",
        default_binding: "h",
        app_action: "prev-feed",
        supports_script_bridge: true,
    },
    BrowserPreviewShortcutSpec {
        pref_key: "shortcut_reload_webview",
        default_binding: "r",
        app_action: "reload-webview",
        supports_script_bridge: true,
    },
];

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct BrowserWebviewState {
    pub url: String,
    pub can_go_back: bool,
    pub can_go_forward: bool,
    pub is_loading: bool,
    #[serde(skip)]
    pub load_generation: u64,
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

pub fn load_browser_preview_prefs<R: Runtime>(
    app_handle: &AppHandle<R>,
) -> Result<HashMap<String, String>, std::io::Error> {
    use crate::infra::db::sqlite_preference::SqlitePreferenceRepository;
    use crate::repository::preference::PreferenceRepository;

    let app_state = app_handle.state::<crate::commands::AppState>();
    let db = app_state
        .db
        .lock()
        .map_err(|error| std::io::Error::other(format!("Preference DB lock error: {error}")))?;
    let repo = SqlitePreferenceRepository::new(db.reader());
    repo.get_all()
        .map_err(|error| std::io::Error::other(format!("Preference read error: {error}")))
}

pub fn browser_preview_focus_override_source(prefs: &HashMap<String, String>) -> Option<String> {
    if prefs.get("web_preview_keep_focus").map(String::as_str) != Some("true") {
        return None;
    }

    Some(
        r#"
(() => {
  if (window.__ULTRA_RSS_FOCUS_OVERRIDE_INSTALLED__) return;
  Object.defineProperty(window, '__ULTRA_RSS_FOCUS_OVERRIDE_INSTALLED__', {
    configurable: false,
    value: true,
  });

  const defineGetter = (target, property, value) => {
    try {
      Object.defineProperty(target, property, {
        configurable: true,
        get: () => value,
      });
    } catch (_) {}
  };
  const defineValue = (target, property, value) => {
    try {
      Object.defineProperty(target, property, {
        configurable: true,
        value,
      });
    } catch (_) {}
  };

  defineGetter(Document.prototype, 'hidden', false);
  defineGetter(document, 'hidden', false);
  defineGetter(Document.prototype, 'visibilityState', 'visible');
  defineGetter(document, 'visibilityState', 'visible');
  defineValue(Document.prototype, 'hasFocus', () => true);
  defineValue(document, 'hasFocus', () => true);

  const blockedEvents = new Set(['blur', 'focus', 'visibilitychange', 'webkitvisibilitychange']);
  const shouldBlock = (target, type) => blockedEvents.has(type) && (target === window || target === document);
  const isEventListener = (listener) => typeof listener === 'function' || (listener !== null && typeof listener === 'object');
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
  const blockedListeners = new WeakMap();

  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (shouldBlock(this, type) && isEventListener(listener)) {
      let listenersByType = blockedListeners.get(this);
      if (!listenersByType) {
        listenersByType = new Map();
        blockedListeners.set(this, listenersByType);
      }
      let listeners = listenersByType.get(type);
      if (!listeners) {
        listeners = new WeakSet();
        listenersByType.set(type, listeners);
      }
      listeners.add(listener);
      return;
    }
    return originalAddEventListener.call(this, type, listener, options);
  };

  EventTarget.prototype.removeEventListener = function(type, listener, options) {
    if (shouldBlock(this, type) && isEventListener(listener)) {
      const listenersByType = blockedListeners.get(this);
      const listeners = listenersByType?.get(type);
      if (listeners?.has(listener)) {
        return;
      }
    }
    return originalRemoveEventListener.call(this, type, listener, options);
  };

  const stopFocusVisibilityEvent = (event) => {
    event.stopImmediatePropagation();
  };
  for (const type of blockedEvents) {
    originalAddEventListener.call(window, type, stopFocusVisibilityEvent, true);
    originalAddEventListener.call(document, type, stopFocusVisibilityEvent, true);
  }
})();
"#
        .to_string(),
    )
}

#[cfg_attr(windows, allow(dead_code))]
pub fn browser_preview_initialization_script(prefs: &HashMap<String, String>) -> Option<String> {
    let mut scripts = Vec::new();

    if let Some(script) = browser_preview_focus_override_source(prefs) {
        scripts.push(script);
    }

    #[cfg(any(test, not(windows)))]
    if let Some(script) = browser_preview_close_bridge_source(prefs) {
        scripts.push(script);
    }

    if scripts.is_empty() {
        None
    } else {
        Some(scripts.join("\n;\n"))
    }
}

pub fn browser_preview_initialization_script_from_prefs_result(
    prefs_result: Result<HashMap<String, String>, std::io::Error>,
) -> Option<String> {
    match prefs_result {
        Ok(prefs) => browser_preview_initialization_script(&prefs),
        Err(error) => {
            tracing::warn!(
                "Failed to load embedded browser preferences; continuing without preview initialization script: {error}"
            );
            None
        }
    }
}

#[cfg(windows)]
fn focus_main_webview_window<R: Runtime>(app_handle: &AppHandle<R>) {
    use windows::Win32::UI::{
        Input::KeyboardAndMouse::SetFocus,
        WindowsAndMessaging::{BringWindowToTop, SetForegroundWindow},
    };

    if let Some(webview) = app_handle.get_webview("main") {
        let _ = webview.set_focus();
    }

    let Some(window) = app_handle.get_webview_window("main") else {
        return;
    };
    let Ok(hwnd) = window.hwnd() else {
        return;
    };

    let _ = unsafe { BringWindowToTop(hwnd) };
    let _ = unsafe { SetForegroundWindow(hwnd) };
    let _ = unsafe { SetFocus(Some(hwnd)) };

    if let Some(webview) = app_handle.get_webview("main") {
        let _ = webview.set_focus();
    }
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
fn normalize_browser_shortcut(key: &str, command_or_control: bool, shift: bool) -> Option<String> {
    if key.is_empty() {
        return None;
    }

    let mut parts = Vec::new();
    if command_or_control {
        parts.push("⌘".to_string());
    }
    if shift {
        parts.push("Shift".to_string());
    }

    let normalized_key = if key.chars().count() == 1 {
        if shift {
            key.to_uppercase()
        } else {
            key.to_lowercase()
        }
    } else {
        key.to_string()
    };
    parts.push(normalized_key);
    Some(parts.join("+"))
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
fn normalize_saved_browser_shortcut(binding: &str) -> Option<String> {
    let mut command_or_control = false;
    let mut shift = false;
    let mut key: Option<&str> = None;

    for segment in binding
        .split('+')
        .map(str::trim)
        .filter(|segment| !segment.is_empty())
    {
        match segment {
            "⌘" | "Ctrl" | "ctrl" | "CmdOrCtrl" | "cmdorctrl" => {
                command_or_control = true;
            }
            "Shift" | "shift" => {
                shift = true;
            }
            other if key.is_none() => {
                key = Some(other);
            }
            _ => return None,
        }
    }

    normalize_browser_shortcut(key?, command_or_control, shift)
}

#[cfg(windows)]
fn now_epoch_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(windows)]
fn begin_browser_close_grace_window() {
    BROWSER_CLOSE_GRACE_UNTIL_MS.store(
        now_epoch_millis().saturating_add(BROWSER_CLOSE_GRACE_WINDOW_MS),
        Ordering::SeqCst,
    );
}

#[cfg(windows)]
fn browser_close_grace_window_active() -> bool {
    now_epoch_millis() <= BROWSER_CLOSE_GRACE_UNTIL_MS.load(Ordering::SeqCst)
}

#[cfg(windows)]
fn is_browser_close_grace_action(action: &str) -> bool {
    matches!(
        action,
        "next-article" | "prev-article" | "next-feed" | "prev-feed"
    )
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
pub fn browser_preview_action_for_shortcut(
    prefs: &HashMap<String, String>,
    key: &str,
    command_or_control: bool,
    shift: bool,
) -> Option<&'static str> {
    let normalized = normalize_browser_shortcut(key, command_or_control, shift)?;

    BROWSER_PREVIEW_SHORTCUT_SPECS.iter().find_map(|shortcut| {
        let binding = prefs
            .get(shortcut.pref_key)
            .map(String::as_str)
            .unwrap_or(shortcut.default_binding);
        (normalize_saved_browser_shortcut(binding).as_deref() == Some(normalized.as_str()))
            .then_some(shortcut.app_action)
    })
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
fn browser_preview_script_bindings(
    prefs: &HashMap<String, String>,
) -> HashMap<String, &'static str> {
    BROWSER_PREVIEW_SHORTCUT_SPECS
        .iter()
        .filter(|shortcut| shortcut.supports_script_bridge)
        .filter_map(|shortcut| {
            let binding = prefs
                .get(shortcut.pref_key)
                .map(String::as_str)
                .unwrap_or(shortcut.default_binding);
            normalize_saved_browser_shortcut(binding)
                .map(|normalized| (normalized, shortcut.app_action))
        })
        .collect()
}

#[cfg(any(test, not(windows)))]
pub fn browser_preview_close_bridge_source(prefs: &HashMap<String, String>) -> Option<String> {
    let close_binding = BROWSER_PREVIEW_SHORTCUT_SPECS
        .iter()
        .find(|shortcut| shortcut.app_action == "close-browser")
        .and_then(|shortcut| {
            let binding = prefs
                .get(shortcut.pref_key)
                .map(String::as_str)
                .unwrap_or(shortcut.default_binding);
            normalize_saved_browser_shortcut(binding)
        })?;

    let close_binding_json = serde_json::to_string(&close_binding).ok()?;
    Some(format!(
        r#"
(() => {{
  if (window.__ULTRA_RSS_BROWSER_BRIDGE_INSTALLED__) return;
  Object.defineProperty(window, '__ULTRA_RSS_BROWSER_BRIDGE_INSTALLED__', {{
    configurable: false,
    value: true,
  }});

  const closeBinding = {close_binding_json};
  let closeInFlight = false;
  let mouseNavigationInFlight = false;
  const isEditableTarget = (target) => {{
    if (!(target instanceof Element)) return false;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {{
      return true;
    }}
    if (target.isContentEditable) {{
      return true;
    }}
    return Boolean(target.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"], [role="searchbox"]'
    ));
  }};
  const normalize = (event) => {{
    if (event.altKey) return null;
    const parts = [];
    if (event.metaKey || event.ctrlKey) parts.push('⌘');
    if (event.shiftKey && event.key !== 'Shift') parts.push('Shift');
    let key = event.key;
    if (!key) return null;
    if (key.length === 1) {{
      key = event.shiftKey ? key.toUpperCase() : key.toLowerCase();
    }}
    parts.push(key);
    return parts.join('+');
  }};
  const getInvoke = () => window.__TAURI_INTERNALS__?.invoke;
  const getSpaceScrollDirection = (event) => {{
    if (event.altKey || event.metaKey || event.ctrlKey || event.key !== ' ') {{
      return 0;
    }}
    return event.shiftKey ? -1 : 1;
  }};
  const scrollByPageStep = (direction) => {{
    const scrollTarget = document.scrollingElement || document.documentElement || document.body;
    if (!scrollTarget) {{
      return;
    }}
    const amount = Math.max(72, Math.round(window.innerHeight * 0.8)) * direction;
    scrollTarget.scrollBy({{ top: amount, behavior: 'auto' }});
  }};
  const closeBrowserPreview = async () => {{
    if (closeInFlight) {{
      return;
    }}

    const invoke = getInvoke();
    if (typeof invoke !== 'function') {{
      return;
    }}

    closeInFlight = true;
    try {{
      await invoke('close_browser_webview');
    }} catch (error) {{
      closeInFlight = false;
      console.error('Failed to close embedded browser webview from bridge:', error);
    }}
  }};
  window.addEventListener('keydown', (event) => {{
    if (event.defaultPrevented || isEditableTarget(event.target)) {{
      return;
    }}
    const spaceScrollDirection = getSpaceScrollDirection(event);
    if (spaceScrollDirection !== 0) {{
      event.preventDefault();
      event.stopPropagation();
      scrollByPageStep(spaceScrollDirection);
      return;
    }}
    const normalized = normalize(event);
    if (!normalized || normalized !== closeBinding || closeInFlight) {{
      return;
    }}
    event.preventDefault();
    event.stopPropagation();
    void closeBrowserPreview();
  }}, true);
  window.addEventListener('mousedown', (event) => {{
    if ((event.button !== 3 && event.button !== 4) || event.defaultPrevented || isEditableTarget(event.target)) {{
      return;
    }}

    event.preventDefault();
    event.stopPropagation();
  }}, true);
  window.addEventListener('mouseup', (event) => {{
    if ((event.button !== 3 && event.button !== 4) || event.defaultPrevented || isEditableTarget(event.target) || mouseNavigationInFlight) {{
      return;
    }}

    const invoke = getInvoke();
    if (typeof invoke !== 'function') {{
      return;
    }}

    event.preventDefault();
    event.stopPropagation();
    mouseNavigationInFlight = true;

    if (event.button === 3) {{
      void invoke('go_back_browser_webview')
        .then((state) => {{
          if (!state?.can_go_back) {{
            return closeBrowserPreview();
          }}
          return null;
        }})
        .catch((error) => {{
          console.error('Failed to navigate back from mouse bridge:', error);
        }})
        .finally(() => {{
          mouseNavigationInFlight = false;
        }});
      return;
    }}

    void invoke('go_forward_browser_webview')
      .catch((error) => {{
        console.error('Failed to navigate forward from mouse bridge:', error);
      }})
      .finally(() => {{
        mouseNavigationInFlight = false;
      }});
  }}, true);
}})();
"#
    ))
}

#[cfg(windows)]
fn browser_preview_script_bridge_source(prefs: &HashMap<String, String>) -> Option<String> {
    let bindings = browser_preview_script_bindings(prefs);
    if bindings.is_empty() {
        return None;
    }

    let bindings_json = serde_json::to_string(&bindings).ok()?;
    Some(format!(
        r#"
(() => {{
  if (window.__ULTRA_RSS_BROWSER_BRIDGE_INSTALLED__) return;
  Object.defineProperty(window, '__ULTRA_RSS_BROWSER_BRIDGE_INSTALLED__', {{
    configurable: false,
    value: true,
  }});

  const bindings = {bindings_json};
  const isEditableTarget = (target) => {{
    if (!(target instanceof Element)) return false;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {{
      return true;
    }}
    if (target.isContentEditable) {{
      return true;
    }}
    return Boolean(target.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"], [role="searchbox"]'
    ));
  }};
  const normalize = (event) => {{
    if (event.altKey || event.metaKey) return null;
    const parts = [];
    if (event.ctrlKey) parts.push('⌘');
    if (event.shiftKey) parts.push('Shift');
    let key = event.key;
    if (!key) return null;
    if (key.length === 1) {{
      key = event.shiftKey ? key.toUpperCase() : key.toLowerCase();
    }}
    parts.push(key);
    return parts.join('+');
  }};
  const getSpaceScrollDirection = (event) => {{
    if (event.altKey || event.metaKey || event.ctrlKey || event.key !== ' ') {{
      return 0;
    }}
    return event.shiftKey ? -1 : 1;
  }};
  const scrollByPageStep = (direction) => {{
    const scrollTarget = document.scrollingElement || document.documentElement || document.body;
    if (!scrollTarget) {{
      return;
    }}
    const amount = Math.max(72, Math.round(window.innerHeight * 0.8)) * direction;
    scrollTarget.scrollBy({{ top: amount, behavior: 'auto' }});
  }};
  window.addEventListener('keydown', (event) => {{
    if (event.defaultPrevented || isEditableTarget(event.target)) {{
      return;
    }}
    const spaceScrollDirection = getSpaceScrollDirection(event);
    if (spaceScrollDirection !== 0) {{
      event.preventDefault();
      event.stopPropagation();
      scrollByPageStep(spaceScrollDirection);
      return;
    }}
    const normalized = normalize(event);
    if (!normalized) {{
      return;
    }}
    const action = bindings[normalized];
    if (!action) {{
      return;
    }}
    event.preventDefault();
    event.stopPropagation();
    window.chrome?.webview?.postMessage(action);
  }}, true);
  window.addEventListener('mousedown', (event) => {{
    if ((event.button !== 3 && event.button !== 4) || event.defaultPrevented || isEditableTarget(event.target)) {{
      return;
    }}

    event.preventDefault();
    event.stopPropagation();
  }}, true);
  window.addEventListener('mouseup', (event) => {{
    if ((event.button !== 3 && event.button !== 4) || event.defaultPrevented || isEditableTarget(event.target)) {{
      return;
    }}

    const action = event.button === 3 ? 'mouse-back' : 'mouse-forward';
    event.preventDefault();
    event.stopPropagation();
    window.chrome?.webview?.postMessage(action);
  }}, true);
}})();
"#
    ))
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
fn browser_preview_action_for_virtual_key_from_prefs_result(
    prefs_result: Result<HashMap<String, String>, std::io::Error>,
    virtual_key: u32,
    command_or_control: bool,
    shift: bool,
) -> Option<&'static str> {
    let key = browser_shortcut_key_from_virtual_key(virtual_key)?;
    let prefs = match prefs_result {
        Ok(prefs) => prefs,
        Err(error) => {
            tracing::warn!(
                "{}",
                browser_preview_shortcut_preferences_read_warning(&error)
            );
            HashMap::new()
        }
    };
    browser_preview_action_for_shortcut(&prefs, &key, command_or_control, shift)
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
fn browser_preview_shortcut_preferences_read_warning(error: &std::io::Error) -> String {
    format!(
        "Failed to load embedded browser shortcut preferences; using default preview shortcuts: {error}"
    )
}

#[cfg(windows)]
fn browser_preview_action_for_virtual_key<R: Runtime>(
    app_handle: &AppHandle<R>,
    virtual_key: u32,
    command_or_control: bool,
    shift: bool,
) -> Option<&'static str> {
    browser_preview_action_for_virtual_key_from_prefs_result(
        load_browser_preview_prefs(app_handle),
        virtual_key,
        command_or_control,
        shift,
    )
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
fn browser_shortcut_key_from_virtual_key(virtual_key: u32) -> Option<String> {
    match virtual_key {
        0x30..=0x39 => char::from_u32(virtual_key).map(|ch| ch.to_string()),
        0x41..=0x5A => char::from_u32(virtual_key).map(|ch| ch.to_ascii_lowercase().to_string()),
        0x1B => Some("Escape".to_string()),
        _ => None,
    }
}

#[cfg(windows)]
unsafe fn take_windows_pwstr(source: windows::core::PWSTR) -> String {
    use std::slice;

    use windows::{
        core::PCWSTR,
        Win32::{Globalization::lstrlenW, System::Com::CoTaskMemFree},
    };

    if source.is_null() {
        return String::new();
    }

    let source_ref = PCWSTR::from_raw(source.as_ptr());
    let len = lstrlenW(source_ref);
    let value = if len > 0 {
        let buffer = slice::from_raw_parts(source.0, len as usize);
        String::from_utf16_lossy(buffer)
    } else {
        String::new()
    };
    CoTaskMemFree(Some(source.as_ptr() as *const _));
    value
}

#[cfg(windows)]
pub fn install_escape_accelerator_bridge<R: Runtime>(
    browser_webview: &Webview<R>,
    app_handle: &AppHandle<R>,
) -> tauri::Result<()> {
    use std::sync::mpsc;

    use webview2_com::{
        AcceleratorKeyPressedEventHandler, AddScriptToExecuteOnDocumentCreatedCompletedHandler,
        Microsoft::Web::WebView2::Win32::{
            ICoreWebView2AcceleratorKeyPressedEventArgs, ICoreWebView2Settings3,
            COREWEBVIEW2_KEY_EVENT_KIND, COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN,
            COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN,
        },
        WebMessageReceivedEventHandler,
    };
    use windows::core::{Interface, HSTRING, PWSTR};
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetKeyState, VK_CONTROL, VK_SHIFT};

    let app_handle = app_handle.clone();
    let prefs = load_browser_preview_prefs(&app_handle)?;
    let shortcut_script = browser_preview_script_bridge_source(&prefs);
    let (tx, rx) = mpsc::channel();

    browser_webview.with_webview(move |platform_webview| unsafe {
        let result = (|| {
            let controller = platform_webview.controller();
            let webview = controller.CoreWebView2().map_err(|error| error.to_string())?;
            if let Ok(settings) = webview.Settings() {
                if let Ok(settings3) = settings.cast::<ICoreWebView2Settings3>() {
                    let _ = settings3.SetAreBrowserAcceleratorKeysEnabled(false);
                }
            }

            if let Some(shortcut_script) = &shortcut_script {
                let handler =
                    AddScriptToExecuteOnDocumentCreatedCompletedHandler::create(Box::new(|_, _| Ok(())));
                webview
                    .AddScriptToExecuteOnDocumentCreated(
                        &HSTRING::from(shortcut_script),
                        &handler,
                    )
                    .map_err(|error| error.to_string())?;

                let app_handle = app_handle.clone();
                let message_handler = WebMessageReceivedEventHandler::create(Box::new(
                    move |_sender, args| {
                        let Some(args) = args else {
                            return Ok(());
                        };

                        let mut message = PWSTR::null();
                        args.TryGetWebMessageAsString(&mut message)?;
                        let action = take_windows_pwstr(message);
                        emit_browser_webview_debug_input(
                            &app_handle,
                            format!("native-script action={action}"),
                        );
                        if BROWSER_PREVIEW_SHORTCUT_SPECS.iter().any(|shortcut| {
                            shortcut.supports_script_bridge && shortcut.app_action == action
                        }) {
                            let _ = app_handle.emit(MENU_ACTION_EVENT, action);
                        }
                        Ok(())
                    },
                ));

                let mut token = 0;
                webview
                    .add_WebMessageReceived(&message_handler, &mut token)
                    .map_err(|error| error.to_string())?;
            }

            let handler = AcceleratorKeyPressedEventHandler::create(Box::new(
                move |_sender, args: Option<ICoreWebView2AcceleratorKeyPressedEventArgs>| {
                    let Some(args) = args else {
                        return Ok(());
                    };

                    let mut key_event_kind = COREWEBVIEW2_KEY_EVENT_KIND(0);
                    args.KeyEventKind(&mut key_event_kind)?;
                    if key_event_kind != COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN
                        && key_event_kind != COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN
                    {
                        return Ok(());
                    }

                    let mut virtual_key = 0;
                    args.VirtualKey(&mut virtual_key)?;
                    let command_or_control = GetKeyState(VK_CONTROL.0 as i32) < 0;
                    let shift = GetKeyState(VK_SHIFT.0 as i32) < 0;
                    let Some(action) = browser_preview_action_for_virtual_key(
                        &app_handle,
                        virtual_key,
                        command_or_control,
                        shift,
                    ) else {
                        emit_browser_webview_debug_input(
                            &app_handle,
                            format!(
                                "native-accelerator vk={virtual_key} ctrl={command_or_control} shift={shift} action=none grace={}",
                                browser_close_grace_window_active()
                            ),
                        );
                        return Ok(());
                    };

                    let should_handle = action == "close-browser"
                        || (is_browser_close_grace_action(action) && browser_close_grace_window_active());
                    emit_browser_webview_debug_input(
                        &app_handle,
                        format!(
                            "native-accelerator vk={virtual_key} ctrl={command_or_control} shift={shift} action={action} grace={} handled={should_handle}",
                            browser_close_grace_window_active()
                        ),
                    );
                    if !should_handle {
                        return Ok(());
                    }

                    args.SetHandled(true)?;
                    if action == "close-browser" {
                        begin_browser_close_grace_window();
                        focus_main_webview_window(&app_handle);
                    }
                    let _ = app_handle.emit(MENU_ACTION_EVENT, action);
                    Ok(())
                },
            ));

            let mut token = 0;
            controller
                .add_AcceleratorKeyPressed(&handler, &mut token)
                .map_err(|error| error.to_string())
        })();
        let _ = tx.send(result);
    })?;

    match rx.recv() {
        Ok(Ok(())) => Ok(()),
        Ok(Err(message)) => Err(std::io::Error::other(message).into()),
        Err(error) => Err(std::io::Error::other(format!(
            "Failed to receive WebView2 Escape bridge install result: {error}"
        ))
        .into()),
    }
}

#[cfg(not(windows))]
pub fn install_escape_accelerator_bridge<R: Runtime>(
    _browser_webview: &Webview<R>,
    _app_handle: &AppHandle<R>,
) -> tauri::Result<()> {
    Ok(())
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
    use std::collections::HashMap;

    use super::{
        browser_preview_action_for_shortcut,
        browser_preview_action_for_virtual_key_from_prefs_result,
        browser_preview_close_bridge_source, browser_preview_focus_override_source,
        browser_preview_initialization_script,
        browser_preview_initialization_script_from_prefs_result, browser_preview_script_bindings,
        browser_preview_shortcut_preferences_read_warning, browser_webview_diagnostics_enabled,
        browser_webview_emit_failure_warning, set_browser_webview_diagnostics_enabled,
        should_trigger_timeout_fallback, supports_native_navigation, BrowserNavigationAvailability,
        BrowserWebviewState, BrowserWebviewTracker, BROWSER_WEBVIEW_DIAGNOSTICS_EVENT,
        BROWSER_WEBVIEW_DIAGNOSTICS_TEST_LOCK,
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
    fn finish_prefers_native_navigation_availability_over_fallback_history() {
        let mut tracker = BrowserWebviewTracker::default();

        tracker.start("https://example.com/article".to_string());
        tracker.finish("https://example.com/article".to_string(), None);

        tracker.start("https://example.com/next".to_string());
        let state = tracker.finish(
            "https://example.com/next".to_string(),
            Some(BrowserNavigationAvailability {
                can_go_back: false,
                can_go_forward: true,
            }),
        );

        assert!(!state.can_go_back);
        assert!(state.can_go_forward);
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
    fn finish_replaces_new_navigation_history_with_redirected_url() {
        let mut tracker = BrowserWebviewTracker::default();

        tracker.start("https://example.com/article".to_string());
        tracker.finish("https://example.com/article".to_string(), None);

        tracker.start("https://example.com/requested".to_string());
        let state = tracker.finish("https://example.com/redirected".to_string(), None);

        assert_eq!(state.url, "https://example.com/redirected");
        assert_eq!(
            tracker.history,
            vec![
                "https://example.com/article".to_string(),
                "https://example.com/redirected".to_string(),
            ]
        );
        assert_eq!(tracker.history_index, 1);
        assert!(state.can_go_back);
        assert!(!state.can_go_forward);
    }

    #[test]
    fn finish_replaces_reload_history_with_redirected_url() {
        let mut tracker = BrowserWebviewTracker::default();

        tracker.start("https://example.com/article".to_string());
        tracker.finish("https://example.com/article".to_string(), None);

        tracker.start("https://example.com/article".to_string());
        let state = tracker.finish("https://example.com/reloaded".to_string(), None);

        assert_eq!(state.url, "https://example.com/reloaded");
        assert_eq!(
            tracker.history,
            vec!["https://example.com/reloaded".to_string()]
        );
        assert_eq!(tracker.history_index, 0);
        assert!(!state.can_go_back);
        assert!(!state.can_go_forward);
    }

    #[test]
    fn finish_replaces_back_and_forward_history_with_redirected_url() {
        let mut tracker = BrowserWebviewTracker::default();

        tracker.start("https://example.com/article".to_string());
        tracker.finish("https://example.com/article".to_string(), None);

        tracker.start("https://example.com/next".to_string());
        tracker.finish("https://example.com/next".to_string(), None);

        tracker.start("https://example.com/article".to_string());
        let back_state = tracker.finish("https://example.com/back-redirected".to_string(), None);

        assert_eq!(back_state.url, "https://example.com/back-redirected");
        assert_eq!(
            tracker.history,
            vec![
                "https://example.com/back-redirected".to_string(),
                "https://example.com/next".to_string(),
            ]
        );
        assert_eq!(tracker.history_index, 0);
        assert!(!back_state.can_go_back);
        assert!(back_state.can_go_forward);

        tracker.start("https://example.com/next".to_string());
        let forward_state =
            tracker.finish("https://example.com/forward-redirected".to_string(), None);

        assert_eq!(forward_state.url, "https://example.com/forward-redirected");
        assert_eq!(
            tracker.history,
            vec![
                "https://example.com/back-redirected".to_string(),
                "https://example.com/forward-redirected".to_string(),
            ]
        );
        assert_eq!(tracker.history_index, 1);
        assert!(forward_state.can_go_back);
        assert!(!forward_state.can_go_forward);
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
            load_generation: 1,
        };
        let finished = BrowserWebviewState {
            is_loading: false,
            ..loading.clone()
        };

        assert!(should_trigger_timeout_fallback(
            Some(&loading),
            "https://example.com/article",
            1
        ));
        assert!(!should_trigger_timeout_fallback(
            Some(&loading),
            "https://example.com/other",
            1
        ));
        assert!(!should_trigger_timeout_fallback(
            Some(&loading),
            "https://example.com/article",
            2
        ));
        assert!(!should_trigger_timeout_fallback(
            Some(&finished),
            "https://example.com/article",
            1
        ));
        assert!(!should_trigger_timeout_fallback(
            None,
            "https://example.com/article",
            1
        ));
    }

    #[test]
    fn timeout_fallback_generation_advances_for_same_url_reload() {
        let mut tracker = BrowserWebviewTracker::default();

        let first_load = tracker.start("https://example.com/article".to_string());
        tracker.finish("https://example.com/article".to_string(), None);
        let reload = tracker.start("https://example.com/article".to_string());

        assert_eq!(first_load.url, reload.url);
        assert!(reload.load_generation > first_load.load_generation);
        assert!(!should_trigger_timeout_fallback(
            tracker.snapshot().as_ref(),
            &first_load.url,
            first_load.load_generation
        ));
        assert!(should_trigger_timeout_fallback(
            tracker.snapshot().as_ref(),
            &reload.url,
            reload.load_generation
        ));
    }

    #[test]
    fn timeout_fallback_generation_advances_for_same_url_reopen_after_clear() {
        let mut tracker = BrowserWebviewTracker::default();

        let first_load = tracker.start("https://example.com/article".to_string());
        tracker.clear();
        let reopened = tracker.start("https://example.com/article".to_string());

        assert_eq!(first_load.url, reopened.url);
        assert!(reopened.load_generation > first_load.load_generation);
        assert!(!should_trigger_timeout_fallback(
            tracker.snapshot().as_ref(),
            &first_load.url,
            first_load.load_generation
        ));
        assert!(should_trigger_timeout_fallback(
            tracker.snapshot().as_ref(),
            &reopened.url,
            reopened.load_generation
        ));
    }

    #[test]
    fn browser_webview_diagnostics_flag_tracks_runtime_setting() {
        let _guard = BROWSER_WEBVIEW_DIAGNOSTICS_TEST_LOCK.lock().unwrap();

        set_browser_webview_diagnostics_enabled(false);
        assert!(!browser_webview_diagnostics_enabled());

        set_browser_webview_diagnostics_enabled(true);
        assert!(browser_webview_diagnostics_enabled());

        set_browser_webview_diagnostics_enabled(false);
    }

    #[test]
    fn browser_webview_emit_failure_warning_is_diagnostics_only() {
        let warning = browser_webview_emit_failure_warning(
            BROWSER_WEBVIEW_DIAGNOSTICS_EVENT,
            &"listener unavailable",
        );

        assert!(warning.contains("Failed to emit browser webview event"));
        assert!(warning.contains(BROWSER_WEBVIEW_DIAGNOSTICS_EVENT));
        assert!(warning.contains("continuing without frontend notification"));
        assert!(warning.contains("listener unavailable"));
    }

    #[test]
    fn browser_preview_shortcuts_use_defaults_when_no_override_exists() {
        let prefs = HashMap::new();

        assert_eq!(
            browser_preview_action_for_shortcut(&prefs, "m", false, false),
            Some("toggle-read")
        );
        assert_eq!(
            browser_preview_action_for_shortcut(&prefs, "s", false, false),
            Some("toggle-star")
        );
        assert_eq!(
            browser_preview_action_for_shortcut(&prefs, "b", false, false),
            Some("open-in-default-browser")
        );
        assert_eq!(
            browser_preview_action_for_shortcut(&prefs, "j", false, false),
            Some("next-article")
        );
        assert_eq!(
            browser_preview_action_for_shortcut(&prefs, "k", false, false),
            Some("prev-article")
        );
        assert_eq!(
            browser_preview_action_for_shortcut(&prefs, "l", false, false),
            Some("next-feed")
        );
        assert_eq!(
            browser_preview_action_for_shortcut(&prefs, "h", false, false),
            Some("prev-feed")
        );
        assert_eq!(
            browser_preview_action_for_shortcut(&prefs, "r", false, false),
            Some("reload-webview")
        );
    }

    #[test]
    fn browser_preview_shortcuts_follow_saved_overrides() {
        let prefs = HashMap::from([
            ("shortcut_toggle_read".to_string(), "x".to_string()),
            ("shortcut_toggle_star".to_string(), "Shift+S".to_string()),
            (
                "shortcut_open_external_browser".to_string(),
                "⌘+B".to_string(),
            ),
            ("shortcut_next_article".to_string(), "n".to_string()),
            ("shortcut_prev_article".to_string(), "p".to_string()),
            ("shortcut_next_feed".to_string(), "Shift+F".to_string()),
            ("shortcut_prev_feed".to_string(), "⌘+H".to_string()),
            ("shortcut_reload_webview".to_string(), "Shift+R".to_string()),
        ]);

        assert_eq!(
            browser_preview_action_for_shortcut(&prefs, "x", false, false),
            Some("toggle-read")
        );
        assert_eq!(
            browser_preview_action_for_shortcut(&prefs, "S", false, true),
            Some("toggle-star")
        );
        assert_eq!(
            browser_preview_action_for_shortcut(&prefs, "b", true, false),
            Some("open-in-default-browser")
        );
        assert_eq!(
            browser_preview_action_for_shortcut(&prefs, "n", false, false),
            Some("next-article")
        );
        assert_eq!(
            browser_preview_action_for_shortcut(&prefs, "p", false, false),
            Some("prev-article")
        );
        assert_eq!(
            browser_preview_action_for_shortcut(&prefs, "F", false, true),
            Some("next-feed")
        );
        assert_eq!(
            browser_preview_action_for_shortcut(&prefs, "h", true, false),
            Some("prev-feed")
        );
        assert_eq!(
            browser_preview_action_for_shortcut(&prefs, "R", false, true),
            Some("reload-webview")
        );
        assert_eq!(
            browser_preview_action_for_shortcut(&prefs, "j", false, false),
            None
        );
    }

    #[test]
    fn browser_preview_virtual_key_uses_default_shortcuts_when_preferences_fail_to_load() {
        let action = browser_preview_action_for_virtual_key_from_prefs_result(
            Err(std::io::Error::other("preference read failed")),
            0x4D,
            false,
            false,
        );

        assert_eq!(action, Some("toggle-read"));
    }

    #[test]
    fn browser_preview_virtual_key_preference_read_failure_warning_documents_fallback() {
        let error = std::io::Error::other("preference read failed");
        let warning = browser_preview_shortcut_preferences_read_warning(&error);

        assert!(warning.contains("Failed to load embedded browser shortcut preferences"));
        assert!(warning.contains("using default preview shortcuts"));
        assert!(warning.contains("preference read failed"));
    }

    #[test]
    fn browser_preview_virtual_key_keeps_saved_overrides_when_preferences_load() {
        let prefs = HashMap::from([("shortcut_toggle_read".to_string(), "x".to_string())]);

        assert_eq!(
            browser_preview_action_for_virtual_key_from_prefs_result(Ok(prefs), 0x58, false, false),
            Some("toggle-read")
        );
    }

    #[test]
    fn browser_preview_script_bindings_include_supported_preview_shortcuts() {
        let prefs = HashMap::from([
            ("shortcut_toggle_read".to_string(), "x".to_string()),
            ("shortcut_toggle_star".to_string(), "Shift+S".to_string()),
            (
                "shortcut_open_external_browser".to_string(),
                "⌘+B".to_string(),
            ),
            ("shortcut_next_article".to_string(), "n".to_string()),
            ("shortcut_prev_article".to_string(), "p".to_string()),
            ("shortcut_next_feed".to_string(), "Shift+F".to_string()),
            ("shortcut_prev_feed".to_string(), "⌘+H".to_string()),
            ("shortcut_reload_webview".to_string(), "Shift+R".to_string()),
            ("shortcut_close_or_clear".to_string(), "x".to_string()),
        ]);

        let bindings = browser_preview_script_bindings(&prefs);

        assert_eq!(bindings.get("x"), Some(&"toggle-read"));
        assert_eq!(bindings.get("Shift+S"), Some(&"toggle-star"));
        assert_eq!(bindings.get("⌘+b"), Some(&"open-in-default-browser"));
        assert_eq!(bindings.get("n"), Some(&"next-article"));
        assert_eq!(bindings.get("p"), Some(&"prev-article"));
        assert_eq!(bindings.get("Shift+F"), Some(&"next-feed"));
        assert_eq!(bindings.get("⌘+h"), Some(&"prev-feed"));
        assert_eq!(bindings.get("Shift+R"), Some(&"reload-webview"));
        assert!(!bindings.values().any(|action| *action == "close-browser"));
    }

    #[test]
    fn browser_preview_close_bridge_uses_default_escape_binding() {
        let prefs = HashMap::new();

        let script = browser_preview_close_bridge_source(&prefs)
            .expect("default close bridge script should exist");

        assert!(script.contains("\"Escape\""));
        assert!(script.contains("close_browser_webview"));
        assert!(script.contains("go_back_browser_webview"));
        assert!(script.contains("go_forward_browser_webview"));
        assert!(script.contains("getSpaceScrollDirection"));
        assert!(script.contains("window.innerHeight * 0.8"));
        assert!(script.contains("event.button === 3"));
        assert!(script.contains("event.button !== 4"));
    }

    #[test]
    fn browser_preview_close_bridge_guards_against_duplicate_listener_installation() {
        let prefs = HashMap::new();

        let script = browser_preview_close_bridge_source(&prefs)
            .expect("default close bridge script should exist");

        assert!(script.contains("__ULTRA_RSS_BROWSER_BRIDGE_INSTALLED__"));
        assert!(script.contains("if (window.__ULTRA_RSS_BROWSER_BRIDGE_INSTALLED__) return;"));
        assert!(script.contains("configurable: false"));
    }

    #[test]
    fn browser_preview_close_bridge_uses_saved_close_binding() {
        let prefs = HashMap::from([("shortcut_close_or_clear".to_string(), "Shift+X".to_string())]);

        let script = browser_preview_close_bridge_source(&prefs)
            .expect("saved close bridge script should exist");

        assert!(script.contains("\"Shift+X\""));
    }

    #[test]
    fn browser_preview_focus_override_is_disabled_by_default() {
        let prefs = HashMap::new();

        assert!(browser_preview_focus_override_source(&prefs).is_none());
    }

    #[test]
    fn browser_preview_focus_override_masks_visibility_and_focus_when_enabled() {
        let prefs = HashMap::from([("web_preview_keep_focus".to_string(), "true".to_string())]);

        let script = browser_preview_focus_override_source(&prefs)
            .expect("focus override script should exist when preference is enabled");

        assert!(script.contains("'hidden'"));
        assert!(script.contains("'visibilityState'"));
        assert!(script.contains("'hasFocus'"));
        assert!(script.contains("stopImmediatePropagation"));
        assert!(script.contains("originalAddEventListener.call(window"));
        assert!(script.contains("typeof listener === 'object'"));
        assert!(script.contains("visibilitychange"));
        assert!(script.contains("blur"));
    }

    #[test]
    fn browser_preview_initialization_script_includes_focus_override_only_when_preference_is_true()
    {
        let enabled_prefs =
            HashMap::from([("web_preview_keep_focus".to_string(), "true".to_string())]);
        let disabled_prefs =
            HashMap::from([("web_preview_keep_focus".to_string(), "false".to_string())]);
        let missing_prefs = HashMap::new();

        let enabled_script = browser_preview_initialization_script(&enabled_prefs)
            .expect("initialization script should exist when focus override is enabled");
        let disabled_script = browser_preview_initialization_script(&disabled_prefs)
            .expect("close bridge script should still exist when focus override is disabled");
        let missing_script = browser_preview_initialization_script(&missing_prefs)
            .expect("close bridge script should still exist when focus override is unset");

        assert!(enabled_script.contains("__ULTRA_RSS_FOCUS_OVERRIDE_INSTALLED__"));
        assert!(enabled_script.contains("Document.prototype, 'hidden', false"));
        assert!(enabled_script.contains("Document.prototype, 'visibilityState', 'visible'"));
        assert!(enabled_script.contains("Document.prototype, 'hasFocus', () => true"));
        assert!(disabled_script.contains("close_browser_webview"));
        assert!(missing_script.contains("close_browser_webview"));
        assert!(!disabled_script.contains("__ULTRA_RSS_FOCUS_OVERRIDE_INSTALLED__"));
        assert!(!missing_script.contains("__ULTRA_RSS_FOCUS_OVERRIDE_INSTALLED__"));
        assert!(!disabled_script.contains("Document.prototype, 'visibilityState', 'visible'"));
        assert!(!missing_script.contains("Document.prototype, 'visibilityState', 'visible'"));
    }

    #[test]
    fn browser_preview_initialization_script_falls_back_when_preferences_fail_to_load() {
        let script = browser_preview_initialization_script_from_prefs_result(Err(
            std::io::Error::other("preference read failed"),
        ));

        assert_eq!(script, None);
    }
}
