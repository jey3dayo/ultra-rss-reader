import { afterEach, describe, expect, it } from "vitest";
import { isBrowserRuntimeUnavailable } from "@/components/reader/browser-runtime-availability";

describe("browser-runtime-availability", () => {
  afterEach(() => {
    window.__DEV_BROWSER_MOCKS__ = false;
    window.__ULTRA_RSS_BROWSER_MOCKS__ = false;
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  it("treats browser dev mocks as runtime unavailable", () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      writable: true,
      value: {},
    });
    window.__DEV_BROWSER_MOCKS__ = true;

    expect(isBrowserRuntimeUnavailable()).toBe(true);
  });

  it("treats the missing Tauri runtime as unavailable", () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    expect(isBrowserRuntimeUnavailable()).toBe(true);
  });

  it("allows the embedded preview when the Tauri runtime is present and mocks are off", () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      writable: true,
      value: {},
    });
    window.__DEV_BROWSER_MOCKS__ = false;
    window.__ULTRA_RSS_BROWSER_MOCKS__ = false;

    expect(isBrowserRuntimeUnavailable()).toBe(false);
  });
});
