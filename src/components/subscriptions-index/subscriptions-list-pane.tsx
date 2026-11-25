import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
} from "react";
import { isImeCommitKeyEvent } from "@/lib/keyboard/ime-key-event";
import { resolveAdjacentSubscriptionFeedId } from "@/lib/subscriptions/subscription-list-navigation";
import { countSubscriptionGroupRows } from "@/lib/subscriptions/subscriptions-index";
import type { SubscriptionListGroup, SubscriptionListRow } from "@/lib/subscriptions/subscriptions-index.types";
import { resolveListPaneDisplay } from "./hooks/subscriptions-index-load-state";
import type { SubscriptionsBulkRunStatus } from "./subscriptions-bulk-run-status";
import {
  SubscriptionsBulkActionBar,
  SubscriptionsBulkSelectAllRow,
  type SubscriptionsBulkSelection,
} from "./subscriptions-bulk-selection";
import type { SubscriptionsFilterBarProps } from "./subscriptions-filter-bar";
import { type SubscriptionsKeptBanner, SubscriptionsKeptBannerView } from "./subscriptions-kept-banner";
import { SubscriptionsListEmptyState } from "./subscriptions-list-empty-state";
import { SubscriptionGroupSection } from "./subscriptions-list-group-section";
import { SubscriptionsListPaneHeader } from "./subscriptions-list-pane-header";
import type {
  SubscriptionsActionableStatusLabels,
  SubscriptionsKeptMarker,
  SubscriptionsLatestArticleLabels,
} from "./subscriptions-list-row";
import { type SubscriptionsListLoadState, SubscriptionsListLoadStatus } from "./subscriptions-load-status";
import { type SubscriptionsSearchCondition, SubscriptionsSearchConditionView } from "./subscriptions-search-condition";

const LIST_SCROLL_TOP_COMMIT_DELAY_MS = 120;
const READY_LOAD_STATE: SubscriptionsListLoadState = { status: "ready" };

type SubscriptionsListPaneProps = {
  heading: string;
  groups: SubscriptionListGroup[];
  selectedFeedId: string | null;
  emptyLabel: string;
  searchQuery: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchClearLabel: string;
  addFeedLabel?: string;
  onAddFeed?: () => void;
  statusLabels: SubscriptionsActionableStatusLabels;
  reasonTooltipLabels: Partial<Record<NonNullable<SubscriptionListRow["reasonTooltipKey"]>, string>>;
  fetchErrorLabel?: string;
  remoteFetchFailureLabel?: string;
  formatUnreadCountLabel: (count: number) => string;
  latestArticleLabels: SubscriptionsLatestArticleLabels;
  isGroupExpanded: (groupKey: string) => boolean;
  initialScrollTop?: number;
  feedScrollRequest?: { feedId: string; sequence: number } | null;
  scrollRegionRef?: RefObject<HTMLDivElement | null>;
  workspaceScrollRef?: RefObject<HTMLDivElement | null>;
  viewportWidth?: number;
  scrollReady?: boolean;
  scrollResetKey?: number;
  loadState?: SubscriptionsListLoadState;
  kept?: SubscriptionsKeptMarker;
  keptBanner?: SubscriptionsKeptBanner | null;
  searchCondition?: SubscriptionsSearchCondition | null;
  emptyShowAllLabel?: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  filterBar?: SubscriptionsFilterBarProps;
  bulkSelection?: SubscriptionsBulkSelection;
  bulkRunStatus?: SubscriptionsBulkRunStatus | null;
  onSelectFeed: (feedId: string) => void;
  onListScrollTopChange?: (scrollTop: number) => void;
  onSearchQueryChange: (query: string) => void;
  onToggleGroup: (groupKey: string) => void;
};

export function SubscriptionsListPane({
  heading,
  groups,
  selectedFeedId,
  emptyLabel,
  searchQuery,
  searchLabel,
  searchPlaceholder,
  searchClearLabel,
  addFeedLabel,
  onAddFeed,
  statusLabels,
  reasonTooltipLabels,
  fetchErrorLabel = "Fetch error",
  remoteFetchFailureLabel = "Fetch failed",
  formatUnreadCountLabel,
  latestArticleLabels,
  isGroupExpanded,
  initialScrollTop = 0,
  feedScrollRequest = null,
  scrollRegionRef: providedScrollRegionRef,
  workspaceScrollRef,
  viewportWidth = 1024,
  scrollReady = true,
  scrollResetKey = 0,
  loadState = READY_LOAD_STATE,
  kept,
  keptBanner,
  searchCondition,
  emptyShowAllLabel,
  headingRef,
  filterBar,
  bulkSelection,
  bulkRunStatus,
  onSelectFeed,
  onListScrollTopChange,
  onSearchQueryChange,
  onToggleGroup,
}: SubscriptionsListPaneProps) {
  const headingId = useId();
  const internalScrollRegionRef = useRef<HTMLDivElement | null>(null);
  const scrollRegionRef = providedScrollRegionRef ?? internalScrollRegionRef;
  const restoredScrollStateRef = useRef<{
    scrollTop: number;
    resetKey: number;
  } | null>(null);
  const pendingScrollTopRef = useRef<number | null>(null);
  const committedScrollTopRef = useRef<number | null>(null);
  const scrollCommitTimerRef = useRef<number | null>(null);
  const onListScrollTopChangeRef = useRef(onListScrollTopChange);
  const totalRowCount = countSubscriptionGroupRows(groups);
  const hasRows = totalRowCount > 0;
  const selecting = bulkSelection?.mode === true;
  const { loading, listUnavailable, showRows, showEmptyState, showKeptBanner } = resolveListPaneDisplay(
    loadState,
    hasRows,
  );

  useLayoutEffect(() => {
    onListScrollTopChangeRef.current = onListScrollTopChange;
  });

  const clearPendingScrollTopCommit = useCallback(() => {
    if (scrollCommitTimerRef.current !== null) {
      window.clearTimeout(scrollCommitTimerRef.current);
      scrollCommitTimerRef.current = null;
    }
  }, []);

  const commitPendingScrollTop = useCallback(() => {
    scrollCommitTimerRef.current = null;
    const pendingScrollTop = pendingScrollTopRef.current;
    pendingScrollTopRef.current = null;
    if (pendingScrollTop === null || committedScrollTopRef.current === pendingScrollTop) {
      return;
    }

    committedScrollTopRef.current = pendingScrollTop;
    onListScrollTopChangeRef.current?.(pendingScrollTop);
  }, []);

  useEffect(() => {
    const scrollRegion = viewportWidth < 1024 ? workspaceScrollRef?.current : scrollRegionRef.current;
    if (!scrollRegion || !scrollReady || (!hasRows && viewportWidth >= 1024)) {
      return;
    }
    const restoredScrollState = restoredScrollStateRef.current;
    const targetScrollTop = hasRows ? initialScrollTop : 0;
    if (restoredScrollState?.scrollTop === targetScrollTop && restoredScrollState.resetKey === scrollResetKey) {
      return;
    }

    clearPendingScrollTopCommit();
    pendingScrollTopRef.current = null;
    scrollRegion.scrollTop = targetScrollTop;
    restoredScrollStateRef.current = {
      scrollTop: targetScrollTop,
      resetKey: scrollResetKey,
    };
    committedScrollTopRef.current = targetScrollTop;
  }, [
    clearPendingScrollTopCommit,
    hasRows,
    initialScrollTop,
    scrollRegionRef,
    scrollResetKey,
    scrollReady,
    viewportWidth,
    workspaceScrollRef,
  ]);

  useEffect(() => {
    return () => {
      clearPendingScrollTopCommit();
      commitPendingScrollTop();
    };
  }, [clearPendingScrollTopCommit, commitPendingScrollTop]);

  // A feed deep link asks for its row to be scrolled into view once it is
  // rendered. Declared after the scroll-restore effect so it wins within a
  // commit, and keyed on the reset key so a later scroll restore (layout
  // generation change) re-applies the scroll instead of stranding the row.
  const handledFeedScrollRef = useRef<{ sequence: number; resetKey: number } | null>(null);
  useEffect(() => {
    if (!feedScrollRequest || !showRows || totalRowCount === 0) {
      return;
    }
    const handled = handledFeedScrollRef.current;
    if (handled?.sequence === feedScrollRequest.sequence && handled?.resetKey === scrollResetKey) {
      return;
    }
    const rowButton = Array.from(
      scrollRegionRef.current?.querySelectorAll<HTMLButtonElement>("[data-feed-id]") ?? [],
    ).find((button) => button.dataset.feedId === feedScrollRequest.feedId);
    if (!rowButton) {
      return;
    }
    rowButton.scrollIntoView?.({ block: "nearest" });
    handledFeedScrollRef.current = { sequence: feedScrollRequest.sequence, resetKey: scrollResetKey };
  }, [feedScrollRequest, scrollResetKey, scrollRegionRef, showRows, totalRowCount]);

  const scheduleScrollTopCommit = useCallback(
    (scrollTop: number) => {
      pendingScrollTopRef.current = Math.max(0, scrollTop);
      clearPendingScrollTopCommit();
      scrollCommitTimerRef.current = window.setTimeout(commitPendingScrollTop, LIST_SCROLL_TOP_COMMIT_DELAY_MS);
    },
    [clearPendingScrollTopCommit, commitPendingScrollTop],
  );

  // Arrow keys move within the visible rows only: collapsed groups keep their
  // rows in the DOM as inert, so the order comes from the expanded groups
  // rather than from DOM enumeration. Movement selects as it goes and stops
  // at both ends (see docs/reader-keyboard-navigation.md). The handler sits on
  // the pane section, mirroring the sidebar pane, and only acts on events
  // that start on a row button.
  const handlePaneKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) {
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || isImeCommitKeyEvent(event.nativeEvent)) {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    const rowButton = target?.closest<HTMLButtonElement>("[data-feed-id]");
    if (!rowButton || !event.currentTarget.contains(rowButton)) {
      return;
    }
    const navigableFeedIds = groups
      .filter((group) => isGroupExpanded(group.key))
      .flatMap((group) => group.rows.map((row) => row.feed.id));
    const nextFeedId = resolveAdjacentSubscriptionFeedId(
      navigableFeedIds,
      rowButton.dataset.feedId ?? null,
      event.key === "ArrowDown" ? 1 : -1,
    );
    if (nextFeedId === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onSelectFeed(nextFeedId);
    const nextButton = Array.from(
      scrollRegionRef.current?.querySelectorAll<HTMLButtonElement>("[data-feed-id]") ?? [],
    ).find((button) => button.dataset.feedId === nextFeedId);
    nextButton?.focus();
    nextButton?.scrollIntoView?.({ block: "nearest" });
  };

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col rounded-md px-4 py-5 sm:px-5 sm:py-6 lg:min-h-0 lg:rounded-r-none lg:border-r lg:border-[color:var(--subscriptions-pane-divider)]"
      style={{
        backgroundColor: "var(--subscriptions-list-surface)",
      }}
      onKeyDown={handlePaneKeyDown}
    >
      <SubscriptionsListPaneHeader
        heading={heading}
        headingId={headingId}
        headingRef={headingRef}
        searchQuery={searchQuery}
        searchLabel={searchLabel}
        searchPlaceholder={searchPlaceholder}
        addFeedLabel={addFeedLabel}
        onAddFeed={onAddFeed}
        filterBar={filterBar}
        bulkSelection={bulkSelection}
        bulkRunStatus={bulkRunStatus}
        bulkToggleDisabled={loading || listUnavailable}
        onSearchQueryChange={onSearchQueryChange}
      />
      <div
        ref={scrollRegionRef}
        data-testid="subscriptions-list-scroll-region"
        className="space-y-3 pr-1.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
        onScroll={(event) => scheduleScrollTopCommit(event.currentTarget.scrollTop)}
      >
        <SubscriptionsListLoadStatus loadState={loadState} />
        {showKeptBanner ? <SubscriptionsSearchConditionView condition={searchCondition} /> : null}
        <SubscriptionsKeptBannerView banner={showKeptBanner ? keptBanner : null} />
        {bulkSelection && selecting && showRows ? (
          <SubscriptionsBulkSelectAllRow bulkSelection={bulkSelection} visibleRowCount={totalRowCount} />
        ) : null}
        {showEmptyState ? (
          <SubscriptionsListEmptyState
            emptyLabel={emptyLabel}
            filterBar={filterBar}
            searchQuery={searchQuery}
            searchClearLabel={searchClearLabel}
            emptyShowAllLabel={emptyShowAllLabel}
            addFeedLabel={addFeedLabel}
            onAddFeed={onAddFeed}
            onSearchQueryChange={onSearchQueryChange}
          />
        ) : null}
        {showRows
          ? groups.map((group) => (
              <SubscriptionGroupSection
                key={group.key}
                group={group}
                expanded={isGroupExpanded(group.key)}
                selectedFeedId={selectedFeedId}
                kept={kept}
                bulkSelection={bulkSelection}
                statusLabels={statusLabels}
                reasonTooltipLabels={reasonTooltipLabels}
                fetchErrorLabel={fetchErrorLabel}
                remoteFetchFailureLabel={remoteFetchFailureLabel}
                formatUnreadCountLabel={formatUnreadCountLabel}
                latestArticleLabels={latestArticleLabels}
                onSelectFeed={onSelectFeed}
                onToggleGroup={onToggleGroup}
              />
            ))
          : null}
      </div>
      {bulkSelection && selecting ? <SubscriptionsBulkActionBar bulkSelection={bulkSelection} /> : null}
    </section>
  );
}
