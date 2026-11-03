import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { CONTEXT_MENU_STORY_TRIGGER_CLASS } from "@/components/storybook/context-menu-story-trigger";
import { ContextMenu } from "@/design-system/context-menu";
import { TagContextMenuView } from "./tag-context-menu-view";

const meta = {
  title: "Reader/Menu/TagContextMenuView",
  component: TagContextMenuView,
  tags: ["autodocs"],
  args: {
    onRename: fn(),
    onDelete: fn(),
  },
  render: (args) => (
    <div className="min-h-48 bg-background p-16">
      <ContextMenu.Root open>
        <ContextMenu.Trigger className={CONTEXT_MENU_STORY_TRIGGER_CLASS}>Tag</ContextMenu.Trigger>
        <TagContextMenuView {...args} />
      </ContextMenu.Root>
    </div>
  ),
} satisfies Meta<typeof TagContextMenuView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
