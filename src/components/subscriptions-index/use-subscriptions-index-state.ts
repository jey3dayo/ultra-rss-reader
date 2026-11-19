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
      resetListScrollState();
    },
    [resetListScrollState],
  );

  const navigateToSummaryFilter = useCallback(
    (filterKey: SubscriptionSummaryFilterKey) => {
      setActiveSummaryFilter(filterKey);
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
    },
    markSelectedFeedKept: () => {
      updateSelectedFeedDecision({
        selectedFeedId,
        setPrimary: setKeptFeedIds,
        setSecondary: setDeferredFeedIds,
      });
    },
    navigateToSummaryFilter,
    toggleGroup: (groupKey: string) => setExpandedGroups((current) => toggleExpandedGroup(current, groupKey)),
  };
}
