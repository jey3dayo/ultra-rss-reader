import { ContextMenu } from "@base-ui/react/context-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ArticleContextMenuView } from "./article-context-menu-view";

const meta = {
  title: "Reader/ArticleContextMenuView",
  component: ArticleContextMenuView,
  tags: ["autodocs"],
  args: {
    toggleReadLabel: "Mark as Read",
    toggleStarLabel: "Star",
    openInBrowserLabel: "Open in Browser",
    onToggleRead: fn(),
    onToggleStar: fn(),
    onOpenInBrowser: fn(),
  },
  render: (args) => (
    <div className="min-h-48 bg-background p-16">
      <ContextMenu.Root open>
        <ContextMenu.Trigger className="inline-flex rounded-md border border-border px-3 py-2 text-sm text-foreground">
          Article
        </ContextMenu.Trigger>
        <ArticleContextMenuView {...args} />
      </ContextMenu.Root>
    </div>
  ),
} satisfies Meta<typeof ArticleContextMenuView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutBrowserAction: Story = {
  args: {
    openInBrowserLabel: undefined,
    onOpenInBrowser: undefined,
  },
};
