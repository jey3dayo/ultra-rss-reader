import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addFeedIdToSet,
  buildListLayoutGeneration,
  findSelectedSubscriptionRow,
  removeFeedIdFromSet,
  resolveGroupExpansion,
  resolveInitialListScrollState,
  sanitizeExpandedGroups,
  toggleExpandedGroup,
} from "@/components/subscriptions-index/lib/subscriptions-index-state-model";
import { resolveBulkSelectableFeedIds, resolveBulkUnsubscribeTargets } from "@/lib/subscriptions/bulk-unsubscribe";
import { buildVisibleSubscriptionRows } from "@/lib/subscriptions/subscriptions-index";
import type { SubscriptionListRow, SubscriptionSummaryFilterKey } from "@/lib/subscriptions/subscriptions-index.types";
import type {
  SubscriptionsWorkspaceExpandedGroupKey,
  SubscriptionsWorkspaceListScrollState,
} from "@/schemas/subscriptions-workspace";

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
  initialSearchQuery?: string;
  initialListScrollState?: SubscriptionsWorkspaceListScrollState;
  viewportHeight?: number;
  viewportWidth?: number;
  selectionReady?: boolean;
};

export function useSubscriptionsIndexState(rows: SubscriptionListRow[], options?: SubscriptionsIndexStateOptions) {
  const viewportHeight = options?.viewportHeight ?? 0;
  const viewportWidth = options?.viewportWidth;
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(options?.initialSelectedFeedId ?? null);
  const [keptFeedIds, setKeptFeedIds] = useState<Set<string>>(() => new Set(options?.initialKeptFeedIds ?? []));
  const [deferredFeedIds, setDeferredFeedIds] = useState<Set<string>>(
    () => new Set(options?.initialDeferredFeedIds ?? []),
  );
  const [storedCheckedFeedIds, setStoredCheckedFeedIds] = useState<Set<string>>(() => new Set());
  const [bulkSelectionMode, setBulkSelectionMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState(options?.initialSearchQuery ?? "");
  const [expandedGroups, setExpandedGroups] = useState<Record<SubscriptionsWorkspaceExpandedGroupKey, boolean>>(() =>
    sanitizeExpandedGroups(options?.initialExpandedGroups),
  );
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
      sortKey: "title",
    });
  }, [activeSummaryFilter, deferredFeedIds, keptFeedIds, rows, searchQuery]);
  const checkedFeedIds = useMemo(() => {
    const existingFeedIds = new Set(rows.map((row) => row.feed.id));
    const effective = new Set<string>();
    for (const feedId of storedCheckedFeedIds) {
      if (existingFeedIds.has(feedId)) {
        effective.add(feedId);
      }
    }
    return effective;
  }, [rows, storedCheckedFeedIds]);
  const bulkSelectable = useMemo(
    () => resolveBulkSelectableFeedIds({ visibleRows, keptFeedIds }),
    [keptFeedIds, visibleRows],
  );
  const bulkTargets = useMemo(
    () => resolveBulkUnsubscribeTargets({ rows, selectedFeedIds: checkedFeedIds, keptFeedIds }),
    [checkedFeedIds, keptFeedIds, rows],
  );
  const hiddenCheckedCount = useMemo(() => {
    const visibleFeedIds = new Set(visibleRows.map((row) => row.feed.id));
    let count = 0;
    for (const feedId of checkedFeedIds) {
      if (!visibleFeedIds.has(feedId)) {
        count += 1;
      }
    }
    return count;
  }, [checkedFeedIds, visibleRows]);
  const checkedSelectableCount = bulkSelectable.feedIds.filter((feedId) => checkedFeedIds.has(feedId)).length;
  const allVisibleCheckState: "none" | "some" | "all" =
    checkedSelectableCount === 0 ? "none" : checkedSelectableCount === bulkSelectable.feedIds.length ? "all" : "some";
  const listLayoutGeneration = useMemo(() => buildListLayoutGeneration(visibleRows), [visibleRows]);
  const listLayoutReady = rows.length > 0 && options?.selectionReady !== false;
  const [listScrollState, setListScrollState] = useState<SubscriptionsWorkspaceListScrollState>(() =>
    resolveInitialListScrollState({
      initialListScrollState: options?.initialListScrollState,
      listLayoutGeneration,
      listLayoutReady,
      viewportHeight,
      ...(viewportWidth === undefined ? {} : { viewportWidth }),
    }),
  );
  const [listScrollResetKey, setListScrollResetKey] = useState(0);

  const resetListScrollState = useCallback(() => {
    setListScrollState({
      scrollTop: 0,
      layoutGeneration: listLayoutGeneration,
      viewportHeight,
      ...(viewportWidth === undefined ? {} : { viewportWidth }),
    });
    setListScrollResetKey((current) => current + 1);
  }, [listLayoutGeneration, viewportHeight, viewportWidth]);

  const selectSummaryFilter = useCallback(
    (filterKey: SubscriptionSummaryFilterKey) => {
      setActiveSummaryFilter(filterKey);
      setStoredCheckedFeedIds(new Set());
      resetListScrollState();
    },
    [resetListScrollState],
  );

  const navigateToSummaryFilter = useCallback(
    (filterKey: SubscriptionSummaryFilterKey) => {
      setActiveSummaryFilter(filterKey);
      setStoredCheckedFeedIds(new Set());
      setSearchQuery("");
      setSelectedFeedId(null);
      resetListScrollState();
    },
    [resetListScrollState],
  );

  const updateSearchQuery = useCallback(
    (query: string) => {
      setSearchQuery(query);
      resetListScrollState();
    },
    [resetListScrollState],
  );

  const uncheckSelectedFeed = () => {
    if (selectedFeedId) {
      setStoredCheckedFeedIds((current) => removeFeedIdFromSet(current, selectedFeedId));
    }
  };

  // react-doctor/no-self-updating-effect (accepted-risk): this effect reads
  // listScrollState to keep the reset condition pure and out of the
  // setListScrollState updater (see no-impure-state-updater fix history).
  // The effect re-runs after its own setListScrollState call, but the
  // second run's condition is then true (generation/height match), so it
  // returns without a further update. Stable, does not loop.
  useEffect(() => {
    if (!listLayoutReady) {
      return;
    }
    if (
      listScrollState.layoutGeneration === listLayoutGeneration &&
      listScrollState.viewportHeight === viewportHeight &&
      (listScrollState.viewportWidth === undefined || listScrollState.viewportWidth === viewportWidth)
    ) {
      return;
    }

    setListScrollState({
      scrollTop: 0,
      layoutGeneration: listLayoutGeneration,
      viewportHeight,
      ...(viewportWidth === undefined ? {} : { viewportWidth }),
    });
    setListScrollResetKey((currentResetKey) => currentResetKey + 1);
  }, [listLayoutGeneration, listLayoutReady, listScrollState, viewportHeight, viewportWidth]);

  const selectedRow = findSelectedSubscriptionRow(visibleRows, selectedFeedId);

  useEffect(() => {
    if (options?.selectionReady === false) return;
    if (visibleRows.length === 0) {
      if (selectedFeedId !== null) {
        // react-doctor-disable-next-line react-doctor/no-adjust-state-on-prop-change -- accepted risk (derived-data selection repair), docs/react-doctor-warning-classification-300.md:374
        setSelectedFeedId(null);
      }
      return;
    }

    if (selectedRow === null) {
      setSelectedFeedId(visibleRows[0]?.feed.id ?? null);
    }
  }, [selectedFeedId, selectedRow, visibleRows, options?.selectionReady]);

  return {
    activeSummaryFilter,
    deferredFeedIds,
    expandedGroups,
    keptFeedIds,
    bulkSelectionMode,
    checkedFeedIds,
    checkedCount: checkedFeedIds.size,
    hiddenCheckedCount,
    allVisibleCheckState,
    skippedKeptCount: bulkSelectable.skippedKeptCount,
    bulkTargets,
    listScrollState,
    listScrollResetKey,
    listScrollTop: listScrollState.scrollTop,
    searchQuery,
    selectedFeedId,
    selectedRow,
    visibleRows,
    isGroupExpanded: (groupKey: string) => resolveGroupExpansion(expandedGroups, groupKey),
    setActiveSummaryFilter: selectSummaryFilter,
    setListScrollTop: (scrollTop: number) =>
      setListScrollState({
        scrollTop: Math.max(0, scrollTop),
        layoutGeneration: listLayoutGeneration,
        viewportHeight,
        ...(viewportWidth === undefined ? {} : { viewportWidth }),
      }),
    setSearchQuery: updateSearchQuery,
    setSelectedFeedId,
    markSelectedFeedDeferred: () => {
      updateSelectedFeedDecision({
        selectedFeedId,
        setPrimary: setDeferredFeedIds,
        setSecondary: setKeptFeedIds,
      });
      uncheckSelectedFeed();
    },
    markSelectedFeedKept: () => {
      updateSelectedFeedDecision({
        selectedFeedId,
        setPrimary: setKeptFeedIds,
        setSecondary: setDeferredFeedIds,
      });
      uncheckSelectedFeed();
    },
    startBulkSelection: () => setBulkSelectionMode(true),
    endBulkSelection: () => {
      setStoredCheckedFeedIds(new Set());
      setBulkSelectionMode(false);
    },
    toggleFeedChecked: (feedId: string) =>
      setStoredCheckedFeedIds((current) =>
        current.has(feedId) ? removeFeedIdFromSet(current, feedId) : addFeedIdToSet(current, feedId),
      ),
    toggleAllVisibleChecked: () => {
      const selectableFeedIds = bulkSelectable.feedIds;
      setStoredCheckedFeedIds((current) => {
        const next = new Set(current);
        for (const feedId of selectableFeedIds) {
          if (allVisibleCheckState === "all") {
            next.delete(feedId);
          } else {
            next.add(feedId);
          }
        }
        return next;
      });
    },
    applyBulkUnsubscribeResult: (succeededFeedIds: readonly string[]) => {
      const succeeded = new Set(succeededFeedIds);
      const remainingCount = [...checkedFeedIds].filter((feedId) => !succeeded.has(feedId)).length;
      const withoutSucceeded = (current: ReadonlySet<string>) => {
        const next = new Set(current);
        for (const feedId of succeeded) {
          next.delete(feedId);
        }
        return next;
      };
      setKeptFeedIds(withoutSucceeded);
      setDeferredFeedIds(withoutSucceeded);
      if (remainingCount === 0) {
        setStoredCheckedFeedIds(new Set());
        setBulkSelectionMode(false);
      } else {
        setStoredCheckedFeedIds(withoutSucceeded);
      }
    },
    navigateToSummaryFilter,
    toggleGroup: (groupKey: string) => setExpandedGroups((current) => toggleExpandedGroup(current, groupKey)),
  };
}
