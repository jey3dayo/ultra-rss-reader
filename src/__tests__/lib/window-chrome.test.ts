import { resetTauriRuntimeFlags, setTauriRuntimePresent } from "@tests/helpers/tauri-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasTauriRuntime, shouldUseDesktopOverlayTitlebar } from "@/lib/window/window-chrome";

describe("window-chrome", () => {
  afterEach(() => {
    resetTauriRuntimeFlags();
  });

  it("does not treat browser dev mocks as the native Tauri runtime", () => {
    setTauriRuntimePresent();
    window.__DEV_BROWSER_MOCKS__ = true;
    window.__ULTRA_RSS_BROWSER_MOCKS__ = true;

    expect(hasTauriRuntime()).toBe(false);
    expect(
      shouldUseDesktopOverlayTitlebar({
        platformKind: "macos",
        hasTauriRuntime: hasTauriRuntime(),
      }),
    ).toBe(false);
  });

  it("allows native chrome handling when Tauri internals are present without browser mocks", () => {
    setTauriRuntimePresent();

    expect(hasTauriRuntime()).toBe(true);
    expect(
      shouldUseDesktopOverlayTitlebar({
        platformKind: "macos",
        hasTauriRuntime: hasTauriRuntime(),
      }),
    ).toBe(true);
  });

  it("uses the macOS user agent fallback only when runtime is present and platform info is unknown", () => {
    setTauriRuntimePresent();
    vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");

    expect(
      shouldUseDesktopOverlayTitlebar({
        platformKind: "unknown",
        hasTauriRuntime: true,
      }),
    ).toBe(true);
    expect(
      shouldUseDesktopOverlayTitlebar({
        platformKind: "unknown",
        hasTauriRuntime: false,
      }),
    ).toBe(false);
  });
});
