import { useTranslation } from "react-i18next";
import { SectionHeading, SettingsSelect, SettingsSwitch } from "@/components/settings/settings-components";

export function AppearanceSettings() {
  const { t } = useTranslation("settings");

  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">{t("appearance.heading")}</h2>

      <section className="mb-6">
        <SectionHeading>{t("appearance.general")}</SectionHeading>
        <SettingsSelect
          label={t("appearance.list_selection_style")}
          prefKey="list_selection_style"
          options={[
            { value: "modern", label: t("appearance.modern") },
            { value: "classic", label: t("appearance.classic") },
          ]}
        />
        <SettingsSelect
          label={t("appearance.layout")}
          prefKey="layout"
          options={[
            { value: "automatic", label: t("appearance.automatic") },
            { value: "wide", label: t("appearance.wide") },
            { value: "compact", label: t("appearance.compact") },
          ]}
        />
        <SettingsSelect
          label={t("appearance.theme")}
          prefKey="theme"
          options={[
            { value: "light", label: t("appearance.light") },
            { value: "dark", label: t("appearance.dark") },
            { value: "system", label: t("appearance.automatic") },
          ]}
        />
        <SettingsSwitch label={t("appearance.opaque_sidebars")} prefKey="opaque_sidebars" />
        <SettingsSwitch label={t("appearance.grayscale_favicons")} prefKey="grayscale_favicons" />
      </section>

      <section className="mb-6">
        <SectionHeading>{t("appearance.text")}</SectionHeading>
        <SettingsSelect
          label={t("appearance.app_font_style")}
          prefKey="font_style"
          options={[
            { value: "sans_serif", label: t("appearance.sans_serif") },
            { value: "serif", label: t("appearance.serif") },
            { value: "monospace", label: t("appearance.monospace") },
          ]}
        />
        <SettingsSelect
          label={t("appearance.font_size")}
          prefKey="font_size"
          options={[
            { value: "small", label: t("appearance.size_s") },
            { value: "medium", label: t("appearance.size_m") },
            { value: "large", label: t("appearance.size_l") },
          ]}
        />
      </section>

      <section className="mb-6">
        <SectionHeading>{t("appearance.display_counts")}</SectionHeading>
        <SettingsSwitch label={t("appearance.starred_list")} prefKey="show_starred_count" />
        <SettingsSwitch label={t("appearance.unread_list")} prefKey="show_unread_count" />
        <SettingsSwitch label={t("appearance.all_items_list")} prefKey="show_all_count" />
      </section>

      <section>
        <SectionHeading>{t("appearance.article_list")}</SectionHeading>
        <SettingsSelect
          label={t("appearance.image_previews")}
          prefKey="image_previews"
          options={[
            { value: "off", label: t("appearance.off") },
            { value: "small", label: t("appearance.small") },
            { value: "medium", label: t("appearance.medium") },
            { value: "large", label: t("appearance.large") },
          ]}
        />
        <SettingsSwitch label={t("appearance.display_favicons")} prefKey="display_favicons" />
        <SettingsSwitch label={t("appearance.text_preview")} prefKey="text_preview" />
        <SettingsSwitch label={t("appearance.dim_archived_articles")} prefKey="dim_archived" />
      </section>
    </div>
  );
}
