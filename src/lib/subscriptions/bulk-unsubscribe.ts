import { buildVisibleSubscriptionRows } from "@/lib/subscriptions/subscriptions-index";
import type { SubscriptionListRow } from "@/lib/subscriptions/subscriptions-index.types";

export function resolveBulkUnsubscribeTargets({
  rows,
  selectedFeedIds,
  keptFeedIds,
}: {
  rows: SubscriptionListRow[];
  selectedFeedIds: ReadonlySet<string>;
  keptFeedIds: ReadonlySet<string>;
}): Array<{ row: SubscriptionListRow; wasKept: boolean }> {
  const selectedRows = rows.filter((row) => selectedFeedIds.has(row.feed.id));
  // Reuse the list's title sort so the ordering rule lives in one place.
  const orderedRows = buildVisibleSubscriptionRows({
    rows: selectedRows,
    activeSummaryFilter: "all",
    keptFeedIds: new Set(),
    deferredFeedIds: new Set(),
    searchQuery: "",
    sortKey: "title",
  });

  return orderedRows.map((row) => ({ row, wasKept: keptFeedIds.has(row.feed.id) }));
}

export function resolveBulkSelectableFeedIds({
  visibleRows,
  keptFeedIds,
}: {
  visibleRows: SubscriptionListRow[];
  keptFeedIds: ReadonlySet<string>;
}): { feedIds: string[]; skippedKeptCount: number } {
  // Fetch-error rows stay visible in the stale filter even when kept, so kept-ness is checked here, not inferred from the filter.
  const feedIds: string[] = [];
  let skippedKeptCount = 0;
  for (const row of visibleRows) {
    if (keptFeedIds.has(row.feed.id)) {
      skippedKeptCount += 1;
    } else {
      feedIds.push(row.feed.id);
    }
  }
  return { feedIds, skippedKeptCount };
}
