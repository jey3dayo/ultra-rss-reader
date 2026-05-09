import { useCallback, useEffect, useMemo, useState } from "react";
import type { SubscriptionSummaryFilterKey } from "@/lib/subscriptions/subscription-summary-filter.types";
import { buildVisibleSubscriptionRows, type SubscriptionSortKey } from "@/lib/subscriptions/subscriptions-index";
import type { SubscriptionListRow } from "@/lib/subscriptions/subscriptions-index.types";

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

function updateSelectedFeedDecision(params: {
  selectedFeedId: string | null;
  setPrimary: (updater: (current: Set<string>) => Set<string>) => void;
  setSecondary: (updater: (current: Set<string>) => Set<string>) => void;
}) {
  const { selectedFeedId, setPrimary, setSecondary } = params;
  if (!selectedFeedId) {
    return;
  }

  setPrimary((current) => addFeedIdToSet(current, selectedFeedId));
  setSecondary((current) => removeFeedIdFromSet(current, selectedFeedId));
}

type SubscriptionsIndexStateOptions = {
  initialSummaryFilter?: SubscriptionSummaryFilterKey;
  initialSelectedFeedId?: string | null;
  initialExpandedGroups?: Record<string, boolean>;
  initialKeptFeedIds?: string[];
  initialDeferredFeedIds?: string[];
  initialListScrollTop?: number;
};

export function useSubscriptionsIndexState(
  rows: SubscriptionListRow[],
  options?: SubscriptionsIndexStateOptions,
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
  const [listScrollTop, setListScrollTop] = useState(options?.initialListScrollTop ?? 0);

  const selectSummaryFilter = useCallback((filterKey: SubscriptionSummaryFilterKey) => {
    setActiveSummaryFilter(filterKey);
    setListScrollTop(0);
  }, []);

  const updateSearchQuery = useCallback((query: string) => {
    setSearchQuery(query);
    setListScrollTop(0);
  }, []);

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
    listScrollTop,
    searchQuery,
    selectedFeedId,
    selectedRow,
    sortKey,
    visibleRows,
    isGroupExpanded: (groupKey: string) => expandedGroups[groupKey] ?? true,
    setActiveSummaryFilter: selectSummaryFilter,
    setListScrollTop,
    setSearchQuery: updateSearchQuery,
    setSelectedFeedId,
    setSortKey,
    markSelectedFeedDeferred: () => {
      updateSelectedFeedDecision({
        selectedFeedId,
        setPrimary: setDeferredFeedIds,
        setSecondary: setKeptFeedIds,
      });
    },
    markSelectedFeedKept: () => {
      updateSelectedFeedDecision({
        selectedFeedId,
        setPrimary: setKeptFeedIds,
        setSecondary: setDeferredFeedIds,
      });
    },
    toggleGroup: (groupKey: string) =>
      setExpandedGroups((current) => ({
        ...current,
        [groupKey]: !(current[groupKey] ?? true),
      })),
  };
}
