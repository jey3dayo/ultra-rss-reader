import type { FeedArticleSummaryDto, FeedDto } from "@/api/tauri-commands";
import { getDateInputTimeMs } from "@/lib/datetime";
import { normalizeSubscriptionCount } from "@/lib/subscriptions/subscription-count";
import type { SubscriptionReviewCandidate } from "@/lib/subscriptions/subscription-review-candidates";
import {
  hasSubscriptionReviewReason,
  isSubscriptionReviewCandidate,
  resolveLatestKnownArticleAt,
} from "@/lib/subscriptions/subscription-review-candidates";
import { isOverloaded } from "@/lib/subscriptions/subscription-update-frequency";
import type {
  SubscriptionListGroup,
  SubscriptionListRow,
  SubscriptionRowStatus,
  SubscriptionSummaryCard,
  SubscriptionSummaryFilterKey,
} from "@/lib/subscriptions/subscriptions-index.types";

export type { SubscriptionDecisionActions } from "./subscription-detail";

export {
  buildFeedArticleSummaryMap,
  buildSubscriptionDecisionActions,
  buildSubscriptionDetailCandidate,
  buildSubscriptionDetailMetrics,
  buildSubscriptionReviewCandidateMap,
  formatSubscriptionDate,
  resolveSelectedSubscriptionCandidate,
  resolveSelectedSubscriptionDetailMetrics,
  resolveSelectedSubscriptionDisplayModeLabel,
} from "./subscription-detail";

type SubscriptionSortKey = "title" | "updated_at" | "unread_count";

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

  if (filterKey === "frequent") {
    return isOverloaded({
      postsLast30Days: row.recentArticleCount,
      unreadCount: row.feed.unread_count,
    });
  }

  if (filterKey === "fetch_errors") {
    return Boolean(row.fetchError);
  }

  return false;
}

function rowMatchesSubscriptionDecisionVisibility(params: {
  row: SubscriptionListRow;
  activeSummaryFilter: SubscriptionSummaryFilterKey;
  keptFeedIds: ReadonlySet<string>;
}): boolean {
  const { row, activeSummaryFilter, keptFeedIds } = params;

  // Only the stale filter hides decided feeds. Other filters keep all their matches visible.
  if (activeSummaryFilter !== "stale") {
    return true;
  }

  if (row.fetchError) {
    return true;
  }

  return !keptFeedIds.has(row.feed.id);
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
  searchQuery,
  sortKey,
}: {
  rows: SubscriptionListRow[];
  activeSummaryFilter: SubscriptionSummaryFilterKey;
  keptFeedIds: ReadonlySet<string>;
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
      }) &&
      rowMatchesSubscriptionSearch(row, normalizedQuery),
  );
  visibleRows.sort((left, right) => compareSubscriptionRows(left, right, sortKey));
  return visibleRows;
}

function countFrequentFeeds(feeds: FeedDto[], feedArticleSummaryMap: Map<string, FeedArticleSummaryDto>): number {
  let count = 0;
  for (const feed of feeds) {
    const recentArticleCount = feedArticleSummaryMap.get(feed.id)?.recent_article_count ?? 0;
    if (isOverloaded({ postsLast30Days: recentArticleCount, unreadCount: feed.unread_count })) {
      count += 1;
    }
  }
  return count;
}

export function buildSubscriptionsIndexSummary({
  feeds,
  candidates,
  feedArticleSummaryMap,
}: {
  feeds: FeedDto[];
  candidates: SubscriptionReviewCandidate[];
  feedArticleSummaryMap: Map<string, FeedArticleSummaryDto>;
}): {
  totalCount: number;
  staleCount: number;
  frequentCount: number;
} {
  return {
    totalCount: feeds.length,
    staleCount: countStaleCandidates(candidates),
    frequentCount: countFrequentFeeds(feeds, feedArticleSummaryMap),
  };
}

export function buildSubscriptionSummaryCards(params: {
  summary: {
    totalCount: number;
    staleCount: number;
    frequentCount: number;
  };
  activeSummaryFilter: SubscriptionSummaryFilterKey;
  labels: {
    total: string;
    totalCaption: (count: number) => string;
    stale: string;
    staleCaption: (count: number) => string;
    frequent: string;
    frequentCaption: (count: number) => string;
  };
}): SubscriptionSummaryCard[] {
  const { summary, activeSummaryFilter, labels } = params;
  const totalCount = normalizeSubscriptionCount(summary.totalCount);
  const staleCount = normalizeSubscriptionCount(summary.staleCount);
  const frequentCount = normalizeSubscriptionCount(summary.frequentCount);

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
      filterKey: "stale",
      label: labels.stale,
      value: String(staleCount),
      caption: labels.staleCaption(staleCount),
      tone: "stale",
      isActive: activeSummaryFilter === "stale",
    },
    {
      filterKey: "frequent",
      label: labels.frequent,
      value: String(frequentCount),
      caption: labels.frequentCaption(frequentCount),
      tone: "neutral",
      isActive: activeSummaryFilter === "frequent",
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
    if ((left.folderId === null) !== (right.folderId === null)) {
      return left.folderId === null ? 1 : -1;
    }

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
    const feedArticleSummary = feedArticleSummaryMap.get(feed.id);
    const latestArticleAt = resolveLatestKnownArticleAt(feedArticleSummary);
    const recentArticleCount = feedArticleSummary?.recent_article_count ?? 0;
    const folderName = feed.folder_id ? (folderNameById.get(feed.folder_id) ?? null) : null;
    const status = resolveSubscriptionRowStatus({
      candidate: candidateMap.get(feed.id),
    });

    return {
      feed,
      folderId: folderName === null ? null : feed.folder_id,
      folderName,
      latestArticleAt,
      recentArticleCount,
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
  if (!candidate) {
    return { labelKey: "normal" };
  }

  if (hasSubscriptionReviewReason(candidate, "attention_30d")) {
    return { labelKey: "attention_30d" };
  }

  if (!isSubscriptionReviewCandidate(candidate)) {
    return { labelKey: "normal" };
  }

  return { labelKey: hasSubscriptionReviewReason(candidate, "stale_90d") ? "stale_90d" : "quiet_no_unread" };
}
