import { stubNavigatorPlatform } from "@tests/helpers/navigator-platform";
import { resetTauriRuntimeFlags, setTauriRuntimePresent } from "@tests/helpers/tauri-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasTauriRuntime, shouldUseDesktopOverlayTitlebar } from "@/lib/window/window-chrome";

describe("window-chrome", () => {
  afterEach(() => {
    resetTauriRuntimeFlags();
    vi.restoreAllMocks();
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
    const restorePlatform = stubNavigatorPlatform({ platform: "MacIntel" });

    try {
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
    } finally {
      restorePlatform();
    }
  });

  it.each([
    ["MacIntel", "Win32", true],
    ["Windows", "MacIntel", false],
    ["", "MacIntel", false],
  ])("keeps unknown-platform Tauri chrome fallback deterministic when userAgentData platform is %s and navigator platform is %s", (userAgentDataPlatform, navigatorPlatform, expected) => {
    setTauriRuntimePresent();
    const restorePlatform = stubNavigatorPlatform({ platform: navigatorPlatform, userAgentDataPlatform });

    try {
      expect(
        shouldUseDesktopOverlayTitlebar({
          platformKind: "unknown",
          hasTauriRuntime: hasTauriRuntime(),
        }),
      ).toBe(expected);
    } finally {
      restorePlatform();
    }
  });

  it.each([
    ["Win32", false],
    ["Linux x86_64", false],
  ])("keeps the unknown-platform Tauri fallback off for %s navigator platform", (platform, expected) => {
    setTauriRuntimePresent();
    const restorePlatform = stubNavigatorPlatform({ platform });

    try {
      expect(
        shouldUseDesktopOverlayTitlebar({
          platformKind: "unknown",
          hasTauriRuntime: hasTauriRuntime(),
        }),
      ).toBe(expected);
    } finally {
      restorePlatform();
    }
  });

  it("reports navigator platform stub restore failures", () => {
    const restorePlatform = stubNavigatorPlatform({ platform: "MacIntel" });
    const deleteProperty = Reflect.deleteProperty;
    const deletePropertySpy = vi.spyOn(Reflect, "deleteProperty").mockImplementation((target, property) => {
      if (target === window.navigator && property === "platform") {
        throw new TypeError("restore failed");
      }

      return deleteProperty(target, property);
    });

    expect(() => restorePlatform()).toThrow("Failed to restore navigator platform stub.");

    deletePropertySpy.mockRestore();
    restorePlatform();
  });
});
