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

  it("disables scenario actions outside dev builds and guards their handlers", () => {
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

    expect(openWebPreviewGeometryCheck).not.toHaveBeenCalled();
    expect(openWebPreviewToastCheck).not.toHaveBeenCalled();
    expect(runReadingDisplayModeScenario).not.toHaveBeenCalled();
  });

  it("keeps debug scenario labels as nouns so action accessible names do not repeat open", () => {
    const props = createProps({ devBuild: true });

    const scenariosSection = props.sections.find((section) => section.id === "debug-scenarios");
    const scenarioControls = scenariosSection?.controls ?? [];

    expect(scenarioControls).toEqual([
      expect.objectContaining({
        id: "debug-web-preview-geometry-check",
        type: "action",
        actionLabel: "Open",
        label: "Web preview geometry check",
      }),
      expect.objectContaining({
        id: "debug-web-preview-toast-check",
        type: "action",
        actionLabel: "Open",
        label: "Web preview toast check",
      }),
      expect.objectContaining({
        id: "debug-reading-display-mode",
        type: "action",
        actionLabel: "Open",
        label: "Reading display mode settings",
      }),
    ]);
  });

  it("surfaces the Dev data seed command and safety notes without wiring execution", () => {
    const props = createProps();

    const devDataSection = props.sections.find((section) => section.id === "debug-dev-data");

    expect(devDataSection).toEqual(
      expect.objectContaining({
        heading: "Dev data seed",
        note: expect.stringContaining("Dev app"),
      }),
    );
    expect(devDataSection?.controls).toEqual([
      expect.objectContaining({
        id: "debug-dev-data-command",
        type: "info",
        label: "Command",
        value: "mise run app:dev:seed-from-prod",
      }),
      expect.objectContaining({
        id: "debug-dev-data-backup",
        type: "info",
        label: "Backup and restart",
        value: expect.stringContaining("timestamped backup"),
      }),
      expect.objectContaining({
        id: "debug-dev-data-credentials",
        type: "info",
        label: "Credentials",
        value: expect.stringContaining("not copied"),
      }),
    ]);
  });
});
