import { useEffect, useMemo, useState } from "react";
import type { SubscriptionListRow, SubscriptionSummaryFilterKey } from "./subscriptions-index.types";

function rowMatchesSummaryFilter(row: SubscriptionListRow, filterKey: SubscriptionSummaryFilterKey) {
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

export function useSubscriptionsIndexState(
  rows: SubscriptionListRow[],
  options?: {
    initialSummaryFilter?: SubscriptionSummaryFilterKey;
    initialSelectedFeedId?: string | null;
    initialExpandedGroups?: Record<string, boolean>;
    initialKeptFeedIds?: string[];
    initialDeferredFeedIds?: string[];
  },
) {
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(options?.initialSelectedFeedId ?? null);
  const [keptFeedIds, setKeptFeedIds] = useState<Set<string>>(() => new Set(options?.initialKeptFeedIds ?? []));
  const [deferredFeedIds, setDeferredFeedIds] = useState<Set<string>>(
    () => new Set(options?.initialDeferredFeedIds ?? []),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<"title" | "updated_at" | "unread_count">("title");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(options?.initialExpandedGroups ?? {});
  const [activeSummaryFilter, setActiveSummaryFilter] = useState<SubscriptionSummaryFilterKey>(
    options?.initialSummaryFilter ?? "all",
  );

  const visibleRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return rows
      .filter((row) => rowMatchesSummaryFilter(row, activeSummaryFilter))
      .filter((row) =>
        activeSummaryFilter === "all" ? true : !keptFeedIds.has(row.feed.id) && !deferredFeedIds.has(row.feed.id),
      )
      .filter((row) => {
        if (normalizedQuery.length === 0) {
          return true;
        }

        return (
          row.feed.title.toLowerCase().includes(normalizedQuery) ||
          (row.folderName ?? "").toLowerCase().includes(normalizedQuery)
        );
      })
      .sort((left, right) => {
        if (sortKey === "updated_at") {
          return (Date.parse(right.latestArticleAt ?? "") || 0) - (Date.parse(left.latestArticleAt ?? "") || 0);
        }

        if (sortKey === "unread_count") {
          return right.feed.unread_count - left.feed.unread_count;
        }

        return left.feed.title.localeCompare(right.feed.title);
      });
  }, [activeSummaryFilter, deferredFeedIds, keptFeedIds, rows, searchQuery, sortKey]);

  useEffect(() => {
    if (visibleRows.length === 0) {
      if (selectedFeedId !== null) {
        setSelectedFeedId(null);
      }
      return;
    }

    if (selectedFeedId === null || !visibleRows.some((row) => row.feed.id === selectedFeedId)) {
      setSelectedFeedId(visibleRows[0]?.feed.id ?? null);
    }
  }, [selectedFeedId, visibleRows]);

  const selectedRow = visibleRows.find((row) => row.feed.id === selectedFeedId) ?? null;

  return {
    activeSummaryFilter,
    deferredFeedIds,
    expandedGroups,
    keptFeedIds,
    searchQuery,
    selectedFeedId,
    selectedRow,
    sortKey,
    visibleRows,
    isGroupExpanded: (groupKey: string) => expandedGroups[groupKey] ?? true,
    setActiveSummaryFilter,
    setSearchQuery,
    setSelectedFeedId,
    setSortKey,
    markSelectedFeedDeferred: () => {
      if (!selectedFeedId) {
        return;
      }
      setDeferredFeedIds((current) => new Set(current).add(selectedFeedId));
      setKeptFeedIds((current) => {
        const next = new Set(current);
        next.delete(selectedFeedId);
        return next;
      });
    },
    markSelectedFeedKept: () => {
      if (!selectedFeedId) {
        return;
      }
      setKeptFeedIds((current) => new Set(current).add(selectedFeedId));
      setDeferredFeedIds((current) => {
        const next = new Set(current);
        next.delete(selectedFeedId);
        return next;
      });
    },
    toggleGroup: (groupKey: string) =>
      setExpandedGroups((current) => ({
        ...current,
        [groupKey]: !(current[groupKey] ?? true),
      })),
  };
}
