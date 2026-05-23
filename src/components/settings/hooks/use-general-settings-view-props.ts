import { supportedLanguages } from "@/lib/i18n";
import { resolvePreferenceValue } from "@/schemas/preferences";
import type { GeneralSettingsViewProps } from "../general-settings-view";
import type { SettingsPreferenceViewPropsParams } from "../settings-preference";

const languageSelfLabels: Partial<Record<(typeof supportedLanguages)[number], string>> = {
  en: "English",
  ja: "日本語",
};

export function useGeneralSettingsViewProps({
  t,
  prefs,
  setPref,
}: SettingsPreferenceViewPropsParams): GeneralSettingsViewProps {
  return {
    title: t("general.heading"),
    sections: [
      {
        id: "app",
        heading: t("general.app"),
        controls: [
          {
            id: "language",
            type: "select",
            name: "language",
            label: t("general.language"),
            value: resolvePreferenceValue(prefs, "language"),
            options: [
              { value: "system", label: t("general.system_default") },
              ...supportedLanguages.map((language) => ({
                value: language,
                label: languageSelfLabels[language] ?? language,
              })),
            ],
            onChange: (value) => setPref("language", value),
          },
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
        id: "navigation",
        heading: t("general.navigation"),
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
            id: "show-sidebar-recent-articles",
            type: "switch",
            label: t("general.show_recent_articles"),
            checked: resolvePreferenceValue(prefs, "show_sidebar_recent_articles") === "true",
            onChange: (checked) => setPref("show_sidebar_recent_articles", String(checked)),
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
    ],
  };
}
