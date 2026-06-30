import { type PlatformKind, SHORTCUT_MODIFIER_BY_PLATFORM } from "@/constants/platform";
import type { DevIntent } from "@/dev/intent";
import { DEV_SCENARIO_ID } from "@/dev/scenario-ids";
import {
  displayPresetToPreferenceValues,
  isArticleDisplayPreset,
  resolveAppDefaultDisplayPreset,
} from "@/lib/articles/article-display";
import { resolvePreferenceValue } from "@/schemas/preference-values";
import type { UiStoreState } from "@/stores/ui-store";
import type { ReadingSettingsViewProps } from "../reading-settings-view";
import type { SettingsPageControl } from "../settings-page.types";
import type { SettingsPreferenceViewPropsParams } from "../settings-preference";

type SettingsPageSwitchControl = Extract<SettingsPageControl, { type: "switch" }>;

type ClearArticleViewHistoryMutation = {
  isPending: boolean;
  mutate: (
    accountId: string,
    options: {
      onError: (error: Error) => void;
      onSuccess: () => void;
    },
  ) => void;
};

export type BuildReadingSettingsViewPropsParams = SettingsPreferenceViewPropsParams & {
  clearHistory: ClearArticleViewHistoryMutation;
  devIntent: DevIntent;
  platformKind: PlatformKind;
  selectedAccountId: string | null;
  showConfirm: UiStoreState["showConfirm"];
  showToast: UiStoreState["showToast"];
  supportsBackgroundBrowserOpen: boolean;
};

export function buildReadingSettingsViewProps({
  t,
  prefs,
  setPref,
  clearHistory,
  devIntent,
  platformKind,
  selectedAccountId,
  showConfirm,
  showToast,
  supportsBackgroundBrowserOpen,
}: BuildReadingSettingsViewPropsParams): ReadingSettingsViewProps {
  const shouldShowDisplayModeOptions = devIntent === DEV_SCENARIO_ID.openSettingsReadingDisplayMode;
  const displayModeOpenState = shouldShowDisplayModeOptions ? { open: true } : {};
  const browserShortcutModifier = SHORTCUT_MODIFIER_BY_PLATFORM[platformKind];
  const openLinksPreference = resolvePreferenceValue(prefs, "open_links");
  const opensInDefaultBrowser = openLinksPreference === "default_browser";
  const hasSelectedAccountId = selectedAccountId !== null && selectedAccountId.trim().length > 0;
  const backgroundBrowserControls: SettingsPageSwitchControl[] = supportsBackgroundBrowserOpen
    ? [
        {
          id: "open-links-background",
          type: "switch",
          label: t("reading.open_links_in_background"),
          checked: resolvePreferenceValue(prefs, "open_links_background") === "true",
          onChange: (checked) => setPref("open_links_background", String(checked)),
          disabled: !opensInDefaultBrowser,
        },
      ]
    : [];
  const handleClearRecentArticles = () => {
    const accountId = selectedAccountId;

    if (accountId === null || accountId.trim().length === 0) {
      return;
    }

    showConfirm(
      t("reading.confirm_clear_recent_articles"),
      () => {
        clearHistory.mutate(accountId, {
          onSuccess: () => showToast(t("reading.clear_recent_articles_success")),
          onError: (error) =>
            showToast(
              t("reading.clear_recent_articles_failed", {
                message: error.message,
              }),
            ),
        });
      },
      {
        actionLabel: t("reading.clear_recent_articles"),
        actionAccessibleLabel: t("reading.clear_recent_articles_aria_label"),
        variant: "destructive",
      },
    );
  };

  return {
    title: t("reading.heading"),
    sections: [
      {
        id: "article-list",
        heading: t("reading.article_list"),
        controls: [
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
            id: "group-by",
            type: "select",
            name: "group_by",
            label: t("reading.group_by"),
            value: resolvePreferenceValue(prefs, "group_by"),
            options: [
              { value: "date", label: t("reading.date") },
              { value: "feed", label: t("reading.feed") },
              { value: "none", label: t("reading.none") },
            ],
            onChange: (value) => setPref("group_by", value),
          },
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
      {
        id: "read-state",
        heading: t("reading.read_state"),
        controls: [
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
            id: "ask-before-mark-all",
            type: "switch",
            label: t("reading.ask_before_mark_all"),
            checked: resolvePreferenceValue(prefs, "ask_before_mark_all") === "true",
            onChange: (checked) => setPref("ask_before_mark_all", String(checked)),
          },
        ],
      },
      {
        id: "history",
        heading: t("reading.history"),
        controls: [
          {
            id: "clear-recent-articles",
            type: "action",
            label: t("reading.recent_articles_history"),
            actionLabel: t("reading.clear_recent_articles"),
            actionAriaLabel: t("reading.clear_recent_articles_aria_label"),
            actionLoading: clearHistory.isPending,
            actionLoadingLabel: t("reading.clearing_recent_articles"),
            onAction: handleClearRecentArticles,
            disabled: !hasSelectedAccountId || clearHistory.isPending,
          },
        ],
      },
      {
        id: "original-article",
        heading: t("reading.original_article_and_web_preview"),
        note: supportsBackgroundBrowserOpen ? t("reading.open_links_background_note") : undefined,
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
            id: "open-links",
            type: "select",
            name: "open_links",
            label: t("reading.open_links"),
            value: openLinksPreference,
            options: [
              { value: "in_app", label: t("reading.in_app_browser") },
              { value: "default_browser", label: t("reading.default_browser") },
            ],
            onChange: (value) => setPref("open_links", value),
          },
          {
            id: "web-preview-keep-focus",
            type: "switch",
            label: t("reading.web_preview_keep_focus"),
            checked: resolvePreferenceValue(prefs, "web_preview_keep_focus") === "true",
            onChange: (checked) => setPref("web_preview_keep_focus", String(checked)),
          },
          {
            id: "window-always-on-top",
            type: "switch",
            label: t("reading.window_always_on_top"),
            checked: resolvePreferenceValue(prefs, "window_always_on_top") === "true",
            onChange: (checked) => setPref("window_always_on_top", String(checked)),
          },
          ...backgroundBrowserControls,
          {
            id: "cmd-click-browser",
            type: "switch",
            label: t("reading.cmd_click_browser", {
              modifier: browserShortcutModifier,
            }),
            checked: resolvePreferenceValue(prefs, "cmd_click_browser") === "true",
            onChange: (checked) => setPref("cmd_click_browser", String(checked)),
          },
        ],
      },
    ],
  };
}
