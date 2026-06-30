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
    canResetDevCredentials: false,
    resetDevCredentials: vi.fn(),
    resettingDevCredentials: false,
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
        developer_mode: "true",
        debug_browser_hud: "true",
        debug_web_preview_url: "https://example.com/debug",
      },
      setPref,
      openWebPreviewUrl,
    });

    const browserSection = props.sections.find((section) => section.id === "debug-browser");
    const hudControl = browserSection?.controls.find((control) => control.id === "debug-browser-hud");
    const urlControl = browserSection?.controls.find((control) => control.id === "debug-web-preview-url");

    expect(browserSection?.motionPhase).toBe("entering");
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

  it("shows only the developer mode switch until it is enabled", () => {
    const setPref = vi.fn();
    const props = createProps({ prefs: { developer_mode: "false" }, setPref });

    expect(props.sections.map((section) => section.id)).toEqual(["debug-developer-mode"]);
    const control = props.sections[0]?.controls[0];

    expect(control).toEqual(
      expect.objectContaining({
        id: "debug-developer-mode-toggle",
        type: "switch",
        label: "Developer Mode",
        checked: false,
      }),
    );

    if (control?.type === "switch") {
      control.onChange(true);
    }

    expect(setPref).toHaveBeenCalledWith("developer_mode", "true");
  });

  it("omits scenario actions outside dev builds", () => {
    const openWebPreviewGeometryCheck = vi.fn();
    const openWebPreviewToastCheck = vi.fn();
    const runReadingDisplayModeScenario = vi.fn();
    const props = createProps({
      prefs: { developer_mode: "true" },
      devBuild: false,
      openWebPreviewGeometryCheck,
      openWebPreviewToastCheck,
      runReadingDisplayModeScenario,
    });

    expect(props.sections.find((section) => section.id === "debug-scenarios")).toBeUndefined();

    expect(openWebPreviewGeometryCheck).not.toHaveBeenCalled();
    expect(openWebPreviewToastCheck).not.toHaveBeenCalled();
    expect(runReadingDisplayModeScenario).not.toHaveBeenCalled();
  });

  it("keeps debug scenario labels as nouns so action accessible names do not repeat open", () => {
    const props = createProps({ prefs: { developer_mode: "true" }, devBuild: true });

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

  it("stacks debug scenario action rows so localized labels can wrap in narrow cards", () => {
    const props = createProps({ prefs: { developer_mode: "true" }, devBuild: true });

    const scenariosSection = props.sections.find((section) => section.id === "debug-scenarios");
    const scenarioControls = scenariosSection?.controls ?? [];

    for (const control of scenarioControls) {
      expect(control).toEqual(
        expect.objectContaining({
          type: "action",
          rowClassName: expect.stringContaining("lg:grid-cols-1"),
        }),
      );
      expect(control).toEqual(
        expect.objectContaining({
          rowClassName: expect.stringContaining("[&>div]:lg:justify-start"),
        }),
      );
      expect(control).not.toEqual(
        expect.objectContaining({
          labelClassName: expect.stringContaining("whitespace-nowrap"),
        }),
      );
    }
  });

  it("maps ja debug scenario action accessible names from locale keys", () => {
    const props = createProps({ t: jaT, prefs: { developer_mode: "true" }, devBuild: true });

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

  it("surfaces the Dev data seed command only for dev builds without wiring execution", () => {
    const props = createProps({ prefs: { developer_mode: "true" }, devBuild: true });

    const devDataSection = props.sections.find((section) => section.id === "debug-dev-data");

    expect(devDataSection).toEqual(
      expect.objectContaining({
        heading: "Dev data seed",
      }),
    );
    expect(devDataSection?.note).toBeUndefined();
    expect(devDataSection?.controls).toEqual([
      expect.objectContaining({
        id: "debug-dev-data-command",
        type: "info",
        label: "Command",
        value: "mise run app:dev:seed-from-prod",
      }),
    ]);
  });

  it("omits the Dev data seed guidance outside dev builds", () => {
    const props = createProps({ prefs: { developer_mode: "true" }, devBuild: false });

    expect(props.sections.find((section) => section.id === "debug-dev-data")).toBeUndefined();
  });

  it("adds the dev credential reset action only when dev file credentials are active", () => {
    const resetDevCredentials = vi.fn();
    const props = createProps({
      prefs: { developer_mode: "true" },
      canResetDevCredentials: true,
      resetDevCredentials,
    });

    const credentialsSection = props.sections.find((section) => section.id === "debug-credentials");
    const resetControl = credentialsSection?.controls.find((control) => control.id === "debug-credentials-reset");

    expect(resetControl).toEqual(
      expect.objectContaining({
        type: "action",
        label: "Dev credential recovery",
        actionLabel: "Reset",
        actionAriaLabel: "Reset oversized dev credential store",
        actionLoading: false,
        actionLoadingLabel: "Resetting…",
        disabled: false,
      }),
    );

    if (resetControl?.type === "action") {
      resetControl.onAction();
    }

    expect(resetDevCredentials).toHaveBeenCalledOnce();
  });

  it("omits the dev credential reset action for native keyring", () => {
    const props = createProps({ prefs: { developer_mode: "true" }, canResetDevCredentials: false });

    const credentialsSection = props.sections.find((section) => section.id === "debug-credentials");

    expect(credentialsSection?.controls.some((control) => control.id === "debug-credentials-reset")).toBe(false);
  });
});
