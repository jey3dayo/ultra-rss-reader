import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { SmartViewsView } from "./smart-views-view";

const meta = {
  title: "Reader/SmartViewsView",
  component: SmartViewsView,
  tags: ["autodocs"],
  args: {
    views: [
      { kind: "unread", label: "Unread", count: 12, showCount: true, isSelected: true },
      { kind: "starred", label: "Starred", count: 3, showCount: true, isSelected: false },
    ],
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
    views: [
      { kind: "unread", label: "Unread", count: 12, showCount: true, isSelected: false },
      { kind: "starred", label: "Starred", count: 3, showCount: true, isSelected: true },
    ],
  },
};
