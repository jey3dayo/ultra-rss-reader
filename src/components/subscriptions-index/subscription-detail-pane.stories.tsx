import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { ArticleDto, FeedDto, LocalFeedSyncStatusDto } from "@/api/tauri-commands";
import {
  resolveSubscriptionUpdatePace,
  SUBSCRIPTION_UPDATE_FREQUENCY_WINDOW_DAYS,
} from "@/lib/subscriptions/subscription-update-frequency";
import type {
  SubscriptionDetailCandidate,
  SubscriptionDetailMetrics,
  SubscriptionListRow,
} from "@/lib/subscriptions/subscriptions-index.types";
import { SubscriptionDetailPane } from "./subscription-detail-pane";

function formatStoryUpdateFrequencyValue(recentArticleCount: number): string {
  const pace = resolveSubscriptionUpdatePace(recentArticleCount);
  if (pace.unit === "none") {
    return `None (in ${SUBSCRIPTION_UPDATE_FREQUENCY_WINDOW_DAYS}d)`;
  }
  return `About ${pace.count} per ${pace.unit} (${recentArticleCount} in ${SUBSCRIPTION_UPDATE_FREQUENCY_WINDOW_DAYS}d)`;
}

const feed = {
  id: "feed-1",
  account_id: "acc-1",
  folder_id: "folder-1",
  remote_id: null,
  title: "Example Feed",
  url: "https://example.com/feed.xml",
  site_url: "https://example.com",
  icon_url: null,
  unread_count: 0,
  reader_mode: "inherit",
  web_preview_mode: "inherit",
} satisfies FeedDto;

const row = {
  feed,
  folderId: "folder-1",
  folderName: "Work",
  latestArticleAt: "2024-01-01T10:00:00Z",
  recentArticleCount: 0,
  status: { tone: "medium", labelKey: "stale_90d" },
  reasonTooltipKey: "stale_90d",
} satisfies SubscriptionListRow;

const fetchError = {
  feed_id: "feed-1",
  last_attempt_at: "2026-10-11T02:15:00Z",
  last_success_at: "2026-10-10T02:15:00Z",
  error_kind: "network",
  error_count: 3,
  diagnostic_id: "b68d9be4-76b3-4fef-9ac5-d1decb40c9b8",
} satisfies LocalFeedSyncStatusDto;

const previewArticles = [
  {
    id: "art-1",
    feed_id: "feed-1",
    title: "Old article",
    content_sanitized: "<p>old</p>",
    summary: null,
    url: "https://example.com/old/1",
    author: null,
    published_at: "2024-01-01T10:00:00Z",
    thumbnail: null,
    is_read: true,
    is_starred: false,
  },
  {
    id: "art-2",
    feed_id: "feed-1",
    title: "Follow-up article",
    content_sanitized: "<p>follow-up</p>",
    summary: null,
    url: "https://example.com/old/2",
    author: null,
    published_at: "2024-01-02T10:00:00Z",
    thumbnail: null,
    is_read: true,
    is_starred: true,
  },
] satisfies ArticleDto[];

const metrics = {
  latestArticleAt: "2024-01-02T10:00:00Z",
  starredCount: 1,
  recentArticleCount: 0,
  previewArticles,
} satisfies SubscriptionDetailMetrics;

const detailCandidate = {
  candidate: null,
  tone: "medium",
  statusLabel: "Needs review",
  summary: null,
  reasonBoxBody: "90+ days without a new article / Updated 94 days ago / Unread 0",
  reasonLabels: ["90+ days without a new article", "60+ days without a new article and no unread"],
} satisfies SubscriptionDetailCandidate;

const meta = {
  title: "Subscriptions/Detail/SubscriptionDetailPane",
  component: SubscriptionDetailPane,
  tags: ["autodocs"],
  args: {
    heading: "Details",
    emptyLabel: "Select a subscription to review its details.",
    row,
    metrics,
    detailCandidate,
    folderLabel: "Folder",
    latestArticleLabel: "Latest article",
    latestArticleEmptyLabel: "No fetched articles",
    updateFrequencyLabel: "Update frequency",
    formatUpdateFrequencyValue: formatStoryUpdateFrequencyValue,
    overloadedBadgeLabel: "Can't keep up",
    unreadCountLabel: "Unread",
    starredCountLabel: "Starred",
    reasonHeading: "Review reason",
    reasonHint: "No review reason available.",
    recentArticlesHeading: "Recent articles",
    feedUrlLabel: "Open RSS feed",
    contentUrlLabel: "Content URL",
    displayModeLabel: "Display mode",
    displayModeValue: "Default",
    dateLocale: "en-US",
    decisionActions: {
      keepLabel: "Keep",
      deferLabel: "Later",
      deleteLabel: "Delete",
      onKeep: fn(),
      onDefer: fn(),
      onDelete: fn(),
    },
    managementActions: null,
  },
  decorators: [
    (Story) => (
      <div className="min-h-[36rem] w-full max-w-[34rem] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SubscriptionDetailPane>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    row: null,
    metrics: null,
    detailCandidate: null,
    decisionActions: null,
    managementActions: null,
  },
};

export const WithoutDecisionActions: Story = {
  args: {
    decisionActions: null,
    managementActions: {
      editLabel: "Edit",
      deleteLabel: "Delete",
      onEdit: fn(),
      onDelete: fn(),
    },
  },
};

export const FetchError: Story = {
  args: {
    fetchError,
    dateLocale: "ja-JP",
    fetchErrorLabels: {
      heading: "取得エラー",
      lastAttempt: "失敗日時",
      copyDiagnosticId: "診断番号をコピー",
      retry: "再取得",
      retrying: "再取得中",
      editFeedUrl: "取得先を確認",
      reason: (kind) =>
        ({
          private_address_blocked: "安全のため、ローカルネットワークへのアクセスをブロックしました。",
          validation: "フィードのURLまたは設定を確認してください。",
          network: "通信に失敗しました。時間をおいて再試行してください。",
          parse: "フィードの形式を読み取れませんでした。",
          persistence: "データの保存に失敗しました。",
          other: "フィードを取得できませんでした。",
        })[kind],
    },
    onRetryFeed: fn(),
    isRetryingFeed: () => false,
    onCopyDiagnosticId: fn(),
  },
};

export const FetchErrorRetrying: Story = {
  args: {
    ...FetchError.args,
    isRetryingFeed: (feedId) => feedId === "feed-1",
  },
};

export const FetchErrorUrlBlocked: Story = {
  args: {
    ...FetchError.args,
    fetchError: {
      ...fetchError,
      error_kind: "private_address_blocked",
    },
  },
};
