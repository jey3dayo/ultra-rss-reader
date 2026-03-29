import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { FolderSectionView } from "./folder-section";

const baseFolder: FolderDto = {
  id: "folder-1",
  account_id: "acc-1",
  name: "Work",
  sort_order: 0,
};

const baseFeeds: FeedDto[] = [
  {
    id: "feed-1",
    account_id: "acc-1",
    folder_id: "folder-1",
    title: "AUTOMATON",
    url: "https://automaton-media.com/feed/",
    site_url: "https://automaton-media.com",
    unread_count: 42,
    display_mode: "normal",
  },
  {
    id: "feed-2",
    account_id: "acc-1",
    folder_id: "folder-1",
    title: "Publickey",
    url: "https://www.publickey1.jp/atom.xml",
    site_url: "https://www.publickey1.jp/",
    unread_count: 7,
    display_mode: "normal",
  },
  {
    id: "feed-3",
    account_id: "acc-1",
    folder_id: "folder-1",
    title: "NHK News",
    url: "https://www3.nhk.or.jp/rss/news/cat0.xml",
    site_url: "https://www3.nhk.or.jp/news/",
    unread_count: 0,
    display_mode: "normal",
  },
];

const meta = {
  title: "Reader/FolderSectionView",
  component: FolderSectionView,
  tags: ["autodocs"],
  args: {
    folder: baseFolder,
    feeds: baseFeeds,
    isExpanded: true,
    onToggle: fn(),
    selectedFeedId: "feed-1",
    onSelectFeed: fn(),
    displayFavicons: true,
    hasContextMenu: true,
  },
  decorators: [
    (Story) => (
      <div className="w-60 bg-sidebar p-2 text-sidebar-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FolderSectionView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {};

export const Collapsed: Story = {
  args: {
    isExpanded: false,
  },
};

export const NoUnreadCounts: Story = {
  args: {
    feeds: baseFeeds.map((feed) => ({ ...feed, unread_count: 0 })),
    selectedFeedId: null,
  },
};
