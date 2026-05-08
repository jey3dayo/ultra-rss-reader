import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import type {
  SubscriptionReviewCandidate,
  SubscriptionReviewTone,
} from "@/lib/subscriptions/subscription-review-candidates";
import type { SubscriptionSummaryFilterKey } from "@/lib/subscriptions/subscription-summary-filter.types";

export type SubscriptionRowStatus =
  | { tone: "neutral"; labelKey: "normal" }
  | { tone: "medium"; labelKey: "review" | "stale_90d" | "no_unread" | "no_stars" };

export type SubscriptionSummaryCard = {
  filterKey: SubscriptionSummaryFilterKey;
  label: string;
  value: string;
  caption?: string;
  tone?: "neutral" | "review" | "stale";
  isActive?: boolean;
  isActionable?: boolean;
};

export type SubscriptionListRow = {
  feed: FeedDto;
  folderId: string | null;
  folderName: string | null;
  latestArticleAt: string | null;
  status: SubscriptionRowStatus;
  reasonTooltipKey: "no_articles" | SubscriptionRowStatus["labelKey"] | null;
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
  candidate: SubscriptionReviewCandidate | null;
  tone: SubscriptionReviewTone | "neutral";
  statusLabel: string;
  summary: string | null;
  reasonBoxBody: string | null;
  reasonLabels: string[];
};

export type SubscriptionDecisionActions = {
  keepLabel: string;
  deferLabel: string;
  deleteLabel: string;
  onKeep: () => void;
  onDefer: () => void;
  onDelete: () => void;
};

export type SubscriptionManagementActions = {
  editLabel: string;
  deleteLabel: string;
  onEdit: () => void;
  onDelete: () => void;
};
