import { describe, expect, it } from "vitest";
import { APP_ACTIONS } from "@/lib/app-actions";
import { shortcutDefinitions, shortcutPrefKey } from "@/lib/keyboard/keyboard-shortcuts";
import backendSource from "../../../src-tauri/src/browser_webview.rs?raw";

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
      const definition = definitionsByPrefKey.get(spec.prefKey);

      expect(definition?.defaultKey).toBe(spec.defaultBinding);
      expect(APP_ACTIONS).toContain(spec.appAction);
    }
  });

  it("keeps Escape outside the script bridge and article actions inside it", () => {
    const specs = extractBrowserPreviewShortcutSpecs(backendSource);
    const scriptBridgeSpecs = specs.filter((spec) => spec.supportsScriptBridge);

    expect(specs.find((spec) => spec.prefKey === "shortcut_close_or_clear")).toMatchObject({
      defaultBinding: "Escape",
      appAction: "close-browser",
      supportsScriptBridge: false,
    });
    expect(scriptBridgeSpecs.map((spec) => spec.appAction)).toEqual([
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
});
