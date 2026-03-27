import type { FeedDto } from "@/api/tauri-commands";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { FeedItem } from "./feed-item";

const baseFeed: FeedDto = {
  id: "feed-1",
  account_id: "acc-1",
  folder_id: "folder-1",
  title: "AUTOMATON",
  url: "https://automaton-media.com/feed/",
  unread_count: 42,
};

const meta = {
  title: "Reader/FeedItem",
  component: FeedItem,
  tags: ["autodocs"],
  args: {
    onSelect: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-60 bg-sidebar p-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FeedItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unselected: Story = {
  args: {
    feed: baseFeed,
    isSelected: false,
    displayFavicons: true,
  },
};

export const Selected: Story = {
  args: {
    feed: baseFeed,
    isSelected: true,
    displayFavicons: true,
  },
};

export const NoUnreadCount: Story = {
  args: {
    feed: { ...baseFeed, unread_count: 0 },
    isSelected: false,
    displayFavicons: true,
  },
};

export const WithoutFavicon: Story = {
  args: {
    feed: baseFeed,
    isSelected: false,
    displayFavicons: false,
  },
};

export const LongTitle: Story = {
  args: {
    feed: {
      ...baseFeed,
      title: "Very Long Feed Title That Should Be Truncated When It Overflows The Container",
    },
    isSelected: false,
    displayFavicons: true,
  },
};

export const HighUnreadCount: Story = {
  args: {
    feed: { ...baseFeed, unread_count: 1234 },
    isSelected: false,
    displayFavicons: true,
  },
};

export const MultipleFeeds: Story = {
  args: {
    feed: baseFeed,
    isSelected: false,
    displayFavicons: true,
  },
  render: () => {
    const feeds: FeedDto[] = [
      { ...baseFeed, id: "1", title: "AUTOMATON", unread_count: 199 },
      { ...baseFeed, id: "2", title: "Publickey", unread_count: 70 },
      { ...baseFeed, id: "3", title: "NHK News", unread_count: 0 },
      { ...baseFeed, id: "4", title: "blog.jxck.io", unread_count: 1 },
    ];
    return (
      <div className="flex flex-col gap-0.5">
        {feeds.map((feed, i) => (
          <FeedItem key={feed.id} feed={feed} isSelected={i === 0} onSelect={fn()} displayFavicons={true} />
        ))}
      </div>
    );
  },
};
