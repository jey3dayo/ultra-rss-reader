import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ContextMenu } from "@/design-system";
import { TagSectionContextMenuView } from "./tag-section-context-menu-view";

const meta = {
  title: "Reader/Menu/TagSectionContextMenuView",
  component: TagSectionContextMenuView,
  tags: ["autodocs"],
  args: {
    addTagLabel: "Add tag",
    manageTagsLabel: "Manage tags",
    onAddTag: fn(),
    onManageTags: fn(),
  },
  render: (args) => (
    <div className="min-h-48 bg-background p-16">
      <ContextMenu.Root open>
        <ContextMenu.Trigger className="inline-flex rounded-md border border-border px-3 py-2 text-sm text-foreground">
          Tags
        </ContextMenu.Trigger>
        <TagSectionContextMenuView {...args} />
      </ContextMenu.Root>
    </div>
  ),
} satisfies Meta<typeof TagSectionContextMenuView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
