//! Native OS-level channels that intercept the embedded browser preview's Escape/close and
//! modifier-bound shortcuts before the hosted page can see or forge them: the Windows
//! WebView2 `AcceleratorKeyPressed` handler and the macOS `NSEvent` local key monitor.

use std::collections::HashMap;

#[cfg(target_os = "macos")]
use std::sync::atomic::AtomicBool;
#[cfg(windows)]
use std::sync::atomic::{AtomicU64, Ordering};
#[cfg(windows)]
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Emitter, Manager, Runtime, Webview};

#[cfg(any(windows, target_os = "macos"))]
use crate::menu::MENU_ACTION_EVENT;

#[cfg(windows)]
use super::bridge::browser_preview_bridge_message_action;
#[cfg(windows)]
use super::bridge::browser_preview_script_bridge_source;
use super::emit_browser_webview_debug_input;
#[cfg(windows)]
use super::prefs::browser_preview_action_for_virtual_key;
#[cfg(windows)]
use super::prefs::load_browser_preview_prefs;
#[cfg(target_os = "macos")]
use super::prefs::try_load_browser_preview_prefs;
#[cfg(target_os = "macos")]
use super::prefs::{
    browser_preview_action_for_macos_key_event, browser_preview_shortcut_preferences_read_warning,
};

#[cfg(target_os = "macos")]
static BROWSER_MACOS_ESCAPE_MONITOR_INSTALLED: AtomicBool = AtomicBool::new(false);
#[cfg(windows)]
static BROWSER_CLOSE_GRACE_UNTIL_MS: AtomicU64 = AtomicU64::new(0);
#[cfg(windows)]
const BROWSER_CLOSE_GRACE_WINDOW_MS: u64 = 800;

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

#[cfg_attr(not(any(test, target_os = "macos")), allow(dead_code))]
pub(super) fn should_handle_macos_browser_escape_key(
    key_code: u16,
    browser_webview_open: bool,
) -> bool {
    const MACOS_ESCAPE_KEY_CODE: u16 = 53;

    browser_webview_open && key_code == MACOS_ESCAPE_KEY_CODE
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

#[cfg(target_os = "macos")]
fn focus_main_webview_window<R: Runtime>(app_handle: &AppHandle<R>) {
    if let Some(webview) = app_handle.get_webview("main") {
        let _ = webview.set_focus();
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
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetKeyState, VK_CONTROL, VK_MENU, VK_SHIFT};

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
                        let raw_message = take_windows_pwstr(message);
                        let snapshot = app_handle
                            .try_state::<crate::commands::AppState>()
                            .and_then(|app_state| {
                                app_state
                                    .browser_webview
                                    .lock()
                                    .ok()
                                    .and_then(|tracker| tracker.snapshot())
                            });
                        let action =
                            browser_preview_bridge_message_action(&raw_message, snapshot.as_ref());
                        emit_browser_webview_debug_input(
                            &app_handle,
                            format!(
                                "native-script raw_message={raw_message} action={}",
                                action.as_deref().unwrap_or("ignored")
                            ),
                        );
                        // Page-origin postMessage cannot be trusted as an app-action source: the
                        // injected bridge script is readable/forgeable by the hosted page (see
                        // `docs/feed-content-privacy.md`), so this handler intentionally stops at
                        // logging and never dispatches `MENU_ACTION_EVENT`. Native
                        // `AcceleratorKeyPressed` below is the only page-independent channel that
                        // still emits app actions for keyboard shortcuts.
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
                    let alt = GetKeyState(VK_MENU.0 as i32) < 0;
                    let Some(action) = browser_preview_action_for_virtual_key(
                        &app_handle,
                        virtual_key,
                        command_or_control,
                        shift,
                        alt,
                    ) else {
                        emit_browser_webview_debug_input(
                            &app_handle,
                            format!(
                                "native-accelerator vk={virtual_key} ctrl={command_or_control} shift={shift} alt={alt} action=none grace={}",
                                browser_close_grace_window_active()
                            ),
                        );
                        return Ok(());
                    };

                    let native_modifier = command_or_control || alt;
                    let should_handle = action == "close-browser"
                        || (is_browser_close_grace_action(action) && browser_close_grace_window_active())
                        || native_modifier;
                    emit_browser_webview_debug_input(
                        &app_handle,
                        format!(
                            "native-accelerator vk={virtual_key} ctrl={command_or_control} shift={shift} alt={alt} action={action} grace={} handled={should_handle}",
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

#[cfg(target_os = "macos")]
pub fn install_escape_accelerator_bridge<R: Runtime>(
    _browser_webview: &Webview<R>,
    app_handle: &AppHandle<R>,
) -> tauri::Result<()> {
    use std::{ptr::null_mut, sync::atomic::Ordering};

    use objc2_app_kit::{NSEvent, NSEventMask, NSEventModifierFlags};

    if BROWSER_MACOS_ESCAPE_MONITOR_INSTALLED
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Ok(());
    }

    let app_handle = app_handle.clone();
    let handler = block2::RcBlock::new(move |event: std::ptr::NonNull<NSEvent>| -> *mut NSEvent {
        let (key_code, modifier_flags, characters_ignoring_modifiers) = unsafe {
            (
                event.as_ref().keyCode(),
                event.as_ref().modifierFlags(),
                event.as_ref().charactersIgnoringModifiers(),
            )
        };
        let browser_webview_open = app_handle
            .try_state::<crate::commands::AppState>()
            .and_then(|app_state| {
                app_state
                    .browser_webview
                    .lock()
                    .ok()
                    .and_then(|tracker| tracker.snapshot())
            })
            .is_some();

        if !should_handle_macos_browser_escape_key(key_code, browser_webview_open) {
            let command_or_control = modifier_flags
                .intersects(NSEventModifierFlags::Command | NSEventModifierFlags::Control);
            let shift = modifier_flags.contains(NSEventModifierFlags::Shift);
            let alt = modifier_flags.contains(NSEventModifierFlags::Option);
            // This local monitor sees every KeyDown in the app; gate on "browser open +
            // modifier held" before touching the DB so plain typing never pays a prefs read.
            if !browser_webview_open || !(command_or_control || alt) {
                return event.as_ptr();
            }
            let Some(prefs_result) = try_load_browser_preview_prefs(&app_handle) else {
                return event.as_ptr();
            };
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
            let characters_ignoring_modifiers = characters_ignoring_modifiers
                .map(|characters| characters.to_string())
                .unwrap_or_default();
            let Some(action) = browser_preview_action_for_macos_key_event(
                &prefs,
                &characters_ignoring_modifiers,
                command_or_control,
                shift,
                alt,
                browser_webview_open,
            ) else {
                return event.as_ptr();
            };

            emit_browser_webview_debug_input(
                &app_handle,
                format!(
                    "native-macos-key key_code={key_code} cmd_or_control={command_or_control} shift={shift} alt={alt} action={action} handled=true"
                ),
            );
            if action == "close-browser" {
                focus_main_webview_window(&app_handle);
            }
            let _ = app_handle.emit(MENU_ACTION_EVENT, action);
            return null_mut();
        }

        emit_browser_webview_debug_input(
            &app_handle,
            format!("native-macos-key key_code={key_code} action=close-browser handled=true"),
        );
        focus_main_webview_window(&app_handle);
        let _ = app_handle.emit(MENU_ACTION_EVENT, "close-browser");
        null_mut()
    });

    let monitor = unsafe {
        NSEvent::addLocalMonitorForEventsMatchingMask_handler(NSEventMask::KeyDown, &handler)
    };

    if let Some(monitor) = monitor {
        std::mem::forget(monitor);
        std::mem::forget(handler);
        Ok(())
    } else {
        BROWSER_MACOS_ESCAPE_MONITOR_INSTALLED.store(false, Ordering::SeqCst);
        Err(std::io::Error::other("Failed to install macOS embedded browser Escape monitor").into())
    }
}

#[cfg(all(not(windows), not(target_os = "macos")))]
pub fn install_escape_accelerator_bridge<R: Runtime>(
    _browser_webview: &Webview<R>,
    _app_handle: &AppHandle<R>,
) -> tauri::Result<()> {
    Ok(())
}
