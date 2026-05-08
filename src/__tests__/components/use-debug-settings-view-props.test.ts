import { describe, expect, it, vi } from "vitest";
import { useDebugSettingsViewProps as buildDebugSettingsViewProps } from "@/components/settings/hooks/use-debug-settings-view-props";
import i18n from "@/lib/i18n";

const t = i18n.getFixedT("en", "settings");

function createProps(overrides: Partial<Parameters<typeof buildDebugSettingsViewProps>[0]> = {}) {
  return buildDebugSettingsViewProps({
    t,
    prefs: {},
    setPref: vi.fn(),
    devBuild: false,
    credentialsBackendValue: "OS keyring",
    openWebPreviewUrl: vi.fn(),
    openWebPreviewGeometryCheck: vi.fn(),
    openWebPreviewToastCheck: vi.fn(),
    runReadingDisplayModeScenario: vi.fn(),
    ...overrides,
  });
}

describe("useDebugSettingsViewProps", () => {
  it("maps browser debug preferences and web preview URL actions", () => {
    const setPref = vi.fn();
    const openWebPreviewUrl = vi.fn();
    const props = createProps({
      prefs: {
        debug_browser_hud: "true",
        debug_web_preview_url: "https://example.com/debug",
      },
      setPref,
      openWebPreviewUrl,
    });

    const browserSection = props.sections.find((section) => section.id === "debug-browser");
    const hudControl = browserSection?.controls.find((control) => control.id === "debug-browser-hud");
    const urlControl = browserSection?.controls.find((control) => control.id === "debug-web-preview-url");

    expect(hudControl).toEqual(expect.objectContaining({ type: "switch", checked: true }));
    expect(urlControl).toEqual(
      expect.objectContaining({
        type: "text",
        value: "https://example.com/debug",
        actionAriaLabel: "Open: Web preview URL",
      }),
    );

    if (hudControl?.type === "switch") {
      hudControl.onChange(false);
    }
    if (urlControl?.type === "text") {
      urlControl.onChange("https://example.com/next");
      urlControl.onAction?.();
    }

    expect(setPref).toHaveBeenCalledWith("debug_browser_hud", "false");
    expect(setPref).toHaveBeenCalledWith("debug_web_preview_url", "https://example.com/next");
    expect(openWebPreviewUrl).toHaveBeenCalledOnce();
  });

  it("disables scenario actions outside dev builds", () => {
    const openWebPreviewGeometryCheck = vi.fn();
    const openWebPreviewToastCheck = vi.fn();
    const runReadingDisplayModeScenario = vi.fn();
    const props = createProps({
      devBuild: false,
      openWebPreviewGeometryCheck,
      openWebPreviewToastCheck,
      runReadingDisplayModeScenario,
    });

    const scenariosSection = props.sections.find((section) => section.id === "debug-scenarios");
    const scenarioControls = scenariosSection?.controls ?? [];

    expect(scenarioControls).toHaveLength(3);
    expect(scenarioControls).toEqual([
      expect.objectContaining({ id: "debug-web-preview-geometry-check", type: "action", disabled: true }),
      expect.objectContaining({ id: "debug-web-preview-toast-check", type: "action", disabled: true }),
      expect.objectContaining({ id: "debug-reading-display-mode", type: "action", disabled: true }),
    ]);

    for (const control of scenarioControls) {
      if (control.type === "action") {
        control.onAction();
      }
    }

    expect(openWebPreviewGeometryCheck).toHaveBeenCalledOnce();
    expect(openWebPreviewToastCheck).toHaveBeenCalledOnce();
    expect(runReadingDisplayModeScenario).toHaveBeenCalledOnce();
  });
});
