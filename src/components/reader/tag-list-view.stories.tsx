import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { TagListView } from "./tag-list-view";

const meta = {
  title: "Reader/Sidebar/TagListView",
  component: TagListView,
  tags: ["autodocs"],
  args: {
    tagsLabel: "Tags",
    isOpen: true,
    onToggleOpen: fn(),
    tags: [
      { id: "tag-1", name: "Later", color: "#6f8eb8", articleCount: 2, isSelected: true },
      { id: "tag-2", name: "Work", color: null, articleCount: 0, isSelected: false },
    ],
    onSelectTag: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-60 bg-sidebar p-2 text-sidebar-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TagListView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Collapsed: Story = {
  args: {
    isOpen: false,
  },
};
