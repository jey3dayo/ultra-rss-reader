import { useTranslation } from "react-i18next";
import { GeneralSettingsView } from "@/components/settings/general-settings-view";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";

export function GeneralSettings() {
  const { t } = useTranslation("settings");
  const prefs = usePreferencesStore((s) => s.prefs);
  const setPref = usePreferencesStore((s) => s.setPref);

  return (
    <GeneralSettingsView
      title={t("general.heading")}
      sections={[
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
          id: "browser",
          heading: t("general.browser"),
          note: t("general.open_links_background_note"),
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
            {
              id: "open-links-background",
              type: "switch",
              label: t("general.open_links_in_background"),
              checked: resolvePreferenceValue(prefs, "open_links_background") === "true",
              onChange: (checked) => setPref("open_links_background", String(checked)),
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
              id: "mark-article-as-read",
              type: "select",
              name: "mark_article_as_read",
              label: t("general.mark_article_as_read"),
              value: resolvePreferenceValue(prefs, "mark_article_as_read"),
              options: [
                { value: "on_open", label: t("general.on_open") },
                { value: "manual", label: t("general.manual") },
              ],
              onChange: (value) => setPref("mark_article_as_read", value),
            },
            {
              id: "cmd-click-browser",
              type: "switch",
              label: t("general.cmd_click_browser"),
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
      ]}
    />
  );
}
