import { describe, expect, it } from "vitest";
import {
  setAppLikeScenarioStoryRuntime,
  setComponentIsolationStoryRuntime,
  setStoryTauriRuntimeMissing,
  setStoryTauriRuntimePresent,
} from "@/components/storybook/story-tauri-runtime";

describe("story Tauri runtime helper", () => {
  it("keeps semantic runtime helpers as public Storybook import paths", () => {
    expect(typeof setComponentIsolationStoryRuntime).toBe("function");
    expect(typeof setAppLikeScenarioStoryRuntime).toBe("function");
  });

  it("keeps Tauri internals configurable when toggling story runtime state", () => {
    window.__DEV_BROWSER_MOCKS__ = true;
    window.__ULTRA_RSS_BROWSER_MOCKS__ = true;

    setStoryTauriRuntimePresent();

    expect(window.__TAURI_INTERNALS__).toEqual({});
    expect(window.__DEV_BROWSER_MOCKS__).toBe(false);
    expect(window.__ULTRA_RSS_BROWSER_MOCKS__).toBe(false);
    expect(Object.getOwnPropertyDescriptor(window, "__TAURI_INTERNALS__")).toMatchObject({
      configurable: true,
      writable: true,
      value: {},
    });

    window.__DEV_BROWSER_MOCKS__ = true;
    window.__ULTRA_RSS_BROWSER_MOCKS__ = true;

    setStoryTauriRuntimeMissing();

    expect(window.__TAURI_INTERNALS__).toBeUndefined();
    expect(window.__DEV_BROWSER_MOCKS__).toBe(false);
    expect(window.__ULTRA_RSS_BROWSER_MOCKS__).toBe(false);
    expect(Object.getOwnPropertyDescriptor(window, "__TAURI_INTERNALS__")).toBeUndefined();

    window.__DEV_BROWSER_MOCKS__ = true;
    window.__ULTRA_RSS_BROWSER_MOCKS__ = true;

    setStoryTauriRuntimePresent();

    expect(window.__TAURI_INTERNALS__).toEqual({});
    expect(window.__DEV_BROWSER_MOCKS__).toBe(false);
    expect(window.__ULTRA_RSS_BROWSER_MOCKS__).toBe(false);
    expect(Object.getOwnPropertyDescriptor(window, "__TAURI_INTERNALS__")).toMatchObject({
      configurable: true,
      writable: true,
      value: {},
    });
  });

  it("names component isolation and app-like scenario runtime responsibilities", () => {
    setAppLikeScenarioStoryRuntime();

    expect(window.__TAURI_INTERNALS__).toEqual({});

    setComponentIsolationStoryRuntime();

    expect(window.__TAURI_INTERNALS__).toBeUndefined();
  });
});
