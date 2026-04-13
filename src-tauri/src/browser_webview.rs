use std::{
    collections::HashMap,
    sync::atomic::{AtomicBool, AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, Webview};

pub const BROWSER_WEBVIEW_LABEL: &str = "browser-webview";
pub const BROWSER_WEBVIEW_STATE_CHANGED_EVENT: &str = "browser-webview-state-changed";
pub const BROWSER_WEBVIEW_CLOSED_EVENT: &str = "browser-webview-closed";
pub const BROWSER_WEBVIEW_FALLBACK_EVENT: &str = "browser-webview-fallback";
pub const BROWSER_WEBVIEW_DIAGNOSTICS_EVENT: &str = "browser-webview-diagnostics";
pub const BROWSER_WEBVIEW_DEBUG_INPUT_EVENT: &str = "browser-webview-debug-input";

static BROWSER_WEBVIEW_DIAGNOSTICS_ENABLED: AtomicBool = AtomicBool::new(false);
static BROWSER_CLOSE_GRACE_UNTIL_MS: AtomicU64 = AtomicU64::new(0);
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

fn now_epoch_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
fn begin_browser_close_grace_window() {
    BROWSER_CLOSE_GRACE_UNTIL_MS.store(
        now_epoch_millis().saturating_add(BROWSER_CLOSE_GRACE_WINDOW_MS),
        Ordering::SeqCst,
    );
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
fn browser_close_grace_window_active() -> bool {
    now_epoch_millis() <= BROWSER_CLOSE_GRACE_UNTIL_MS.load(Ordering::SeqCst)
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
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

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
fn browser_preview_script_bridge_source(prefs: &HashMap<String, String>) -> Option<String> {
    let bindings = browser_preview_script_bindings(prefs);
    if bindings.is_empty() {
        return None;
    }

    let bindings_json = serde_json::to_string(&bindings).ok()?;
    Some(format!(
        r#"
(() => {{
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
  window.addEventListener('keydown', (event) => {{
    if (event.defaultPrevented || isEditableTarget(event.target)) {{
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
}})();
"#
    ))
}

#[cfg(windows)]
fn browser_preview_action_for_virtual_key<R: Runtime>(
    app_handle: &AppHandle<R>,
    virtual_key: u32,
    command_or_control: bool,
    shift: bool,
) -> Option<&'static str> {
    use crate::infra::db::sqlite_preference::SqlitePreferenceRepository;
    use crate::repository::preference::PreferenceRepository;

    let key = browser_shortcut_key_from_virtual_key(virtual_key)?;
    let app_state = app_handle.state::<crate::commands::AppState>();
    let db = app_state.db.lock().ok()?;
    let repo = SqlitePreferenceRepository::new(db.reader());
    let prefs = repo.get_all().ok()?;
    browser_preview_action_for_shortcut(&prefs, &key, command_or_control, shift)
}

#[cfg(windows)]
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
            ICoreWebView2AcceleratorKeyPressedEventArgs, COREWEBVIEW2_KEY_EVENT_KIND,
            COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN, COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN,
        },
        WebMessageReceivedEventHandler,
    };
    use windows::core::{HSTRING, PWSTR};
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetKeyState, VK_CONTROL, VK_SHIFT};

    let app_handle = app_handle.clone();
    let shortcut_script = {
        use crate::infra::db::sqlite_preference::SqlitePreferenceRepository;
        use crate::repository::preference::PreferenceRepository;

        let app_state = app_handle.state::<crate::commands::AppState>();
        let db = app_state
            .db
            .lock()
            .map_err(|error| std::io::Error::other(format!("Preference DB lock error: {error}")))?;
        let repo = SqlitePreferenceRepository::new(db.reader());
        let prefs = repo
            .get_all()
            .map_err(|error| std::io::Error::other(format!("Preference read error: {error}")))?;
        browser_preview_script_bridge_source(&prefs)
    };
    let (tx, rx) = mpsc::channel();

    browser_webview.with_webview(move |platform_webview| unsafe {
        let result = (|| {
            let controller = platform_webview.controller();
            let webview = controller.CoreWebView2().map_err(|error| error.to_string())?;

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
                            let _ = app_handle.emit("menu-action", action);
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
                    let _ = app_handle.emit("menu-action", action);
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

pub fn emit_browser_webview_debug_input<R: Runtime>(app_handle: &AppHandle<R>, message: String) {
    if browser_webview_diagnostics_enabled() {
        let _ = app_handle.emit(BROWSER_WEBVIEW_DEBUG_INPUT_EVENT, message);
    }
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
    use std::collections::HashMap;

    use super::{
        browser_preview_action_for_shortcut, browser_preview_script_bindings,
        browser_webview_diagnostics_enabled, set_browser_webview_diagnostics_enabled,
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

    #[test]
    fn browser_webview_diagnostics_flag_tracks_runtime_setting() {
        set_browser_webview_diagnostics_enabled(false);
        assert!(!browser_webview_diagnostics_enabled());

        set_browser_webview_diagnostics_enabled(true);
        assert!(browser_webview_diagnostics_enabled());

        set_browser_webview_diagnostics_enabled(false);
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
}
