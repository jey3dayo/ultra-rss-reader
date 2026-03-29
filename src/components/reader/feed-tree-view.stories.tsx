import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { FeedTreeView } from "./feed-tree-view";

const meta = {
  title: "Reader/FeedTreeView",
  component: FeedTreeView,
  tags: ["autodocs"],
  args: {
    isOpen: true,
    folders: [
      {
        id: "folder-1",
        name: "Work",
        unreadCount: 4,
        isExpanded: true,
        feeds: [
          {
            id: "feed-1",
            title: "Alpha",
            url: "https://example.com/alpha.xml",
            siteUrl: "https://example.com/alpha",
            unreadCount: 4,
            displayMode: "normal",
            isSelected: true,
            grayscaleFavicon: false,
          },
        ],
      },
    ],
    unfolderedFeeds: [
      {
        id: "feed-2",
        title: "Beta",
        url: "https://example.com/beta.xml",
        siteUrl: "https://example.com/beta",
        unreadCount: 1,
        displayMode: "normal",
        isSelected: false,
        grayscaleFavicon: false,
      },
    ],
    onToggleFolder: fn(),
    onSelectFeed: fn(),
    displayFavicons: true,
    emptyState: { kind: "message", message: "No feeds yet" },
    renderFolderContextMenu: fn(),
    renderFeedContextMenu: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-60 bg-sidebar p-2 text-sidebar-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FeedTreeView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    folders: [],
    unfolderedFeeds: [],
    emptyState: { kind: "action", label: "Add account", onAction: fn() },
  },
};
