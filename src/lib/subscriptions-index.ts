import type { ArticleDto, FeedDto, FeedIntegrityReportDto } from "@/api/tauri-commands";
import type {
  SubscriptionListGroup,
  SubscriptionListRow,
} from "@/components/subscriptions-index/subscriptions-index.types";
import type { FeedCleanupCandidate } from "@/lib/feed-cleanup";
import { summarizeCleanupCandidate } from "@/lib/feed-cleanup";

export type SubscriptionRowStatus =
  | { tone: "neutral"; labelKey: "normal" }
  | { tone: "medium"; labelKey: "review" | "stale_90d" | "no_unread" | "no_stars" };

export function isSubscriptionRowFlagged(status: SubscriptionRowStatus): boolean {
  return status.labelKey !== "normal";
}

export function buildSubscriptionsIndexSummary({
  feeds,
  candidates,
  integrityReport,
}: {
  feeds: FeedDto[];
  candidates: FeedCleanupCandidate[];
  integrityReport?: FeedIntegrityReportDto | null;
}): {
  totalCount: number;
  reviewCount: number;
  staleCount: number;
  brokenReferenceCount: number;
} {
  return {
    totalCount: feeds.length,
    reviewCount: candidates.filter((candidate) => summarizeCleanupCandidate(candidate).tone !== "low").length,
    staleCount: candidates.filter((candidate) => candidate.reasonKeys.includes("stale_90d")).length,
    brokenReferenceCount: integrityReport?.orphaned_article_count ?? 0,
  };
}

export function buildCleanupCandidateMap(candidates: FeedCleanupCandidate[]): Map<string, FeedCleanupCandidate> {
  return new Map(candidates.map((candidate) => [candidate.feedId, candidate]));
}

export function buildSubscriptionListGroups(
  rows: SubscriptionListRow[],
  noFolderLabel: string,
): SubscriptionListGroup[] {
  const groups = new Map<string, SubscriptionListGroup>();

  for (const row of rows) {
    const key = row.folderId ?? "__ungrouped__";
    const label = row.folderName ?? noFolderLabel;
    const existing = groups.get(key);

    if (existing) {
      existing.rows.push(row);
      continue;
    }

    groups.set(key, {
      key,
      label,
      rows: [row],
      folderId: row.folderId,
    });
  }

  return Array.from(groups.values()).sort((left, right) => left.label.localeCompare(right.label));
}

export function resolveSubscriptionRowStatus({
  candidate,
}: {
  candidate?: FeedCleanupCandidate;
  integrityReport?: FeedIntegrityReportDto | null;
}): SubscriptionRowStatus {
  if (!candidate || summarizeCleanupCandidate(candidate).tone === "low") {
    return { tone: "neutral", labelKey: "normal" };
  }

  if (candidate.reasonKeys.includes("stale_90d")) {
    return { tone: "medium", labelKey: "stale_90d" };
  }

  if (candidate.reasonKeys.includes("no_unread")) {
    return { tone: "medium", labelKey: "no_unread" };
  }

  if (candidate.reasonKeys.includes("no_stars")) {
    return { tone: "medium", labelKey: "no_stars" };
  }

  return { tone: "medium", labelKey: "review" };
}

export function buildSubscriptionDetailMetrics({ feed, articles }: { feed: FeedDto; articles: ArticleDto[] }): {
  latestArticleAt: string | null;
  starredCount: number;
  previewArticles: ArticleDto[];
} {
  const feedArticles = articles.filter((article) => article.feed_id === feed.id);
  const previewArticles = [...feedArticles]
    .sort((left, right) => new Date(right.published_at).getTime() - new Date(left.published_at).getTime())
    .slice(0, 3);

  return {
    latestArticleAt: previewArticles[0]?.published_at ?? null,
    starredCount: feedArticles.filter((article) => article.is_starred).length,
    previewArticles,
  };
}
