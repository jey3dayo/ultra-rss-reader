import { resetTauriRuntimeFlags, setTauriRuntimeMissing, setTauriRuntimePresent } from "@tests/helpers/tauri-runtime";
import { afterEach, describe, expect, it } from "vitest";
import { isBrowserRuntimeUnavailable } from "@/components/reader/browser-runtime-availability";

describe("browser-runtime-availability", () => {
  afterEach(() => {
    resetTauriRuntimeFlags();
  });

  it("treats browser dev mocks as runtime unavailable", () => {
    setTauriRuntimePresent();
    window.__DEV_BROWSER_MOCKS__ = true;

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
});
