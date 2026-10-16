use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Duration;

use tauri::{Emitter, Manager};

use super::lifecycle::*;
use super::messages::*;
use super::window::*;
use crate::MAIN_WINDOW_CLOSE_BLOCKED_EVENT;

#[cfg(not(test))]
pub(crate) fn focus_main_webview_on_startup<R: tauri::Runtime>(
    app_handle: tauri::AppHandle<R>,
    active: Arc<AtomicBool>,
) {
    tauri::async_runtime::spawn(async move {
        // `restore_state` queues the resized frame on the event loop; clamp and
        // show only after that frame is applied so users see one final geometry.
        tokio::time::sleep(Duration::from_millis(250)).await;

        if !startup_focus_restore_is_active(&active) {
            return;
        }

        let app_handle_for_main_thread = app_handle.clone();
        let active_for_main_thread = active.clone();
        if let Err(error) = app_handle.run_on_main_thread(move || {
            let main_window = app_handle_for_main_thread.get_webview_window("main");
            let main_webview = app_handle_for_main_thread.get_webview("main");
            if startup_focus_restore_decision(
                startup_focus_restore_is_active(&active_for_main_thread),
                main_window.is_some(),
                main_webview.is_some(),
            ) != StartupFocusRestoreDecision::Restore
            {
                return;
            }

            let Some(window) = main_window else {
                return;
            };
            let Some(webview) = main_webview else {
                return;
            };

            #[cfg(desktop)]
            if let Some(tauri_window) = app_handle_for_main_thread.get_window("main") {
                clamp_main_window_size_after_state_restore(&tauri_window);
                match tauri_window.inner_size() {
                    Ok(size) => {
                        enforce_main_window_min_size_after_window_resize(&tauri_window, size);
                    }
                    Err(error) => {
                        tracing::warn!(
                            "Failed to read main window size before presenting startup window: {error}"
                        );
                    }
                }
            }

            if let Err(error) = window.show() {
                tracing::warn!("{}", startup_main_window_show_warning(&error));
            }
            if let Err(error) = window.set_focus() {
                tracing::warn!("{}", startup_main_window_focus_warning(&error));
            }
            if let Err(error) = webview.set_focus() {
                tracing::warn!("{}", startup_main_webview_focus_warning(&error));
            }
        }) {
            if startup_focus_restore_is_active(&active) {
                tracing::warn!("{}", startup_focus_main_thread_warning(&error));
            }
        }
    });
}

#[cfg(not(test))]
pub(crate) fn focus_main_webview_on_second_launch<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
) {
    if let Some(window) = app_handle.get_webview_window("main") {
        if let Err(error) = window.show() {
            tracing::warn!("{}", second_launch_main_window_show_warning(&error));
        }
        if let Err(error) = window.set_focus() {
            tracing::warn!("{}", second_launch_main_window_focus_warning(&error));
        }
    }

    if let Some(webview) = app_handle.get_webview("main") {
        if let Err(error) = webview.set_focus() {
            tracing::warn!("{}", second_launch_main_webview_focus_warning(&error));
        }
    }
}

#[cfg(not(test))]
pub(crate) fn emit_main_window_close_blocked(app_handle: &tauri::AppHandle) {
    if let Err(error) = app_handle.emit(MAIN_WINDOW_CLOSE_BLOCKED_EVENT, ()) {
        tracing::warn!("Failed to emit main window close blocked lifecycle event: {error}");
    }
}
