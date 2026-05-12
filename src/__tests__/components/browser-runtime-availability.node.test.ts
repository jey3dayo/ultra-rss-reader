import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { resetTauriRuntimeFlags, setTauriRuntimeMissing, setTauriRuntimePresent } from "@tests/helpers/tauri-runtime";
import { afterEach, describe, expect, it } from "vitest";
import { isBrowserRuntimeUnavailable } from "@/lib/browser/browser-runtime-availability";

setupBrowserTestDom();

describe("browser-runtime-availability", () => {
  afterEach(() => {
    resetTauriRuntimeFlags();
  });

  it("treats browser dev mocks as runtime unavailable", () => {
    setTauriRuntimePresent();
    window.__DEV_BROWSER_MOCKS__ = true;

    expect(isBrowserRuntimeUnavailable()).toBe(true);
  });

  it("treats standalone browser preview mocks as runtime unavailable", () => {
    setTauriRuntimePresent();
    window.__ULTRA_RSS_BROWSER_MOCKS__ = true;

    expect(isBrowserRuntimeUnavailable()).toBe(true);
  });

  it("treats the missing Tauri runtime as unavailable", () => {
    setTauriRuntimeMissing();

    expect(isBrowserRuntimeUnavailable()).toBe(true);
  });

  it("allows the embedded preview when the Tauri runtime is present and mocks are off", () => {
    setTauriRuntimePresent();
    window.__DEV_BROWSER_MOCKS__ = false;
    window.__ULTRA_RSS_BROWSER_MOCKS__ = false;

    expect(isBrowserRuntimeUnavailable()).toBe(false);
  });

  it.each([
    {
      name: "packaged runtime",
      setup: () => {
        setTauriRuntimePresent();
        window.__DEV_BROWSER_MOCKS__ = false;
        window.__ULTRA_RSS_BROWSER_MOCKS__ = false;
      },
      unavailable: false,
    },
    {
      name: "dev browser mocks",
      setup: () => {
        setTauriRuntimePresent();
        window.__DEV_BROWSER_MOCKS__ = true;
        window.__ULTRA_RSS_BROWSER_MOCKS__ = true;
      },
      unavailable: true,
    },
    {
      name: "Storybook/browser preview without Tauri internals",
      setup: () => {
        setTauriRuntimeMissing();
        window.__DEV_BROWSER_MOCKS__ = false;
        window.__ULTRA_RSS_BROWSER_MOCKS__ = false;
      },
      unavailable: true,
    },
  ])("keeps runtime availability consistent for $name", ({ setup, unavailable }) => {
    setup();

    expect(isBrowserRuntimeUnavailable()).toBe(unavailable);
  });
});
