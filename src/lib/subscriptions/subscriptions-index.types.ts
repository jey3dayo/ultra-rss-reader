import type { ArticleDto, FeedDto, LocalFeedSyncStatusDto } from "@/api/tauri-commands";
import type { RemoteFeedFetchFailure } from "@/lib/subscriptions/remote-feed-fetch-failure";
import type { SubscriptionReviewCandidate } from "@/lib/subscriptions/subscription-review-candidates";

export type SubscriptionSummaryFilterKey = "all" | "stale" | "frequent" | "fetch_errors";

export type SubscriptionRowStatus = {
  labelKey: "normal" | "attention_30d" | "stale_90d" | "quiet_no_unread";
};

export type SubscriptionStatusTone = "neutral" | "warning" | "danger";

export type SubscriptionFilterOption = {
  filterKey: SubscriptionSummaryFilterKey;
  label: string;
  count: number | null;
  isActive: boolean;
  tooltip?: string;
};

export type SubscriptionListRow = {
  feed: FeedDto;
  folderId: string | null;
  folderName: string | null;
  latestArticleAt: string | null;
  latestArticleDays: number | null;
  recentArticleCount: number;
  status: SubscriptionRowStatus;
  reasonTooltipKey: "no_articles" | SubscriptionRowStatus["labelKey"] | "fetch_error" | "remote_fetch_error" | null;
  fetchError?: LocalFeedSyncStatusDto;
  remoteFetchFailure?: RemoteFeedFetchFailure;
};

export type SubscriptionListGroup = {
  key: string;
  label: string;
  rows: SubscriptionListRow[];
  folderId: string | null;
};

export type SubscriptionDetailMetrics = {
  latestArticleAt: string | null;
  starredCount: number;
  recentArticleCount: number;
  previewArticles: ArticleDto[];
};

export type SubscriptionDetailCandidate = {
  candidate: SubscriptionReviewCandidate | null;
  tone: SubscriptionStatusTone;
  statusLabel: string;
  reasonBoxBody: string | null;
};
