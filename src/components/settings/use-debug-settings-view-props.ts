import type { TFunction } from "i18next";
import { resolvePreferenceValue } from "@/stores/preferences-store";
import type { SettingsPageViewProps } from "./settings-page.types";

type UseDebugSettingsViewPropsParams = {
  t: TFunction<"settings">;
  prefs: Record<string, string>;
  setPref: (key: string, value: string) => void;
  devBuild: boolean;
  openWebPreviewUrl: () => void;
  openWebPreviewGeometryCheck: () => void;
  runFeedCleanupBrokenReferencesScenario: () => void;
  runReadingDisplayModeScenario: () => void;
};

export function useDebugSettingsViewProps({
  t,
  prefs,
  setPref,
  devBuild,
  openWebPreviewUrl,
  openWebPreviewGeometryCheck,
  runFeedCleanupBrokenReferencesScenario,
  runReadingDisplayModeScenario,
}: UseDebugSettingsViewPropsParams): SettingsPageViewProps {
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
            actionLabel: t("debug.open_now"),
            actionAriaLabel: `${t("debug.open_now")}: ${t("debug.web_preview_url")}`,
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
            actionLabel: t("debug.open_now"),
            disabled: !devBuild,
            onAction: openWebPreviewGeometryCheck,
          },
          {
            id: "debug-feed-cleanup-broken-references",
            type: "action",
            label: t("debug.feed_cleanup_broken_references"),
            actionLabel: t("debug.open_now"),
            disabled: !devBuild,
            onAction: runFeedCleanupBrokenReferencesScenario,
          },
          {
            id: "debug-reading-display-mode",
            type: "action",
            label: t("debug.reading_display_mode"),
            actionLabel: t("debug.open_now"),
            disabled: !devBuild,
            onAction: runReadingDisplayModeScenario,
          },
        ],
      },
    ],
  };
}
