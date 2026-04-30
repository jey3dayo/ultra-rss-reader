import { useEffect, useMemo, useState } from "react";
import { buildVisibleSubscriptionRows, type SubscriptionSortKey } from "@/lib/subscriptions-index";
import type { SubscriptionListRow, SubscriptionSummaryFilterKey } from "./subscriptions-index.types";

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
  const [sortKey, setSortKey] = useState<SubscriptionSortKey>("title");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(options?.initialExpandedGroups ?? {});
  const [activeSummaryFilter, setActiveSummaryFilter] = useState<SubscriptionSummaryFilterKey>(
    options?.initialSummaryFilter ?? "all",
  );

  const visibleRows = useMemo(() => {
    return buildVisibleSubscriptionRows({
      rows,
      activeSummaryFilter,
      keptFeedIds,
      deferredFeedIds,
      searchQuery,
      sortKey,
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
