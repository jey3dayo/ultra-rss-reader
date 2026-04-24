import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { TagsSettingsView } from "./tags-settings-view";

const meta = {
  title: "Settings/Page/TagsSettingsView",
  component: TagsSettingsView,
  tags: ["autodocs"],
  args: {
    title: "Tags",
    addHeading: "Add tag",
    intro: "Create tags to organize feeds and articles.",
    nameLabel: "Title",
    nameValue: "Later",
    namePlaceholder: "Enter a tag name",
    colorLabel: "Color",
    colorValue: "#f97316",
    colorOptions: ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"],
    noColorLabel: "No color",
    colorOptionAriaLabel: (color: string) => `Select ${color}`,
    createLabel: "Create",
    onNameChange: fn(),
    onColorChange: fn(),
    onCreate: fn(),
    createDisabled: false,
    savedHeading: "Saved tags",
    emptyState: "No tags yet.",
    tags: [
      {
        id: "tag-1",
        name: "Later",
        color: "#f97316",
      },
      {
        id: "tag-2",
        name: "Reference",
        color: null,
      },
    ],
    editLabel: "Edit",
    editAriaLabel: (name: string) => `Edit ${name}`,
    deleteLabel: "Delete",
    deleteAriaLabel: (name: string) => `Delete ${name}`,
    onEdit: fn(),
    onDelete: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[420px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TagsSettingsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    nameValue: "",
    colorValue: null,
    createDisabled: true,
    tags: [],
  },
};
