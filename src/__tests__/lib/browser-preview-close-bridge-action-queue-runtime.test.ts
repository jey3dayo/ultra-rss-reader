import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import backendSource from "../../../src-tauri/src/browser_webview.rs?raw";

/**
 * Extracts the raw `r#"..."#` script body embedded in
 * `pub fn browser_preview_close_bridge_source` and renders it into real,
 * executable JavaScript by:
 * - collapsing the `format!` macro's escaped `{{` / `}}` brace pairs, and
 * - substituting the `{close_binding_json}` / `{bindings_json}` placeholders
 *   with concrete JSON payloads for this test.
 *
 * This lets the test execute the actual generated bridge script at runtime
 * (via `eval`) instead of asserting on string fragments of the Rust source.
 */
function renderCloseBridgeScript(closeBinding: string, bindings: Record<string, string>): string {
  const raw = backendSource.match(
    /pub fn browser_preview_close_bridge_source[\s\S]*?Some\(format!\(\s*r#"\n([\s\S]*?)"#\s*\)\)/,
  )?.[1];
  if (!raw) {
    throw new Error("Could not find non-Windows browser preview close bridge source");
  }

  return raw
    .replace(/\{\{/g, "{")
    .replace(/\}\}/g, "}")
    .replace("{close_binding_json}", JSON.stringify(closeBinding))
    .replace("{bindings_json}", JSON.stringify(bindings));
}

describe("browser preview close bridge action queue runtime behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("drains queued bridge actions in FIFO order, one at a time, and releases the drain flag when idle", () => {
    const hrefs: string[] = [];
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        get href() {
          return "";
        },
        set href(value: string) {
          hrefs.push(value);
        },
      },
    });

    const script = renderCloseBridgeScript("Escape", {
      a: "toggle-read",
      b: "toggle-star",
    });

    // biome-ignore lint/security/noGlobalEval: executes the actual generated bridge script for a runtime behavior test
    eval(script);

    const dispatchKey = (key: string) => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    };

    // Scenario: two fast successive keydowns enqueue two distinct actions.
    dispatchKey("a");
    dispatchKey("b");

    // Scenario: serialization. The first action drains synchronously (the
    // drain-in-flight flag was false), but the second stays queued because
    // the flag is now true; only a setTimeout(0) continuation can pick it up.
    expect(hrefs).toEqual(["ultra-rss-browser-shortcut://toggle-read"]);

    vi.runOnlyPendingTimers();

    // Scenario: FIFO order + full count. The second queued action is now
    // drained via the setTimeout(0) continuation, in the order it was enqueued.
    expect(hrefs).toEqual(["ultra-rss-browser-shortcut://toggle-read", "ultra-rss-browser-shortcut://toggle-star"]);

    // Flush the trailing setTimeout(0) continuation scheduled by the drain
    // above (it finds an empty queue and releases the in-flight flag).
    vi.runAllTimers();

    // The queue is now empty; the final drain call found nothing to process
    // and released the in-flight flag without emitting another navigation.
    expect(hrefs).toHaveLength(2);

    // Scenario: flag release. A subsequent action enqueued after the queue
    // fully drained is processed immediately (synchronously), proving the
    // drain-in-flight flag was reset to false and did not leak state into a
    // later enqueue.
    dispatchKey("a");
    expect(hrefs).toEqual([
      "ultra-rss-browser-shortcut://toggle-read",
      "ultra-rss-browser-shortcut://toggle-star",
      "ultra-rss-browser-shortcut://toggle-read",
    ]);
  });
});
