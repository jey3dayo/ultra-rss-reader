import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { describe, expect, it, vi } from "vitest";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { resolveBrowserWebviewBounds, shouldApplySyncedBrowserState } from "@/lib/browser/browser-webview-sync";

setupBrowserTestDom();

function createDomRect({ left = 10, top = 20, width = 300, height = 200 }: Partial<DOMRect>): DOMRect {
  return new DOMRect(left, top, width, height);
}

function createHostRef(rect: Partial<DOMRect>) {
  const host = document.createElement("div");
  host.getBoundingClientRect = vi.fn(() => createDomRect(rect));
  return { current: host };
}

function createRootRelativeHostRef(rootRect: Partial<DOMRect>, hostRect: Partial<DOMRect>) {
  const root = document.createElement("div");
  const host = document.createElement("div");
  root.setAttribute("data-browser-overlay-client-root", "");
  root.append(host);
  root.getBoundingClientRect = vi.fn(() => createDomRect({ left: 0, top: 18, width: 1400, height: 900, ...rootRect }));
  host.getBoundingClientRect = vi.fn(() => createDomRect({ left: 0, top: 58, width: 1400, height: 860, ...hostRect }));
  return { current: host };
}

function createBrowserState(overrides?: Partial<BrowserWebviewState>): BrowserWebviewState {
  return {
    url: "https://example.com/article",
    can_go_back: false,
    can_go_forward: false,
    is_loading: false,
    load_generation: 1,
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

  it("resolves browser webview bounds in the main webview viewport coordinate space", () => {
    expect(resolveBrowserWebviewBounds(createRootRelativeHostRef({}, {}), "macos")).toEqual({
      x: 0,
      y: 58,
      width: 1400,
      height: 860,
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

    expect(
      resolveBrowserWebviewBounds(
        createRootRelativeHostRef(
          { left: 11, top: 18, right: 1411, bottom: 918 },
          { left: 31, top: 58, width: 120, height: 80, right: 151, bottom: 138 },
        ),
        "windows",
      ),
    ).toEqual({
      x: 62,
      y: 116,
      width: 240,
      height: 160,
      unit: "physical",
    });

    Object.defineProperty(window, "devicePixelRatio", {
      configurable: true,
      value: originalDevicePixelRatio,
    });
  });

  it("rounds fractional browser webview bounds after applying Windows DPI scale", () => {
    const originalDevicePixelRatio = window.devicePixelRatio;
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1.25 });

    try {
      expect(
        resolveBrowserWebviewBounds(createHostRef({ left: 10.4, top: 20.4, width: 300.4, height: 200.4 }), "windows"),
      ).toEqual({
        x: 13,
        y: 26,
        width: 376,
        height: 251,
        unit: "physical",
      });
    } finally {
      Object.defineProperty(window, "devicePixelRatio", {
        configurable: true,
        value: originalDevicePixelRatio,
      });
    }
  });

  it("keeps subpixel browser webview min size aligned with the rounding policy", () => {
    expect(resolveBrowserWebviewBounds(createHostRef({ width: 0.49, height: 200 }), "macos")).toBeNull();
    expect(resolveBrowserWebviewBounds(createHostRef({ width: 0.5, height: 0.5 }), "macos")).toEqual({
      x: 10,
      y: 20,
      width: 1,
      height: 1,
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
    expect(
      shouldApplySyncedBrowserState(
        createBrowserState({ is_loading: true }),
        "https://example.com/article",
        createBrowserState({ url: "https://example.com/other", is_loading: false }),
      ),
    ).toBe(false);
  });
});
