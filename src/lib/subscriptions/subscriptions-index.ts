import type { ArticleDto, FeedArticleSummaryDto, FeedDto } from "@/api/tauri-commands";
import { resolveFeedDisplayPreset, resolveFeedDisplayPresetLabel } from "@/lib/article-display";
import { countStarredArticles } from "@/lib/article-list";
import { findLatestArticleOrNull } from "@/lib/article-view";
import { compareDateInputsAsc, formatMediumDateOrDash, getDateInputTimeMs } from "@/lib/datetime";
import type { SubscriptionReviewCandidate } from "@/lib/subscriptions/subscription-review-candidates";
import {
  buildSubscriptionReviewReasonFacts,
  hasSubscriptionReviewReason,
  summarizeSubscriptionReviewCandidate,
} from "@/lib/subscriptions/subscription-review-candidates";
import type { SubscriptionSummaryFilterKey } from "@/lib/subscriptions/subscription-summary-filter.types";
import type {
  SubscriptionDecisionActions,
  SubscriptionDetailCandidate,
  SubscriptionDetailMetrics,
  SubscriptionListGroup,
  SubscriptionListRow,
  SubscriptionRowStatus,
  SubscriptionSummaryCard,
} from "@/lib/subscriptions/subscriptions-index.types";

export { countStarredArticles } from "@/lib/article-list";
export type { SubscriptionRowStatus } from "@/lib/subscriptions/subscriptions-index.types";

export type SubscriptionSortKey = "title" | "updated_at" | "unread_count";

export function isSubscriptionRowFlagged(status: SubscriptionRowStatus): boolean {
  return status.labelKey !== "normal";
}

export function countReviewCandidates(candidates: SubscriptionReviewCandidate[]): number {
  return candidates.filter((candidate) => summarizeSubscriptionReviewCandidate(candidate).tone !== "low").length;
}

export function countStaleCandidates(candidates: SubscriptionReviewCandidate[]): number {
  return candidates.filter((candidate) => hasSubscriptionReviewReason(candidate, "stale_90d")).length;
}

export function findLatestArticleTimestamp(articles: ArticleDto[]): string | null {
  return findLatestArticleOrNull(articles)?.published_at ?? null;
}

export function rowMatchesSubscriptionSummaryFilter(
  row: SubscriptionListRow,
  filterKey: SubscriptionSummaryFilterKey,
): boolean {
  if (filterKey === "all") {
    return true;
  }

  if (filterKey === "stale") {
    return row.status.labelKey === "stale_90d";
  }

  if (filterKey === "review") {
    return (
      row.status.labelKey === "review" || row.status.labelKey === "stale_90d" || row.status.labelKey === "no_unread"
    );
  }

  return false;
}

function rowMatchesSubscriptionDecisionVisibility(params: {
  row: SubscriptionListRow;
  activeSummaryFilter: SubscriptionSummaryFilterKey;
  keptFeedIds: ReadonlySet<string>;
  deferredFeedIds: ReadonlySet<string>;
}): boolean {
  const { row, activeSummaryFilter, keptFeedIds, deferredFeedIds } = params;

  return activeSummaryFilter === "all" ? true : !keptFeedIds.has(row.feed.id) && !deferredFeedIds.has(row.feed.id);
}

function rowMatchesSubscriptionSearch(row: SubscriptionListRow, normalizedQuery: string): boolean {
  if (normalizedQuery.length === 0) {
    return true;
  }

  return (
    row.feed.title.toLowerCase().includes(normalizedQuery) ||
    (row.folderName ?? "").toLowerCase().includes(normalizedQuery)
  );
}

function compareSubscriptionRows(
  left: SubscriptionListRow,
  right: SubscriptionListRow,
  sortKey: SubscriptionSortKey,
): number {
  if (sortKey === "updated_at") {
    return (getDateInputTimeMs(right.latestArticleAt) ?? 0) - (getDateInputTimeMs(left.latestArticleAt) ?? 0);
  }

  if (sortKey === "unread_count") {
    return right.feed.unread_count - left.feed.unread_count;
  }

  return left.feed.title.localeCompare(right.feed.title);
}

export function buildVisibleSubscriptionRows({
  rows,
  activeSummaryFilter,
  keptFeedIds,
  deferredFeedIds,
  searchQuery,
  sortKey,
}: {
  rows: SubscriptionListRow[];
  activeSummaryFilter: SubscriptionSummaryFilterKey;
  keptFeedIds: ReadonlySet<string>;
  deferredFeedIds: ReadonlySet<string>;
  searchQuery: string;
  sortKey: SubscriptionSortKey;
}): SubscriptionListRow[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return rows
    .filter((row) => rowMatchesSubscriptionSummaryFilter(row, activeSummaryFilter))
    .filter((row) =>
      rowMatchesSubscriptionDecisionVisibility({
        row,
        activeSummaryFilter,
        keptFeedIds,
        deferredFeedIds,
      }),
    )
    .filter((row) => rowMatchesSubscriptionSearch(row, normalizedQuery))
    .sort((left, right) => compareSubscriptionRows(left, right, sortKey));
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
    reviewCount: countReviewCandidates(candidates),
    staleCount: countStaleCandidates(candidates),
  };
}

export function buildSubscriptionSummaryCards(params: {
  summary: {
    totalCount: number;
    reviewCount: number;
    staleCount: number;
  };
  activeSummaryFilter: SubscriptionSummaryFilterKey;
  labels: {
    total: string;
    totalCaption: (count: number) => string;
    review: string;
    reviewCaption: (count: number) => string;
    stale: string;
    staleCaption: (count: number) => string;
  };
}): SubscriptionSummaryCard[] {
  const { summary, activeSummaryFilter, labels } = params;

  return [
    {
      filterKey: "all",
      label: labels.total,
      value: String(summary.totalCount),
      caption: labels.totalCaption(summary.totalCount),
      tone: "neutral",
      isActive: activeSummaryFilter === "all",
    },
    {
      filterKey: "review",
      label: labels.review,
      value: String(summary.reviewCount),
      caption: labels.reviewCaption(summary.reviewCount),
      tone: "review",
      isActive: activeSummaryFilter === "review",
    },
    {
      filterKey: "stale",
      label: labels.stale,
      value: String(summary.staleCount),
      caption: labels.staleCaption(summary.staleCount),
      tone: "stale",
      isActive: activeSummaryFilter === "stale",
    },
  ];
}

export function resolveSubscriptionsInventoryHeading(params: {
  activeSummaryFilter: SubscriptionSummaryFilterKey;
  summaryCards: SubscriptionSummaryCard[];
  defaultHeading: string;
}): string {
  const { activeSummaryFilter, summaryCards, defaultHeading } = params;

  if (activeSummaryFilter === "all") {
    return defaultHeading;
  }

  return summaryCards.find((card) => card.filterKey === activeSummaryFilter)?.label ?? defaultHeading;
}

export function buildSubscriptionDetailCandidate(params: {
  selectedRow: SubscriptionListRow | null;
  selectedCandidate: SubscriptionReviewCandidate | null;
  labels: {
    statusLabel: (labelKey: SubscriptionRowStatus["labelKey"]) => string;
    normalReason: string;
    summaryText: (summaryKey: ReturnType<typeof summarizeSubscriptionReviewCandidate>["summaryKey"]) => string;
    reasonFact: (fact: { key: "stale_days" | "unread_count" | "starred_count"; value: number }) => string;
    reasonLabel: (reasonKey: SubscriptionReviewCandidate["reasonKeys"][number]) => string;
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

  return {
    candidate: selectedCandidate,
    tone: summary.tone,
    statusLabel: labels.statusLabel(selectedRow.status.labelKey),
    summary: summaryText,
    reasonBoxBody:
      reasonFacts.length > 0 ? reasonFacts.map((fact) => labels.reasonFact(fact)).join(" / ") : summaryText,
    reasonLabels: selectedCandidate.reasonKeys.map((reasonKey) => labels.reasonLabel(reasonKey)),
  };
}

export function buildSubscriptionReviewCandidateMap(
  candidates: SubscriptionReviewCandidate[],
): Map<string, SubscriptionReviewCandidate> {
  return new Map(candidates.map((candidate) => [candidate.feedId, candidate]));
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
  if (!selectedRow || !isFlagged) {
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

export function countSubscriptionGroupRows(groups: SubscriptionListGroup[]): number {
  return groups.reduce((count, group) => count + group.rows.length, 0);
}

export function buildSubscriptionListRows({
  feeds,
  candidateMap,
  feedArticleSummaryMap,
  folderNameById,
}: {
  feeds: FeedDto[];
  candidateMap: Map<string, SubscriptionReviewCandidate>;
  feedArticleSummaryMap: Map<string, FeedArticleSummaryDto>;
  folderNameById: Map<string, string>;
}): SubscriptionListRow[] {
  return feeds.map((feed) => {
    const latestArticleAt = feedArticleSummaryMap.get(feed.id)?.latest_article_at ?? null;
    const status = resolveSubscriptionRowStatus({ candidate: candidateMap.get(feed.id) });

    return {
      feed,
      folderId: feed.folder_id,
      folderName: feed.folder_id ? (folderNameById.get(feed.folder_id) ?? null) : null,
      latestArticleAt,
      status,
      reasonTooltipKey: resolveSubscriptionRowReasonTooltipKey({ latestArticleAt, status }),
    };
  });
}

export function resolveSubscriptionRowReasonTooltipKey({
  latestArticleAt,
  status,
}: {
  latestArticleAt: string | null;
  status: SubscriptionRowStatus;
}): SubscriptionListRow["reasonTooltipKey"] {
  if (status.labelKey !== "normal") {
    return status.labelKey;
  }

  return latestArticleAt === null ? "no_articles" : null;
}

export function resolveSubscriptionRowStatus({
  candidate,
}: {
  candidate?: SubscriptionReviewCandidate;
}): SubscriptionRowStatus {
  if (!candidate || summarizeSubscriptionReviewCandidate(candidate).tone === "low") {
    return { tone: "neutral", labelKey: "normal" };
  }

  if (hasSubscriptionReviewReason(candidate, "stale_90d")) {
    return { tone: "medium", labelKey: "stale_90d" };
  }

  if (hasSubscriptionReviewReason(candidate, "no_unread")) {
    return { tone: "medium", labelKey: "no_unread" };
  }

  if (hasSubscriptionReviewReason(candidate, "no_stars")) {
    return { tone: "medium", labelKey: "no_stars" };
  }

  return { tone: "medium", labelKey: "review" };
}

export function buildSubscriptionDetailMetrics({
  feed,
  articles,
  feedArticleSummary,
}: {
  feed: FeedDto;
  articles: ArticleDto[];
  feedArticleSummary: FeedArticleSummaryDto | null;
}): {
  latestArticleAt: string | null;
  starredCount: number;
  previewArticles: ArticleDto[];
} {
  const feedArticles = articles.filter((article) => article.feed_id === feed.id);
  const previewArticles = [...feedArticles]
    .sort((left, right) => compareDateInputsAsc(right.published_at, left.published_at))
    .slice(0, 2);

  return {
    latestArticleAt: feedArticleSummary?.latest_article_at ?? findLatestArticleTimestamp(feedArticles),
    starredCount: feedArticleSummary?.starred_count ?? countStarredArticles(feedArticles),
    previewArticles,
  };
}

export function formatSubscriptionDate(value: string | null | undefined, locale?: string): string {
  return formatMediumDateOrDash(value, locale);
}
