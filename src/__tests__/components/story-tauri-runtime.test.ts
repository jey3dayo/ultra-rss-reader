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

  it("returns restore callbacks from semantic story runtime helpers", () => {
    const restoreComponentIsolationRuntime = setComponentIsolationStoryRuntime();
    const restoreAppLikeScenarioRuntime = setAppLikeScenarioStoryRuntime();

    expect(typeof restoreComponentIsolationRuntime).toBe("function");
    expect(typeof restoreAppLikeScenarioRuntime).toBe("function");

    restoreAppLikeScenarioRuntime();
    restoreComponentIsolationRuntime();
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

  it("restores previous runtime globals after app-like story runtime setup", () => {
    const previousInternals = { existing: true };
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      writable: false,
      value: previousInternals,
    });
    window.__DEV_BROWSER_MOCKS__ = true;
    window.__ULTRA_RSS_BROWSER_MOCKS__ = true;

    const restoreRuntime = setStoryTauriRuntimePresent();

    expect(window.__TAURI_INTERNALS__).toEqual({});
    expect(window.__DEV_BROWSER_MOCKS__).toBe(false);
    expect(window.__ULTRA_RSS_BROWSER_MOCKS__).toBe(false);

    restoreRuntime();

    expect(window.__TAURI_INTERNALS__).toBe(previousInternals);
    expect(window.__DEV_BROWSER_MOCKS__).toBe(true);
    expect(window.__ULTRA_RSS_BROWSER_MOCKS__).toBe(true);
    expect(Object.getOwnPropertyDescriptor(window, "__TAURI_INTERNALS__")).toMatchObject({
      configurable: true,
      writable: false,
      value: previousInternals,
    });
  });

  it("restores an absent runtime descriptor after component-isolation setup", () => {
    delete window.__TAURI_INTERNALS__;
    delete window.__DEV_BROWSER_MOCKS__;
    delete window.__ULTRA_RSS_BROWSER_MOCKS__;

    const restoreRuntime = setStoryTauriRuntimeMissing();

    expect(Object.getOwnPropertyDescriptor(window, "__TAURI_INTERNALS__")).toBeUndefined();
    expect(window.__DEV_BROWSER_MOCKS__).toBe(false);
    expect(window.__ULTRA_RSS_BROWSER_MOCKS__).toBe(false);

    restoreRuntime();

    expect(Object.getOwnPropertyDescriptor(window, "__TAURI_INTERNALS__")).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(window, "__DEV_BROWSER_MOCKS__")).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(window, "__ULTRA_RSS_BROWSER_MOCKS__")).toBeUndefined();
  });
});
