import { SectionHeading, SettingsSelect, SettingsSwitch } from "@/components/settings/settings-components";

export function AppearanceSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Appearance</h2>

      <section className="mb-6">
        <SectionHeading>General</SectionHeading>
        <SettingsSelect
          label="List selection style"
          prefKey="list_selection_style"
          options={[
            { value: "modern", label: "Modern" },
            { value: "classic", label: "Classic" },
          ]}
        />
        <SettingsSelect
          label="Layout"
          prefKey="layout"
          options={[
            { value: "automatic", label: "Automatic" },
            { value: "wide", label: "Wide" },
            { value: "compact", label: "Compact" },
          ]}
        />
        <SettingsSelect
          label="Theme"
          prefKey="theme"
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "Automatic" },
          ]}
        />
        <SettingsSwitch label="Opaque sidebars" prefKey="opaque_sidebars" />
        <SettingsSwitch label="Grayscale favicons" prefKey="grayscale_favicons" />
      </section>

      <section className="mb-6">
        <SectionHeading>Text</SectionHeading>
        <SettingsSelect
          label="App font style"
          prefKey="font_style"
          options={[
            { value: "sans_serif", label: "Sans-serif" },
            { value: "serif", label: "Serif" },
            { value: "monospace", label: "Monospace" },
          ]}
        />
        <SettingsSelect
          label="Font size"
          prefKey="font_size"
          options={[
            { value: "small", label: "S" },
            { value: "medium", label: "M" },
            { value: "large", label: "L" },
          ]}
        />
      </section>

      <section className="mb-6">
        <SectionHeading>Display Counts</SectionHeading>
        <SettingsSwitch label="Starred list" prefKey="show_starred_count" />
        <SettingsSwitch label="Unread list" prefKey="show_unread_count" />
        <SettingsSwitch label="All items list" prefKey="show_all_count" />
      </section>

      <section>
        <SectionHeading>Article List</SectionHeading>
        <SettingsSelect
          label="Image previews"
          prefKey="image_previews"
          options={[
            { value: "off", label: "Off" },
            { value: "small", label: "Small" },
            { value: "medium", label: "Medium" },
            { value: "large", label: "Large" },
          ]}
        />
        <SettingsSwitch label="Display favicons" prefKey="display_favicons" />
        <SettingsSwitch label="Text preview" prefKey="text_preview" />
        <SettingsSwitch label="Dim archived articles" prefKey="dim_archived" />
      </section>
    </div>
  );
}
