import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addFeedIdToSet,
  buildListLayoutGeneration,
  findSelectedSubscriptionRow,
  removeFeedIdFromSet,
  removeFeedIdsFromSet,
  resolveGroupExpansion,
  resolveInitialListScrollState,
  resolveSelectionAfterRowsChange,
  sanitizeExpandedGroups,
  toggleExpandedGroup,
  type VisibleRowsSnapshot,
} from "@/components/subscriptions-index/lib/subscriptions-index-state-model";
import { resolveBulkSelectableFeedIds, resolveBulkUnsubscribeTargets } from "@/lib/subscriptions/bulk-unsubscribe";
import { buildSubscriptionListGroups, buildVisibleSubscriptionRows } from "@/lib/subscriptions/subscriptions-index";
import type { SubscriptionListRow, SubscriptionSummaryFilterKey } from "@/lib/subscriptions/subscriptions-index.types";
import type {
  SubscriptionsWorkspaceExpandedGroupKey,
  SubscriptionsWorkspaceListScrollState,
} from "@/schemas/subscriptions-workspace";

function clearCheckedFeedIds(current: Set<string>): Set<string> {
  return current.size === 0 ? current : new Set();
}

type SubscriptionsIndexStateOptions = {
  initialSummaryFilter?: SubscriptionSummaryFilterKey;
  initialSelectedFeedId?: string | null;
  initialExpandedGroups?: Record<string, boolean>;
  initialKeptFeedIds?: string[];
  initialSearchQuery?: string;
  noFolderLabel?: string;
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
      searchQuery,
      sortKey: "title",
    });
  }, [activeSummaryFilter, keptFeedIds, rows, searchQuery]);
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
      setStoredCheckedFeedIds(clearCheckedFeedIds);
      resetListScrollState();
    },
    [resetListScrollState],
  );

  const navigateToSummaryFilter = useCallback(
    (filterKey: SubscriptionSummaryFilterKey) => {
      setActiveSummaryFilter(filterKey);
      setStoredCheckedFeedIds(clearCheckedFeedIds);
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
  const displayedFeedIds = useMemo(
    () =>
      buildSubscriptionListGroups(visibleRows, options?.noFolderLabel ?? "").flatMap((group) =>
        group.rows.map((row) => row.feed.id),
      ),
    [visibleRows, options?.noFolderLabel],
  );
  const viewKey = `${activeSummaryFilter}\n${searchQuery}`;
  const previousVisibleRowsRef = useRef<VisibleRowsSnapshot | null>(null);

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
      setSelectedFeedId(
        resolveSelectionAfterRowsChange({
          previous: previousVisibleRowsRef.current,
          visibleFeedIds: displayedFeedIds,
          viewKey,
          selectedFeedId,
        }),
      );
    }
  }, [selectedFeedId, selectedRow, visibleRows, displayedFeedIds, viewKey, options?.selectionReady]);

  useEffect(() => {
    previousVisibleRowsRef.current = { feedIds: displayedFeedIds, viewKey };
  }, [displayedFeedIds, viewKey]);

  return {
    activeSummaryFilter,
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
    markSelectedFeedKept: () => {
      if (!selectedFeedId) {
        return;
      }
      setKeptFeedIds((current) => addFeedIdToSet(current, selectedFeedId));
      uncheckSelectedFeed();
    },
    unkeepFeed: (feedId: string) => setKeptFeedIds((current) => removeFeedIdFromSet(current, feedId)),
    purgeUnsubscribedFeed: (feedId: string) => {
      setKeptFeedIds((current) => removeFeedIdFromSet(current, feedId));
      setStoredCheckedFeedIds((current) => removeFeedIdFromSet(current, feedId));
    },
    startBulkSelection: () => setBulkSelectionMode(true),
    endBulkSelection: () => {
      setStoredCheckedFeedIds(clearCheckedFeedIds);
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
    // Decides from the checked set of this render, so callers must not change the selection while the run is in flight.
    applyBulkUnsubscribeResult: (succeededFeedIds: readonly string[]) => {
      const succeeded = new Set(succeededFeedIds);
      const remainingCount = [...checkedFeedIds].filter((feedId) => !succeeded.has(feedId)).length;
      const withoutSucceeded = (current: ReadonlySet<string>) => removeFeedIdsFromSet(current, succeeded);
      setKeptFeedIds(withoutSucceeded);
      if (remainingCount === 0) {
        setStoredCheckedFeedIds(clearCheckedFeedIds);
        setBulkSelectionMode(false);
      } else {
        setStoredCheckedFeedIds(withoutSucceeded);
      }
    },
    navigateToSummaryFilter,
    toggleGroup: (groupKey: string) => setExpandedGroups((current) => toggleExpandedGroup(current, groupKey)),
  };
}
