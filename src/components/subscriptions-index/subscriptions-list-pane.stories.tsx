import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { FeedDto } from "@/api/tauri-commands";
import type { SubscriptionListGroup, SubscriptionListRow } from "@/lib/subscriptions/subscriptions-index.types";
import type { SubscriptionsBulkSelection } from "./subscriptions-bulk-selection";
import { SubscriptionsListPane } from "./subscriptions-list-pane";
import type { SubscriptionsActionableStatusLabels } from "./subscriptions-list-row";

function buildFeed(overrides: Partial<FeedDto>): FeedDto {
  return {
    id: "feed-1",
    account_id: "acc-1",
    folder_id: "folder-1",
    remote_id: null,
    title: "Example Feed",
    url: "https://example.com/feed.xml",
    site_url: "https://example.com",
    unread_count: 0,
    reader_mode: "inherit",
    web_preview_mode: "inherit",
    created_at: null,
    ...overrides,
    icon_url: overrides.icon_url ?? null,
  };
}

const rows = [
  {
    feed: buildFeed({ id: "feed-1", title: "Example Feed", unread_count: 0 }),
    folderId: "folder-1",
    folderName: "Work",
    latestArticleAt: "2024-01-01T10:00:00Z",
    latestArticleDays: 820,
    inactiveDays: 820,
    recentArticleCount: 0,
    status: { labelKey: "stale_90d" },
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
    latestArticleDays: 36,
    inactiveDays: 36,
    recentArticleCount: 0,
    status: { labelKey: "normal" },
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
    latestArticleDays: null,
    inactiveDays: null,
    recentArticleCount: 0,
    status: { labelKey: "quiet_no_unread" },
    reasonTooltipKey: "quiet_no_unread",
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
    latestArticleDays: 0,
    inactiveDays: 0,
    recentArticleCount: 0,
    status: { labelKey: "normal" },
    reasonTooltipKey: null,
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
    latestArticleDays: null,
    inactiveDays: null,
    recentArticleCount: 0,
    status: { labelKey: "normal" },
    reasonTooltipKey: "no_articles_yet",
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
    latestArticleDays: 0,
    inactiveDays: 0,
    recentArticleCount: 0,
    status: { labelKey: "normal" },
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
    latestArticleDays: 1,
    inactiveDays: 1,
    recentArticleCount: 0,
    status: { labelKey: "normal" },
    reasonTooltipKey: null,
  },
] satisfies SubscriptionListRow[];

const readerAlignedGroups = [
  { key: "misc", label: "Misc", folderId: "misc", rows: [readerAlignedRows[0], readerAlignedRows[1]] },
  { key: "news", label: "News", folderId: "news", rows: [readerAlignedRows[2]] },
  { key: "tech", label: "Tech", folderId: "tech", rows: [readerAlignedRows[3]] },
] satisfies SubscriptionListGroup[];

const statusLabels = {
  attention_30d: "Attention",
  stale_90d: "Long-term inactive",
  quiet_no_unread: "Quiet",
  no_articles: "No articles",
} satisfies SubscriptionsActionableStatusLabels;

const reasonTooltipLabels = {
  no_articles_yet: "No fetched articles yet",
  attention_30d: "Latest article is older than 30 days",
  stale_90d: "Latest article is older than 90 days",
  quiet_no_unread: "Latest article is older than 60 days and the feed has no unread items",
  no_articles: "No article has ever been fetched, and the subscription is more than 90 days old",
} satisfies Partial<Record<NonNullable<SubscriptionListRow["reasonTooltipKey"]>, string>>;

function isEveryGroupExpanded(_groupKey?: string) {
  return true;
}

function isOnlyDesignGroupCollapsed(groupKey?: string) {
  return groupKey !== "folder-2";
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
    searchQuery: "",
    searchLabel: "Search subscriptions",
    searchPlaceholder: "Search subscriptions",
    searchClearLabel: "Clear search",
    statusLabels,
    reasonTooltipLabels,
    formatUnreadCountLabel: (count: number) => `Unread ${count}`,
    latestArticleLabels: {
      srPrefix: "Latest RSS update",
      none: "No articles fetched",
      formatDaysAgo: (days: number) => (days === 0 ? "Today" : `${days} days ago`),
    },
    isGroupExpanded: isEveryGroupExpanded,
    onSelectFeed: fn(),
    onListScrollTopChange: fn(),
    onSearchQueryChange: fn(),
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

export const Loading: Story = {
  args: {
    groups: [],
    selectedFeedId: null,
    loadState: { status: "loading", label: "Loading subscriptions" },
  },
};

export const LoadFailed: Story = {
  args: {
    groups: [],
    selectedFeedId: null,
    loadState: {
      status: "error",
      failure: {
        message: "Could not load the subscription list. Your subscriptions are unchanged.",
        retryLabel: "Retry",
        retrying: false,
        onRetry: fn(),
      },
      hasData: false,
    },
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
    formatUnreadCountLabel: (count: number) => `未読 ${count}件`,
    latestArticleLabels: {
      srPrefix: "RSS上の最終更新",
      none: "取得記事なし",
      formatDaysAgo: (days: number) => (days === 0 ? "今日" : `${days}日前`),
    },
  },
};

const bulkSelection = {
  mode: true,
  checkedFeedIds: new Set(["feed-2"]),
  checkedCount: 1,
  hiddenCheckedCount: 0,
  allVisibleCheckState: "some",
  skippedKeptCount: 1,
  toggleButtonRef: { current: null },
  labels: {
    start: "Select multiple",
    end: "Done selecting",
    selectAllVisible: (count) => `Select all shown (${count})`,
    selectAllVisibleAria: "Select all shown feeds",
    skippedKept: (count) => `${count} feed excluded from review is not included`,
    rowSelectAria: (title) => `Select ${title}`,
    selectedCount: (count) => `${count} selected`,
    selectedCountHidden: (count, hidden) => `${count} selected (${hidden} hidden by search)`,
    unsubscribeAction: "Unsubscribe…",
  },
  onStart: fn(),
  onEnd: fn(),
  onToggleFeed: fn(),
  onToggleAllVisible: fn(),
  onRequestUnsubscribe: fn(),
} satisfies SubscriptionsBulkSelection;

export const BulkSelecting: Story = {
  args: { bulkSelection, kept: { feedIds: new Set(["feed-3"]), chipLabel: "Excluded from review" } },
};
