import { useTranslation } from "react-i18next";
import { SectionHeading, SettingsSelect, SettingsSwitch } from "@/components/settings/settings-components";

export function GeneralSettings() {
  const { t } = useTranslation("settings");

  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">{t("general.heading")}</h2>

      <section className="mb-6">
        <SectionHeading>{t("general.language")}</SectionHeading>
        <SettingsSelect
          label={t("general.language")}
          prefKey="language"
          options={[
            { value: "system", label: t("general.system_default") },
            { value: "en", label: "English" },
            { value: "ja", label: "日本語" },
          ]}
        />
      </section>

      <section className="mb-6">
        <SectionHeading>{t("general.app_icon")}</SectionHeading>
        <SettingsSelect
          label={t("general.unread_count_badge")}
          prefKey="unread_badge"
          options={[
            { value: "dont_display", label: t("general.dont_display") },
            { value: "all_unread", label: t("general.all_unread") },
            { value: "only_inbox", label: t("general.only_inbox") },
          ]}
        />
      </section>

      <section className="mb-6">
        <SectionHeading>{t("general.browser")}</SectionHeading>
        <SettingsSelect
          label={t("general.open_links")}
          prefKey="open_links"
          options={[
            { value: "in_app", label: t("general.in_app_browser") },
            { value: "default_browser", label: t("general.default_browser") },
          ]}
        />
        <SettingsSwitch label={t("general.open_links_in_background")} prefKey="open_links_background" />
        <p className="mt-2 text-xs text-muted-foreground">{t("general.open_links_background_note")}</p>
      </section>

      <section className="mb-6">
        <SectionHeading>{t("general.article_list")}</SectionHeading>
        <SettingsSelect
          label={t("general.sort_unread_items")}
          prefKey="sort_unread"
          options={[
            { value: "newest_first", label: t("general.newest_first") },
            { value: "oldest_first", label: t("general.oldest_first") },
          ]}
        />
        <SettingsSelect
          label={t("general.group_by")}
          prefKey="group_by"
          options={[
            { value: "date", label: t("general.date") },
            { value: "feed", label: t("general.feed") },
            { value: "none", label: t("general.none") },
          ]}
        />
        <SettingsSelect
          label={t("general.sort_subscriptions")}
          prefKey="sort_subscriptions"
          options={[
            { value: "folders_first", label: t("general.folders_first") },
            { value: "alphabetical", label: t("general.alphabetical") },
            { value: "newest_first", label: t("general.newest_first") },
            { value: "oldest_first", label: t("general.oldest_first") },
          ]}
        />
        <SettingsSelect
          label={t("general.mark_article_as_read")}
          prefKey="mark_article_as_read"
          options={[
            { value: "on_open", label: t("general.on_open") },
            { value: "manual", label: t("general.manual") },
          ]}
        />
        <SettingsSwitch label={t("general.cmd_click_browser")} prefKey="cmd_click_browser" />
      </section>

      <section>
        <SectionHeading>{t("general.mark_all_as_read")}</SectionHeading>
        <SettingsSwitch label={t("general.ask_before")} prefKey="ask_before_mark_all" />
      </section>
    </div>
  );
}
