import type { TFunction } from "i18next";
import { displayPresetToPreferenceValues, resolveAppDefaultDisplayPreset } from "@/lib/article-display";
import type { DevIntent } from "@/lib/dev-intent";
import { resolvePreferenceValue } from "@/stores/preferences-store";
import type { ReadingSettingsViewProps } from "./reading-settings-view";

type UseReadingSettingsViewPropsParams = {
  t: TFunction<"settings">;
  prefs: Record<string, string>;
  setPref: (key: string, value: string) => void;
  devIntent: DevIntent;
};

export function useReadingSettingsViewProps({
  t,
  prefs,
  setPref,
  devIntent,
}: UseReadingSettingsViewPropsParams): ReadingSettingsViewProps {
  const shouldShowDisplayModeOptions = devIntent === "open-settings-reading-display-mode";

  return {
    title: t("reading.heading"),
    sections: [
      {
        id: "reading-general",
        heading: t("reading.general"),
        controls: [
          {
            id: "display-preset",
            type: "select",
            name: "display_preset",
            label: t("reading.default_display_mode"),
            value: resolveAppDefaultDisplayPreset(prefs),
            open: shouldShowDisplayModeOptions,
            options: [
              { value: "standard", label: t("reading.standard") },
              { value: "preview", label: t("reading.preview") },
            ],
            onChange: (value) => {
              const nextValues = displayPresetToPreferenceValues(value as "standard" | "preview");
              setPref("reader_mode_default", nextValues.reader_mode_default);
              setPref("web_preview_mode_default", nextValues.web_preview_mode_default);
            },
          },
          {
            id: "reading-sort",
            type: "select",
            name: "reading_sort",
            label: t("reading.sort"),
            value: resolvePreferenceValue(prefs, "reading_sort"),
            options: [
              { value: "newest_first", label: t("reading.newest_first") },
              { value: "oldest_first", label: t("reading.oldest_first") },
            ],
            onChange: (value) => setPref("reading_sort", value),
          },
          {
            id: "after-reading",
            type: "select",
            name: "after_reading",
            label: t("reading.after_reading"),
            value: resolvePreferenceValue(prefs, "after_reading"),
            options: [
              { value: "mark_as_read", label: t("reading.mark_as_read") },
              { value: "do_nothing", label: t("reading.do_nothing") },
              { value: "archive", label: t("reading.archive") },
            ],
            onChange: (value) => setPref("after_reading", value),
          },
        ],
      },
      {
        id: "scroll",
        heading: t("reading.scroll"),
        controls: [
          {
            id: "scroll-to-top-on-change",
            type: "switch",
            label: t("reading.scroll_to_top_on_feed_change"),
            checked: resolvePreferenceValue(prefs, "scroll_to_top_on_change") === "true",
            onChange: (checked) => setPref("scroll_to_top_on_change", String(checked)),
          },
        ],
      },
    ],
  };
}
