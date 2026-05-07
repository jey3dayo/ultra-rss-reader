import { ChevronDown } from "lucide-react";
import { useEffect, useRef } from "react";
import { FeedFavicon } from "@/components/shared/feed-favicon";
import { LabelChip } from "@/components/shared/label-chip";
import { NavRowButton } from "@/components/shared/nav-row-button";
import { AppTooltip, TooltipProvider } from "@/components/ui/tooltip";
import {
  MOTION_CONTENT_SWAP_CLASS_NAME,
  MOTION_DATA_PHASE_ATTRIBUTE,
  MOTION_DATA_STATE_ATTRIBUTE,
  MOTION_PHASE_ENTERING,
  MOTION_STATE_CLOSED,
  MOTION_STATE_OPEN,
} from "@/constants/motion";
import { countSubscriptionGroupRows } from "@/lib/subscriptions-index";
import { cn } from "@/lib/utils";
import type { SubscriptionListGroup, SubscriptionListRow } from "./subscriptions-index.types";

type SubscriptionGroupDisclosureButtonProps = {
  group: SubscriptionListGroup;
  expanded: boolean;
  controlsId: string;
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
  statusLabels,
  reasonTooltipLabels,
  formatUnreadCountLabel,
  formatLatestArticleLabel,
  isGroupExpanded,
  initialScrollTop = 0,
  onSelectFeed,
  onListScrollTopChange,
  onToggleGroup,
}: {
  heading: string;
  groups: SubscriptionListGroup[];
  selectedFeedId: string | null;
  emptyLabel: string;
  statusLabels: Record<SubscriptionListRow["status"]["labelKey"], string>;
  reasonTooltipLabels: Record<NonNullable<SubscriptionListRow["reasonTooltipKey"]>, string>;
  formatUnreadCountLabel: (count: number) => string;
  formatLatestArticleLabel: (value: string | null) => string;
  isGroupExpanded: (groupKey: string) => boolean;
  initialScrollTop?: number;
  onSelectFeed: (feedId: string) => void;
  onListScrollTopChange?: (scrollTop: number) => void;
  onToggleGroup: (groupKey: string) => void;
}) {
  const scrollRegionRef = useRef<HTMLDivElement | null>(null);
  const restoredScrollTopRef = useRef<number | null>(null);
  const totalRowCount = countSubscriptionGroupRows(groups);
  const hasRows = totalRowCount > 0;

  useEffect(() => {
    const scrollRegion = scrollRegionRef.current;
    if (!scrollRegion) {
      return;
    }
    if (restoredScrollTopRef.current === initialScrollTop) {
      return;
    }

    scrollRegion.scrollTop = initialScrollTop;
    restoredScrollTopRef.current = initialScrollTop;
  }, [initialScrollTop]);

  return (
    <section
      className="flex flex-col rounded-md px-4 py-5 sm:px-5 sm:py-5 lg:min-h-0 lg:border-r lg:border-[color:var(--subscriptions-pane-divider)]"
      style={{
        backgroundColor: "var(--subscriptions-list-surface)",
      }}
    >
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-border/50 pb-4">
        <h2 className="font-sans text-[1.02rem] font-normal tracking-[-0.02em] text-foreground">{heading}</h2>
        {hasRows ? <LabelChip tone="neutral">{totalRowCount}</LabelChip> : null}
      </div>
      <div
        ref={scrollRegionRef}
        className="space-y-5 pr-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
        onScroll={(event) => onListScrollTopChange?.(event.currentTarget.scrollTop)}
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
                                  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-[background-color,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
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
