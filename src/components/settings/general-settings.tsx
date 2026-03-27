import { SectionHeading, SettingsSelect, SettingsSwitch } from "@/components/settings/settings-components";

export function GeneralSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">General</h2>

      <section className="mb-6">
        <SectionHeading>App Icon</SectionHeading>
        <SettingsSelect
          label="Unread count badge"
          prefKey="unread_badge"
          options={[
            { value: "dont_display", label: "Don't display" },
            { value: "all_unread", label: "All unread" },
            { value: "only_inbox", label: "Only inbox" },
          ]}
        />
      </section>

      <section className="mb-6">
        <SectionHeading>Browser</SectionHeading>
        <SettingsSelect
          label="Open links"
          prefKey="open_links"
          options={[
            { value: "in_app", label: "In-app browser" },
            { value: "default_browser", label: "Default browser" },
          ]}
        />
        <SettingsSwitch label="Open links in background" prefKey="open_links_background" />
        <p className="mt-2 text-xs text-muted-foreground">
          Please note that some third-party browsers do not support opening links in the background.
        </p>
      </section>

      <section className="mb-6">
        <SectionHeading>Article List</SectionHeading>
        <SettingsSelect
          label="Sort unread items"
          prefKey="sort_unread"
          options={[
            { value: "newest_first", label: "Newest first" },
            { value: "oldest_first", label: "Oldest first" },
          ]}
        />
        <SettingsSelect
          label="Group by"
          prefKey="group_by"
          options={[
            { value: "date", label: "Date" },
            { value: "feed", label: "Feed" },
            { value: "none", label: "None" },
          ]}
        />
        <SettingsSwitch label={"\u2318-click opens in-app browser"} prefKey="cmd_click_browser" />
      </section>

      <section>
        <SectionHeading>Mark All As Read</SectionHeading>
        <SettingsSwitch label="Ask before" prefKey="ask_before_mark_all" />
      </section>
    </div>
  );
}
