import { cva } from "class-variance-authority";
import { cn } from "cn";
import { ChevronDown, Folder, Search } from "lucide-react";
import { type RefObject, useCallback, useEffect, useId, useLayoutEffect, useRef } from "react";
import {
  MOTION_CONTENT_SWAP_CLASS_NAME,
  MOTION_DATA_PHASE_ATTRIBUTE,
  MOTION_DATA_STATE_ATTRIBUTE,
  MOTION_PHASE_ENTERING,
  MOTION_STATE_CLOSED,
  MOTION_STATE_OPEN,
} from "@/constants/motion";
import { Button, Input } from "@/design-system";
import { countSubscriptionGroupRows } from "@/lib/subscriptions/subscriptions-index";
import type { SubscriptionListGroup, SubscriptionListRow } from "@/lib/subscriptions/subscriptions-index.types";
import {
  SubscriptionsBulkActionBar,
  SubscriptionsBulkSelectAllRow,
  type SubscriptionsBulkSelection,
} from "./subscriptions-bulk-selection";
import { SubscriptionsListRow } from "./subscriptions-list-row";
import {
  resolveListPaneDisplay,
  type SubscriptionsListLoadState,
  SubscriptionsListLoadStatus,
} from "./subscriptions-load-status";

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
  statusLabels: Record<SubscriptionListRow["status"]["labelKey"], string>;
  reasonTooltipLabels: Partial<Record<NonNullable<SubscriptionListRow["reasonTooltipKey"]>, string>>;
  fetchErrorLabel?: string;
  formatUnreadCountLabel: (count: number) => string;
  formatLatestArticleLabel: (value: string | null) => string;
  isGroupExpanded: (groupKey: string) => boolean;
  initialScrollTop?: number;
  scrollRegionRef?: RefObject<HTMLDivElement | null>;
  workspaceScrollRef?: RefObject<HTMLDivElement | null>;
  viewportWidth?: number;
  scrollReady?: boolean;
  scrollResetKey?: number;
  loadState?: SubscriptionsListLoadState;
  bulkSelection?: SubscriptionsBulkSelection;
  onSelectFeed: (feedId: string) => void;
  onListScrollTopChange?: (scrollTop: number) => void;
  onSearchQueryChange: (query: string) => void;
  onToggleGroup: (groupKey: string) => void;
};

function SubscriptionsListEmptyState({
  emptyLabel,
  searchQuery,
  searchClearLabel,
  onSearchQueryChange,
}: Pick<SubscriptionsListPaneProps, "emptyLabel" | "searchQuery" | "searchClearLabel" | "onSearchQueryChange">) {
  return (
    <div
      {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
      className={`${MOTION_CONTENT_SWAP_CLASS_NAME} rounded-md border border-dashed border-border px-4 py-6 text-sm text-foreground-soft`}
    >
      <p className="text-foreground-soft">{emptyLabel}</p>
      {searchQuery.length > 0 ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => onSearchQueryChange("")}
          className="mt-3 min-h-11 hover:bg-[color:var(--subscriptions-list-row-hover)]"
        >
          {searchClearLabel}
        </Button>
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
  formatUnreadCountLabel,
  formatLatestArticleLabel,
  isGroupExpanded,
  initialScrollTop = 0,
  scrollRegionRef: providedScrollRegionRef,
  workspaceScrollRef,
  viewportWidth = 1024,
  scrollReady = true,
  scrollResetKey = 0,
  loadState = READY_LOAD_STATE,
  bulkSelection,
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
  const { loading, listUnavailable, showRows, showEmptyState } = resolveListPaneDisplay(loadState, hasRows);

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

  const searchField = (
    <div className="relative w-full min-w-0 sm:max-w-[20rem]">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-soft"
      />
      <Input
        type="search"
        value={searchQuery}
        aria-label={searchLabel}
        placeholder={searchPlaceholder}
        onChange={(event) => onSearchQueryChange(event.currentTarget.value)}
        className="h-11 rounded-md border-[var(--workspace-low-wire-section-border)] bg-[var(--workspace-low-wire-group-surface)] pl-10 pr-3 text-[0.88rem] shadow-none"
      />
    </div>
  );

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col rounded-md px-4 py-5 sm:px-5 sm:py-6 lg:min-h-0 lg:rounded-r-none lg:border-r lg:border-[color:var(--subscriptions-pane-divider)]"
      style={{
        backgroundColor: "var(--subscriptions-list-surface)",
      }}
    >
      <div className="mb-4 flex flex-col gap-3 border-b border-border/55 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <h2
            id={headingId}
            className="min-w-[4rem] truncate font-sans text-[1.08rem] font-semibold tracking-[-0.025em] text-foreground"
          >
            {heading}
          </h2>
          {showRows ? (
            <span className="inline-flex h-6 min-w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-surface-1/58 px-2 font-sans text-(length:--font-size-2xs) font-medium tabular-nums text-foreground-soft shadow-none">
              {totalRowCount}
            </span>
          ) : null}
        </div>
        {bulkSelection ? (
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1 sm:justify-end">
            {searchField}
            <Button
              ref={bulkSelection.toggleButtonRef}
              type="button"
              variant="outline"
              disabled={loading || listUnavailable}
              onClick={selecting ? bulkSelection.onEnd : bulkSelection.onStart}
              className="min-h-11 shrink-0"
            >
              {selecting ? bulkSelection.labels.end : bulkSelection.labels.start}
            </Button>
          </div>
        ) : (
          searchField
        )}
      </div>
      <div
        ref={scrollRegionRef}
        data-testid="subscriptions-list-scroll-region"
        className="space-y-3 pr-1.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
        onScroll={(event) => scheduleScrollTopCommit(event.currentTarget.scrollTop)}
      >
        <SubscriptionsListLoadStatus loadState={loadState} />
        {bulkSelection && selecting && showRows ? (
          <SubscriptionsBulkSelectAllRow bulkSelection={bulkSelection} visibleRowCount={totalRowCount} />
        ) : null}
        {showEmptyState ? (
          <SubscriptionsListEmptyState
            emptyLabel={emptyLabel}
            searchQuery={searchQuery}
            searchClearLabel={searchClearLabel}
            onSearchQueryChange={onSearchQueryChange}
          />
        ) : null}
        {showRows
          ? groups.map((group) => {
              const expanded = isGroupExpanded(group.key);
              const groupBodyId = `subscriptions-group-panel-${group.key}`;

              return (
                <div key={group.key} className="relative space-y-1">
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
                            bulkSelection={bulkSelection}
                            statusLabels={statusLabels}
                            reasonTooltipLabels={reasonTooltipLabels}
                            fetchErrorLabel={fetchErrorLabel}
                            formatUnreadCountLabel={formatUnreadCountLabel}
                            formatLatestArticleLabel={formatLatestArticleLabel}
                            onSelectFeed={onSelectFeed}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          : null}
      </div>
      {bulkSelection && selecting ? <SubscriptionsBulkActionBar bulkSelection={bulkSelection} /> : null}
    </section>
  );
}
