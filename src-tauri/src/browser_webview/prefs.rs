//! Preference-driven browser preview initialization: loading persisted values and composing
//! the optional focus/close scripts injected into the child webview.

use std::collections::HashMap;

use tauri::{AppHandle, Manager, Runtime};

#[cfg(any(test, not(windows)))]
use super::bridge::browser_preview_close_bridge_source;

#[cfg(any(test, target_os = "macos"))]
pub(super) use super::shortcuts::browser_preview_action_for_macos_key_event;
#[cfg(windows)]
pub(super) use super::shortcuts::browser_preview_action_for_virtual_key;
#[cfg(any(test, target_os = "macos"))]
pub(super) use super::shortcuts::browser_preview_shortcut_preferences_read_warning;
pub use super::shortcuts::is_supported_browser_preview_bridge_action;
#[cfg(test)]
pub(super) use super::shortcuts::{
    browser_preview_action_for_shortcut, browser_preview_action_for_virtual_key_from_prefs_result,
    browser_shortcut_key_from_macos_event_characters, browser_shortcut_key_from_virtual_key,
    browser_shortcut_key_from_virtual_key_name, synthesize_shift_only_key_state,
    KEY_STATE_DOWN_BIT, VIRTUAL_KEY_SHIFT_INDEX,
};

pub fn load_browser_preview_prefs<R: Runtime>(
    app_handle: &AppHandle<R>,
) -> Result<HashMap<String, String>, std::io::Error> {
    let app_state = app_handle.state::<crate::commands::AppState>();
    let db = app_state
        .db
        .lock()
        .map_err(|error| std::io::Error::other(format!("Preference DB lock error: {error}")))?;
    load_browser_preview_prefs_from_db(&db)
}

pub(super) fn load_browser_preview_prefs_from_db(
    db: &crate::infra::db::connection::DbManager,
) -> Result<HashMap<String, String>, std::io::Error> {
    use crate::infra::db::sqlite_preference::SqlitePreferenceRepository;
    use crate::repository::preference::PreferenceRepository;

    let repo = SqlitePreferenceRepository::new(db.reader());
    repo.get_all()
        .map_err(|error| std::io::Error::other(format!("Preference read error: {error}")))
}

/// Loads preferences without allowing a native key monitor to wait behind a database operation.
/// A lock miss is distinct from a read error: the caller must pass the event through so a
/// shortcut is not dispatched from a stale or incomplete preference snapshot.
#[cfg_attr(not(any(windows, target_os = "macos")), allow(dead_code))]
pub(super) fn try_load_browser_preview_prefs<R: Runtime>(
    app_handle: &AppHandle<R>,
) -> Option<Result<HashMap<String, String>, std::io::Error>> {
    let app_state = app_handle.state::<crate::commands::AppState>();
    try_load_browser_preview_prefs_from_db(&app_state.db)
}

pub(super) fn try_load_browser_preview_prefs_from_db(
    db: &std::sync::Mutex<crate::infra::db::connection::DbManager>,
) -> Option<Result<HashMap<String, String>, std::io::Error>> {
    let db = match crate::commands::try_lock_db(db) {
        Ok(db) => db,
        Err(error) => {
            tracing::warn!(
                "Skipping embedded browser shortcut dispatch because preference DB lock is unavailable: {error}"
            );
            return None;
        }
    };

    Some(load_browser_preview_prefs_from_db(&db))
}

pub fn browser_preview_focus_override_source(prefs: &HashMap<String, String>) -> Option<String> {
    if prefs.get("web_preview_keep_focus").map(String::as_str) != Some("true") {
        return None;
    }

    Some(
        r#"
(() => {
  if (window.__ULTRA_RSS_FOCUS_OVERRIDE_INSTALLED__ || window.__MBU_FOCUS_OVERRIDE_APPLIED__) return;
  Object.defineProperty(window, '__ULTRA_RSS_FOCUS_OVERRIDE_INSTALLED__', {
    configurable: false,
    value: true,
  });
  Object.defineProperty(window, '__MBU_FOCUS_OVERRIDE_APPLIED__', {
    configurable: false,
    value: true,
  });

  try {
    document.documentElement?.setAttribute('data-mbu-focus-override-applied', 'true');
  } catch (_) {}

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
        writable: true,
        value,
      });
    } catch (_) {}
  };
  const ignoreEventHandlerProperty = (target, property) => {
    try {
      Object.defineProperty(target, property, {
        configurable: true,
        get: () => null,
        set: () => {},
      });
    } catch (_) {}
  };

  defineGetter(Document.prototype, 'hidden', false);
  defineGetter(document, 'hidden', false);
  defineGetter(Document.prototype, 'visibilityState', 'visible');
  defineGetter(document, 'visibilityState', 'visible');
  defineGetter(Document.prototype, 'webkitHidden', false);
  defineGetter(document, 'webkitHidden', false);
  defineGetter(Document.prototype, 'webkitVisibilityState', 'visible');
  defineGetter(document, 'webkitVisibilityState', 'visible');
  defineValue(Document.prototype, 'hasFocus', () => true);
  defineValue(document, 'hasFocus', () => true);

  ignoreEventHandlerProperty(window, 'onblur');
  ignoreEventHandlerProperty(window, 'onfocus');
  ignoreEventHandlerProperty(document, 'onvisibilitychange');
  ignoreEventHandlerProperty(document, 'onwebkitvisibilitychange');

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
