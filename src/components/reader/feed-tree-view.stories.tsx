import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { FeedTreeView } from "./feed-tree-view";

const folder: FolderDto = {
  id: "folder-1",
  account_id: "acc-1",
  name: "Work",
  sort_order: 0,
};

const feeds: FeedDto[] = [
  {
    id: "feed-1",
    account_id: "acc-1",
    folder_id: "folder-1",
    title: "Alpha",
    url: "https://example.com/alpha.xml",
    site_url: "https://example.com/alpha",
    unread_count: 4,
    display_mode: "normal",
  },
  {
    id: "feed-2",
    account_id: "acc-1",
    folder_id: null,
    title: "Beta",
    url: "https://example.com/beta.xml",
    site_url: "https://example.com/beta",
    unread_count: 1,
    display_mode: "normal",
  },
];

const meta = {
  title: "Reader/FeedTreeView",
  component: FeedTreeView,
  tags: ["autodocs"],
  args: {
    feedsLabel: "Feeds",
    isOpen: true,
    onToggleOpen: fn(),
    folders: [
      {
        folder,
        feeds: [feeds[0]],
        isExpanded: true,
      },
    ],
    unfolderedFeeds: [feeds[1]],
    selectedFeedId: "feed-1",
    onToggleFolder: fn(),
    onSelectFeed: fn(),
    displayFavicons: true,
    emptyState: <p>No feeds yet</p>,
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
    emptyState: <p>No feeds yet</p>,
  },
};
