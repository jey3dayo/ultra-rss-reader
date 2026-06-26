import { resolvePreferenceValue } from "@/schemas/preferences";
import type { SettingsPageViewProps } from "../settings-page.types";
import type { SettingsPreferenceViewPropsParams } from "../settings-preference";

type UseDebugSettingsViewPropsParams = SettingsPreferenceViewPropsParams & {
  devBuild: boolean;
  credentialsBackendValue: string;
  canResetDevCredentials: boolean;
  resetDevCredentials: () => void;
  resettingDevCredentials: boolean;
  openWebPreviewUrl: () => void;
  openWebPreviewGeometryCheck: () => void;
  openWebPreviewToastCheck: () => void;
  runReadingDisplayModeScenario: () => void;
};

const DEBUG_SCENARIO_ACTION_ROW_CLASS = "gap-3 lg:grid-cols-1 lg:items-start [&>div]:lg:justify-start [&>div]:lg:pr-0";

export function useDebugSettingsViewProps({
  t,
  prefs,
  setPref,
  devBuild,
  credentialsBackendValue,
  canResetDevCredentials,
  resetDevCredentials,
  resettingDevCredentials,
  openWebPreviewUrl,
  openWebPreviewGeometryCheck,
  openWebPreviewToastCheck,
  runReadingDisplayModeScenario,
}: UseDebugSettingsViewPropsParams): SettingsPageViewProps {
  const runDevAction = (action: () => void) => {
    if (devBuild) {
      action();
    }
  };
  const devDataSections: SettingsPageViewProps["sections"] = devBuild
    ? [
        {
          id: "debug-dev-data",
          heading: t("debug.dev_data"),
          controls: [
            {
              id: "debug-dev-data-command",
              type: "info",
              label: t("debug.dev_data_command"),
              value: "mise run app:dev:seed-from-prod",
            },
          ],
        },
      ]
    : [];

  return {
    title: t("debug.heading"),
    sections: [
      {
        id: "debug-overlays",
        heading: t("debug.overlays"),
        controls: [
          {
            id: "debug-agentation-visibility",
            type: "select",
            name: "debug_agentation_visibility",
            label: t("debug.agentation_visibility"),
            value: resolvePreferenceValue(prefs, "debug_agentation_visibility"),
            options: [
              { value: "always", label: t("debug.agentation_always") },
              { value: "hide_in_settings", label: t("debug.agentation_hide_in_settings") },
              { value: "off", label: t("debug.agentation_off") },
            ],
            onChange: (value) => setPref("debug_agentation_visibility", value),
          },
        ],
      },
      {
        id: "debug-browser",
        heading: t("debug.browser"),
        note: t("debug.browser_note"),
        controls: [
          {
            id: "debug-browser-hud",
            type: "switch",
            label: t("debug.web_preview_hud"),
            checked: resolvePreferenceValue(prefs, "debug_browser_hud") === "true",
            onChange: (checked) => setPref("debug_browser_hud", String(checked)),
          },
          {
            id: "debug-web-preview-url",
            type: "text",
            name: "debug_web_preview_url",
            label: t("debug.web_preview_url"),
            value: resolvePreferenceValue(prefs, "debug_web_preview_url"),
            placeholder: t("debug.web_preview_url_placeholder"),
            onChange: (value) => setPref("debug_web_preview_url", value),
            onAction: openWebPreviewUrl,
            actionLabel: t("debug.open_short"),
            actionAriaLabel: `${t("debug.open_short")}: ${t("debug.web_preview_url")}`,
          },
        ],
      },
      {
        id: "debug-credentials",
        heading: t("debug.credentials"),
        note: t("debug.credentials_note"),
        controls: [
          {
            id: "debug-credentials-backend",
            type: "info",
            label: t("debug.credentials_backend"),
            value: credentialsBackendValue,
          },
          ...(canResetDevCredentials
            ? [
                {
                  id: "debug-credentials-reset",
                  type: "action" as const,
                  label: t("debug.credentials_reset"),
                  actionLabel: resettingDevCredentials
                    ? t("debug.credentials_resetting")
                    : t("debug.credentials_reset_action"),
                  actionAriaLabel: t("debug.credentials_reset_aria_label"),
                  actionLoading: resettingDevCredentials,
                  actionLoadingLabel: t("debug.credentials_resetting"),
                  disabled: resettingDevCredentials,
                  onAction: resetDevCredentials,
                },
              ]
            : []),
        ],
      },
      ...devDataSections,
      {
        id: "debug-scenarios",
        heading: t("debug.scenarios"),
        note: t("debug.scenarios_note"),
        controls: [
          {
            id: "debug-web-preview-geometry-check",
            type: "action",
            label: t("debug.web_preview_geometry_check"),
            actionLabel: t("debug.open_short"),
            actionAriaLabel: t("debug.open_web_preview_geometry_check_aria_label"),
            rowClassName: DEBUG_SCENARIO_ACTION_ROW_CLASS,
            disabled: !devBuild,
            onAction: () => runDevAction(openWebPreviewGeometryCheck),
          },
          {
            id: "debug-web-preview-toast-check",
            type: "action",
            label: t("debug.web_preview_toast_check"),
            actionLabel: t("debug.open_short"),
            actionAriaLabel: t("debug.open_web_preview_toast_check_aria_label"),
            rowClassName: DEBUG_SCENARIO_ACTION_ROW_CLASS,
            disabled: !devBuild,
            onAction: () => runDevAction(openWebPreviewToastCheck),
          },
          {
            id: "debug-reading-display-mode",
            type: "action",
            label: t("debug.reading_display_mode"),
            actionLabel: t("debug.open_short"),
            actionAriaLabel: t("debug.open_reading_display_mode_aria_label"),
            rowClassName: DEBUG_SCENARIO_ACTION_ROW_CLASS,
            disabled: !devBuild,
            onAction: () => runDevAction(runReadingDisplayModeScenario),
          },
        ],
      },
    ],
  };
}
