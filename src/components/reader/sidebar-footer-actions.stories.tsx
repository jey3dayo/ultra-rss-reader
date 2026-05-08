import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { SidebarFooterActions } from "./sidebar-footer-actions";

const meta = {
  title: "Reader/Sidebar/SidebarFooterActions",
  component: SidebarFooterActions,
  tags: ["autodocs"],
  args: {
    subscriptionsIndexLabel: "Manage Subscriptions",
    subscriptionsIndexShortLabel: "Feeds",
    settingsLabel: "Settings",
    themeToggleLabel: "Toggle Theme",
    onOpenSubscriptionsIndex: fn(),
    onOpenSettings: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[260px] bg-sidebar text-sidebar-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SidebarFooterActions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[156px] bg-sidebar text-sidebar-foreground">
        <Story />
      </div>
    ),
  ],
};

export const LongLabels: Story = {
  args: {
    subscriptionsIndexLabel: "Manage subscriptions, folders, and feed sources",
    subscriptionsIndexShortLabel: "Subscriptions",
    settingsLabel: "Open application settings",
    themeToggleLabel: "Switch between light and dark themes",
  },
};
