import type { FeedArticleSummaryDto, FeedDto } from "@/api/tauri-commands";
import { getDateInputTimeMs } from "@/lib/datetime";
import { normalizeSubscriptionCount } from "@/lib/subscriptions/subscription-count";
import type { SubscriptionReviewCandidate } from "@/lib/subscriptions/subscription-review-candidates";
import {
  hasSubscriptionReviewReason,
  isSubscriptionReviewCandidate,
  resolveLatestKnownArticleAt,
  resolveSubscriptionReviewInactiveDays,
} from "@/lib/subscriptions/subscription-review-candidates";
import { isOverloaded } from "@/lib/subscriptions/subscription-update-frequency";
import type {
  SubscriptionFilterOption,
  SubscriptionListGroup,
  SubscriptionListRow,
  SubscriptionRowStatus,
  SubscriptionSummaryFilterKey,
} from "@/lib/subscriptions/subscriptions-index.types";

export type { SubscriptionActionRail, SubscriptionRailDecision } from "./subscription-detail";

export {
  buildFeedArticleSummaryMap,
  buildSubscriptionActionRail,
  buildSubscriptionDetailCandidate,
  buildSubscriptionDetailMetrics,
  buildSubscriptionReviewCandidateMap,
  formatSubscriptionDate,
  resolveSelectedSubscriptionCandidate,
  resolveSelectedSubscriptionDetailMetrics,
  resolveSelectedSubscriptionDisplayModeLabel,
} from "./subscription-detail";

export type SubscriptionSortKey = "title" | "updated_at" | "unread_count" | "stale_days" | "recent_count";

export function resolveSubscriptionSortKey(filterKey: SubscriptionSummaryFilterKey): SubscriptionSortKey {
  if (filterKey === "stale") {
    return "stale_days";
  }

  if (filterKey === "frequent") {
    return "recent_count";
  }

  return "title";
}

function rowMatchesSubscriptionSummaryFilter(
  row: SubscriptionListRow,
  filterKey: SubscriptionSummaryFilterKey,
): boolean {
  if (filterKey === "all") {
    return true;
  }

  if (filterKey === "stale") {
    return row.status.labelKey === "stale_90d" || row.status.labelKey === "no_articles";
  }

  if (filterKey === "frequent") {
    return isOverloaded({
      postsLast30Days: row.recentArticleCount,
      unreadCount: row.feed.unread_count,
    });
  }

  if (filterKey === "fetch_errors") {
    return Boolean(row.fetchError ?? row.remoteFetchFailure);
  }

  return false;
}

function rowMatchesSubscriptionDecisionVisibility(params: {
  row: SubscriptionListRow;
  activeSummaryFilter: SubscriptionSummaryFilterKey;
  keptFeedIds: ReadonlySet<string>;
  showKept: boolean;
}): boolean {
  const { row, activeSummaryFilter, keptFeedIds, showKept } = params;

  // Only the stale filter hides decided feeds. Other filters keep all their matches visible.
  if (activeSummaryFilter !== "stale" || showKept) {
    return true;
  }

  if (row.fetchError ?? row.remoteFetchFailure) {
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

  if (sortKey === "stale_days") {
    if (left.inactiveDays === null && right.inactiveDays !== null) {
      return 1;
    }

    if (left.inactiveDays !== null && right.inactiveDays === null) {
      return -1;
    }

    if (left.inactiveDays !== null && right.inactiveDays !== null && left.inactiveDays !== right.inactiveDays) {
      return right.inactiveDays - left.inactiveDays;
    }

    const leftTime = getDateInputTimeMs(left.latestArticleAt);
    const rightTime = getDateInputTimeMs(right.latestArticleAt);

    if (leftTime === null && rightTime !== null) {
      return 1;
    }

    if (leftTime !== null && rightTime === null) {
      return -1;
    }

    if (leftTime !== null && rightTime !== null && leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return compareByTitleAndId();
  }

  if (sortKey === "recent_count") {
    const recentCountOrder =
      normalizeSubscriptionCount(right.recentArticleCount) - normalizeSubscriptionCount(left.recentArticleCount);
    if (recentCountOrder !== 0) {
      return recentCountOrder;
    }

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
  showKept,
  searchQuery,
  sortKey,
}: {
  rows: SubscriptionListRow[];
  activeSummaryFilter: SubscriptionSummaryFilterKey;
  keptFeedIds: ReadonlySet<string>;
  showKept: boolean;
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
        showKept,
      }) &&
      rowMatchesSubscriptionSearch(row, normalizedQuery),
  );
  visibleRows.sort((left, right) => compareSubscriptionRows(left, right, sortKey));
  return visibleRows;
}

const SUBSCRIPTION_SUMMARY_FILTER_KEYS = [
  "all",
  "stale",
  "frequent",
  "fetch_errors",
] as const satisfies readonly SubscriptionSummaryFilterKey[];

export function countSubscriptionFilterRows(
  rows: SubscriptionListRow[],
  keptFeedIds: ReadonlySet<string>,
): Record<SubscriptionSummaryFilterKey, number> {
  const counts: Record<SubscriptionSummaryFilterKey, number> = { all: 0, stale: 0, frequent: 0, fetch_errors: 0 };

  for (const row of rows) {
    for (const filterKey of SUBSCRIPTION_SUMMARY_FILTER_KEYS) {
      if (
        rowMatchesSubscriptionSummaryFilter(row, filterKey) &&
        rowMatchesSubscriptionDecisionVisibility({
          row,
          activeSummaryFilter: filterKey,
          keptFeedIds,
          showKept: false,
        })
      ) {
        counts[filterKey] += 1;
      }
    }
  }

  return counts;
}

export function resolveSubscriptionsInventoryHeading(params: {
  activeSummaryFilter: SubscriptionSummaryFilterKey;
  filterOptions: SubscriptionFilterOption[];
  defaultHeading: string;
}): string {
  const { activeSummaryFilter, filterOptions, defaultHeading } = params;

  if (activeSummaryFilter === "all") {
    return defaultHeading;
  }

  return filterOptions.find((option) => option.filterKey === activeSummaryFilter)?.label ?? defaultHeading;
}

export function resolveSubscriptionListGroupKey(folderId: string | null): string {
  return folderId === null ? "subscription-list:0-sentinel:no-folder" : getSubscriptionFolderGroupKey(folderId);
}

export function buildSubscriptionListGroups(
  rows: SubscriptionListRow[],
  noFolderLabel: string,
): SubscriptionListGroup[] {
  const groups = new Map<string, SubscriptionListGroup>();

  for (const row of rows) {
    const key = resolveSubscriptionListGroupKey(row.folderId);
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
    const candidate = candidateMap.get(feed.id);
    const status = resolveSubscriptionRowStatus({ candidate });

    return {
      feed,
      folderId: folderName === null ? null : feed.folder_id,
      folderName,
      latestArticleAt,
      latestArticleDays: candidate?.staleDays ?? null,
      inactiveDays: candidate ? resolveSubscriptionReviewInactiveDays(candidate) : null,
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

  return latestArticleAt === null ? "no_articles_yet" : null;
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

  if (hasSubscriptionReviewReason(candidate, "stale_90d")) {
    return { labelKey: "stale_90d" };
  }

  return { labelKey: hasSubscriptionReviewReason(candidate, "no_articles") ? "no_articles" : "quiet_no_unread" };
}
