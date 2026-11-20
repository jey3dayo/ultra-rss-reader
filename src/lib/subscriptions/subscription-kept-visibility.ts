import { buildVisibleSubscriptionRows } from "@/lib/subscriptions/subscriptions-index";
import type { SubscriptionListRow, SubscriptionSummaryFilterKey } from "@/lib/subscriptions/subscriptions-index.types";

export type SubscriptionKeptBannerMode = "hidden" | "shown" | "summary";

/** Kept feeds the current filter and search would show if kept feeds were not hidden. Independent of the `showKept` toggle. */
export function resolveHiddenKeptFeedIds({
  rows,
  activeSummaryFilter,
  keptFeedIds,
  searchQuery,
}: {
  rows: SubscriptionListRow[];
  activeSummaryFilter: SubscriptionSummaryFilterKey;
  keptFeedIds: ReadonlySet<string>;
  searchQuery: string;
}): ReadonlySet<string> {
  const visibleFeedIds = (showKept: boolean) =>
    buildVisibleSubscriptionRows({
      rows,
      activeSummaryFilter,
      keptFeedIds,
      showKept,
      searchQuery,
      sortKey: "title",
    }).map((row) => row.feed.id);
  const shownByDefault = new Set(visibleFeedIds(false));
  return new Set(visibleFeedIds(true).filter((feedId) => !shownByDefault.has(feedId)));
}

export function resolveExistingKeptFeedIds(
  rows: SubscriptionListRow[],
  keptFeedIds: ReadonlySet<string>,
): ReadonlySet<string> {
  return new Set(rows.map((row) => row.feed.id).filter((feedId) => keptFeedIds.has(feedId)));
}

export function resolveSubscriptionKeptBannerMode({
  activeSummaryFilter,
  showKept,
  hiddenKeptCount,
}: {
  activeSummaryFilter: SubscriptionSummaryFilterKey;
  showKept: boolean;
  hiddenKeptCount: number;
}): SubscriptionKeptBannerMode {
  if (activeSummaryFilter !== "stale" || hiddenKeptCount === 0) {
    return "summary";
  }
  return showKept ? "shown" : "hidden";
}
