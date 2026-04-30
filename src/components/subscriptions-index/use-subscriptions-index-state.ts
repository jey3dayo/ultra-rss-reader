import { useEffect, useMemo, useState } from "react";
import { buildVisibleSubscriptionRows, type SubscriptionSortKey } from "@/lib/subscriptions-index";
import type { SubscriptionListRow, SubscriptionSummaryFilterKey } from "./subscriptions-index.types";

function findSelectedSubscriptionRow(
  rows: SubscriptionListRow[],
  selectedFeedId: string | null,
): SubscriptionListRow | null {
  return rows.find((row) => row.feed.id === selectedFeedId) ?? null;
}

function addFeedIdToSet(current: ReadonlySet<string>, feedId: string): Set<string> {
  return new Set(current).add(feedId);
}

function removeFeedIdFromSet(current: ReadonlySet<string>, feedId: string): Set<string> {
  const next = new Set(current);
  next.delete(feedId);
  return next;
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

  const selectedRow = findSelectedSubscriptionRow(visibleRows, selectedFeedId);

  useEffect(() => {
    if (visibleRows.length === 0) {
      if (selectedFeedId !== null) {
        setSelectedFeedId(null);
      }
      return;
    }

    if (selectedRow === null) {
      setSelectedFeedId(visibleRows[0]?.feed.id ?? null);
    }
  }, [selectedFeedId, selectedRow, visibleRows]);

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
      setDeferredFeedIds((current) => addFeedIdToSet(current, selectedFeedId));
      setKeptFeedIds((current) => removeFeedIdFromSet(current, selectedFeedId));
    },
    markSelectedFeedKept: () => {
      if (!selectedFeedId) {
        return;
      }
      setKeptFeedIds((current) => addFeedIdToSet(current, selectedFeedId));
      setDeferredFeedIds((current) => removeFeedIdFromSet(current, selectedFeedId));
    },
    toggleGroup: (groupKey: string) =>
      setExpandedGroups((current) => ({
        ...current,
        [groupKey]: !(current[groupKey] ?? true),
      })),
  };
}
