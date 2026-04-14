import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import type { SubscriptionRowStatus } from "@/lib/subscriptions-index";

export type SubscriptionSummaryCard = {
  label: string;
  value: string;
  actionLabel?: string;
  onAction?: () => void;
};

export type SubscriptionListRow = {
  feed: FeedDto;
  folderName: string | null;
  latestArticleAt: string | null;
  status: SubscriptionRowStatus;
};

export type SubscriptionDetailMetrics = {
  latestArticleAt: string | null;
  starredCount: number;
  previewArticles: ArticleDto[];
};
