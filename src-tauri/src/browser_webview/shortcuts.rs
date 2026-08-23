use std::collections::HashMap;

#[cfg(windows)]
use tauri::{AppHandle, Runtime};

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
pub(super) struct BrowserPreviewShortcutSpec {
    pref_key: &'static str,
    default_binding: &'static str,
    app_action: &'static str,
    #[cfg_attr(not(any(test, windows)), allow(dead_code))]
    supports_script_bridge: bool,
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
pub(super) const BROWSER_PREVIEW_SHORTCUT_SPECS: &[BrowserPreviewShortcutSpec] = &[
    BrowserPreviewShortcutSpec {
        pref_key: "shortcut_close_or_clear",
        default_binding: "Escape",
        app_action: "close-browser",
        supports_script_bridge: true,
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

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
pub(super) fn normalize_browser_shortcut(
    key: &str,
    command_or_control: bool,
    shift: bool,
    alt: bool,
) -> Option<String> {
    if key.is_empty() {
        return None;
    }

    let mut parts = Vec::new();
    if command_or_control {
        parts.push("⌘".to_string());
    }
    if alt {
        parts.push("Alt".to_string());
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
pub(super) fn normalize_saved_browser_shortcut(binding: &str) -> Option<String> {
    let mut command_or_control = false;
    let mut alt = false;
    let mut shift = false;
    let mut key: Option<&str> = None;

    for segment in binding
        .split('+')
        .map(str::trim)
        .filter(|segment| !segment.is_empty())
    {
        match segment {
            "⌘" | "Ctrl" | "ctrl" | "CmdOrCtrl" | "cmdorctrl" | "Command" | "command" | "Cmd"
            | "cmd" | "Control" | "control" => {
                command_or_control = true;
            }
            "Alt" | "alt" | "Option" | "option" | "⌥" => {
                alt = true;
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

    normalize_browser_shortcut(key?, command_or_control, shift, alt)
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
pub fn browser_preview_action_for_shortcut(
    prefs: &HashMap<String, String>,
    key: &str,
    command_or_control: bool,
    shift: bool,
    alt: bool,
) -> Option<&'static str> {
    let normalized = normalize_browser_shortcut(key, command_or_control, shift, alt)?;

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
pub(super) fn is_supported_browser_preview_script_action(action: &str) -> bool {
    BROWSER_PREVIEW_SHORTCUT_SPECS
        .iter()
        .any(|shortcut| shortcut.supports_script_bridge && shortcut.app_action == action)
}

pub fn is_supported_browser_preview_bridge_action(action: &str) -> bool {
    is_supported_browser_preview_script_action(action)
        || matches!(action, "mouse-back" | "mouse-forward")
}

/// NSFunctionKey range (arrow keys, etc.) as documented on `NSEvent`: characters in
/// U+F700-U+F8FF are "function key" characters, not printable text, and must be mapped
/// to their symbolic name instead of used literally.
const MACOS_NS_UP_ARROW_FUNCTION_KEY: char = '\u{F700}';
const MACOS_NS_DOWN_ARROW_FUNCTION_KEY: char = '\u{F701}';
const MACOS_NS_LEFT_ARROW_FUNCTION_KEY: char = '\u{F702}';
const MACOS_NS_RIGHT_ARROW_FUNCTION_KEY: char = '\u{F703}';
const MACOS_NS_FUNCTION_KEY_RANGE_START: char = '\u{F700}';
const MACOS_NS_FUNCTION_KEY_RANGE_END: char = '\u{F8FF}';
const MACOS_NS_FUNCTION_KEY_F1: char = '\u{F704}';
const MACOS_NS_FUNCTION_KEY_F12: char = '\u{F70F}';

/// Resolves the logical shortcut key from `NSEvent.charactersIgnoringModifiers()` instead
/// of a fixed US-keyboard `keyCode` table, so layout-dependent bindings (JIS symbols,
/// QWERTZ/AZERTY letters) match the same logical key the frontend recorded from
/// `KeyboardEvent.key`. See `.claude/rules` PR #67 review: a keyCode table silently
/// mismatches on any non-US physical layout.
#[cfg_attr(not(any(test, target_os = "macos")), allow(dead_code))]
pub(super) fn browser_shortcut_key_from_macos_event_characters(characters: &str) -> Option<String> {
    let mut chars = characters.chars();
    let first = chars.next()?;
    if chars.next().is_some() {
        // Dead keys / IME composition can yield multi-character strings; those are not a
        // single logical shortcut key we can normalize against a saved binding.
        return None;
    }

    Some(match first {
        '\r' | '\u{3}' => "Enter".to_string(),
        '\t' => "Tab".to_string(),
        '\u{7f}' | '\u{8}' => "Backspace".to_string(),
        '\u{1b}' => "Escape".to_string(),
        ' ' => "Space".to_string(),
        MACOS_NS_UP_ARROW_FUNCTION_KEY => "ArrowUp".to_string(),
        MACOS_NS_DOWN_ARROW_FUNCTION_KEY => "ArrowDown".to_string(),
        MACOS_NS_LEFT_ARROW_FUNCTION_KEY => "ArrowLeft".to_string(),
        MACOS_NS_RIGHT_ARROW_FUNCTION_KEY => "ArrowRight".to_string(),
        function_key @ MACOS_NS_FUNCTION_KEY_F1..=MACOS_NS_FUNCTION_KEY_F12 => {
            format!(
                "F{}",
                function_key as u32 - MACOS_NS_FUNCTION_KEY_F1 as u32 + 1
            )
        }
        unmapped_function_key
            if (MACOS_NS_FUNCTION_KEY_RANGE_START..=MACOS_NS_FUNCTION_KEY_RANGE_END)
                .contains(&unmapped_function_key) =>
        {
            return None;
        }
        other => other.to_string(),
    })
}

#[cfg_attr(not(any(test, target_os = "macos")), allow(dead_code))]
pub(super) fn browser_preview_action_for_macos_key_event(
    prefs: &HashMap<String, String>,
    characters: &str,
    command_or_control: bool,
    shift: bool,
    alt: bool,
    browser_webview_open: bool,
) -> Option<&'static str> {
    if !browser_webview_open || !(command_or_control || alt) {
        return None;
    }

    let key = browser_shortcut_key_from_macos_event_characters(characters)?;
    browser_preview_action_for_shortcut(prefs, &key, command_or_control, shift, alt)
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
pub(super) fn browser_preview_action_for_virtual_key_from_prefs_result(
    prefs_result: Result<HashMap<String, String>, std::io::Error>,
    virtual_key: u32,
    command_or_control: bool,
    shift: bool,
    alt: bool,
) -> Option<&'static str> {
    let key = browser_shortcut_key_from_virtual_key(virtual_key, shift)?;
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
    browser_preview_action_for_shortcut(&prefs, &key, command_or_control, shift, alt)
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
pub(super) fn browser_preview_shortcut_preferences_read_warning(error: &std::io::Error) -> String {
    format!(
        "Failed to load embedded browser shortcut preferences; using default preview shortcuts: {error}"
    )
}

#[cfg(windows)]
pub(super) fn browser_preview_action_for_virtual_key<R: Runtime>(
    app_handle: &AppHandle<R>,
    virtual_key: u32,
    command_or_control: bool,
    shift: bool,
    alt: bool,
) -> Option<&'static str> {
    let prefs_result = super::prefs::try_load_browser_preview_prefs(app_handle)?;
    browser_preview_action_for_virtual_key_from_prefs_result(
        prefs_result,
        virtual_key,
        command_or_control,
        shift,
        alt,
    )
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
pub(super) fn browser_shortcut_key_from_virtual_key_name(virtual_key: u32) -> Option<&'static str> {
    // Keep the stable Win32 VK_* values in a platform-independent pure table so this mapping
    // remains unit-testable on non-Windows hosts; layout-dependent keys use MapVirtualKeyW below.
    match virtual_key {
        0x0D => Some("Enter"),
        0x09 => Some("Tab"),
        0x08 => Some("Backspace"),
        0x20 => Some("Space"),
        0x25 => Some("ArrowLeft"),
        0x26 => Some("ArrowUp"),
        0x27 => Some("ArrowRight"),
        0x28 => Some("ArrowDown"),
        0x70 => Some("F1"),
        0x71 => Some("F2"),
        0x72 => Some("F3"),
        0x73 => Some("F4"),
        0x74 => Some("F5"),
        0x75 => Some("F6"),
        0x76 => Some("F7"),
        0x77 => Some("F8"),
        0x78 => Some("F9"),
        0x79 => Some("F10"),
        0x7A => Some("F11"),
        0x7B => Some("F12"),
        0x1B => Some("Escape"),
        _ => None,
    }
}

/// Windows virtual-key code for the Shift key (`VK_SHIFT` = 0x10), duplicated here as a
/// plain constant so `synthesize_shift_only_key_state` stays testable without the
/// `windows` crate's Windows-only bindings.
pub(super) const VIRTUAL_KEY_SHIFT_INDEX: usize = 0x10;
/// `GetKeyState`/`ToUnicode` key-state array convention: the high bit (0x80) marks a key
/// as currently down.
pub(super) const KEY_STATE_DOWN_BIT: u8 = 0x80;

/// Builds a `ToUnicode` key-state array reflecting only the Shift key, leaving Ctrl/Alt
/// unset even when the accelerator handler observed them held. Ctrl/Alt intentionally stay
/// out of this synthesized state: including them would let `ToUnicode` apply AltGr-style
/// composition on layouts where Ctrl+Alt changes the produced character, but shortcuts here
/// are recorded and matched on the base character plus an explicit Shift flag, not on
/// AltGr composition.
#[cfg_attr(not(any(test, windows)), allow(dead_code))]
pub(super) fn synthesize_shift_only_key_state(shift: bool) -> [u8; 256] {
    let mut key_state = [0u8; 256];
    if shift {
        key_state[VIRTUAL_KEY_SHIFT_INDEX] = KEY_STATE_DOWN_BIT;
    }
    key_state
}

#[cfg(windows)]
pub(super) fn browser_shortcut_key_from_windows_layout(
    virtual_key: u32,
    shift: bool,
) -> Option<String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{MapVirtualKeyW, ToUnicode, MAPVK_VK_TO_VSC};

    // Bit 2 (0x4) tells `ToUnicode` not to modify the calling thread's keyboard state
    // (Windows 10 1607+). Without it, probing a shortcut here would corrupt any dead-key
    // composition the user is mid-way through typing into the page itself.
    const TOUNICODE_DO_NOT_MODIFY_KEYBOARD_STATE: u32 = 0x4;

    let scan_code = unsafe { MapVirtualKeyW(virtual_key, MAPVK_VK_TO_VSC) };
    let key_state = synthesize_shift_only_key_state(shift);
    let mut buffer = [0u16; 8];
    let result = unsafe {
        ToUnicode(
            virtual_key,
            scan_code,
            Some(&key_state),
            &mut buffer,
            TOUNICODE_DO_NOT_MODIFY_KEYBOARD_STATE,
        )
    };

    // `result < 0`: dead key. `result == 0`: no translation. `result > 1`: composed into
    // more than one UTF-16 code unit. None of these map to a single stable logical key.
    if result != 1 {
        return None;
    }

    let character = char::decode_utf16(buffer[..1].iter().copied())
        .next()?
        .ok()?;
    (!character.is_control()).then(|| character.to_string())
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
pub(super) fn browser_shortcut_key_from_virtual_key(
    virtual_key: u32,
    shift: bool,
) -> Option<String> {
    if let Some(named_key) = browser_shortcut_key_from_virtual_key_name(virtual_key) {
        return Some(named_key.to_string());
    }

    match virtual_key {
        // The fixed "0".."9" table only applies unshifted. Shift+digit produces a
        // layout-dependent symbol (US: "!", "@", ...), which must go through `ToUnicode`
        // so the resolved key matches the shift-applied glyph the frontend recorded from
        // `KeyboardEvent.key` (see PR #71 review: a fixed digit table ignored Shift).
        0x30..=0x39 if !shift => char::from_u32(virtual_key).map(|ch| ch.to_string()),
        0x41..=0x5A => char::from_u32(virtual_key).map(|ch| ch.to_ascii_lowercase().to_string()),
        #[cfg(windows)]
        _ => browser_shortcut_key_from_windows_layout(virtual_key, shift),
        #[cfg(not(windows))]
        _ => None,
    }
}
