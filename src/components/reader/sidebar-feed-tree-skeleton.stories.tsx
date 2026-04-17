import type { Meta, StoryObj } from "@storybook/react-vite";
import { SidebarFeedTreeSkeleton } from "./sidebar-feed-tree-skeleton";

const meta = {
  title: "Reader/Sidebar/SidebarFeedTreeSkeleton",
  component: SidebarFeedTreeSkeleton,
  tags: ["autodocs"],
  args: {
    label: "Loading",
  },
  decorators: [
    (Story) => (
      <div className="w-60 bg-sidebar p-2 text-sidebar-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SidebarFeedTreeSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
