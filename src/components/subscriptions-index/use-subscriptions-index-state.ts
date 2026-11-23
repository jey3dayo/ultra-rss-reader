import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addFeedIdToSet,
  buildListLayoutGeneration,
  expandExpandedGroup,
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
import { resolveExistingKeptFeedIds, resolveHiddenKeptFeedIds } from "@/lib/subscriptions/subscription-kept-visibility";
import {
  buildSubscriptionListGroups,
  buildVisibleSubscriptionRows,
  resolveSubscriptionListGroupKey,
  resolveSubscriptionSortKey,
} from "@/lib/subscriptions/subscriptions-index";
import type { SubscriptionListRow, SubscriptionSummaryFilterKey } from "@/lib/subscriptions/subscriptions-index.types";
import type {
  SubscriptionsWorkspaceExpandedGroupKey,
  SubscriptionsWorkspaceListScrollState,
} from "@/schemas/subscriptions-workspace";
import { useKeptFeedIds, useSubscriptionReviewStore } from "@/stores/subscription-review-store";

function clearCheckedFeedIds(current: Set<string>): Set<string> {
  return current.size === 0 ? current : new Set();
}

type SubscriptionsIndexStateOptions = {
  accountId?: string | null;
  initialSummaryFilter?: SubscriptionSummaryFilterKey;
  initialSelectedFeedId?: string | null;
  initialExpandedGroups?: Record<string, boolean>;
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
  const accountId = options?.accountId ?? null;
  const keptFeedIds = useKeptFeedIds(accountId);
  const [storedCheckedFeedIds, setStoredCheckedFeedIds] = useState<Set<string>>(() => new Set());
  const [bulkSelectionMode, setBulkSelectionMode] = useState(false);
  const [showKept, setShowKept] = useState(false);
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
      showKept,
      searchQuery,
      sortKey: resolveSubscriptionSortKey(activeSummaryFilter),
    });
  }, [activeSummaryFilter, keptFeedIds, rows, searchQuery, showKept]);
  const hiddenKeptFeedIds = useMemo(
    () => resolveHiddenKeptFeedIds({ rows, activeSummaryFilter, keptFeedIds, searchQuery }),
    [activeSummaryFilter, keptFeedIds, rows, searchQuery],
  );
  const existingKeptFeedIds = useMemo(() => resolveExistingKeptFeedIds(rows, keptFeedIds), [keptFeedIds, rows]);
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

  // A feed deep link lands on a specific row. The request is held until the
  // rows are loaded (selectionReady), then applied once: the row is made
  // visible, its group expanded, and the row selected with a scroll request.
  const [pendingFeedNavigation, setPendingFeedNavigation] = useState<{ feedId: string; sequence: number } | null>(null);
  const [feedScrollRequest, setFeedScrollRequest] = useState<{ feedId: string; sequence: number } | null>(null);
  const feedNavigationSequenceRef = useRef(0);

  const resetListScrollState = useCallback(() => {
    setListScrollState({
      scrollTop: 0,
      layoutGeneration: listLayoutGeneration,
      viewportHeight,
      ...(viewportWidth === undefined ? {} : { viewportWidth }),
    });
    setListScrollResetKey((current) => current + 1);
    // A user-driven scroll reset (search, summary filter) ends any deep-link
    // landing: the scroll request must not replay over the reset's
    // scroll-to-top on later resets.
    setFeedScrollRequest(null);
  }, [listLayoutGeneration, viewportHeight, viewportWidth]);

  const selectSummaryFilter = useCallback(
    (filterKey: SubscriptionSummaryFilterKey) => {
      if (filterKey === activeSummaryFilter) {
        return;
      }
      setActiveSummaryFilter(filterKey);
      setStoredCheckedFeedIds(clearCheckedFeedIds);
      resetListScrollState();
    },
    [activeSummaryFilter, resetListScrollState],
  );

  const navigateToSummaryFilter = useCallback(
    (filterKey: SubscriptionSummaryFilterKey) => {
      setActiveSummaryFilter(filterKey);
      setStoredCheckedFeedIds(clearCheckedFeedIds);
      setSelectedFeedId(null);
      resetListScrollState();
    },
    [resetListScrollState],
  );

  const navigateToFeed = useCallback((feedId: string) => {
    feedNavigationSequenceRef.current += 1;
    setPendingFeedNavigation({ feedId, sequence: feedNavigationSequenceRef.current });
  }, []);

  useEffect(() => {
    if (!pendingFeedNavigation || options?.selectionReady === false) {
      return;
    }
    const targetRow = rows.find((row) => row.feed.id === pendingFeedNavigation.feedId);
    if (!targetRow) {
      // Rows are loaded and the feed is not in this account; drop the request
      // and let the regular selection repair pick the visible selection.
      // react-doctor-disable-next-line react-doctor/no-adjust-state-on-prop-change -- accepted risk (feed deep-link application), .claude/rules/react-doctor-triage.md "Adjust State On Prop Change Findings"
      setPendingFeedNavigation(null);
      return;
    }
    const targetVisible = buildVisibleSubscriptionRows({
      rows,
      activeSummaryFilter,
      keptFeedIds,
      showKept,
      searchQuery,
      sortKey: resolveSubscriptionSortKey(activeSummaryFilter),
    }).some((row) => row.feed.id === targetRow.feed.id);
    if (!targetVisible) {
      // Same recovery as the empty state: clear the search and show all
      // subscriptions so the target row exists in the list.
      // react-doctor-disable-next-line react-doctor/no-adjust-state-on-prop-change -- accepted risk (feed deep-link application), .claude/rules/react-doctor-triage.md "Adjust State On Prop Change Findings"
      setActiveSummaryFilter("all");
      // react-doctor-disable-next-line react-doctor/no-adjust-state-on-prop-change -- accepted risk (feed deep-link application), .claude/rules/react-doctor-triage.md "Adjust State On Prop Change Findings"
      setSearchQuery("");
    }
    setExpandedGroups((current) => expandExpandedGroup(current, resolveSubscriptionListGroupKey(targetRow.folderId)));
    setStoredCheckedFeedIds(clearCheckedFeedIds);
    setSelectedFeedId(targetRow.feed.id);
    setFeedScrollRequest({ feedId: targetRow.feed.id, sequence: pendingFeedNavigation.sequence });
    // react-doctor-disable-next-line react-doctor/no-adjust-state-on-prop-change -- accepted risk (feed deep-link application), .claude/rules/react-doctor-triage.md "Adjust State On Prop Change Findings"
    setPendingFeedNavigation(null);
  }, [pendingFeedNavigation, rows, activeSummaryFilter, keptFeedIds, showKept, searchQuery, options?.selectionReady]);

  const updateSearchQuery = useCallback(
    (query: string) => {
      setSearchQuery(query);
      resetListScrollState();
    },
    [resetListScrollState],
  );

  const forgetKeptFeeds = (feedIds: Iterable<string>) => {
    if (accountId !== null) {
      useSubscriptionReviewStore.getState().forget(accountId, feedIds);
    }
  };

  const uncheckSelectedFeed = () => {
    if (selectedFeedId) {
      setStoredCheckedFeedIds((current) => removeFeedIdFromSet(current, selectedFeedId));
    }
  };

  // The layout reset a feed navigation triggers itself (its filter/search
  // reset changes the layout generation) must keep the scroll request: the
  // list pane re-applies the scroll for that reset instead of stranding the
  // row at the top. That reset fires in the commit the request appears or
  // the one right after, so a request already seen by an earlier commit is
  // settled — any later layout reset retires it rather than replaying it.
  const feedScrollRequestSeenRef = useRef<number | null>(null);

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

    if (feedScrollRequest !== null && feedScrollRequestSeenRef.current === feedScrollRequest.sequence) {
      // react-doctor-disable-next-line react-doctor/no-adjust-state-on-prop-change -- accepted risk (feed deep-link application), .claude/rules/react-doctor-triage.md "Adjust State On Prop Change Findings"
      setFeedScrollRequest(null);
    }
    setListScrollState({
      scrollTop: 0,
      layoutGeneration: listLayoutGeneration,
      viewportHeight,
      ...(viewportWidth === undefined ? {} : { viewportWidth }),
    });
    setListScrollResetKey((currentResetKey) => currentResetKey + 1);
  }, [feedScrollRequest, listLayoutGeneration, listLayoutReady, listScrollState, viewportHeight, viewportWidth]);

  // Declared after the layout effect so it records the request only once
  // that commit's layout reset has had its chance to keep it.
  useEffect(() => {
    feedScrollRequestSeenRef.current = feedScrollRequest?.sequence ?? null;
  }, [feedScrollRequest]);

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
    // While a feed navigation is queued, the navigation effect above owns
    // the selection: it applies in the same pass, and repairing here from
    // this render's stale selectedRow would overwrite its target with the
    // first visible row.
    if (pendingFeedNavigation !== null) return;
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
  }, [
    selectedFeedId,
    selectedRow,
    visibleRows,
    displayedFeedIds,
    viewKey,
    options?.selectionReady,
    pendingFeedNavigation,
  ]);

  useEffect(() => {
    previousVisibleRowsRef.current = { feedIds: displayedFeedIds, viewKey };
  }, [displayedFeedIds, viewKey]);

  return {
    activeSummaryFilter,
    expandedGroups,
    keptFeedIds,
    showKept,
    hiddenKeptCount: hiddenKeptFeedIds.size,
    existingKeptCount: existingKeptFeedIds.size,
    toggleShowKept: () => setShowKept((current) => !current),
    collapseKept: () => setShowKept(false),
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
      if (accountId !== null) {
        useSubscriptionReviewStore.getState().keep(accountId, selectedFeedId);
      }
      uncheckSelectedFeed();
    },
    unkeepFeed: (feedId: string) => {
      if (accountId !== null) {
        useSubscriptionReviewStore.getState().unkeep(accountId, feedId);
      }
    },
    purgeUnsubscribedFeed: (feedId: string) => {
      forgetKeptFeeds([feedId]);
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
    // The run works from the snapshot taken when it started, so the live selection may have
    // changed while it ran. Only the succeeded feeds are removed from whatever is checked
    // now; selection mode ends only when nothing remains checked.
    applyBulkUnsubscribeResult: (succeededFeedIds: readonly string[]) => {
      const succeeded = new Set(succeededFeedIds);
      forgetKeptFeeds(succeededFeedIds);
      const remainingCount = [...checkedFeedIds].filter((feedId) => !succeeded.has(feedId)).length;
      if (remainingCount === 0) {
        setStoredCheckedFeedIds(clearCheckedFeedIds);
        setBulkSelectionMode(false);
      } else {
        setStoredCheckedFeedIds((current) => removeFeedIdsFromSet(current, succeeded));
      }
    },
    navigateToSummaryFilter,
    navigateToFeed,
    feedScrollRequest,
    toggleGroup: (groupKey: string) => setExpandedGroups((current) => toggleExpandedGroup(current, groupKey)),
  };
}
