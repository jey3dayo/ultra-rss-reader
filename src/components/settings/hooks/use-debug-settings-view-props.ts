import { resolvePreferenceValue } from "@/schemas/preferences";
import type { SettingsPageViewProps } from "../settings-page.types";
import type { SettingsPreferenceViewPropsParams } from "../settings-preference.types";

type UseDebugSettingsViewPropsParams = SettingsPreferenceViewPropsParams & {
  devBuild: boolean;
  credentialsBackendValue: string;
  openWebPreviewUrl: () => void;
  openWebPreviewGeometryCheck: () => void;
  openWebPreviewToastCheck: () => void;
  runReadingDisplayModeScenario: () => void;
};

export function useDebugSettingsViewProps({
  t,
  prefs,
  setPref,
  devBuild,
  credentialsBackendValue,
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
          note: t("debug.dev_data_note"),
          controls: [
            {
              id: "debug-dev-data-command",
              type: "info",
              label: t("debug.dev_data_command"),
              value: "mise run app:dev:seed-from-prod",
            },
            {
              id: "debug-dev-data-backup",
              type: "info",
              label: t("debug.dev_data_backup"),
              value: t("debug.dev_data_backup_value"),
            },
            {
              id: "debug-dev-data-credentials",
              type: "info",
              label: t("debug.dev_data_credentials"),
              value: t("debug.dev_data_credentials_value"),
            },
          ],
        },
      ]
    : [];

  return {
    title: t("debug.heading"),
    sections: [
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
        ],
      },
      ...devDataSections,
      {
        id: "debug-support-log-privacy",
        heading: t("debug.support_log_privacy"),
        note: t("debug.support_log_privacy_note"),
        controls: [
          {
            id: "debug-support-log-excerpt",
            type: "info",
            label: t("debug.support_log_excerpt"),
            value: t("debug.support_log_excerpt_value"),
          },
          {
            id: "debug-support-log-redaction",
            type: "info",
            label: t("debug.support_log_redaction"),
            value: t("debug.support_log_redaction_value"),
          },
          {
            id: "debug-support-log-retention",
            type: "info",
            label: t("debug.support_log_retention"),
            value: t("debug.support_log_retention_value"),
          },
          {
            id: "debug-support-log-backup",
            type: "info",
            label: t("debug.support_log_backup"),
            value: t("debug.support_log_backup_value"),
          },
        ],
      },
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
            rowClassName: "gap-4 sm:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]",
            labelClassName: "whitespace-nowrap",
            disabled: !devBuild,
            onAction: () => runDevAction(openWebPreviewGeometryCheck),
          },
          {
            id: "debug-web-preview-toast-check",
            type: "action",
            label: t("debug.web_preview_toast_check"),
            actionLabel: t("debug.open_short"),
            actionAriaLabel: t("debug.open_web_preview_toast_check_aria_label"),
            rowClassName: "gap-4 sm:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]",
            labelClassName: "whitespace-nowrap",
            disabled: !devBuild,
            onAction: () => runDevAction(openWebPreviewToastCheck),
          },
          {
            id: "debug-reading-display-mode",
            type: "action",
            label: t("debug.reading_display_mode"),
            actionLabel: t("debug.open_short"),
            actionAriaLabel: t("debug.open_reading_display_mode_aria_label"),
            rowClassName: "gap-4 sm:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]",
            labelClassName: "whitespace-nowrap",
            disabled: !devBuild,
            onAction: () => runDevAction(runReadingDisplayModeScenario),
          },
        ],
      },
    ],
  };
}
