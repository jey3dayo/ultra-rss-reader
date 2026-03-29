import { ContextMenu } from "@base-ui/react/context-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { TagContextMenuView } from "./tag-context-menu-view";

const meta = {
  title: "Reader/TagContextMenuView",
  component: TagContextMenuView,
  tags: ["autodocs"],
  args: {
    onRename: fn(),
    onDelete: fn(),
  },
  render: (args) => (
    <div className="min-h-48 bg-background p-16">
      <ContextMenu.Root open>
        <ContextMenu.Trigger className="inline-flex rounded-md border border-border px-3 py-2 text-sm text-foreground">
          Tag
        </ContextMenu.Trigger>
        <TagContextMenuView {...args} />
      </ContextMenu.Root>
    </div>
  ),
} satisfies Meta<typeof TagContextMenuView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
