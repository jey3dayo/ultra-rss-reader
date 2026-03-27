import { SectionHeading, SettingsSelect, SettingsSwitch } from "@/components/settings/settings-components";

export function ReadingSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Reading</h2>

      <section className="mb-6">
        <SectionHeading>General</SectionHeading>
        <SettingsSelect
          label="Reader View"
          prefKey="reader_view"
          options={[
            { value: "off", label: "Off" },
            { value: "on", label: "On" },
            { value: "auto", label: "Automatic" },
          ]}
        />
        <SettingsSelect
          label="Sort"
          prefKey="reading_sort"
          options={[
            { value: "newest_first", label: "Newest first" },
            { value: "oldest_first", label: "Oldest first" },
          ]}
        />
        <SettingsSelect
          label="After reading"
          prefKey="after_reading"
          options={[
            { value: "mark_as_read", label: "Mark as read" },
            { value: "do_nothing", label: "Do nothing" },
            { value: "archive", label: "Archive" },
          ]}
        />
      </section>

      <section>
        <SectionHeading>Scroll</SectionHeading>
        <SettingsSwitch label="Scroll to top on feed change" prefKey="scroll_to_top_on_change" />
      </section>
    </div>
  );
}
