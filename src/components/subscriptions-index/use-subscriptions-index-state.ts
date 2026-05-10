import { useCallback, useEffect, useMemo, useState } from "react";
import type { SubscriptionSummaryFilterKey } from "@/lib/subscriptions/subscription-summary-filter.types";
import { buildVisibleSubscriptionRows, type SubscriptionSortKey } from "@/lib/subscriptions/subscriptions-index";
import type { SubscriptionListRow } from "@/lib/subscriptions/subscriptions-index.types";
import type {
  SubscriptionsWorkspaceExpandedGroupKey,
  SubscriptionsWorkspaceListScrollState,
} from "@/lib/subscriptions/subscriptions-workspace.types";

const EXPANDED_GROUP_KEY_PREFIX = "group:";

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

function namespaceExpandedGroupKey(groupKey: string): SubscriptionsWorkspaceExpandedGroupKey {
  return `${EXPANDED_GROUP_KEY_PREFIX}${groupKey}`;
}

function isExpandedGroupKey(groupKey: string): groupKey is SubscriptionsWorkspaceExpandedGroupKey {
  return groupKey.startsWith(EXPANDED_GROUP_KEY_PREFIX);
}

function sanitizeExpandedGroups(
  expandedGroups: Record<string, boolean> | undefined,
): Record<SubscriptionsWorkspaceExpandedGroupKey, boolean> {
  if (!expandedGroups) {
    return {};
  }

  const sanitized: Record<SubscriptionsWorkspaceExpandedGroupKey, boolean> = {};
  for (const [groupKey, expanded] of Object.entries(expandedGroups)) {
    if (isExpandedGroupKey(groupKey) && typeof expanded === "boolean") {
      sanitized[groupKey] = expanded;
    }
  }
  return sanitized;
}

function resolveInitialListScrollState(params: {
  initialListScrollState?: SubscriptionsWorkspaceListScrollState;
  listLayoutGeneration: string;
  listLayoutReady: boolean;
  viewportHeight: number;
}): SubscriptionsWorkspaceListScrollState {
  const { initialListScrollState, listLayoutGeneration, listLayoutReady, viewportHeight } = params;
  if (
    !initialListScrollState ||
    (listLayoutReady && initialListScrollState.layoutGeneration !== listLayoutGeneration) ||
    initialListScrollState.viewportHeight !== viewportHeight ||
    initialListScrollState.scrollTop < 0
  ) {
    return {
      scrollTop: 0,
      layoutGeneration: listLayoutGeneration,
      viewportHeight,
    };
  }

  return initialListScrollState;
}

function buildListLayoutGeneration(visibleRows: SubscriptionListRow[]): string {
  return visibleRows.map((row) => row.feed.id).join("\n");
}

type SubscriptionsIndexStateOptions = {
  accountId?: string | null;
  initialSummaryFilter?: SubscriptionSummaryFilterKey;
  initialSelectedFeedId?: string | null;
  initialExpandedGroups?: Record<string, boolean>;
  initialKeptFeedIds?: string[];
  initialDeferredFeedIds?: string[];
  initialListScrollState?: SubscriptionsWorkspaceListScrollState;
  viewportHeight?: number;
};

export function useSubscriptionsIndexState(rows: SubscriptionListRow[], options?: SubscriptionsIndexStateOptions) {
  const viewportHeight = options?.viewportHeight ?? 0;
  const [activeAccountId, setActiveAccountId] = useState(options?.accountId ?? null);
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(options?.initialSelectedFeedId ?? null);
  const [keptFeedIds, setKeptFeedIds] = useState<Set<string>>(() => new Set(options?.initialKeptFeedIds ?? []));
  const [deferredFeedIds, setDeferredFeedIds] = useState<Set<string>>(
    () => new Set(options?.initialDeferredFeedIds ?? []),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SubscriptionSortKey>("title");
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
      sortKey,
    });
  }, [activeSummaryFilter, deferredFeedIds, keptFeedIds, rows, searchQuery, sortKey]);
  const listLayoutGeneration = useMemo(() => buildListLayoutGeneration(visibleRows), [visibleRows]);
  const listLayoutReady = rows.length > 0;
  const [listScrollState, setListScrollState] = useState<SubscriptionsWorkspaceListScrollState>(() =>
    resolveInitialListScrollState({
      initialListScrollState: options?.initialListScrollState,
      listLayoutGeneration,
      listLayoutReady,
      viewportHeight,
    }),
  );

  useEffect(() => {
    const nextAccountId = options?.accountId ?? null;
    if (activeAccountId === nextAccountId) {
      return;
    }

    setActiveAccountId(nextAccountId);
    setSelectedFeedId(null);
    setKeptFeedIds(new Set());
    setDeferredFeedIds(new Set());
    setSearchQuery("");
    setSortKey("title");
    setExpandedGroups({});
    setActiveSummaryFilter("all");
    setListScrollState({
      scrollTop: 0,
      layoutGeneration: listLayoutGeneration,
      viewportHeight,
    });
  }, [activeAccountId, listLayoutGeneration, options?.accountId, viewportHeight]);

  const selectSummaryFilter = useCallback(
    (filterKey: SubscriptionSummaryFilterKey) => {
      setActiveSummaryFilter(filterKey);
      setListScrollState({
        scrollTop: 0,
        layoutGeneration: listLayoutGeneration,
        viewportHeight,
      });
    },
    [listLayoutGeneration, viewportHeight],
  );

  const updateSearchQuery = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setListScrollState({
        scrollTop: 0,
        layoutGeneration: listLayoutGeneration,
        viewportHeight,
      });
    },
    [listLayoutGeneration, viewportHeight],
  );

  const updateSortKey = useCallback(
    (nextSortKey: SubscriptionSortKey) => {
      setSortKey(nextSortKey);
      setListScrollState({
        scrollTop: 0,
        layoutGeneration: listLayoutGeneration,
        viewportHeight,
      });
    },
    [listLayoutGeneration, viewportHeight],
  );

  useEffect(() => {
    setListScrollState((current) => {
      if (!listLayoutReady) {
        return current;
      }
      if (current.layoutGeneration === listLayoutGeneration && current.viewportHeight === viewportHeight) {
        return current;
      }

      return {
        scrollTop: 0,
        layoutGeneration: listLayoutGeneration,
        viewportHeight,
      };
    });
  }, [listLayoutGeneration, listLayoutReady, viewportHeight]);

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
    listScrollState,
    listScrollTop: listScrollState.scrollTop,
    searchQuery,
    selectedFeedId,
    selectedRow,
    sortKey,
    visibleRows,
    isGroupExpanded: (groupKey: string) => expandedGroups[namespaceExpandedGroupKey(groupKey)] ?? true,
    setActiveSummaryFilter: selectSummaryFilter,
    setListScrollTop: (scrollTop: number) =>
      setListScrollState({
        scrollTop: Math.max(0, scrollTop),
        layoutGeneration: listLayoutGeneration,
        viewportHeight,
      }),
    setSearchQuery: updateSearchQuery,
    setSelectedFeedId,
    setSortKey: updateSortKey,
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
      setExpandedGroups((current) => {
        const expandedGroupKey = namespaceExpandedGroupKey(groupKey);
        return {
          ...current,
          [expandedGroupKey]: !(current[expandedGroupKey] ?? true),
        };
      }),
  };
}
