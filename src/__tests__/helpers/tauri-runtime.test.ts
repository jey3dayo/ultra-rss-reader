import { resetTauriRuntimeFlags, setTauriRuntimePresent } from "@tests/helpers/tauri-runtime";
import { describe, expect, it } from "vitest";

describe("tauri runtime test helper", () => {
  it("resets browser mock flags and removes Tauri internals", () => {
    setTauriRuntimePresent();
    window.__DEV_BROWSER_MOCKS__ = true;
    window.__ULTRA_RSS_BROWSER_MOCKS__ = true;

    resetTauriRuntimeFlags();

    expect(window.__DEV_BROWSER_MOCKS__).toBe(false);
    expect(window.__ULTRA_RSS_BROWSER_MOCKS__).toBe(false);
    expect("__TAURI_INTERNALS__" in window).toBe(false);
    expect(Object.getOwnPropertyDescriptor(window, "__TAURI_INTERNALS__")).toBeUndefined();
  });
});
