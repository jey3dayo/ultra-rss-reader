import { cn } from "cn";
import { AppTooltip, Checkbox, FeedFavicon, LabelChip, NavRowButton, TooltipProvider } from "@/design-system";
import type { SubscriptionListRow } from "@/lib/subscriptions/subscriptions-index.types";
import type { SubscriptionsBulkSelection } from "./subscriptions-bulk-selection";

type SubscriptionsListRowProps = {
  row: SubscriptionListRow;
  selected: boolean;
  bulkSelection?: SubscriptionsBulkSelection;
  statusLabels: Record<SubscriptionListRow["status"]["labelKey"], string>;
  reasonTooltipLabels: Partial<Record<NonNullable<SubscriptionListRow["reasonTooltipKey"]>, string>>;
  fetchErrorLabel: string;
  formatUnreadCountLabel: (count: number) => string;
  formatLatestArticleLabel: (value: string | null) => string;
  onSelectFeed: (feedId: string) => void;
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

// The checkbox sits in a fixed slot before the row button, so the button keeps its position and is not remounted when selection mode toggles.
export function SubscriptionsListRow({
  row,
  selected,
  bulkSelection,
  statusLabels,
  reasonTooltipLabels,
  fetchErrorLabel,
  formatUnreadCountLabel,
  formatLatestArticleLabel,
  onSelectFeed,
}: SubscriptionsListRowProps) {
  const selecting = bulkSelection?.mode === true;
  const rowButton = (
    <NavRowButton
      selected={selected}
      aria-pressed={selected}
      onClick={() => onSelectFeed(row.feed.id)}
      className={cn(
        "motion-list-item-enter motion-static-hover-surface items-center rounded-md border border-transparent px-3.5 py-3.5 shadow-none",
        selected
          ? "border-[color:var(--subscriptions-list-row-selected-border)] bg-[color:var(--subscriptions-list-row-selected-surface)] shadow-[var(--subscriptions-list-row-selected-shadow)]"
          : "bg-surface-1/36 hover:border-[color:var(--subscriptions-list-divider)] hover:bg-[color:var(--subscriptions-list-row-hover)]",
      )}
      leading={
        <span
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border shadow-[inset_0_1px_0_rgba(255,255,255,0.32)] transition-[background-color,border-color] duration-200 ease-standard motion-reduce:transition-none",
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
      }
      title={
        <div className="flex items-center gap-2">
          <span className="text-[0.95rem] font-semibold tracking-[-0.02em] text-foreground">{row.feed.title}</span>
        </div>
      }
      description={
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-(length:--font-size-2xs) text-foreground-soft">
          <LabelChip tone={row.fetchError ? "danger" : resolveStatusTone(row.status.labelKey)} size="compact">
            {row.fetchError ? fetchErrorLabel : statusLabels[row.status.labelKey]}
          </LabelChip>
          {bulkSelection && selecting && bulkSelection.keptFeedIds.has(row.feed.id) ? (
            <LabelChip tone="neutral" size="compact">
              {bulkSelection.labels.keptChip}
            </LabelChip>
          ) : null}
          <span
            aria-hidden="true"
            style={{
              color: "var(--subscriptions-list-meta-divider)",
            }}
          >
            •
          </span>
          <span>{formatUnreadCountLabel(row.feed.unread_count)}</span>
          <span
            aria-hidden="true"
            style={{
              color: "var(--subscriptions-list-meta-divider)",
            }}
          >
            •
          </span>
          <span>{formatLatestArticleLabel(row.latestArticleAt)}</span>
        </div>
      }
    />
  );
  const reasonTooltipLabel = row.reasonTooltipKey
    ? (reasonTooltipLabels[row.reasonTooltipKey] ?? (row.fetchError ? fetchErrorLabel : null))
    : null;

  return (
    <>
      {bulkSelection && selecting ? (
        <Checkbox
          checked={bulkSelection.checkedFeedIds.has(row.feed.id)}
          aria-label={bulkSelection.labels.rowSelectAria(row.feed.title)}
          onCheckedChange={() => bulkSelection.onToggleFeed(row.feed.id)}
        />
      ) : null}
      {reasonTooltipLabel ? (
        <TooltipProvider>
          <AppTooltip label={reasonTooltipLabel} side="top" align="start">
            {rowButton}
          </AppTooltip>
        </TooltipProvider>
      ) : (
        rowButton
      )}
    </>
  );
}
