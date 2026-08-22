import { describe, expect, it } from "vitest";
import { APP_ACTIONS } from "@/lib/app-actions";
import { isShortcutPreferenceKey, shortcutDefinitions, shortcutPrefKey } from "@/lib/keyboard/keyboard-shortcuts";
import browserWebviewBridgeSource from "../../../src-tauri/src/browser_webview/bridge.rs?raw";
import browserWebviewEscapeAcceleratorSource from "../../../src-tauri/src/browser_webview/escape_accelerator.rs?raw";
// The Rust runtime and command modules were split by responsibility into directories; these
// contracts scan Rust source text for specific blocks, so concatenate every submodule back
// into one string per crate module (order does not matter for the regexes below).
import browserWebviewModSource from "../../../src-tauri/src/browser_webview/mod.rs?raw";
import browserWebviewNavigationSource from "../../../src-tauri/src/browser_webview/navigation.rs?raw";
import browserWebviewPrefsSource from "../../../src-tauri/src/browser_webview/prefs.rs?raw";
import browserWebviewCommandsBoundsSource from "../../../src-tauri/src/commands/browser_webview_commands/bounds.rs?raw";
import browserWebviewCommandsLifecycleSource from "../../../src-tauri/src/commands/browser_webview_commands/lifecycle.rs?raw";
import browserWebviewCommandsModSource from "../../../src-tauri/src/commands/browser_webview_commands/mod.rs?raw";
import browserWebviewCommandsPrivacySource from "../../../src-tauri/src/commands/browser_webview_commands/privacy.rs?raw";

const backendSource = [
  browserWebviewModSource,
  browserWebviewPrefsSource,
  browserWebviewBridgeSource,
  browserWebviewEscapeAcceleratorSource,
  browserWebviewNavigationSource,
].join("\n");
const commandsSource = [
  browserWebviewCommandsModSource,
  browserWebviewCommandsBoundsSource,
  browserWebviewCommandsPrivacySource,
  browserWebviewCommandsLifecycleSource,
].join("\n");

type BrowserPreviewShortcutSpec = {
  prefKey: string;
  defaultBinding: string;
  appAction: string;
  supportsScriptBridge: boolean;
};

function extractBlock(source: string, pattern: RegExp, label: string): string {
  const matched = source.match(pattern)?.[1];
  if (!matched) {
    throw new Error(`Could not find ${label}`);
  }
  return matched;
}

function extractBrowserPreviewShortcutSpecs(source: string): BrowserPreviewShortcutSpec[] {
  const block = extractBlock(
    source,
    /const BROWSER_PREVIEW_SHORTCUT_SPECS: &\[BrowserPreviewShortcutSpec\] = &\[([\s\S]*?)\];/,
    "browser preview shortcut specs block",
  );

  return [
    ...block.matchAll(
      /BrowserPreviewShortcutSpec\s*\{\s*pref_key: "([^"]+)",\s*default_binding: "([^"]+)",\s*app_action: "([^"]+)",\s*supports_script_bridge: (true|false),\s*\}/g,
    ),
  ].map((match) => ({
    prefKey: match[1],
    defaultBinding: match[2],
    appAction: match[3],
    supportsScriptBridge: match[4] === "true",
  }));
}

describe("browser preview shortcut bridge contract", () => {
  it("keeps preview shortcut defaults and actions aligned with app registries", () => {
    const specs = extractBrowserPreviewShortcutSpecs(backendSource);
    const definitionsByPrefKey = new Map(
      shortcutDefinitions.map((definition) => [shortcutPrefKey(definition.id), definition]),
    );

    expect(specs).toHaveLength(9);
    expect(specs.map((spec) => spec.prefKey)).toEqual([
      "shortcut_close_or_clear",
      "shortcut_toggle_read",
      "shortcut_toggle_star",
      "shortcut_open_external_browser",
      "shortcut_next_article",
      "shortcut_prev_article",
      "shortcut_next_feed",
      "shortcut_prev_feed",
      "shortcut_reload_webview",
    ]);

    for (const spec of specs) {
      expect(isShortcutPreferenceKey(spec.prefKey)).toBe(true);
      if (!isShortcutPreferenceKey(spec.prefKey)) {
        throw new Error(`Unexpected browser preview shortcut key: ${spec.prefKey}`);
      }

      const definition = definitionsByPrefKey.get(spec.prefKey);

      expect(definition?.defaultKey).toBe(spec.defaultBinding);
      expect(APP_ACTIONS).toContain(spec.appAction);
    }
  });

  it("keeps Escape in the script bridge so focused WebViews can close", () => {
    const specs = extractBrowserPreviewShortcutSpecs(backendSource);
    const scriptBridgeSpecs = specs.filter((spec) => spec.supportsScriptBridge);

    expect(specs.find((spec) => spec.prefKey === "shortcut_close_or_clear")).toMatchObject({
      defaultBinding: "Escape",
      appAction: "close-browser",
      supportsScriptBridge: true,
    });
    expect(scriptBridgeSpecs.map((spec) => spec.appAction)).toEqual([
      "close-browser",
      "toggle-read",
      "toggle-star",
      "open-in-default-browser",
      "next-article",
      "prev-article",
      "next-feed",
      "prev-feed",
      "reload-webview",
    ]);
  });

  it("keeps the Windows injected script free of bindings/close/mouse capture and native snapshot filtering intact", () => {
    const windowsBridgeBlock = extractBlock(
      backendSource,
      /fn browser_preview_script_bridge_source[\s\S]*?Some\(\s*r#"\n([\s\S]*?)"#\s*\n\s*\.to_string\(\),\s*\)/,
      "Windows browser preview script bridge source",
    );
    const nativeMessageHandlerBlock = extractBlock(
      backendSource,
      /WebMessageReceivedEventHandler::create\(Box::new\(\s*move \|_sender, args\| \{([\s\S]*?)\n\s*Ok\(\(\)\)\s*\},\s*\)\)/,
      "Windows WebMessageReceived handler",
    );
    const bridgeMessageActionBlock = extractBlock(
      backendSource,
      /fn browser_preview_bridge_message_action\([\s\S]*?\) -> Option<String> \{([\s\S]*?)\n\}/,
      "browser preview bridge message action",
    );
    const acceptMessageBlock = extractBlock(
      backendSource,
      /fn should_accept_browser_preview_bridge_message\([\s\S]*?\) -> bool \{([\s\S]*?)\n\}/,
      "browser preview bridge message acceptance",
    );
    const supportedBridgeActionBlock = extractBlock(
      backendSource,
      /fn is_supported_browser_preview_bridge_action\(action: &str\) -> bool \{([\s\S]*?)\n\}/,
      "browser preview bridge action allowlist",
    );

    // Bridge actions this script used to send (bindings dispatch via postMessage, and mouse
    // button 3/4 capture) are discarded at the native layer (plan 019 Phase A/B), so keydown
    // capture here must be limited to Space-key page scrolling and the page-forgeable
    // postMessage channel must be gone entirely.
    expect(windowsBridgeBlock).not.toContain("postMessage");
    expect(windowsBridgeBlock).not.toContain("bindings");
    expect(windowsBridgeBlock).not.toContain("mousedown");
    expect(windowsBridgeBlock).not.toContain("mouseup");
    expect(windowsBridgeBlock).toContain("getSpaceScrollDirection");
    expect(windowsBridgeBlock).toContain("if (!event.defaultPrevented && spaceScrollDirection !== 0)");
    // The native WebMessageReceived handler and its supporting parsers stay in place as
    // defense-in-depth for any page that still tries to forge a postMessage payload directly;
    // they must keep stopping at logging and never dispatching an app action.
    expect(nativeMessageHandlerBlock).toContain(
      "browser_preview_bridge_message_action(&raw_message, snapshot.as_ref())",
    );
    expect(nativeMessageHandlerBlock).not.toContain("app_handle.emit(MENU_ACTION_EVENT, action)");
    expect(nativeMessageHandlerBlock).not.toContain("focus_main_webview_window(&app_handle);");
    expect(bridgeMessageActionBlock).toContain("serde_json::from_str(raw_message).ok()?");
    expect(acceptMessageBlock).toContain("is_supported_browser_preview_bridge_action(&message.action)");
    expect(acceptMessageBlock).toContain("browser_preview_bridge_url_matches(&message.url, &state.url)");
    expect(supportedBridgeActionBlock).toContain("is_supported_browser_preview_script_action(action)");
    expect(supportedBridgeActionBlock).toContain('matches!(action, "mouse-back" | "mouse-forward")');
  });

  it("keeps MENU_ACTION_EVENT dispatch exclusive to native input channels", () => {
    // Page-forgeable channels must never dispatch app actions (plan 019 Phase A):
    // the shortcut-scheme navigation handler lives in browser_webview_commands.rs and
    // must stay emit-free end to end (doc comments may still mention the event name).
    expect(commandsSource).not.toContain("emit(MENU_ACTION_EVENT");
    expect(commandsSource).not.toContain("use crate::menu::MENU_ACTION_EVENT");

    // The only remaining emitters must be hardware-input channels that a hosted page
    // cannot synthesize: Windows AcceleratorKeyPressed and the two macOS NSEvent monitor
    // branches (Escape plus modifier-bound shortcuts).
    const emitCount = backendSource.split("emit(MENU_ACTION_EVENT").length - 1;
    expect(emitCount).toBe(3);
    const acceleratorHandlerBlock = extractBlock(
      backendSource,
      /native-accelerator vk=([\s\S]*?)add_AcceleratorKeyPressed/,
      "Windows AcceleratorKeyPressed handler",
    );
    expect(acceleratorHandlerBlock).toContain("emit(MENU_ACTION_EVENT, action)");
    const macosMonitorBlock = extractBlock(
      backendSource,
      /native-macos-key key_code=([\s\S]*?)addLocalMonitorForEventsMatchingMask_handler/,
      "macOS NSEvent key monitor handler",
    );
    expect(macosMonitorBlock).toContain('emit(MENU_ACTION_EVENT, "close-browser")');
    const macosModifierHandlerBlock = extractBlock(
      backendSource,
      /(if !should_handle_macos_browser_escape_key\([\s\S]*?let _ = app_handle\.emit\(MENU_ACTION_EVENT, action\);\s*return null_mut\(\);)/,
      "macOS NSEvent modifier shortcut handler",
    );
    expect(macosModifierHandlerBlock).toContain("browser_preview_action_for_macos_key_event");
    expect(macosModifierHandlerBlock).toContain("browser_webview_open");
    expect(macosModifierHandlerBlock).toContain("command_or_control");
    expect(macosModifierHandlerBlock).toContain("alt");
    expect(macosModifierHandlerBlock).toContain("emit(MENU_ACTION_EVENT, action)");
  });

  it("keeps the non-Windows injected script free of close/bindings/mouse capture (native monitors own those channels)", () => {
    const closeBridgeBlock = extractBlock(
      backendSource,
      /pub fn browser_preview_close_bridge_source[\s\S]*?Some\(\s*r#"\n([\s\S]*?)"#\s*\n\s*\.to_string\(\),\s*\)/,
      "non-Windows browser preview close bridge source",
    );

    // `invoke('close_browser_webview')` is ACL-denied for the child webview capability
    // (`browser-webview` only grants `core:event:default`), and the scheme-navigation fallback
    // is discarded at the native layer (plan 019 Phase A). Capturing Escape/bindings/mouse
    // buttons 3-4 here only swallowed them for both the app and the page, so none of that
    // capture remains; macOS Escape (NSEvent monitor) and Windows (AcceleratorKeyPressed)
    // handle those shortcuts before the WebView sees them.
    expect(closeBridgeBlock).not.toContain("invoke(");
    expect(closeBridgeBlock).not.toContain("close_browser_webview");
    expect(closeBridgeBlock).not.toContain("closeBrowserPreview");
    expect(closeBridgeBlock).not.toContain("closeBinding");
    expect(closeBridgeBlock).not.toContain("closeInFlight");
    expect(closeBridgeBlock).not.toContain("mouseNavigationInFlight");
    expect(closeBridgeBlock).not.toContain("go_back_browser_webview");
    expect(closeBridgeBlock).not.toContain("go_forward_browser_webview");
    expect(closeBridgeBlock).not.toContain("ultra-rss-browser-shortcut://");
    expect(closeBridgeBlock).not.toContain("emit(MENU_ACTION_EVENT");
  });

  it("keeps bindings dispatch and its scheme-navigation queue out of the non-Windows injected script", () => {
    const closeBridgeBlock = extractBlock(
      backendSource,
      /pub fn browser_preview_close_bridge_source[\s\S]*?Some\(\s*r#"\n([\s\S]*?)"#\s*\n\s*\.to_string\(\),\s*\)/,
      "non-Windows browser preview close bridge source",
    );
    const specs = extractBrowserPreviewShortcutSpecs(backendSource);
    const scriptBridgeActions = specs.filter((spec) => spec.supportsScriptBridge).map((spec) => spec.appAction);

    // The spec table still marks these actions as historically script-bridge-eligible (used by
    // `is_supported_browser_preview_bridge_action` for scheme-nav classification), but the
    // injected script itself no longer builds or dispatches a bindings map for any of them.
    expect(scriptBridgeActions).toContain("toggle-read");
    expect(closeBridgeBlock).not.toContain("const bindings");
    expect(closeBridgeBlock).not.toContain("actionQueue");
    expect(closeBridgeBlock).not.toContain("actionDrainInFlight");
    expect(closeBridgeBlock).not.toContain("queueBridgeAction");
    expect(closeBridgeBlock).not.toContain("requestActionViaNavigation");
    expect(closeBridgeBlock).not.toContain("bindings[normalized]");
    expect(closeBridgeBlock).toContain("getSpaceScrollDirection");
  });
});
