import type { Meta, StoryObj } from "@storybook/react-vite";
import { SettingsSection } from "@/components/settings/settings-section";
import { SectionHeading } from "@/components/shared/section-heading";
import { SettingsRow } from "./settings-components";

const sectionHeadingMeta = {
  title: "Settings/SectionHeading",
  component: SectionHeading,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-full max-w-[24rem] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SectionHeading>;

export default sectionHeadingMeta;
type SectionHeadingStory = StoryObj<typeof sectionHeadingMeta>;

export const Default: SectionHeadingStory = {
  args: {
    children: "General",
  },
};

export const Appearance: SectionHeadingStory = {
  args: {
    children: "Appearance",
  },
};

// SettingsRow stories are in a separate file since CSF requires one default export.
// But we can use named exports with render functions to show them here.

export const SettingsRowSwitch: SectionHeadingStory = {
  name: "SettingsRow (Switch)",
  args: { children: "Switch Variants" },
  render: () => (
    <div className="w-full max-w-[24rem]">
      <SettingsRow label="Enable notifications" type="switch" checked={true} />
      <SettingsRow label="Dark mode" type="switch" checked={false} />
      <SettingsRow label="Auto-sync" type="switch" />
    </div>
  ),
};

export const SettingsRowSelect: SectionHeadingStory = {
  name: "SettingsRow (Select)",
  args: { children: "Select Variants" },
  render: () => (
    <div className="w-full max-w-[24rem]">
      <SettingsRow label="Theme" type="select" value="Dark" />
      <SettingsRow label="Language" type="select" value="Japanese" />
    </div>
  ),
};

export const SettingsRowText: SectionHeadingStory = {
  name: "SettingsRow (Text)",
  args: { children: "Text Variants" },
  render: () => (
    <div className="w-full max-w-[24rem]">
      <SettingsRow label="Server URL" type="text" value="https://freshrss.example.com" />
      <SettingsRow
        label="Username"
        type="text"
        value="a-very-long-username-that-needs-truncation@example.com"
        truncate
      />
    </div>
  ),
};

export const FullSettingsSection: SectionHeadingStory = {
  name: "Full Settings Section",
  args: { children: "Account" },
  render: () => (
    <div className="w-full max-w-[24rem]">
      <SettingsSection heading="Account" note="Keep these details aligned with the current sync setup." surface="flat">
        <SettingsRow label="Server" type="text" value="https://freshrss.example.com" />
        <SettingsRow label="Username" type="text" value="admin" />
        <SettingsRow label="Auto-sync" type="switch" checked={true} />
        <SettingsRow label="Sync interval" type="select" value="15 min" />
      </SettingsSection>
    </div>
  ),
};
