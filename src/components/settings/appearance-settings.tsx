import { useTranslation } from "react-i18next";
import { AppearanceSettingsView } from "@/components/settings/appearance-settings-view";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";

export function AppearanceSettings() {
  const { t } = useTranslation("settings");
  const prefs = usePreferencesStore((s) => s.prefs);
  const setPref = usePreferencesStore((s) => s.setPref);

  return (
    <AppearanceSettingsView
      title={t("appearance.heading")}
      sections={[
        {
          id: "appearance-general",
          heading: t("appearance.general"),
          controls: [
            {
              id: "list-selection-style",
              type: "select",
              name: "list_selection_style",
              label: t("appearance.list_selection_style"),
              value: resolvePreferenceValue(prefs, "list_selection_style"),
              options: [
                { value: "modern", label: t("appearance.modern") },
                { value: "classic", label: t("appearance.classic") },
              ],
              onChange: (value) => setPref("list_selection_style", value),
            },
            {
              id: "layout",
              type: "select",
              name: "layout",
              label: t("appearance.layout"),
              value: resolvePreferenceValue(prefs, "layout"),
              options: [
                { value: "automatic", label: t("appearance.automatic") },
                { value: "wide", label: t("appearance.wide") },
                { value: "compact", label: t("appearance.compact") },
              ],
              onChange: (value) => setPref("layout", value),
            },
            {
              id: "theme",
              type: "select",
              name: "theme",
              label: t("appearance.theme"),
              value: resolvePreferenceValue(prefs, "theme"),
              options: [
                { value: "light", label: t("appearance.light") },
                { value: "dark", label: t("appearance.dark") },
                { value: "system", label: t("appearance.automatic") },
              ],
              onChange: (value) => setPref("theme", value),
            },
            {
              id: "opaque-sidebars",
              type: "switch",
              label: t("appearance.opaque_sidebars"),
              checked: resolvePreferenceValue(prefs, "opaque_sidebars") === "true",
              onChange: (checked) => setPref("opaque_sidebars", String(checked)),
            },
            {
              id: "grayscale-favicons",
              type: "switch",
              label: t("appearance.grayscale_favicons"),
              checked: resolvePreferenceValue(prefs, "grayscale_favicons") === "true",
              onChange: (checked) => setPref("grayscale_favicons", String(checked)),
            },
          ],
        },
        {
          id: "text",
          heading: t("appearance.text"),
          controls: [
            {
              id: "font-style",
              type: "select",
              name: "font_style",
              label: t("appearance.app_font_style"),
              value: resolvePreferenceValue(prefs, "font_style"),
              options: [
                { value: "sans_serif", label: t("appearance.sans_serif") },
                { value: "serif", label: t("appearance.serif") },
                { value: "monospace", label: t("appearance.monospace") },
              ],
              onChange: (value) => setPref("font_style", value),
            },
            {
              id: "font-size",
              type: "select",
              name: "font_size",
              label: t("appearance.font_size"),
              value: resolvePreferenceValue(prefs, "font_size"),
              options: [
                { value: "small", label: t("appearance.size_s") },
                { value: "medium", label: t("appearance.size_m") },
                { value: "large", label: t("appearance.size_l") },
              ],
              onChange: (value) => setPref("font_size", value),
            },
          ],
        },
        {
          id: "display-counts",
          heading: t("appearance.display_counts"),
          controls: [
            {
              id: "show-starred-count",
              type: "switch",
              label: t("appearance.starred_list"),
              checked: resolvePreferenceValue(prefs, "show_starred_count") === "true",
              onChange: (checked) => setPref("show_starred_count", String(checked)),
            },
            {
              id: "show-unread-count",
              type: "switch",
              label: t("appearance.unread_list"),
              checked: resolvePreferenceValue(prefs, "show_unread_count") === "true",
              onChange: (checked) => setPref("show_unread_count", String(checked)),
            },
          ],
        },
        {
          id: "article-list",
          heading: t("appearance.article_list"),
          controls: [
            {
              id: "image-previews",
              type: "select",
              name: "image_previews",
              label: t("appearance.image_previews"),
              value: resolvePreferenceValue(prefs, "image_previews"),
              options: [
                { value: "off", label: t("appearance.off") },
                { value: "small", label: t("appearance.small") },
                { value: "medium", label: t("appearance.medium") },
                { value: "large", label: t("appearance.large") },
              ],
              onChange: (value) => setPref("image_previews", value),
            },
            {
              id: "display-favicons",
              type: "switch",
              label: t("appearance.display_favicons"),
              checked: resolvePreferenceValue(prefs, "display_favicons") === "true",
              onChange: (checked) => setPref("display_favicons", String(checked)),
            },
            {
              id: "text-preview",
              type: "switch",
              label: t("appearance.text_preview"),
              checked: resolvePreferenceValue(prefs, "text_preview") === "true",
              onChange: (checked) => setPref("text_preview", String(checked)),
            },
            {
              id: "dim-archived",
              type: "switch",
              label: t("appearance.dim_archived_articles"),
              checked: resolvePreferenceValue(prefs, "dim_archived") === "true",
              onChange: (checked) => setPref("dim_archived", String(checked)),
            },
          ],
        },
      ]}
    />
  );
}
