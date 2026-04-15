import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ArticleTagPickerView } from "./article-tag-picker-view";

const meta = {
  title: "Reader/ArticleTagPickerView",
  component: ArticleTagPickerView,
  tags: ["autodocs"],
  args: {
    assignedTags: [{ id: "tag-1", name: "Later", color: null }],
    availableTags: [
      { id: "tag-2", name: "Important", color: "#cf7868" },
      { id: "tag-3", name: "Work", color: "#6f8eb8" },
    ],
    newTagName: "",
    isExpanded: true,
    labels: {
      addTag: "Add tag",
      availableTags: "Available tags",
      newTagPlaceholder: "Create tag",
      createTag: "Create tag",
      removeTag: (name: string) => `Remove tag ${name}`,
    },
    onExpandedChange: fn(),
    onNewTagNameChange: fn(),
    onAssignTag: fn(),
    onRemoveTag: fn(),
    onCreateTag: fn(),
  },
  decorators: [
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ArticleTagPickerView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {};

export const WithoutAvailableTags: Story = {
  args: {
    availableTags: [],
    newTagName: "Follow up",
  },
};
