import { ChevronDown, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import {
  MOTION_CONTENT_SWAP_CLASS_NAME,
  MOTION_DATA_PHASE_ATTRIBUTE,
  MOTION_DATA_STATE_ATTRIBUTE,
  MOTION_PHASE_ENTERING,
  MOTION_STATE_CLOSED,
  MOTION_STATE_OPEN,
} from "@/constants/motion";
import { AppTooltip, FeedFavicon, Input, LabelChip, NavRowButton, TooltipProvider } from "@/design-system";
import { countSubscriptionGroupRows } from "@/lib/subscriptions/subscriptions-index";
import type { SubscriptionListGroup, SubscriptionListRow } from "@/lib/subscriptions/subscriptions-index.types";
import { cn } from "@/lib/utils";

const LIST_SCROLL_TOP_COMMIT_DELAY_MS = 120;

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
  reasonTooltipLabels: Record<NonNullable<SubscriptionListRow["reasonTooltipKey"]>, string>;
  formatUnreadCountLabel: (count: number) => string;
  formatLatestArticleLabel: (value: string | null) => string;
  isGroupExpanded: (groupKey: string) => boolean;
  initialScrollTop?: number;
  scrollResetKey?: number;
  onSelectFeed: (feedId: string) => void;
  onListScrollTopChange?: (scrollTop: number) => void;
  onSearchQueryChange: (query: string) => void;
  onToggleGroup: (groupKey: string) => void;
};

function resolveStatusTone(labelKey: SubscriptionListRow["status"]["labelKey"]) {
  if (labelKey === "review") {
    return "warning";
  }

  if (labelKey === "stale_90d") {
    return "danger";
  }

  return "neutral";
}

export function SubscriptionGroupDisclosureButton({
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
        "motion-disclosure-trigger flex min-h-9 w-full items-center justify-between rounded-md px-1.5 py-1 text-left text-foreground transition-[background-color,color,box-shadow] duration-150 hover:bg-[color:var(--subscriptions-list-row-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/45 motion-reduce:transition-none",
        !expanded && "text-foreground-soft",
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <ChevronDown
          className={cn(
            "motion-disclosure-icon h-3 w-3 shrink-0 text-foreground-soft",
            expanded ? "rotate-0" : "-rotate-90",
          )}
        />
        <h3 className="min-w-0 truncate text-sm font-medium tracking-[-0.01em]">{group.label}</h3>
      </span>
      <LabelChip tone="neutral" size="compact" className="shrink-0 bg-surface-1/70 text-[0.72rem]">
        {group.rows.length}
      </LabelChip>
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
  formatUnreadCountLabel,
  formatLatestArticleLabel,
  isGroupExpanded,
  initialScrollTop = 0,
  scrollResetKey = 0,
  onSelectFeed,
  onListScrollTopChange,
  onSearchQueryChange,
  onToggleGroup,
}: SubscriptionsListPaneProps) {
  const scrollRegionRef = useRef<HTMLDivElement | null>(null);
  const restoredScrollStateRef = useRef<{ scrollTop: number; resetKey: number } | null>(null);
  const pendingScrollTopRef = useRef<number | null>(null);
  const committedScrollTopRef = useRef<number | null>(null);
  const scrollCommitTimerRef = useRef<number | null>(null);
  const onListScrollTopChangeRef = useRef(onListScrollTopChange);
  const totalRowCount = countSubscriptionGroupRows(groups);
  const hasRows = totalRowCount > 0;

  onListScrollTopChangeRef.current = onListScrollTopChange;

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
    const scrollRegion = scrollRegionRef.current;
    if (!scrollRegion) {
      return;
    }
    const restoredScrollState = restoredScrollStateRef.current;
    if (restoredScrollState?.scrollTop === initialScrollTop && restoredScrollState.resetKey === scrollResetKey) {
      return;
    }

    clearPendingScrollTopCommit();
    pendingScrollTopRef.current = null;
    scrollRegion.scrollTop = initialScrollTop;
    restoredScrollStateRef.current = {
      scrollTop: initialScrollTop,
      resetKey: scrollResetKey,
    };
    committedScrollTopRef.current = initialScrollTop;
  }, [clearPendingScrollTopCommit, initialScrollTop, scrollResetKey]);

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
      className="flex flex-col rounded-md px-4 py-5 sm:px-5 sm:py-5 lg:min-h-0 lg:border-r lg:border-[color:var(--subscriptions-pane-divider)]"
      style={{
        backgroundColor: "var(--subscriptions-list-surface)",
      }}
    >
      <div className="mb-5 flex flex-col gap-3 border-b border-border/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <h2 className="min-w-0 truncate font-sans text-[1.02rem] font-normal tracking-[-0.02em] text-foreground">
            {heading}
          </h2>
          {hasRows ? <LabelChip tone="neutral">{totalRowCount}</LabelChip> : null}
        </div>
        <div className="relative w-full sm:max-w-[20rem]">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-soft"
          />
          <Input
            type="search"
            value={searchQuery}
            aria-label={searchLabel}
            placeholder={searchPlaceholder}
            onChange={(event) => onSearchQueryChange(event.currentTarget.value)}
            className="h-8 rounded-full bg-background/25 pl-8 pr-8 text-[0.82rem] shadow-none"
          />
          {searchQuery.length > 0 ? (
            <button
              type="button"
              aria-label={searchClearLabel}
              onClick={() => onSearchQueryChange("")}
              className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-foreground-soft transition-[background-color,color] duration-150 hover:bg-[color:var(--subscriptions-list-row-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/45 motion-reduce:transition-none"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      <div
        ref={scrollRegionRef}
        data-testid="subscriptions-list-scroll-region"
        className="space-y-5 pr-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
        onScroll={(event) => scheduleScrollTopCommit(event.currentTarget.scrollTop)}
      >
        {!hasRows ? (
          <p
            {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
            className={`${MOTION_CONTENT_SWAP_CLASS_NAME} rounded-md border border-dashed border-border px-4 py-6 text-sm text-foreground-soft`}
          >
            {emptyLabel}
          </p>
        ) : (
          groups.map((group) => {
            const expanded = isGroupExpanded(group.key);
            const groupBodyId = `subscriptions-group-panel-${group.key}`;

            return (
              <div key={group.key} className="space-y-1.5">
                <SubscriptionGroupDisclosureButton
                  group={group}
                  expanded={expanded}
                  controlsId={groupBodyId}
                  onToggleGroup={onToggleGroup}
                />
                <div
                  id={groupBodyId}
                  {...{ [MOTION_DATA_STATE_ATTRIBUTE]: expanded ? MOTION_STATE_OPEN : MOTION_STATE_CLOSED }}
                  aria-hidden={expanded ? "false" : "true"}
                  inert={expanded ? undefined : true}
                  className="motion-disclosure-panel"
                >
                  <div className="motion-disclosure-body">
                    <div
                      data-testid={`subscriptions-folder-tree-rail-${group.folderId ?? "ungrouped"}`}
                      className="space-y-1.5 border-l border-[color:var(--subscriptions-list-divider)] pl-3 pt-2"
                    >
                      {group.rows.map((row) => {
                        const isSelected = selectedFeedId === row.feed.id;
                        const rowButton = (
                          <NavRowButton
                            key={row.feed.id}
                            selected={isSelected}
                            aria-pressed={isSelected}
                            onClick={() => onSelectFeed(row.feed.id)}
                            className={cn(
                              "motion-static-hover-surface items-center rounded-md border border-transparent px-3.5 py-3.5 shadow-none",
                              isSelected
                                ? "border-[color:var(--subscriptions-list-row-selected-border)] bg-[color:var(--subscriptions-list-row-selected-surface)] shadow-[var(--subscriptions-list-row-selected-shadow)]"
                                : "bg-background/15 hover:border-[color:var(--subscriptions-list-divider)] hover:bg-[color:var(--subscriptions-list-row-hover)]",
                            )}
                            leading={
                              <span
                                className={cn(
                                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-[background-color,border-color] duration-200 ease-standard motion-reduce:transition-none",
                                  isSelected ? "bg-surface-1 text-foreground" : "bg-surface-2/88 text-foreground",
                                )}
                                style={{
                                  borderColor: "var(--subscriptions-list-divider)",
                                  backgroundColor: isSelected
                                    ? "var(--subscriptions-list-favicon-surface)"
                                    : "var(--subscriptions-list-favicon-surface-muted)",
                                }}
                              >
                                <FeedFavicon
                                  title={row.feed.title}
                                  url={row.feed.url}
                                  siteUrl={row.feed.site_url}
                                  size="md"
                                />
                              </span>
                            }
                            title={
                              <div className="flex items-center gap-2">
                                <span className="text-[0.95rem] font-medium tracking-[-0.02em] text-foreground">
                                  {row.feed.title}
                                </span>
                              </div>
                            }
                            description={
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-foreground-soft">
                                <LabelChip tone={resolveStatusTone(row.status.labelKey)} size="compact">
                                  {statusLabels[row.status.labelKey]}
                                </LabelChip>
                                <span aria-hidden="true" style={{ color: "var(--subscriptions-list-meta-divider)" }}>
                                  •
                                </span>
                                <span>{formatUnreadCountLabel(row.feed.unread_count)}</span>
                                <span aria-hidden="true" style={{ color: "var(--subscriptions-list-meta-divider)" }}>
                                  •
                                </span>
                                <span>{formatLatestArticleLabel(row.latestArticleAt)}</span>
                              </div>
                            }
                          />
                        );

                        return row.reasonTooltipKey ? (
                          <TooltipProvider key={row.feed.id}>
                            <AppTooltip label={reasonTooltipLabels[row.reasonTooltipKey]} side="top" align="start">
                              {rowButton}
                            </AppTooltip>
                          </TooltipProvider>
                        ) : (
                          <div key={row.feed.id}>{rowButton}</div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
