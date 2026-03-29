import { useTranslation } from "react-i18next";
import { ReadingSettingsView } from "@/components/settings/reading-settings-view";
import { usePreferencesStore } from "@/stores/preferences-store";

export function ReadingSettings() {
  const { t } = useTranslation("settings");
  const prefs = usePreferencesStore((s) => s.prefs);
  const setPref = usePreferencesStore((s) => s.setPref);

  return (
    <ReadingSettingsView
      title={t("reading.heading")}
      sections={[
        {
          id: "reading-general",
          heading: t("reading.general"),
          controls: [
            {
              id: "reader-view",
              type: "select",
              name: "reader_view",
              label: t("reading.reader_view"),
              value: prefs.reader_view ?? "",
              options: [
                { value: "off", label: t("reading.off") },
                { value: "on", label: t("reading.on") },
                { value: "auto", label: t("reading.automatic") },
              ],
              onChange: (value) => setPref("reader_view", value),
            },
            {
              id: "reading-sort",
              type: "select",
              name: "reading_sort",
              label: t("reading.sort"),
              value: prefs.reading_sort ?? "",
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
              value: prefs.after_reading ?? "",
              options: [
                { value: "mark_as_read", label: t("reading.mark_as_read") },
                { value: "do_nothing", label: t("reading.do_nothing") },
                { value: "archive", label: t("reading.archive") },
              ],
              onChange: (value) => setPref("after_reading", value),
            },
          ],
        },
        {
          id: "scroll",
          heading: t("reading.scroll"),
          controls: [
            {
              id: "scroll-to-top-on-change",
              type: "switch",
              label: t("reading.scroll_to_top_on_feed_change"),
              checked: prefs.scroll_to_top_on_change === "true",
              onChange: (checked) => setPref("scroll_to_top_on_change", String(checked)),
            },
          ],
        },
      ]}
    />
  );
}
