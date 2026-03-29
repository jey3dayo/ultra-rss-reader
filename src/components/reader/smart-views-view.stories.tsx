import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { SmartViewsView } from "./smart-views-view";

const meta = {
  title: "Reader/SmartViewsView",
  component: SmartViewsView,
  tags: ["autodocs"],
  args: {
    unreadLabel: "Unread",
    starredLabel: "Starred",
    unreadCount: 12,
    starredCount: 3,
    showUnreadCount: true,
    showStarredCount: true,
    selectedKind: "unread",
    onSelectSmartView: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-60 bg-sidebar p-2 text-sidebar-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SmartViewsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const StarredSelected: Story = {
  args: {
    selectedKind: "starred",
  },
};
