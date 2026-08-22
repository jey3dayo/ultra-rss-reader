import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import browserWebviewBridgeSource from "../../../src-tauri/src/browser_webview/bridge.rs?raw";

/**
 * Extracts the raw `r#"..."#` script body embedded in
 * `pub fn browser_preview_close_bridge_source` and renders it into real,
 * executable JavaScript so the test can execute the actual generated bridge
 * script at runtime (via `eval`) instead of asserting on string fragments of
 * the Rust source.
 *
 * Plan 019 Phase A/B discard every bridge action this script used to send
 * (scheme navigation for keydown bindings/close, and mouse button 3/4
 * capture) at the native layer, so the script no longer sends any of them.
 * The only behavior left here is Space-key page scrolling, which is not an
 * app action and is not affected by that native discard.
 */
function renderCloseBridgeScript(): string {
  const raw = browserWebviewBridgeSource.match(
    /pub fn browser_preview_close_bridge_source[\s\S]*?Some\(\s*r#"\n([\s\S]*?)"#\s*\n\s*\.to_string\(\),\s*\)/,
  )?.[1];
  if (!raw) {
    throw new Error("Could not find non-Windows browser preview close bridge source");
  }

  return raw;
}

describe("browser preview close bridge injected script runtime behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("lets bare and modified keys reach the page instead of swallowing them for a discarded bridge action", () => {
    const script = renderCloseBridgeScript();
    // biome-ignore lint/security/noGlobalEval: executes the actual generated bridge script for a runtime behavior test
    eval(script);

    const dispatch = (key: string, options: KeyboardEventInit = {}) => {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options });
      document.body.dispatchEvent(event);
      return event;
    };

    // Bare keys that used to be captured for app-action bindings (m/s/j/k/etc.) must now
    // reach the page: native monitors, not this script, are the source of truth for shortcuts.
    expect(dispatch("j").defaultPrevented).toBe(false);
    expect(dispatch("m").defaultPrevented).toBe(false);
    // Escape used to be captured to invoke `close_browser_webview`; it must also pass through.
    expect(dispatch("Escape").defaultPrevented).toBe(false);
    // Modifier-bound shortcuts are swallowed by the native monitor before the WebView sees
    // them, so this script must not double-handle them either.
    expect(dispatch("s", { metaKey: true }).defaultPrevented).toBe(false);
  });

  it("still captures Space for in-page scrolling and calls scrollBy", () => {
    const script = renderCloseBridgeScript();
    // biome-ignore lint/security/noGlobalEval: executes the actual generated bridge script for a runtime behavior test
    eval(script);

    const scrollBySpy = vi.fn();
    Object.defineProperty(document, "scrollingElement", {
      configurable: true,
      value: { scrollBy: scrollBySpy },
    });

    const event = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(scrollBySpy).toHaveBeenCalledTimes(1);
  });

  it("does not capture mouse buttons 3/4, leaving default WebView history navigation intact", () => {
    const script = renderCloseBridgeScript();
    // biome-ignore lint/security/noGlobalEval: executes the actual generated bridge script for a runtime behavior test
    eval(script);

    const dispatchMouse = (type: "mousedown" | "mouseup", button: number) => {
      const event = new MouseEvent(type, { button, bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      return event;
    };

    expect(dispatchMouse("mousedown", 3).defaultPrevented).toBe(false);
    expect(dispatchMouse("mouseup", 3).defaultPrevented).toBe(false);
    expect(dispatchMouse("mousedown", 4).defaultPrevented).toBe(false);
    expect(dispatchMouse("mouseup", 4).defaultPrevented).toBe(false);
  });

  it("does not define any bridge action queue, close, or mouse-navigation globals", () => {
    const script = renderCloseBridgeScript();

    expect(script).not.toContain("queueBridgeAction");
    expect(script).not.toContain("actionQueue");
    expect(script).not.toContain("closeBrowserPreview");
    expect(script).not.toContain("closeBinding");
    expect(script).not.toContain("mouseNavigationInFlight");
    expect(script).not.toContain("ultra-rss-browser-shortcut://");
    expect(script).not.toContain("close_browser_webview");
  });
});
