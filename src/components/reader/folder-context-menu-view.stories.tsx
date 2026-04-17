import { ContextMenu } from "@base-ui/react/context-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { FolderContextMenuView } from "./folder-context-menu-view";

const meta = {
  title: "Reader/Menu/FolderContextMenuView",
  component: FolderContextMenuView,
  tags: ["autodocs"],
  args: {
    markAllReadLabel: "Mark all as read",
    onMarkAllRead: fn(),
  },
  render: (args) => (
    <div className="min-h-48 bg-background p-16">
      <ContextMenu.Root open>
        <ContextMenu.Trigger className="inline-flex rounded-md border border-border px-3 py-2 text-sm text-foreground">
          Folder
        </ContextMenu.Trigger>
        <FolderContextMenuView {...args} />
      </ContextMenu.Root>
    </div>
  ),
} satisfies Meta<typeof FolderContextMenuView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
