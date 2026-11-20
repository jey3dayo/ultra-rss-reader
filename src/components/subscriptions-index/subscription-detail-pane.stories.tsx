import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type {
  ArticleDto,
  FeedArticleSummaryDto,
  FeedDto,
  FolderDto,
  LocalFeedSyncStatusDto,
} from "@/api/tauri-commands";
import {
  buildFolderNameByIdMap,
  buildSubscriptionReviewCandidates,
  type SubscriptionReviewSummaryKey,
} from "@/lib/subscriptions/subscription-review-candidates";
import {
  resolveSubscriptionUpdatePace,
  SUBSCRIPTION_UPDATE_FREQUENCY_WINDOW_DAYS,
} from "@/lib/subscriptions/subscription-update-frequency";
import {
  buildFeedArticleSummaryMap,
  buildSubscriptionDetailCandidate,
  buildSubscriptionDetailMetrics,
  buildSubscriptionListRows,
  buildSubscriptionReviewCandidateMap,
} from "@/lib/subscriptions/subscriptions-index";
import type { SubscriptionListRow } from "@/lib/subscriptions/subscriptions-index.types";
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

const folders = [{ id: "folder-1", account_id: "acc-1", name: "Work", sort_order: 0 }] satisfies FolderDto[];

const storyNow = new Date("2024-04-05T00:00:00Z");

const statusLabels = {
  normal: "No review needed",
  attention_30d: "Attention",
  stale_90d: "Long-term inactive",
  quiet_no_unread: "Quiet",
} satisfies Record<SubscriptionListRow["status"]["labelKey"], string>;

const summaryTexts = {
  attention_low_activity: "This RSS feed has had no updates for 30+ days. Keep an eye on it for now.",
  stale_and_inactive: "This RSS feed has been quiet for a long stretch and no unread backlog is keeping it active.",
  quiet_without_unread: "This RSS feed has had no updates for 60+ days and has no unread items.",
  stale_but_supported: "This RSS feed has had no updates for 90+ days and should be checked as long-term inactive.",
  healthy_feed: "This subscription still looks healthy and can stay where it is.",
} satisfies Record<SubscriptionReviewSummaryKey, string>;

function buildStoryDetail({
  unreadCount,
  summary,
}: {
  unreadCount: number;
  summary: Pick<FeedArticleSummaryDto, "latest_article_at" | "starred_count">;
}) {
  const storyFeed = { ...feed, unread_count: unreadCount };
  const feedArticleSummary = {
    feed_id: storyFeed.id,
    last_seen_article_at: null,
    recent_article_count: 0,
    ...summary,
  } satisfies FeedArticleSummaryDto;
  const candidateMap = buildSubscriptionReviewCandidateMap(
    buildSubscriptionReviewCandidates({
      feeds: [storyFeed],
      folders,
      feedArticleSummaries: [feedArticleSummary],
      now: storyNow,
    }),
  );
  const [row] = buildSubscriptionListRows({
    feeds: [storyFeed],
    candidateMap,
    feedArticleSummaryMap: buildFeedArticleSummaryMap([feedArticleSummary]),
    folderNameById: buildFolderNameByIdMap(folders),
  });
  if (!row) {
    throw new Error("Story fixture produced no subscription row");
  }

  return {
    row,
    metrics: buildSubscriptionDetailMetrics({ feed: storyFeed, articles: previewArticles, feedArticleSummary }),
    detailCandidate: buildSubscriptionDetailCandidate({
      selectedRow: row,
      selectedCandidate: candidateMap.get(storyFeed.id) ?? null,
      labels: {
        statusLabel: (labelKey) => statusLabels[labelKey],
        summaryText: (summaryKey) => summaryTexts[summaryKey],
        reasonFact: (fact) => `Unread ${fact.value}`,
        reasonLabel: (reasonKey, staleDays) =>
          reasonKey === "quiet_no_unread"
            ? `No new RSS article for ${staleDays} days with no unread`
            : `No new RSS article for ${staleDays} days`,
      },
    }),
  };
}

const stale = buildStoryDetail({
  unreadCount: 0,
  summary: { latest_article_at: "2024-01-02T10:00:00Z", starred_count: 1 },
});
const attention = buildStoryDetail({
  unreadCount: 0,
  summary: { latest_article_at: "2024-03-02T10:00:00Z", starred_count: 1 },
});
const healthy = buildStoryDetail({
  unreadCount: 3,
  summary: { latest_article_at: "2024-04-02T10:00:00Z", starred_count: 1 },
});

const meta = {
  title: "Subscriptions/Detail/SubscriptionDetailPane",
  component: SubscriptionDetailPane,
  tags: ["autodocs"],
  args: {
    heading: "Details",
    emptyLabel: "Select a subscription to review its details.",
    row: stale.row,
    metrics: stale.metrics,
    detailCandidate: stale.detailCandidate,
    folderLabel: "Folder",
    latestArticleLabel: "Latest article",
    latestArticleEmptyLabel: "No fetched articles",
    updateFrequencyLabel: "Update frequency",
    formatUpdateFrequencyValue: formatStoryUpdateFrequencyValue,
    overloadedBadgeLabel: "Can't keep up",
    unreadCountLabel: "Unread",
    starredCountLabel: "Starred",
    reasonHeading: "Review reason",
    recentArticlesHeading: "Recent articles",
    feedUrlLabel: "Open RSS feed",
    contentUrlLabel: "Content URL",
    displayModeLabel: "Display mode",
    displayModeValue: "Default",
    dateLocale: "en-US",
    decisionActions: {
      kind: "undecided",
      keepLabel: "Exclude from review",
      deleteLabel: "Unsubscribe",
      onKeep: fn(),
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

export const KeptDecision: Story = {
  args: {
    decisionActions: {
      kind: "kept",
      keptChipLabel: "Excluded from review",
      keptEffectLabel: "Left out of the 90+ days without updates list and of multi-select.",
      unkeepLabel: "Remove review exclusion",
      editLabel: "Edit",
      deleteLabel: "Unsubscribe",
      onUnkeep: fn(),
      onEdit: fn(),
      onDelete: fn(),
    },
  },
};

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
    row: attention.row,
    metrics: attention.metrics,
    detailCandidate: attention.detailCandidate,
    decisionActions: null,
    managementActions: {
      editLabel: "Edit",
      deleteLabel: "Unsubscribe",
      onEdit: fn(),
      onDelete: fn(),
    },
  },
};

export const NotReviewCandidate: Story = {
  args: {
    row: healthy.row,
    metrics: healthy.metrics,
    detailCandidate: healthy.detailCandidate,
    decisionActions: null,
    managementActions: {
      editLabel: "Edit",
      deleteLabel: "Unsubscribe",
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
      retryOutcome: (kind) =>
        ({
          succeeded: "再取得しました",
          busy: "同期処理中です。完了後に再取得してください。",
          incomplete: "再取得が完了しませんでした。結果を確認してください。",
          failed: "フィードを再取得できませんでした",
          "refresh-failed": "再取得は行いましたが、画面の表示を最新にできませんでした。",
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

export const FetchErrorRetryFailed: Story = {
  args: {
    ...FetchError.args,
    retryOutcome: "failed",
  },
};

export const FetchErrorUrlBlocked: Story = {
  args: {
    ...FetchError.args,
    fetchError: {
      ...fetchError,
      error_kind: "private_address_blocked",
    },
    onEditFeed: fn(),
  },
};
