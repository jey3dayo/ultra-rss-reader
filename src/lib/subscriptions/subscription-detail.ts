import type { ArticleDto, FeedArticleSummaryDto, FeedDto } from "@/api/tauri-commands";
import { resolveFeedDisplayPreset, resolveFeedDisplayPresetLabel } from "@/lib/articles/article-display";
import { compareDateInputsAsc, formatMediumDateOrDash, getDateInputTimeMs } from "@/lib/datetime";
import type { SubscriptionReviewCandidate } from "@/lib/subscriptions/subscription-review-candidates";
import {
  buildSubscriptionReviewReasonFacts,
  summarizeSubscriptionReviewCandidate,
} from "@/lib/subscriptions/subscription-review-candidates";
import type {
  SubscriptionDetailCandidate,
  SubscriptionDetailMetrics,
  SubscriptionListRow,
  SubscriptionRowStatus,
} from "@/lib/subscriptions/subscriptions-index.types";

export function isSubscriptionRowFlagged(status: SubscriptionRowStatus): boolean {
  return status.labelKey !== "normal" && status.labelKey !== "attention_30d";
}

export type SubscriptionDecisionActions = {
  keepLabel: string;
  deferLabel: string;
  deleteLabel: string;
  onKeep: () => void;
  onDefer: () => void;
  onDelete: () => void;
};

export function buildSubscriptionDetailCandidate(params: {
  selectedRow: SubscriptionListRow | null;
  selectedCandidate: SubscriptionReviewCandidate | null;
  labels: {
    statusLabel: (labelKey: SubscriptionRowStatus["labelKey"]) => string;
    normalReason: string;
    summaryText: (summaryKey: ReturnType<typeof summarizeSubscriptionReviewCandidate>["summaryKey"]) => string;
    reasonFact: (fact: { key: "stale_days" | "unread_count"; value: number }) => string;
    reasonLabel: (reasonKey: SubscriptionReviewCandidate["reasonKeys"][number], staleDays: number | null) => string;
  };
}): SubscriptionDetailCandidate | null {
  const { selectedRow, selectedCandidate, labels } = params;
  if (!selectedRow) {
    return null;
  }

  if (!selectedCandidate) {
    return {
      candidate: null,
      tone: "neutral",
      statusLabel: labels.statusLabel("normal"),
      summary: labels.normalReason,
      reasonBoxBody: labels.normalReason,
      reasonLabels: [],
    };
  }

  const summary = summarizeSubscriptionReviewCandidate(selectedCandidate);
  const reasonFacts = buildSubscriptionReviewReasonFacts(selectedCandidate);
  const summaryText = labels.summaryText(summary.summaryKey);
  const reasonLabels = selectedCandidate.reasonKeys.map((reasonKey) =>
    labels.reasonLabel(reasonKey, selectedCandidate.staleDays),
  );
  const primaryReasonLabel = reasonLabels[0] ?? null;

  return {
    candidate: selectedCandidate,
    tone: summary.tone,
    statusLabel: labels.statusLabel(selectedRow.status.labelKey),
    summary: summaryText,
    reasonBoxBody:
      reasonFacts.length > 0
        ? [primaryReasonLabel, ...reasonFacts.map((fact) => labels.reasonFact(fact))]
            .filter((value): value is string => value !== null)
            .join(" / ")
        : summaryText,
    reasonLabels,
  };
}

export function buildSubscriptionReviewCandidateMap(
  candidates: SubscriptionReviewCandidate[],
): Map<string, SubscriptionReviewCandidate> {
  const candidateMap = new Map<string, SubscriptionReviewCandidate>();
  for (const candidate of candidates) {
    candidateMap.set(candidate.feedId, candidate);
  }
  return candidateMap;
}

export function buildFeedArticleSummaryMap(summaries: FeedArticleSummaryDto[]): Map<string, FeedArticleSummaryDto> {
  return new Map(summaries.map((summary) => [summary.feed_id, summary]));
}

export function resolveSelectedSubscriptionCandidate(params: {
  selectedRow: SubscriptionListRow | null;
  candidateMap: Map<string, SubscriptionReviewCandidate>;
}): SubscriptionReviewCandidate | null {
  const { selectedRow, candidateMap } = params;
  return selectedRow ? (candidateMap.get(selectedRow.feed.id) ?? null) : null;
}

export function resolveSelectedSubscriptionDetailMetrics(params: {
  selectedRow: SubscriptionListRow | null;
  articles: ArticleDto[];
  feedArticleSummaryMap: Map<string, FeedArticleSummaryDto>;
}): SubscriptionDetailMetrics | null {
  const { selectedRow, articles, feedArticleSummaryMap } = params;
  return selectedRow
    ? buildSubscriptionDetailMetrics({
        feed: selectedRow.feed,
        articles,
        feedArticleSummary: feedArticleSummaryMap.get(selectedRow.feed.id) ?? null,
      })
    : null;
}

export function resolveSelectedSubscriptionDisplayModeLabel(params: {
  selectedRow: SubscriptionListRow | null;
  labels: {
    default: string;
    standard: string;
    preview: string;
  };
}): string {
  const { selectedRow, labels } = params;
  if (!selectedRow) {
    return labels.default;
  }

  return resolveFeedDisplayPresetLabel({
    preset: resolveFeedDisplayPreset(selectedRow.feed),
    labels,
  });
}

export function buildSubscriptionDecisionActions(params: {
  selectedRow: SubscriptionListRow | null;
  isFlagged: boolean;
  labels: {
    keep: string;
    defer: string;
    delete: string;
  };
  onKeep: (selectedRow: SubscriptionListRow) => void;
  onDefer: (selectedRow: SubscriptionListRow) => void;
  onDelete: () => void;
}): SubscriptionDecisionActions | null {
  const { selectedRow, isFlagged, labels, onKeep, onDefer, onDelete } = params;
  if (!selectedRow || !isFlagged || !isSubscriptionRowFlagged(selectedRow.status)) {
    return null;
  }

  return {
    keepLabel: labels.keep,
    deferLabel: labels.defer,
    deleteLabel: labels.delete,
    onKeep: () => onKeep(selectedRow),
    onDefer: () => onDefer(selectedRow),
    onDelete,
  };
}
export function buildSubscriptionDetailMetrics({
  feed,
  articles,
  feedArticleSummary,
}: {
  feed: FeedDto;
  articles: ArticleDto[];
  feedArticleSummary: FeedArticleSummaryDto | null;
}): SubscriptionDetailMetrics {
  let latestArticleAt: string | null = feedArticleSummary?.latest_article_at ?? null;
  let starredCount = feedArticleSummary?.starred_count ?? 0;
  // recentArticleCount is only sourced from the summary DTO (the backend computes
  // the 30-day window). Unlike latestArticleAt/starredCount, it is not recomputed
  // from `articles` in the null-summary fallback because that array is a short
  // preview, not the full window. In production every feed has a summary row
  // (list_feed_article_summaries LEFT JOINs feeds), so this stays 0 only in
  // synthetic callers that omit the summary.
  const recentArticleCount = feedArticleSummary?.recent_article_count ?? 0;
  const previewArticles: ArticleDto[] = [];

  for (const article of articles) {
    if (article.feed_id !== feed.id) {
      continue;
    }

    if (!feedArticleSummary) {
      if (latestArticleAt === null || compareDateInputsAsc(article.published_at, latestArticleAt) > 0) {
        latestArticleAt = article.published_at;
      }
      if (article.is_starred) {
        starredCount += 1;
      }
    }

    previewArticles.push(article);
    previewArticles.sort(compareSubscriptionPreviewArticles);
    if (previewArticles.length > 2) {
      previewArticles.pop();
    }
  }

  return {
    latestArticleAt,
    starredCount,
    recentArticleCount,
    previewArticles,
  };
}

export function compareSubscriptionPreviewArticles(candidate: ArticleDto, current: ArticleDto): number {
  const candidateTime = getDateInputTimeMs(candidate.published_at);
  const currentTime = getDateInputTimeMs(current.published_at);

  if (candidateTime === null) {
    return currentTime === null ? compareSubscriptionPreviewArticleFallback(candidate, current) : 1;
  }

  if (currentTime === null) {
    return -1;
  }

  if (candidateTime === currentTime) {
    return compareSubscriptionPreviewArticleFallback(candidate, current);
  }

  return candidateTime > currentTime ? -1 : 1;
}

export function compareSubscriptionPreviewArticleFallback(candidate: ArticleDto, current: ArticleDto): number {
  const titleOrder = candidate.title.localeCompare(current.title);
  if (titleOrder !== 0) {
    return titleOrder;
  }

  return candidate.id.localeCompare(current.id);
}

export function formatSubscriptionDate(value: string | null | undefined, locale?: string): string {
  return formatMediumDateOrDash(value, locale);
}
