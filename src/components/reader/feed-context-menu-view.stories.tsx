import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { CONTEXT_MENU_STORY_TRIGGER_CLASS } from "@/components/storybook/context-menu-story-trigger";
import { ContextMenu } from "@/design-system/context-menu";
import { FeedContextMenuView } from "./feed-context-menu-view";

const meta = {
  title: "Reader/Menu/FeedContextMenuView",
  component: FeedContextMenuView,
  tags: ["autodocs"],
  args: {
    openSiteLabel: "Open site",
    markAllReadLabel: "Mark all as read",
    markOldUnreadReadLabel: "Mark old unread as read",
    oldUnreadDayLabel: (days) => `${days} days`,
    unsubscribeLabel: "Unsubscribe…",
    editLabel: "Edit…",
    onOpenSite: fn(),
    onMarkAllRead: fn(),
    onMarkOldUnreadRead: fn(),
    onUnsubscribe: fn(),
    onEdit: fn(),
  },
  render: (args) => (
    <div className="min-h-48 bg-background p-16">
      <ContextMenu.Root open>
        <ContextMenu.Trigger className={CONTEXT_MENU_STORY_TRIGGER_CLASS}>Feed</ContextMenu.Trigger>
        <FeedContextMenuView {...args} />
      </ContextMenu.Root>
    </div>
  ),
} satisfies Meta<typeof FeedContextMenuView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
