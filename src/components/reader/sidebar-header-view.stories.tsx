import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { SidebarHeaderView } from "./sidebar-header-view";

const meta = {
  title: "Reader/SidebarHeaderView",
  component: SidebarHeaderView,
  tags: ["autodocs"],
  args: {
    lastSyncedLabel: "Not synced yet",
    isSyncing: false,
    onSync: fn(),
    onAddFeed: fn(),
    syncButtonLabel: "Sync feeds",
    addFeedButtonLabel: "Add feed",
  },
  decorators: [
    (Story) => (
      <div className="w-[280px] bg-sidebar text-sidebar-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SidebarHeaderView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Syncing: Story = {
  args: {
    lastSyncedLabel: "Today at 10:42",
    isSyncing: true,
  },
};
