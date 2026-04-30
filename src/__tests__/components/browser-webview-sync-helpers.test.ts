import { describe, expect, it, vi } from "vitest";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import {
  resolveBrowserWebviewBounds,
  shouldApplySyncedBrowserState,
} from "@/components/reader/browser-webview-sync-helpers";

function createHostRef(rect: Partial<DOMRect>) {
  const host = document.createElement("div");
  host.getBoundingClientRect = vi.fn(
    () =>
      ({
        left: 10,
        top: 20,
        width: 300,
        height: 200,
        ...rect,
      }) as DOMRect,
  );
  return { current: host };
}

function createBrowserState(overrides?: Partial<BrowserWebviewState>): BrowserWebviewState {
  return {
    url: "https://example.com/article",
    can_go_back: false,
    can_go_forward: false,
    is_loading: false,
    ...overrides,
  };
}

describe("browser-webview-sync-helpers", () => {
  it("resolves browser webview bounds using logical units outside Windows", () => {
    expect(resolveBrowserWebviewBounds(createHostRef({ left: 10.4, top: 20.4 }), "macos")).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 200,
    });
  });

  it("resolves browser webview bounds using physical units on Windows", () => {
    const originalDevicePixelRatio = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });

    expect(resolveBrowserWebviewBounds(createHostRef({ width: 120, height: 80 }), "windows")).toEqual({
      x: 20,
      y: 40,
      width: 240,
      height: 160,
      unit: "physical",
    });

    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: originalDevicePixelRatio,
    });
  });

  it("skips empty host bounds", () => {
    expect(resolveBrowserWebviewBounds(createHostRef({ width: 0 }), "linux")).toBeNull();
    expect(resolveBrowserWebviewBounds({ current: null }, "linux")).toBeNull();
  });

  it("applies synced browser state only when it matches the requested URL lifecycle", () => {
    expect(
      shouldApplySyncedBrowserState(null, "https://example.com/article", createBrowserState({ is_loading: true })),
    ).toBe(true);
    expect(
      shouldApplySyncedBrowserState(
        createBrowserState({ is_loading: true }),
        "https://example.com/article",
        createBrowserState({ is_loading: false }),
      ),
    ).toBe(true);
    expect(
      shouldApplySyncedBrowserState(
        createBrowserState({ is_loading: false }),
        "https://example.com/article",
        createBrowserState({ is_loading: true }),
      ),
    ).toBe(false);
    expect(
      shouldApplySyncedBrowserState(
        createBrowserState({ url: "https://example.com/other", is_loading: true }),
        "https://example.com/article",
        createBrowserState({ is_loading: false }),
      ),
    ).toBe(false);
  });
});
