import { cva } from "class-variance-authority";
import { cn } from "cn";
import { ChevronDown, Folder } from "lucide-react";
import { type RefObject, useCallback, useEffect, useId, useLayoutEffect, useRef } from "react";
import {
  MOTION_CONTENT_SWAP_CLASS_NAME,
  MOTION_DATA_PHASE_ATTRIBUTE,
  MOTION_DATA_STATE_ATTRIBUTE,
  MOTION_PHASE_ENTERING,
  MOTION_STATE_CLOSED,
  MOTION_STATE_OPEN,
} from "@/constants/motion";
import { Button } from "@/design-system";
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
import { SubscriptionsListPaneHeader } from "./subscriptions-list-pane-header";
import {
  type SubscriptionsActionableStatusLabels,
  type SubscriptionsKeptMarker,
  type SubscriptionsLatestArticleLabels,
  SubscriptionsListRow,
} from "./subscriptions-list-row";
import { type SubscriptionsListLoadState, SubscriptionsListLoadStatus } from "./subscriptions-load-status";
import { type SubscriptionsSearchCondition, SubscriptionsSearchConditionView } from "./subscriptions-search-condition";

const LIST_SCROLL_TOP_COMMIT_DELAY_MS = 120;
const READY_LOAD_STATE: SubscriptionsListLoadState = { status: "ready" };

// Selecting keeps each checkbox and row button as grid siblings, so toggling the mode never remounts the row buttons.
const subscriptionRowsVariants = cva("pl-9 pt-1", {
  variants: {
    selecting: {
      true: "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5",
      false: "space-y-1.5",
    },
  },
});

type SubscriptionGroupDisclosureButtonProps = {
  group: SubscriptionListGroup;
  expanded: boolean;
  controlsId: string;
  onToggleGroup: (groupKey: string) => void;
};

type SubscriptionsListPaneProps = {
  heading: string;
  groups: SubscriptionListGroup[];
  selectedFeedId: string | null;
  emptyLabel: string;
  searchQuery: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchClearLabel: string;
  statusLabels: SubscriptionsActionableStatusLabels;
  reasonTooltipLabels: Partial<Record<NonNullable<SubscriptionListRow["reasonTooltipKey"]>, string>>;
  fetchErrorLabel?: string;
  remoteFetchFailureLabel?: string;
  formatUnreadCountLabel: (count: number) => string;
  latestArticleLabels: SubscriptionsLatestArticleLabels;
  isGroupExpanded: (groupKey: string) => boolean;
  initialScrollTop?: number;
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

function SubscriptionsListEmptyState({
  emptyLabel,
  filterBar,
  searchQuery,
  searchClearLabel,
  emptyShowAllLabel,
  onSearchQueryChange,
}: Pick<
  SubscriptionsListPaneProps,
  "emptyLabel" | "filterBar" | "searchQuery" | "searchClearLabel" | "emptyShowAllLabel" | "onSearchQueryChange"
>) {
  const description = filterBar?.model.activeDescription;
  const activeFilterKey = filterBar?.model.options.find((option) => option.isActive)?.filterKey ?? "all";
  const showAllAction = activeFilterKey !== "all" && emptyShowAllLabel && filterBar ? filterBar : null;
  const hasActions = searchQuery.length > 0 || showAllAction !== null;

  return (
    <div
      {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
      className={`${MOTION_CONTENT_SWAP_CLASS_NAME} rounded-md border border-dashed border-border px-4 py-6 text-sm text-foreground-soft`}
    >
      <p role="status" className="text-foreground-soft">
        {emptyLabel}
      </p>
      {description ? <p className="mt-1.5 text-xs leading-[1.5] text-foreground-soft">{description}</p> : null}
      {hasActions ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {searchQuery.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => onSearchQueryChange("")}
              className="min-h-11 hover:bg-[color:var(--subscriptions-list-row-hover)]"
            >
              {searchClearLabel}
            </Button>
          ) : null}
          {showAllAction ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => showAllAction.onSelect("all")}
              className="min-h-11 hover:bg-[color:var(--subscriptions-list-row-hover)]"
            >
              {emptyShowAllLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SubscriptionGroupDisclosureButton({
  group,
  expanded,
  controlsId,
  onToggleGroup,
}: SubscriptionGroupDisclosureButtonProps) {
  return (
    <button
      type="button"
      data-testid={`subscriptions-folder-row-${group.folderId ?? "ungrouped"}`}
      data-folder-drop-target={group.folderId ? "true" : "false"}
      aria-expanded={expanded}
      aria-controls={controlsId}
      onClick={() => onToggleGroup(group.key)}
      className={cn(
        "motion-disclosure-trigger flex min-h-11 w-full items-center justify-between rounded-md border border-transparent px-2.5 py-1.5 text-left text-foreground transition-[background-color,color] duration-150 hover:bg-[color:var(--subscriptions-list-row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/45 motion-reduce:transition-none",
        expanded ? "bg-[color:var(--subscriptions-list-row-hover)]" : "text-foreground-soft",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="flex size-5 shrink-0 items-center justify-center text-foreground-soft">
          <ChevronDown
            aria-hidden="true"
            className={cn("motion-disclosure-icon size-3.5 shrink-0", expanded ? "rotate-0" : "-rotate-90")}
          />
        </span>
        <span className="flex size-5 shrink-0 items-center justify-center text-foreground-soft">
          <Folder aria-hidden="true" className="size-3.5" />
        </span>
        <h3 className="min-w-0 truncate text-[0.88rem] font-medium tracking-[-0.01em]">{group.label}</h3>
      </span>
      <span className="ml-3 shrink-0 text-[0.72rem] font-medium tabular-nums text-foreground-soft">
        {group.rows.length}
      </span>
    </button>
  );
}

type SubscriptionGroupSectionProps = Pick<
  SubscriptionsListPaneProps,
  | "selectedFeedId"
  | "kept"
  | "bulkSelection"
  | "statusLabels"
  | "reasonTooltipLabels"
  | "formatUnreadCountLabel"
  | "latestArticleLabels"
  | "onSelectFeed"
  | "onToggleGroup"
> & {
  group: SubscriptionsListPaneProps["groups"][number];
  fetchErrorLabel: string;
  remoteFetchFailureLabel: string;
  expanded: boolean;
  selecting: boolean;
};

function SubscriptionGroupSection({
  group,
  expanded,
  selecting,
  selectedFeedId,
  kept,
  bulkSelection,
  statusLabels,
  reasonTooltipLabels,
  fetchErrorLabel,
  remoteFetchFailureLabel,
  formatUnreadCountLabel,
  latestArticleLabels,
  onSelectFeed,
  onToggleGroup,
}: SubscriptionGroupSectionProps) {
  const groupBodyId = `subscriptions-group-panel-${group.key}`;

  return (
    <div className="relative space-y-1">
      <SubscriptionGroupDisclosureButton
        group={group}
        expanded={expanded}
        controlsId={groupBodyId}
        onToggleGroup={onToggleGroup}
      />
      <div
        id={groupBodyId}
        {...{
          [MOTION_DATA_STATE_ATTRIBUTE]: expanded ? MOTION_STATE_OPEN : MOTION_STATE_CLOSED,
        }}
        aria-hidden={expanded ? "false" : "true"}
        inert={expanded ? undefined : true}
        className="motion-disclosure-panel"
      >
        <div className="motion-disclosure-body">
          <div
            data-testid={`subscriptions-folder-rows-${group.folderId ?? "ungrouped"}`}
            className={subscriptionRowsVariants({ selecting })}
          >
            {group.rows.map((row) => (
              <SubscriptionsListRow
                key={row.feed.id}
                row={row}
                selected={selectedFeedId === row.feed.id}
                kept={kept?.feedIds.has(row.feed.id) ?? false}
                keptChipLabel={kept?.chipLabel ?? ""}
                bulkSelection={bulkSelection}
                statusLabels={statusLabels}
                reasonTooltipLabels={reasonTooltipLabels}
                fetchErrorLabel={fetchErrorLabel}
                remoteFetchFailureLabel={remoteFetchFailureLabel}
                formatUnreadCountLabel={formatUnreadCountLabel}
                latestArticleLabels={latestArticleLabels}
                onSelectFeed={onSelectFeed}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SubscriptionsListPane({
  heading,
  groups,
  selectedFeedId,
  emptyLabel,
  searchQuery,
  searchLabel,
  searchPlaceholder,
  searchClearLabel,
  statusLabels,
  reasonTooltipLabels,
  fetchErrorLabel = "Fetch error",
  remoteFetchFailureLabel = "Fetch failed",
  formatUnreadCountLabel,
  latestArticleLabels,
  isGroupExpanded,
  initialScrollTop = 0,
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

  const scheduleScrollTopCommit = useCallback(
    (scrollTop: number) => {
      pendingScrollTopRef.current = Math.max(0, scrollTop);
      clearPendingScrollTopCommit();
      scrollCommitTimerRef.current = window.setTimeout(commitPendingScrollTop, LIST_SCROLL_TOP_COMMIT_DELAY_MS);
    },
    [clearPendingScrollTopCommit, commitPendingScrollTop],
  );

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col rounded-md px-4 py-5 sm:px-5 sm:py-6 lg:min-h-0 lg:rounded-r-none lg:border-r lg:border-[color:var(--subscriptions-pane-divider)]"
      style={{
        backgroundColor: "var(--subscriptions-list-surface)",
      }}
    >
      <SubscriptionsListPaneHeader
        heading={heading}
        headingId={headingId}
        headingRef={headingRef}
        searchQuery={searchQuery}
        searchLabel={searchLabel}
        searchPlaceholder={searchPlaceholder}
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
            onSearchQueryChange={onSearchQueryChange}
          />
        ) : null}
        {showRows
          ? groups.map((group) => (
              <SubscriptionGroupSection
                key={group.key}
                group={group}
                expanded={isGroupExpanded(group.key)}
                selecting={selecting}
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
