import { cva } from "class-variance-authority";
import { cn } from "cn";
import type { ReactElement } from "react";
import { MOTION_CONTEXTUAL_SURFACE_CLASS_NAME, MOTION_INTERACTIVE_SURFACE_CLASS_NAME } from "@/constants";
import { AppTooltip, Checkbox, FeedFavicon, LabelChip, TooltipProvider } from "@/design-system";
import { resolveSubscriptionStatusTone } from "@/lib/subscriptions/subscription-status-tone";
import type { SubscriptionListRow, SubscriptionStatusTone } from "@/lib/subscriptions/subscriptions-index.types";
import type { SubscriptionsBulkSelection } from "./subscriptions-bulk-selection";

export type SubscriptionsKeptMarker = {
  feedIds: ReadonlySet<string>;
  chipLabel: string;
};

export type SubscriptionsLatestArticleLabels = {
  srPrefix: string;
  none: string;
  formatDaysAgo: (days: number) => string;
};

export type SubscriptionsActionableStatusLabels = Record<
  Exclude<SubscriptionListRow["status"]["labelKey"], "normal">,
  string
>;

type SubscriptionsListRowProps = {
  row: SubscriptionListRow;
  selected: boolean;
  kept: boolean;
  keptChipLabel: string;
  bulkSelection?: SubscriptionsBulkSelection;
  statusLabels: SubscriptionsActionableStatusLabels;
  reasonTooltipLabels: Partial<Record<NonNullable<SubscriptionListRow["reasonTooltipKey"]>, string>>;
  fetchErrorLabel: string;
  formatUnreadCountLabel: (count: number) => string;
  latestArticleLabels: SubscriptionsLatestArticleLabels;
  onSelectFeed: (feedId: string) => void;
};

// The container query lives on the button, and the grid inside it switches columns, because an element cannot query its own container.
const rowButtonVariants = cva(
  [
    MOTION_CONTEXTUAL_SURFACE_CLASS_NAME,
    MOTION_INTERACTIVE_SURFACE_CLASS_NAME,
    "motion-list-item-enter motion-static-hover-surface @container block min-h-11 w-full rounded-md border px-3.5 py-2 text-left text-foreground select-none",
    "focus-visible:border-border-strong focus-visible:bg-surface-2/90 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
  ],
  {
    variants: {
      selected: {
        true: "border-[color:var(--subscriptions-list-row-selected-border)] bg-[color:var(--subscriptions-list-row-selected-surface)] shadow-[var(--subscriptions-list-row-selected-shadow)]",
        false:
          "border-transparent bg-surface-1/36 shadow-none hover:border-[color:var(--subscriptions-list-divider)] hover:bg-[color:var(--subscriptions-list-row-hover)]",
      },
    },
  },
);

const META_CELL_CLASS_NAME =
  "min-w-0 truncate text-(length:--font-size-2xs) text-foreground-soft tabular-nums @[28rem]:text-right";

function resolveStatusChip(
  row: SubscriptionListRow,
  statusLabels: SubscriptionsActionableStatusLabels,
  fetchErrorLabel: string,
): { tone: SubscriptionStatusTone; label: string } | null {
  if (row.fetchError) {
    return { tone: "danger", label: fetchErrorLabel };
  }
  const statusKey = row.status.labelKey;
  if (statusKey === "normal") {
    return null;
  }
  return { tone: resolveSubscriptionStatusTone(statusKey), label: statusLabels[statusKey] };
}

function SubscriptionRowChips({
  statusChip,
  keptChipLabel,
}: {
  statusChip: ReturnType<typeof resolveStatusChip>;
  keptChipLabel: string | null;
}) {
  if (!statusChip && keptChipLabel === null) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {statusChip ? (
        <LabelChip tone={statusChip.tone} size="compact">
          {statusChip.label}
        </LabelChip>
      ) : null}
      {keptChipLabel === null ? null : (
        <LabelChip tone="neutral" size="compact">
          {keptChipLabel}
        </LabelChip>
      )}
    </div>
  );
}

function LatestArticleCell({ row, labels }: { row: SubscriptionListRow; labels: SubscriptionsLatestArticleLabels }) {
  if (row.latestArticleAt === null) {
    return <span className={META_CELL_CLASS_NAME}>{labels.none}</span>;
  }
  if (row.latestArticleDays === null) {
    return <span className={META_CELL_CLASS_NAME} />;
  }

  return (
    <span className={META_CELL_CLASS_NAME}>
      <span className="sr-only">{labels.srPrefix} </span>
      {labels.formatDaysAgo(row.latestArticleDays)}
    </span>
  );
}

function resolveReasonTooltipLabel(
  row: SubscriptionListRow,
  reasonTooltipLabels: SubscriptionsListRowProps["reasonTooltipLabels"],
  fetchErrorLabel: string,
): string | null {
  if (!row.reasonTooltipKey) {
    return null;
  }
  return reasonTooltipLabels[row.reasonTooltipKey] ?? (row.fetchError ? fetchErrorLabel : null);
}

function RowTooltip({ label, children }: { label: string | null; children: ReactElement }) {
  if (label === null) {
    return children;
  }

  return (
    <TooltipProvider>
      <AppTooltip label={label} side="top" align="start">
        {children}
      </AppTooltip>
    </TooltipProvider>
  );
}

// The checkbox sits in a fixed slot before the row button, so the button keeps its position and is not remounted when selection mode toggles.
export function SubscriptionsListRow({
  row,
  selected,
  kept,
  keptChipLabel,
  bulkSelection,
  statusLabels,
  reasonTooltipLabels,
  fetchErrorLabel,
  formatUnreadCountLabel,
  latestArticleLabels,
  onSelectFeed,
}: SubscriptionsListRowProps) {
  const selecting = bulkSelection?.mode === true;
  const statusChip = resolveStatusChip(row, statusLabels, fetchErrorLabel);
  const rowButton = (
    <button
      type="button"
      aria-pressed={selected}
      aria-current={selected ? "page" : undefined}
      onClick={() => onSelectFeed(row.feed.id)}
      className={rowButtonVariants({ selected })}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 @[28rem]:grid-cols-[auto_minmax(0,1fr)_8.5rem_5.5rem]">
        <span
          className={cn(
            "row-span-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border shadow-[inset_0_1px_0_rgba(255,255,255,0.32)] transition-[background-color,border-color] duration-200 ease-standard motion-reduce:transition-none @[28rem]:row-span-1",
            selected ? "bg-surface-1 text-foreground" : "bg-surface-2/88 text-foreground",
          )}
          style={{
            borderColor: "var(--subscriptions-list-divider)",
            backgroundColor: selected
              ? "var(--subscriptions-list-favicon-surface)"
              : "var(--subscriptions-list-favicon-surface-muted)",
          }}
        >
          <FeedFavicon
            title={row.feed.title}
            url={row.feed.url}
            siteUrl={row.feed.site_url}
            iconUrl={row.feed.icon_url}
            size="md"
          />
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="min-w-0 max-w-full truncate text-[0.95rem] font-semibold tracking-[-0.02em] text-foreground">
            {row.feed.title}
          </span>
          <SubscriptionRowChips statusChip={statusChip} keptChipLabel={kept ? keptChipLabel : null} />
        </div>
        <div className="flex items-baseline gap-3 @[28rem]:contents">
          <LatestArticleCell row={row} labels={latestArticleLabels} />
          <span className={META_CELL_CLASS_NAME}>{formatUnreadCountLabel(row.feed.unread_count)}</span>
        </div>
      </div>
    </button>
  );
  const reasonTooltipLabel = resolveReasonTooltipLabel(row, reasonTooltipLabels, fetchErrorLabel);

  return (
    <>
      {bulkSelection && selecting ? (
        <Checkbox
          checked={bulkSelection.checkedFeedIds.has(row.feed.id)}
          aria-label={bulkSelection.labels.rowSelectAria(row.feed.title)}
          onCheckedChange={() => bulkSelection.onToggleFeed(row.feed.id)}
        />
      ) : null}
      <RowTooltip label={reasonTooltipLabel}>{rowButton}</RowTooltip>
    </>
  );
}
