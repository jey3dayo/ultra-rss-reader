import { cn } from "cn";
import { ChevronDown, Folder } from "lucide-react";
import { MOTION_DATA_STATE_ATTRIBUTE, MOTION_STATE_CLOSED, MOTION_STATE_OPEN } from "@/constants/motion";
import type { SubscriptionListGroup, SubscriptionListRow } from "@/lib/subscriptions/subscriptions-index.types";
import type { SubscriptionsBulkSelection } from "./subscriptions-bulk-selection";
import {
  type SubscriptionsActionableStatusLabels,
  type SubscriptionsKeptMarker,
  type SubscriptionsLatestArticleLabels,
  SubscriptionsListRow,
} from "./subscriptions-list-row";

// Rows keep one layout in both modes: the selection checkbox overlays the row card,
// so toggling selection never shifts the cards.
const SUBSCRIPTION_ROWS_CLASS_NAME = "space-y-1.5 pl-9 pt-1";

type SubscriptionGroupDisclosureButtonProps = {
  group: SubscriptionListGroup;
  expanded: boolean;
  controlsId: string;
  onToggleGroup: (groupKey: string) => void;
};

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

type SubscriptionGroupSectionProps = {
  group: SubscriptionListGroup;
  expanded: boolean;
  selectedFeedId: string | null;
  kept?: SubscriptionsKeptMarker;
  bulkSelection?: SubscriptionsBulkSelection;
  statusLabels: SubscriptionsActionableStatusLabels;
  reasonTooltipLabels: Partial<Record<NonNullable<SubscriptionListRow["reasonTooltipKey"]>, string>>;
  fetchErrorLabel: string;
  remoteFetchFailureLabel: string;
  formatUnreadCountLabel: (count: number) => string;
  latestArticleLabels: SubscriptionsLatestArticleLabels;
  onSelectFeed: (feedId: string) => void;
  onToggleGroup: (groupKey: string) => void;
};

export function SubscriptionGroupSection({
  group,
  expanded,
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
            className={SUBSCRIPTION_ROWS_CLASS_NAME}
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
