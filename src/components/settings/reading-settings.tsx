import { useTranslation } from "react-i18next";
import { SectionHeading, SettingsSelect, SettingsSwitch } from "@/components/settings/settings-components";

export function ReadingSettings() {
  const { t } = useTranslation("settings");

  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">{t("reading.heading")}</h2>

      <section className="mb-6">
        <SectionHeading>{t("reading.general")}</SectionHeading>
        <SettingsSelect
          label={t("reading.default_display_mode")}
          prefKey="reader_view"
          options={[
            { value: "normal", label: t("reading.normal") },
            { value: "widescreen", label: t("reading.widescreen") },
          ]}
        />
        <SettingsSelect
          label={t("reading.sort")}
          prefKey="reading_sort"
          options={[
            { value: "newest_first", label: t("reading.newest_first") },
            { value: "oldest_first", label: t("reading.oldest_first") },
          ]}
        />
        <SettingsSelect
          label={t("reading.after_reading")}
          prefKey="after_reading"
          options={[
            { value: "mark_as_read", label: t("reading.mark_as_read") },
            { value: "do_nothing", label: t("reading.do_nothing") },
            { value: "archive", label: t("reading.archive") },
          ]}
        />
      </section>

      <section>
        <SectionHeading>{t("reading.scroll")}</SectionHeading>
        <SettingsSwitch label={t("reading.scroll_to_top_on_feed_change")} prefKey="scroll_to_top_on_change" />
      </section>
    </div>
  );
}
