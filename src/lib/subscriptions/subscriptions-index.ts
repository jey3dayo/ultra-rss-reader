import type { ArticleDto, FeedArticleSummaryDto, FeedDto } from "@/api/tauri-commands";
import { resolveFeedDisplayPreset, resolveFeedDisplayPresetLabel } from "@/lib/articles/article-display";
import { compareDateInputsAsc, formatMediumDateOrDash, getDateInputTimeMs } from "@/lib/datetime";
import { normalizeSubscriptionCount } from "@/lib/subscriptions/subscription-count";
import type { SubscriptionReviewCandidate } from "@/lib/subscriptions/subscription-review-candidates";
import {
  buildSubscriptionReviewReasonFacts,
  hasSubscriptionReviewReason,
  summarizeSubscriptionReviewCandidate,
} from "@/lib/subscriptions/subscription-review-candidates";
import type {
  SubscriptionDetailCandidate,
  SubscriptionDetailMetrics,
  SubscriptionListGroup,
  SubscriptionListRow,
  SubscriptionRowStatus,
  SubscriptionSummaryCard,
  SubscriptionSummaryFilterKey,
} from "@/lib/subscriptions/subscriptions-index.types";

export { countStarredArticles } from "@/lib/articles/article-list";
export type { SubscriptionRowStatus } from "@/lib/subscriptions/subscriptions-index.types";

export type SubscriptionSortKey = "title" | "updated_at" | "unread_count";

export type SubscriptionDecisionActions = {
  keepLabel: string;
  deferLabel: string;
  deleteLabel: string;
  onKeep: () => void;
  onDefer: () => void;
  onDelete: () => void;
};

export function isSubscriptionRowFlagged(status: SubscriptionRowStatus): boolean {
  return status.labelKey !== "normal";
}

function countReviewCandidates(candidates: SubscriptionReviewCandidate[]): number {
  let count = 0;
  for (const candidate of candidates) {
    if (summarizeSubscriptionReviewCandidate(candidate).tone !== "low") {
      count += 1;
    }
  }
  return count;
}

function countStaleCandidates(candidates: SubscriptionReviewCandidate[]): number {
  let count = 0;
  for (const candidate of candidates) {
    if (hasSubscriptionReviewReason(candidate, "stale_90d")) {
      count += 1;
    }
  }
  return count;
}

function rowMatchesSubscriptionSummaryFilter(
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
      row.status.labelKey === "review" ||
      row.status.labelKey === "stale_90d" ||
      row.status.labelKey === "quiet_no_unread"
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

function normalizeSubscriptionSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .trim()
    .toLocaleLowerCase();
}

function rowMatchesSubscriptionSearch(row: SubscriptionListRow, normalizedQuery: string): boolean {
  if (normalizedQuery.length === 0) {
    return true;
  }

  return (
    normalizeSubscriptionSearchText(row.feed.title).includes(normalizedQuery) ||
    normalizeSubscriptionSearchText(row.feed.url).includes(normalizedQuery) ||
    normalizeSubscriptionSearchText(row.feed.site_url).includes(normalizedQuery) ||
    normalizeSubscriptionSearchText(row.folderName ?? "").includes(normalizedQuery)
  );
}

function compareSubscriptionRows(
  left: SubscriptionListRow,
  right: SubscriptionListRow,
  sortKey: SubscriptionSortKey,
): number {
  const compareByTitleAndId = () => {
    const titleOrder = left.feed.title.localeCompare(right.feed.title);
    if (titleOrder !== 0) {
      return titleOrder;
    }

    return left.feed.id.localeCompare(right.feed.id);
  };

  if (sortKey === "updated_at") {
    const updatedAtOrder =
      (getDateInputTimeMs(right.latestArticleAt) ?? 0) - (getDateInputTimeMs(left.latestArticleAt) ?? 0);
    return updatedAtOrder === 0 ? compareByTitleAndId() : updatedAtOrder;
  }

  if (sortKey === "unread_count") {
    const unreadCountOrder =
      normalizeSubscriptionCount(right.feed.unread_count) - normalizeSubscriptionCount(left.feed.unread_count);
    return unreadCountOrder === 0 ? compareByTitleAndId() : unreadCountOrder;
  }

  return compareByTitleAndId();
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
  const normalizedQuery = normalizeSubscriptionSearchText(searchQuery);

  const visibleRows = rows.filter(
    (row) =>
      rowMatchesSubscriptionSummaryFilter(row, activeSummaryFilter) &&
      rowMatchesSubscriptionDecisionVisibility({
        row,
        activeSummaryFilter,
        keptFeedIds,
        deferredFeedIds,
      }) &&
      rowMatchesSubscriptionSearch(row, normalizedQuery),
  );
  visibleRows.sort((left, right) => compareSubscriptionRows(left, right, sortKey));
  return visibleRows;
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
  const totalCount = normalizeSubscriptionCount(summary.totalCount);
  const reviewCount = normalizeSubscriptionCount(summary.reviewCount);
  const staleCount = normalizeSubscriptionCount(summary.staleCount);

  return [
    {
      filterKey: "all",
      label: labels.total,
      value: String(totalCount),
      caption: labels.totalCaption(totalCount),
      tone: "neutral",
      isActive: activeSummaryFilter === "all",
    },
    {
      filterKey: "review",
      label: labels.review,
      value: String(reviewCount),
      caption: labels.reviewCaption(reviewCount),
      tone: "review",
      isActive: activeSummaryFilter === "review",
    },
    {
      filterKey: "stale",
      label: labels.stale,
      value: String(staleCount),
      caption: labels.staleCaption(staleCount),
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
    reasonFact: (fact: { key: "stale_days" | "unread_count"; value: number }) => string;
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

export function buildSubscriptionListGroups(
  rows: SubscriptionListRow[],
  noFolderLabel: string,
): SubscriptionListGroup[] {
  const groups = new Map<string, SubscriptionListGroup>();

  for (const row of rows) {
    const key =
      row.folderId === null ? "subscription-list:0-sentinel:no-folder" : getSubscriptionFolderGroupKey(row.folderId);
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

  const sortedGroups = Array.from(groups.values());
  sortedGroups.sort((left, right) => {
    const labelOrder = left.label.localeCompare(right.label);
    if (labelOrder !== 0) {
      return labelOrder;
    }

    if (left.key === right.key) {
      return 0;
    }

    return left.key < right.key ? -1 : 1;
  });
  return sortedGroups;
}

function getSubscriptionFolderGroupKey(folderId: string): string {
  return `subscription-list:1-folder:${folderId}`;
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
    const folderName = feed.folder_id ? (folderNameById.get(feed.folder_id) ?? null) : null;
    const status = resolveSubscriptionRowStatus({
      candidate: candidateMap.get(feed.id),
    });

    return {
      feed,
      folderId: folderName === null ? null : feed.folder_id,
      folderName,
      latestArticleAt,
      status,
      reasonTooltipKey: resolveSubscriptionRowReasonTooltipKey({
        latestArticleAt,
        status,
      }),
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

  if (hasSubscriptionReviewReason(candidate, "quiet_no_unread")) {
    return { tone: "medium", labelKey: "quiet_no_unread" };
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
  let latestArticleAt: string | null = feedArticleSummary?.latest_article_at ?? null;
  let starredCount = feedArticleSummary?.starred_count ?? 0;
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
    previewArticles,
  };
}

function compareSubscriptionPreviewArticles(candidate: ArticleDto, current: ArticleDto): number {
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

function compareSubscriptionPreviewArticleFallback(candidate: ArticleDto, current: ArticleDto): number {
  const titleOrder = candidate.title.localeCompare(current.title);
  if (titleOrder !== 0) {
    return titleOrder;
  }

  return candidate.id.localeCompare(current.id);
}

export function formatSubscriptionDate(value: string | null | undefined, locale?: string): string {
  return formatMediumDateOrDash(value, locale);
}
