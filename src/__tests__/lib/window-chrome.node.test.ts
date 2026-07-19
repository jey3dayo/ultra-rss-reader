import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { stubNavigatorPlatform } from "@tests/helpers/navigator-platform";
import { resetTauriRuntimeFlags, setTauriRuntimePresent } from "@tests/helpers/tauri-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APP_STACKING_CLASS_NAMES, hasTauriRuntime, shouldUseDesktopOverlayTitlebar } from "@/lib/window/window-chrome";

setupBrowserTestDom();

function readTailwindZIndexClassValue(className: string): number {
  const arbitraryValueMatch = /^z-\[(\d+)\]$/.exec(className);
  if (arbitraryValueMatch) {
    return Number(arbitraryValueMatch[1]);
  }

  const scaleValueMatch = /^z-(\d+)$/.exec(className);
  if (scaleValueMatch) {
    return Number(scaleValueMatch[1]);
  }

  throw new Error(`Unsupported z-index class: ${className}`);
}

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
  ])(
    "keeps unknown-platform Tauri chrome fallback deterministic when userAgentData platform is %s and navigator platform is %s",
    (userAgentDataPlatform, navigatorPlatform, expected) => {
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
    },
  );

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

  it("keeps app stacking layers ordered so browser overlays stay below dialogs and toasts", () => {
    const browserOverlayRoot = readTailwindZIndexClassValue(APP_STACKING_CLASS_NAMES.browserOverlayRoot);
    const dialog = readTailwindZIndexClassValue(APP_STACKING_CLASS_NAMES.dialog);
    const commandPalette = readTailwindZIndexClassValue(APP_STACKING_CLASS_NAMES.commandPalette);
    const popup = readTailwindZIndexClassValue(APP_STACKING_CLASS_NAMES.popup);
    const tooltip = readTailwindZIndexClassValue(APP_STACKING_CLASS_NAMES.tooltip);
    const toast = readTailwindZIndexClassValue(APP_STACKING_CLASS_NAMES.toast);

    expect(APP_STACKING_CLASS_NAMES).toEqual({
      browserOverlayRoot: "z-40",
      dialog: "z-50",
      commandPalette: "z-50",
      popup: "z-[70]",
      tooltip: "z-[80]",
      toast: "z-[100]",
    });
    expect(browserOverlayRoot).toBeLessThan(dialog);
    expect(browserOverlayRoot).toBeLessThan(commandPalette);
    expect(dialog).toBe(commandPalette);
    expect(popup).toBeGreaterThan(dialog);
    expect(tooltip).toBeGreaterThan(popup);
    expect(toast).toBeGreaterThan(dialog);
    expect(toast).toBeGreaterThan(commandPalette);
    expect(toast).toBeGreaterThan(tooltip);
  });
});
