import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import type { FeedCleanupCandidate, FeedCleanupTone } from "@/lib/feed-cleanup";
import type { SubscriptionRowStatus } from "@/lib/subscriptions-index";

export type SubscriptionSummaryFilterKey = "all" | "review" | "stale" | "broken";

export type SubscriptionSummaryCard = {
  filterKey: SubscriptionSummaryFilterKey;
  label: string;
  value: string;
  caption?: string;
  tone?: "neutral" | "review" | "stale" | "danger";
  isActive?: boolean;
};

export type SubscriptionListRow = {
  feed: FeedDto;
  folderId: string | null;
  folderName: string | null;
  latestArticleAt: string | null;
  status: SubscriptionRowStatus;
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
  previewArticles: ArticleDto[];
};

export type SubscriptionDetailCandidate = {
  candidate: FeedCleanupCandidate | null;
  tone: FeedCleanupTone | "neutral";
  statusLabel: string;
  summary: string | null;
  reasonBoxBody: string | null;
  reasonLabels: string[];
};
