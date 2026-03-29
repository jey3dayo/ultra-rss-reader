import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ArticleToolbarView } from "./article-toolbar-view";

const meta = {
  title: "Reader/ArticleToolbarView",
  component: ArticleToolbarView,
  tags: ["autodocs"],
  args: {
    showSidebarButton: true,
    canToggleRead: true,
    canToggleStar: true,
    isRead: false,
    isStarred: true,
    showCopyLinkButton: true,
    canCopyLink: true,
    showOpenInBrowserButton: true,
    canOpenInBrowser: true,
    showOpenInExternalBrowserButton: true,
    canOpenInExternalBrowser: true,
    labels: {
      showSidebar: "Show sidebar",
      toggleRead: "Toggle read",
      toggleStar: "Toggle star",
      copyLink: "Copy link",
      viewInBrowser: "View in browser",
      openInExternalBrowser: "Open in external browser",
    },
    onShowSidebar: fn(),
    onToggleRead: fn(),
    onToggleStar: fn(),
    onCopyLink: fn(),
    onOpenInBrowser: fn(),
    onOpenInExternalBrowser: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ArticleToolbarView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DisabledActions: Story = {
  args: {
    showSidebarButton: false,
    canToggleRead: false,
    canToggleStar: false,
    showCopyLinkButton: false,
    canCopyLink: false,
    showOpenInBrowserButton: false,
    canOpenInBrowser: false,
    showOpenInExternalBrowserButton: false,
    canOpenInExternalBrowser: false,
  },
};
