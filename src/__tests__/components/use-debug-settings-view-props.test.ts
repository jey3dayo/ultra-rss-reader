import { describe, expect, it, vi } from "vitest";
import { useDebugSettingsViewProps as buildDebugSettingsViewProps } from "@/components/settings/hooks/use-debug-settings-view-props";
import i18n from "@/lib/i18n";

const enT = i18n.getFixedT("en", "settings");
const jaT = i18n.getFixedT("ja", "settings");

function createProps(overrides: Partial<Parameters<typeof buildDebugSettingsViewProps>[0]> = {}) {
  return buildDebugSettingsViewProps({
    t: enT,
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
        actionAriaLabel: "Open geometry check",
        label: "Web preview geometry check",
      }),
      expect.objectContaining({
        id: "debug-web-preview-toast-check",
        type: "action",
        actionLabel: "Open",
        actionAriaLabel: "Open toast check",
        label: "Web preview toast check",
      }),
      expect.objectContaining({
        id: "debug-reading-display-mode",
        type: "action",
        actionLabel: "Open",
        actionAriaLabel: "Open reading display mode check",
        label: "Reading display mode settings",
      }),
    ]);
  });

  it("maps ja debug scenario action accessible names from locale keys", () => {
    const props = createProps({ t: jaT, devBuild: true });

    const scenariosSection = props.sections.find((section) => section.id === "debug-scenarios");
    const scenarioControls = scenariosSection?.controls ?? [];

    expect(scenarioControls).toEqual([
      expect.objectContaining({
        id: "debug-web-preview-geometry-check",
        type: "action",
        actionLabel: "開く",
        actionAriaLabel: "配置チェックを開く",
        label: "Webプレビューの配置チェック",
      }),
      expect.objectContaining({
        id: "debug-web-preview-toast-check",
        type: "action",
        actionLabel: "開く",
        actionAriaLabel: "通知表示チェックを開く",
        label: "Webプレビューの通知表示チェック",
      }),
      expect.objectContaining({
        id: "debug-reading-display-mode",
        type: "action",
        actionLabel: "開く",
        actionAriaLabel: "閲覧表示モードのチェックを開く",
        label: "閲覧設定の表示モード",
      }),
    ]);
  });

  it("surfaces the Dev data seed command and safety notes only for dev builds without wiring execution", () => {
    const props = createProps({ devBuild: true });

    const devDataSection = props.sections.find((section) => section.id === "debug-dev-data");

    expect(devDataSection).toEqual(
      expect.objectContaining({
        heading: "Dev data seed",
        note: expect.stringContaining("Dev app"),
      }),
    );
    expect(devDataSection?.controls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "debug-dev-data-source",
          type: "info",
          label: "Source label",
          value: expect.stringContaining("Dev mock data"),
        }),
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
      ]),
    );
  });

  it("omits the Dev data seed guidance outside dev builds", () => {
    const props = createProps({ devBuild: false });

    expect(props.sections.find((section) => section.id === "debug-dev-data")).toBeUndefined();
  });
});
