import { useCallback } from "react";
import { useClearArticleViewHistory } from "@/hooks/use-articles";
import {
  displayPresetToPreferenceValues,
  isArticleDisplayPreset,
  resolveAppDefaultDisplayPreset,
} from "@/lib/article-display";
import type { DevIntent } from "@/lib/dev-intent";
import { DEV_SCENARIO_ID } from "@/lib/dev-scenario-ids";
import { resolvePreferenceValue } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import type { ReadingSettingsViewProps } from "./reading-settings-view";
import type { SettingsPreferenceViewPropsParams } from "./settings-page.types";

type UseReadingSettingsViewPropsParams = SettingsPreferenceViewPropsParams & {
  devIntent: DevIntent;
};

export function useReadingSettingsViewProps({
  t,
  prefs,
  setPref,
  devIntent,
}: UseReadingSettingsViewPropsParams): ReadingSettingsViewProps {
  const shouldShowDisplayModeOptions = devIntent === DEV_SCENARIO_ID.openSettingsReadingDisplayMode;
  const displayModeOpenState = shouldShowDisplayModeOptions ? { open: true } : {};
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const showToast = useUiStore((state) => state.showToast);
  const showConfirm = useUiStore((state) => state.showConfirm);
  const clearHistory = useClearArticleViewHistory();
  const handleClearRecentArticles = useCallback(() => {
    if (!selectedAccountId) {
      return;
    }

    showConfirm(
      t("reading.confirm_clear_recent_articles"),
      () => {
        clearHistory.mutate(selectedAccountId, {
          onSuccess: () => showToast(t("reading.clear_recent_articles_success")),
          onError: (error) => showToast(t("reading.clear_recent_articles_failed", { message: error.message })),
        });
      },
      { actionLabel: t("reading.clear_recent_articles") },
    );
  }, [clearHistory, selectedAccountId, showConfirm, showToast, t]);

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
            ...displayModeOpenState,
            options: [
              { value: "standard", label: t("reading.standard") },
              { value: "preview", label: t("reading.preview") },
            ],
            onChange: (value) => {
              if (!isArticleDisplayPreset(value)) {
                return;
              }

              const nextValues = displayPresetToPreferenceValues(value);
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
              { value: "never", label: t("reading.do_nothing") },
              { value: "immediately", label: t("reading.mark_immediately") },
              { value: "after_0_3s", label: t("reading.mark_after_0_3s") },
              { value: "after_0_5s", label: t("reading.mark_after_0_5s") },
              { value: "after_1s", label: t("reading.mark_after_1s") },
            ],
            onChange: (value) => setPref("after_reading", value),
          },
          {
            id: "recent-articles-history-enabled",
            type: "switch",
            label: t("reading.recent_articles_history_enabled"),
            checked: resolvePreferenceValue(prefs, "recent_articles_history_enabled") === "true",
            onChange: (checked) => setPref("recent_articles_history_enabled", String(checked)),
          },
          {
            id: "clear-recent-articles",
            type: "action",
            label: t("reading.recent_articles_history"),
            actionLabel: t("reading.clear_recent_articles"),
            onAction: handleClearRecentArticles,
            disabled: !selectedAccountId || clearHistory.isPending,
          },
        ],
      },
      {
        id: "scroll",
        heading: t("reading.scroll"),
        controls: [
          {
            id: "open-first-article-on-feed-selection",
            type: "switch",
            label: t("reading.open_first_article_on_feed_selection"),
            checked: resolvePreferenceValue(prefs, "open_first_article_on_feed_selection") === "true",
            onChange: (checked) => setPref("open_first_article_on_feed_selection", String(checked)),
          },
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
