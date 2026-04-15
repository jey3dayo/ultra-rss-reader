import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import type { FeedCleanupCandidate, FeedCleanupTone } from "@/lib/feed-cleanup";
import type { SubscriptionRowStatus } from "@/lib/subscriptions-index";

export type SubscriptionSummaryCard = {
  label: string;
  value: string;
  caption?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: "neutral" | "review" | "stale" | "danger";
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
