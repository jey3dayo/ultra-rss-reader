import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { FeedDto } from "@/api/tauri-commands";
import type { SubscriptionListGroup, SubscriptionListRow } from "@/lib/subscriptions-index.types";
import { SubscriptionsListPane } from "./subscriptions-list-pane";

function buildFeed(overrides: Partial<FeedDto>): FeedDto {
  return {
    id: "feed-1",
    account_id: "acc-1",
    folder_id: "folder-1",
    title: "Example Feed",
    url: "https://example.com/feed.xml",
    site_url: "https://example.com",
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
    ...overrides,
  };
}

const rows = [
  {
    feed: buildFeed({ id: "feed-1", title: "Example Feed", unread_count: 0 }),
    folderId: "folder-1",
    folderName: "Work",
    latestArticleAt: "2024-01-01T10:00:00Z",
    status: { tone: "medium", labelKey: "stale_90d" },
    reasonTooltipKey: "stale_90d",
  },
  {
    feed: buildFeed({
      id: "feed-2",
      folder_id: "folder-2",
      title: "Fresh Feed",
      url: "https://example.com/fresh.xml",
      site_url: "https://example.com/fresh",
      unread_count: 3,
    }),
    folderId: "folder-2",
    folderName: "Design",
    latestArticleAt: "2026-04-01T10:00:00Z",
    status: { tone: "neutral", labelKey: "normal" },
    reasonTooltipKey: null,
  },
  {
    feed: buildFeed({
      id: "feed-3",
      folder_id: null,
      title: "Long Research Newsletter With Truncation Pressure",
      url: "https://example.com/loose.xml",
      site_url: "https://example.com/loose",
      unread_count: 12,
    }),
    folderId: null,
    folderName: null,
    latestArticleAt: null,
    status: { tone: "medium", labelKey: "review" },
    reasonTooltipKey: "review",
  },
] satisfies SubscriptionListRow[];

const groups = [
  { key: "folder-1", label: "Work", folderId: "folder-1", rows: [rows[0]] },
  { key: "folder-2", label: "Design", folderId: "folder-2", rows: [rows[1]] },
  { key: "ungrouped", label: "Unfoldered", folderId: null, rows: [rows[2]] },
] satisfies SubscriptionListGroup[];

const readerAlignedRows = [
  {
    feed: buildFeed({
      id: "automation",
      folder_id: "misc",
      title: "AUTOMATON",
      unread_count: 3,
    }),
    folderId: "misc",
    folderName: "Misc",
    latestArticleAt: "2026-05-07T10:00:00Z",
    status: { tone: "neutral", labelKey: "normal" },
    reasonTooltipKey: "normal",
  },
  {
    feed: buildFeed({
      id: "hatena",
      folder_id: "misc",
      title: "はちま起稿",
      url: "https://example.com/hatena.xml",
      site_url: "https://example.com/hatena",
      unread_count: 0,
    }),
    folderId: "misc",
    folderName: "Misc",
    latestArticleAt: null,
    status: { tone: "neutral", labelKey: "normal" },
    reasonTooltipKey: "no_articles",
  },
  {
    feed: buildFeed({
      id: "nhk",
      folder_id: "news",
      title: "NHKニュース",
      url: "https://example.com/nhk.xml",
      site_url: "https://example.com/nhk",
      unread_count: 8,
    }),
    folderId: "news",
    folderName: "News",
    latestArticleAt: "2026-05-07T10:00:00Z",
    status: { tone: "neutral", labelKey: "normal" },
    reasonTooltipKey: null,
  },
  {
    feed: buildFeed({
      id: "internet-watch",
      folder_id: "tech",
      title: "INTERNET Watch",
      url: "https://example.com/watch.xml",
      site_url: "https://example.com/watch",
      unread_count: 2,
    }),
    folderId: "tech",
    folderName: "Tech",
    latestArticleAt: "2026-05-06T10:00:00Z",
    status: { tone: "neutral", labelKey: "normal" },
    reasonTooltipKey: null,
  },
] satisfies SubscriptionListRow[];

const readerAlignedGroups = [
  { key: "misc", label: "Misc", folderId: "misc", rows: [readerAlignedRows[0], readerAlignedRows[1]] },
  { key: "news", label: "News", folderId: "news", rows: [readerAlignedRows[2]] },
  { key: "tech", label: "Tech", folderId: "tech", rows: [readerAlignedRows[3]] },
] satisfies SubscriptionListGroup[];

const statusLabels = {
  normal: "No action",
  review: "Review",
  stale_90d: "90 days stale",
  no_unread: "No unread",
  no_stars: "No stars",
} satisfies Record<SubscriptionListRow["status"]["labelKey"], string>;

const reasonTooltipLabels = {
  no_articles: "No fetched articles yet",
  normal: "No action needed",
  review: "Review signal",
  stale_90d: "Latest article is older than 90 days",
  no_unread: "No unread articles",
  no_stars: "No starred articles",
} satisfies Record<NonNullable<SubscriptionListRow["reasonTooltipKey"]>, string>;

function isEveryGroupExpanded(_groupKey?: string) {
  return true;
}

function isOnlyDesignGroupCollapsed(groupKey?: string) {
  return groupKey !== "folder-2";
}

function formatJapaneseStoryLatestArticleLabel(value: string | null) {
  if (!value) {
    return "取得記事なし";
  }

  const date = new Date(value);
  return `最終更新 ${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

const meta = {
  title: "Subscriptions/List/SubscriptionsListPane",
  component: SubscriptionsListPane,
  tags: ["autodocs"],
  args: {
    heading: "All subscriptions",
    groups,
    selectedFeedId: "feed-1",
    emptyLabel: "No subscriptions match this filter.",
    statusLabels,
    reasonTooltipLabels,
    formatUnreadCountLabel: (count: number) => `Unread ${count}`,
    formatLatestArticleLabel: (value: string | null) => (value ? `Updated ${value.slice(0, 10)}` : "No updates"),
    isGroupExpanded: isEveryGroupExpanded,
    onSelectFeed: fn(),
    onListScrollTopChange: fn(),
    onToggleGroup: fn(),
  },
  decorators: [
    (Story) => (
      <div className="min-h-[34rem] w-full max-w-[28rem] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SubscriptionsListPane>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    groups: [],
    selectedFeedId: null,
  },
};

export const Collapsed: Story = {
  args: {
    isGroupExpanded: isOnlyDesignGroupCollapsed,
  },
};

export const ReaderAligned: Story = {
  args: {
    groups: readerAlignedGroups,
    selectedFeedId: "automation",
    heading: "全購読",
    statusLabels: {
      ...statusLabels,
      normal: "対応不要",
    },
    formatUnreadCountLabel: (count: number) => `未読 ${count}件`,
    formatLatestArticleLabel: formatJapaneseStoryLatestArticleLabel,
  },
};
