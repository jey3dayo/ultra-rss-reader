import { ContextMenu } from "@base-ui/react/context-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { FeedContextMenuView } from "./feed-context-menu-view";

const meta = {
  title: "Reader/FeedContextMenuView",
  component: FeedContextMenuView,
  tags: ["autodocs"],
  args: {
    openSiteLabel: "Open site",
    markAllReadLabel: "Mark all as read",
    unsubscribeLabel: "Unsubscribe…",
    editLabel: "Edit…",
    onOpenSite: fn(),
    onMarkAllRead: fn(),
    onUnsubscribe: fn(),
    onEdit: fn(),
  },
  render: (args) => (
    <div className="min-h-48 bg-background p-16">
      <ContextMenu.Root open>
        <ContextMenu.Trigger className="inline-flex rounded-md border border-border px-3 py-2 text-sm text-foreground">
          Feed
        </ContextMenu.Trigger>
        <FeedContextMenuView {...args} />
      </ContextMenu.Root>
    </div>
  ),
} satisfies Meta<typeof FeedContextMenuView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
