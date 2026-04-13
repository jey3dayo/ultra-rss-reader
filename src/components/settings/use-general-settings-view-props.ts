import type { TFunction } from "i18next";
import { SHORTCUT_MODIFIER_BY_PLATFORM } from "@/constants/platform";
import { resolvePreferenceValue } from "@/stores/preferences-store";
import type { GeneralSettingsViewProps } from "./general-settings-view";

type UseGeneralSettingsViewPropsParams = {
  t: TFunction<"settings">;
  prefs: Record<string, string>;
  setPref: (key: string, value: string) => void;
  platformKind: keyof typeof SHORTCUT_MODIFIER_BY_PLATFORM;
  supportsBackgroundBrowserOpen: boolean;
};

export function useGeneralSettingsViewProps({
  t,
  prefs,
  setPref,
  platformKind,
  supportsBackgroundBrowserOpen,
}: UseGeneralSettingsViewPropsParams): GeneralSettingsViewProps {
  const browserShortcutModifier = SHORTCUT_MODIFIER_BY_PLATFORM[platformKind];

  return {
    title: t("general.heading"),
    sections: [
      {
        id: "language",
        heading: t("general.language"),
        controls: [
          {
            id: "language",
            type: "select",
            name: "language",
            label: t("general.language"),
            value: resolvePreferenceValue(prefs, "language"),
            options: [
              { value: "system", label: t("general.system_default") },
              { value: "en", label: "English" },
              { value: "ja", label: "日本語" },
            ],
            onChange: (value) => setPref("language", value),
          },
        ],
      },
      {
        id: "app-icon",
        heading: t("general.app_icon"),
        controls: [
          {
            id: "unread-badge",
            type: "select",
            name: "unread_badge",
            label: t("general.unread_count_badge"),
            value: resolvePreferenceValue(prefs, "unread_badge"),
            options: [
              { value: "dont_display", label: t("general.dont_display") },
              { value: "all_unread", label: t("general.all_unread") },
              { value: "only_inbox", label: t("general.only_inbox") },
            ],
            onChange: (value) => setPref("unread_badge", value),
          },
        ],
      },
      {
        id: "sidebar",
        heading: t("general.sidebar"),
        controls: [
          {
            id: "show-sidebar-unread",
            type: "switch",
            label: t("general.show_unread"),
            checked: resolvePreferenceValue(prefs, "show_sidebar_unread") === "true",
            onChange: (checked) => setPref("show_sidebar_unread", String(checked)),
          },
          {
            id: "show-sidebar-starred",
            type: "switch",
            label: t("general.show_starred"),
            checked: resolvePreferenceValue(prefs, "show_sidebar_starred") === "true",
            onChange: (checked) => setPref("show_sidebar_starred", String(checked)),
          },
          {
            id: "show-sidebar-tags",
            type: "switch",
            label: t("general.show_tags"),
            checked: resolvePreferenceValue(prefs, "show_sidebar_tags") === "true",
            onChange: (checked) => setPref("show_sidebar_tags", String(checked)),
          },
          {
            id: "startup-folder-expansion",
            type: "select",
            name: "startup_folder_expansion",
            label: t("general.startup_folder_expansion"),
            value: resolvePreferenceValue(prefs, "startup_folder_expansion"),
            options: [
              { value: "all_collapsed", label: t("general.all_collapsed") },
              { value: "unread_folders", label: t("general.unread_folders") },
              { value: "restore_previous", label: t("general.restore_previous") },
            ],
            onChange: (value) => setPref("startup_folder_expansion", value),
          },
        ],
      },
      {
        id: "browser",
        heading: t("general.browser"),
        note: supportsBackgroundBrowserOpen ? t("general.open_links_background_note") : undefined,
        controls: [
          {
            id: "open-links",
            type: "select",
            name: "open_links",
            label: t("general.open_links"),
            value: resolvePreferenceValue(prefs, "open_links"),
            options: [
              { value: "in_app", label: t("general.in_app_browser") },
              { value: "default_browser", label: t("general.default_browser") },
            ],
            onChange: (value) => setPref("open_links", value),
          },
          ...(supportsBackgroundBrowserOpen
            ? [
                {
                  id: "open-links-background",
                  type: "switch" as const,
                  label: t("general.open_links_in_background"),
                  checked: resolvePreferenceValue(prefs, "open_links_background") === "true",
                  onChange: (checked: boolean) => setPref("open_links_background", String(checked)),
                },
              ]
            : []),
        ],
      },
      {
        id: "sync",
        heading: t("general.sync"),
        controls: [
          {
            id: "sync-on-startup",
            type: "switch",
            label: t("general.sync_on_startup"),
            checked: resolvePreferenceValue(prefs, "sync_on_startup") === "true",
            onChange: (checked) => setPref("sync_on_startup", String(checked)),
          },
        ],
      },
      {
        id: "article-list",
        heading: t("general.article_list"),
        controls: [
          {
            id: "sort-unread",
            type: "select",
            name: "sort_unread",
            label: t("general.sort_unread_items"),
            value: resolvePreferenceValue(prefs, "sort_unread"),
            options: [
              { value: "newest_first", label: t("general.newest_first") },
              { value: "oldest_first", label: t("general.oldest_first") },
            ],
            onChange: (value) => setPref("sort_unread", value),
          },
          {
            id: "group-by",
            type: "select",
            name: "group_by",
            label: t("general.group_by"),
            value: resolvePreferenceValue(prefs, "group_by"),
            options: [
              { value: "date", label: t("general.date") },
              { value: "feed", label: t("general.feed") },
              { value: "none", label: t("general.none") },
            ],
            onChange: (value) => setPref("group_by", value),
          },
          {
            id: "sort-subscriptions",
            type: "select",
            name: "sort_subscriptions",
            label: t("general.sort_subscriptions"),
            value: resolvePreferenceValue(prefs, "sort_subscriptions"),
            options: [
              { value: "folders_first", label: t("general.folders_first") },
              { value: "alphabetical", label: t("general.alphabetical") },
              { value: "newest_first", label: t("general.newest_first") },
              { value: "oldest_first", label: t("general.oldest_first") },
            ],
            onChange: (value) => setPref("sort_subscriptions", value),
          },
          {
            id: "cmd-click-browser",
            type: "switch",
            label: t("general.cmd_click_browser", { modifier: browserShortcutModifier }),
            checked: resolvePreferenceValue(prefs, "cmd_click_browser") === "true",
            onChange: (checked) => setPref("cmd_click_browser", String(checked)),
          },
        ],
      },
      {
        id: "mark-all-read",
        heading: t("general.mark_all_as_read"),
        controls: [
          {
            id: "ask-before-mark-all",
            type: "switch",
            label: t("general.ask_before"),
            checked: resolvePreferenceValue(prefs, "ask_before_mark_all") === "true",
            onChange: (checked) => setPref("ask_before_mark_all", String(checked)),
          },
        ],
      },
    ],
  };
}
