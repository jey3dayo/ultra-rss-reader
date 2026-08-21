import { describe, expect, it } from "vitest";
import { APP_ACTIONS } from "@/lib/app-actions";
import { isShortcutPreferenceKey, shortcutDefinitions, shortcutPrefKey } from "@/lib/keyboard/keyboard-shortcuts";
import backendSource from "../../../src-tauri/src/browser_webview.rs?raw";
import commandsSource from "../../../src-tauri/src/commands/browser_webview_commands.rs?raw";

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

  it("keeps Windows remote-page actions behind postMessage and native snapshot filtering", () => {
    const windowsBridgeBlock = extractBlock(
      backendSource,
      /fn browser_preview_script_bridge_source[\s\S]*?Some\(format!\(\s*r#"\n([\s\S]*?)"#\s*\)\)/,
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

    expect(windowsBridgeBlock).toContain("window.chrome?.webview?.postMessage");
    expect(windowsBridgeBlock).toContain("JSON.stringify({{ action, url: window.location.href }})");
    expect(windowsBridgeBlock).toContain("event.button === 3 ? 'mouse-back' : 'mouse-forward'");
    expect(windowsBridgeBlock).not.toContain("__TAURI_INTERNALS__");
    expect(nativeMessageHandlerBlock).toContain(
      "browser_preview_bridge_message_action(&raw_message, snapshot.as_ref())",
    );
    // Page-origin postMessage must never reach MENU_ACTION_EVENT: the injected bridge script is
    // readable/forgeable by the hosted page, so this native handler stops at logging the parsed
    // action and never dispatches it as an app action (see docs/feed-content-privacy.md).
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
    // cannot synthesize: Windows AcceleratorKeyPressed and the macOS NSEvent monitor.
    const emitCount = backendSource.split("emit(MENU_ACTION_EVENT").length - 1;
    expect(emitCount).toBe(2);
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
  });

  it("keeps non-Windows close/mouse bridge actions on denied-invoke recovery with direct commands", () => {
    const closeBridgeBlock = extractBlock(
      backendSource,
      /pub fn browser_preview_close_bridge_source[\s\S]*?Some\(format!\(\s*r#"\n([\s\S]*?)"#\s*\)\)/,
      "non-Windows browser preview close bridge source",
    );

    expect(closeBridgeBlock).toContain("const getInvoke = () => window.__TAURI_INTERNALS__?.invoke;");
    expect(closeBridgeBlock).toContain("await invoke('close_browser_webview');");
    expect(closeBridgeBlock).toContain("void invoke('go_back_browser_webview')");
    expect(closeBridgeBlock).toContain("void invoke('go_forward_browser_webview')");
    expect(closeBridgeBlock).not.toContain("emit(MENU_ACTION_EVENT");
    expect(closeBridgeBlock).toContain("closeInFlight = false;");
    expect(closeBridgeBlock).toContain(
      "console.error('Failed to close embedded browser webview from bridge:', error);",
    );
    expect(closeBridgeBlock).toContain("if (!state?.can_go_back)");
    expect(closeBridgeBlock).toContain("return closeBrowserPreview();");
    expect(closeBridgeBlock).toContain("ultra-rss-browser-shortcut://mouse-back");
    expect(closeBridgeBlock).toContain("ultra-rss-browser-shortcut://mouse-forward");

    const specs = extractBrowserPreviewShortcutSpecs(backendSource);
    const queueOnlyActions = specs
      .filter((spec) => spec.supportsScriptBridge && spec.appAction !== "close-browser")
      .map((spec) => spec.appAction);
    for (const action of queueOnlyActions) {
      expect(closeBridgeBlock).not.toContain(`invoke('${action}'`);
    }
  });

  it("queues the full script-bridge shortcut set on non-Windows via serialized scheme navigation", () => {
    const closeBridgeBlock = extractBlock(
      backendSource,
      /pub fn browser_preview_close_bridge_source[\s\S]*?Some\(format!\(\s*r#"\n([\s\S]*?)"#\s*\)\)/,
      "non-Windows browser preview close bridge source",
    );
    const specs = extractBrowserPreviewShortcutSpecs(backendSource);
    const scriptBridgeActions = specs.filter((spec) => spec.supportsScriptBridge).map((spec) => spec.appAction);

    expect(scriptBridgeActions).toContain("toggle-read");
    expect(closeBridgeBlock).toContain("const bindings = {bindings_json};");
    expect(closeBridgeBlock).toContain("const actionQueue = [];");
    expect(closeBridgeBlock).toContain("let actionDrainInFlight = false;");
    expect(closeBridgeBlock).toContain("window.location.href = 'ultra-rss-browser-shortcut://' + action;");
    expect(closeBridgeBlock).toContain("const action = bindings[normalized];");
    expect(closeBridgeBlock).toContain("queueBridgeAction(action);");
    expect(closeBridgeBlock).toContain("if (normalized === closeBinding) {");
  });
});
