import { Result } from "@praha/byethrow";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getDatabaseInfo, vacuumDatabase } from "@/api/tauri-commands";
import { GeneralSettingsView } from "@/components/settings/general-settings-view";
import { SectionHeading } from "@/components/settings/settings-components";
import { Button } from "@/components/ui/button";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DataManagementSection() {
  const { t } = useTranslation("settings");
  const showToast = useUiStore((s) => s.showToast);
  const [totalSize, setTotalSize] = useState<number | null>(null);
  const [vacuuming, setVacuuming] = useState(false);

  const fetchDbInfo = useCallback(async () => {
    Result.pipe(
      await getDatabaseInfo(),
      Result.inspect((info) => setTotalSize(info.total_size_bytes)),
      Result.inspectError((e) => console.error("Failed to get database info:", e)),
    );
  }, []);

  useEffect(() => {
    fetchDbInfo();
  }, [fetchDbInfo]);

  const handleVacuum = async () => {
    if (vacuuming) return;
    const sizeBefore = totalSize;
    setVacuuming(true);
    Result.pipe(
      await vacuumDatabase(),
      Result.inspect((info) => {
        setTotalSize(info.total_size_bytes);
        const saved = sizeBefore != null ? sizeBefore - info.total_size_bytes : 0;
        showToast(t("general.vacuum_success", { saved: saved > 0 ? `-${formatBytes(saved)}` : formatBytes(0) }));
      }),
      Result.inspectError((e) => {
        console.error("VACUUM failed:", e);
        showToast(t("general.vacuum_failed", { message: e.message }));
      }),
    );
    setVacuuming(false);
  };

  return (
    <section>
      <SectionHeading>{t("general.data_management")}</SectionHeading>
      <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
        <span className="text-sm text-foreground">{t("general.database_size")}</span>
        <span className="text-sm text-muted-foreground">{totalSize != null ? formatBytes(totalSize) : "..."}</span>
      </div>
      <div className="mt-3">
        <p className="mb-2 text-xs text-muted-foreground">{t("general.vacuum_description")}</p>
        <Button variant="outline" size="sm" disabled={vacuuming} onClick={handleVacuum}>
          {vacuuming ? t("general.vacuuming") : t("general.vacuum")}
        </Button>
      </div>
    </section>
  );
}

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
      extraContent={<DataManagementSection />}
    />
  );
}
