import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { TAG_COLOR_PRESETS } from "@/design-system";
import { TagsSettingsView } from "./tags-settings-view";

const meta = {
  title: "Settings/Category/TagsSettingsView",
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
    colorValue: TAG_COLOR_PRESETS[0],
    colorOptions: TAG_COLOR_PRESETS,
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
        color: TAG_COLOR_PRESETS[0],
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
