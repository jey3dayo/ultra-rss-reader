import { Minus } from "lucide-react";
import { type RefObject, useId } from "react";
import { MOTION_BULK_ACTION_BAR_ENTER_CLASS_NAME } from "@/constants/motion";
import { Button, Checkbox, DeleteButton } from "@/design-system";

export type SubscriptionsBulkSelection = {
  mode: boolean;
  checkedFeedIds: ReadonlySet<string>;
  keptFeedIds: ReadonlySet<string>;
  checkedCount: number;
  hiddenCheckedCount: number;
  allVisibleCheckState: "none" | "some" | "all";
  skippedKeptCount: number;
  toggleButtonRef: RefObject<HTMLButtonElement | null>;
  labels: {
    start: string;
    end: string;
    selectAllVisible: (count: number) => string;
    selectAllVisibleAria: string;
    skippedKept: (count: number) => string;
    rowSelectAria: (title: string) => string;
    keptChip: string;
    selectedCount: (count: number) => string;
    selectedCountHidden: (count: number, hiddenCount: number) => string;
    unsubscribeAction: string;
  };
  onStart: () => void;
  onEnd: () => void;
  onToggleFeed: (feedId: string) => void;
  onToggleAllVisible: () => void;
  onRequestUnsubscribe: () => void;
};

type SubscriptionsBulkSelectAllRowProps = {
  bulkSelection: SubscriptionsBulkSelection;
  visibleRowCount: number;
};

export function SubscriptionsBulkSelectAllRow({ bulkSelection, visibleRowCount }: SubscriptionsBulkSelectAllRowProps) {
  const { allVisibleCheckState, skippedKeptCount, labels } = bulkSelection;
  const checkboxId = useId();

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-9 pt-1">
      <label
        htmlFor={checkboxId}
        className="flex min-h-9 min-w-0 cursor-pointer items-center gap-2 text-[0.88rem] font-medium text-foreground"
      >
        <Checkbox
          id={checkboxId}
          checked={allVisibleCheckState === "all"}
          indeterminate={allVisibleCheckState === "some"}
          aria-label={labels.selectAllVisibleAria}
          onCheckedChange={bulkSelection.onToggleAllVisible}
          className="data-[indeterminate]:border-state-success-border data-[indeterminate]:bg-state-success-surface data-[indeterminate]:text-state-success-foreground"
        >
          {allVisibleCheckState === "some" ? <Minus className="size-3.5" strokeWidth={2.4} /> : undefined}
        </Checkbox>
        <span className="min-w-0 tabular-nums">{labels.selectAllVisible(visibleRowCount)}</span>
      </label>
      {skippedKeptCount > 0 ? (
        <span className="text-(length:--font-size-2xs) text-foreground-soft">
          {labels.skippedKept(skippedKeptCount)}
        </span>
      ) : null}
    </div>
  );
}

export function SubscriptionsBulkActionBar({ bulkSelection }: { bulkSelection: SubscriptionsBulkSelection }) {
  const { checkedCount, hiddenCheckedCount, labels } = bulkSelection;

  return (
    <div
      className={`${MOTION_BULK_ACTION_BAR_ENTER_CLASS_NAME} sticky bottom-0 z-10 mt-3 flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-md border border-[var(--workspace-low-wire-section-border)] bg-[var(--workspace-low-wire-action-surface)] px-3.5 py-2.5 backdrop-blur-sm lg:static`}
    >
      <p role="status" className="min-w-0 text-sm font-medium tabular-nums text-foreground">
        {hiddenCheckedCount > 0
          ? labels.selectedCountHidden(checkedCount, hiddenCheckedCount)
          : labels.selectedCount(checkedCount)}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="outline" onClick={bulkSelection.onEnd} className="min-h-11">
          {labels.end}
        </Button>
        <DeleteButton
          type="button"
          disabled={checkedCount === 0}
          onClick={bulkSelection.onRequestUnsubscribe}
          className="min-h-11"
        >
          {labels.unsubscribeAction}
        </DeleteButton>
      </div>
    </div>
  );
}
