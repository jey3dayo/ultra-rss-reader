import type { Meta, StoryObj } from "@storybook/react-vite";
import { AccountDetailSettingsRow } from "@/components/settings/account-detail/settings-row";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { SectionHeading } from "@/design-system";

const sectionHeadingMeta = {
  title: "Settings/Section/SettingsComponents",
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

// AccountDetailSettingsRow stories are in a separate file since CSF requires one default export.
// But we can use named exports with render functions to show them here.

export const SettingsRowSwitch: SectionHeadingStory = {
  name: "AccountDetailSettingsRow (Switch)",
  args: { children: "Switch Variants" },
  render: () => (
    <div className="w-full max-w-[24rem]">
      <AccountDetailSettingsRow label="Enable notifications" type="switch" checked={true} />
      <AccountDetailSettingsRow label="Dark mode" type="switch" checked={false} />
      <AccountDetailSettingsRow label="Auto-sync" type="switch" />
    </div>
  ),
};

export const SettingsRowSelect: SectionHeadingStory = {
  name: "AccountDetailSettingsRow (Select)",
  args: { children: "Select Variants" },
  render: () => (
    <div className="w-full max-w-[24rem]">
      <AccountDetailSettingsRow label="Theme" type="select" value="Dark" />
      <AccountDetailSettingsRow label="Language" type="select" value="Japanese" />
    </div>
  ),
};

export const SettingsRowText: SectionHeadingStory = {
  name: "AccountDetailSettingsRow (Text)",
  args: { children: "Text Variants" },
  render: () => (
    <div className="w-full max-w-[24rem]">
      <AccountDetailSettingsRow label="Server URL" type="text" value="https://freshrss.example.com" />
      <AccountDetailSettingsRow
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
        <AccountDetailSettingsRow label="Server" type="text" value="https://freshrss.example.com" />
        <AccountDetailSettingsRow label="Username" type="text" value="admin" />
        <AccountDetailSettingsRow label="Auto-sync" type="switch" checked={true} />
        <AccountDetailSettingsRow label="Sync interval" type="select" value="15 min" />
      </SettingsSection>
    </div>
  ),
};
