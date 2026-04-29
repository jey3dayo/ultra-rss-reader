import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import type {
  SubscriptionListGroup,
  SubscriptionListRow,
} from "@/components/subscriptions-index/subscriptions-index.types";
import { compareDateInputsAsc, formatMediumDate } from "@/lib/datetime";
import type { SubscriptionReviewCandidate } from "@/lib/subscription-review-candidates";
import { summarizeSubscriptionReviewCandidate } from "@/lib/subscription-review-candidates";

export type SubscriptionRowStatus =
  | { tone: "neutral"; labelKey: "normal" }
  | { tone: "medium"; labelKey: "review" | "stale_90d" | "no_unread" | "no_stars" };

export function isSubscriptionRowFlagged(status: SubscriptionRowStatus): boolean {
  return status.labelKey !== "normal";
}

export function buildSubscriptionsIndexSummary({
  feeds,
  candidates,
}: {
  feeds: FeedDto[];
  candidates: SubscriptionReviewCandidate[];
}): {
  totalCount: number;
  reviewCount: number;
  staleCount: number;
} {
  return {
    totalCount: feeds.length,
    reviewCount: candidates.filter((candidate) => summarizeSubscriptionReviewCandidate(candidate).tone !== "low")
      .length,
    staleCount: candidates.filter((candidate) => candidate.reasonKeys.includes("stale_90d")).length,
  };
}

export function buildSubscriptionReviewCandidateMap(
  candidates: SubscriptionReviewCandidate[],
): Map<string, SubscriptionReviewCandidate> {
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
  candidate?: SubscriptionReviewCandidate;
}): SubscriptionRowStatus {
  if (!candidate || summarizeSubscriptionReviewCandidate(candidate).tone === "low") {
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
    .sort((left, right) => compareDateInputsAsc(right.published_at, left.published_at))
    .slice(0, 3);

  return {
    latestArticleAt: previewArticles[0]?.published_at ?? null,
    starredCount: feedArticles.filter((article) => article.is_starred).length,
    previewArticles,
  };
}

export function formatSubscriptionDate(value: string | null | undefined, locale?: string): string {
  return formatMediumDate(value, locale) ?? "—";
}
