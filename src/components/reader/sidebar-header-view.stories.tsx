import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { SidebarHeaderView } from "./sidebar-header-view";

const meta = {
  title: "Reader/Sidebar/SidebarHeaderView",
  component: SidebarHeaderView,
  tags: ["autodocs"],
  args: {
    isSyncing: false,
    onSync: fn(),
    onAddFeed: fn(),
    syncButtonLabel: "Sync feeds",
    syncButtonText: "Sync",
    addFeedButtonLabel: "Add feed",
    addFeedButtonText: "Add",
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[280px] bg-sidebar text-sidebar-foreground">
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
    isSyncing: true,
  },
};
