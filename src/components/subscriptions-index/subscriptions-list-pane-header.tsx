import { Plus, Search } from "lucide-react";
import type { RefObject } from "react";
import { Button, Input } from "@/design-system";
import { type SubscriptionsBulkRunStatus, SubscriptionsBulkRunStatusView } from "./subscriptions-bulk-run-status";
import type { SubscriptionsBulkSelection } from "./subscriptions-bulk-selection";
import { SubscriptionsFilterBar, type SubscriptionsFilterBarProps } from "./subscriptions-filter-bar";

type SubscriptionsListPaneHeaderProps = {
  heading: string;
  headingId: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  searchQuery: string;
  searchLabel: string;
  searchPlaceholder: string;
  addFeedLabel?: string;
  onAddFeed?: () => void;
  filterBar?: SubscriptionsFilterBarProps;
  bulkSelection?: SubscriptionsBulkSelection;
  bulkRunStatus?: SubscriptionsBulkRunStatus | null;
  bulkToggleDisabled: boolean;
  onSearchQueryChange: (query: string) => void;
};

export function SubscriptionsListPaneHeader({
  heading,
  headingId,
  headingRef,
  searchQuery,
  searchLabel,
  searchPlaceholder,
  addFeedLabel,
  onAddFeed,
  filterBar,
  bulkSelection,
  bulkRunStatus,
  bulkToggleDisabled,
  onSearchQueryChange,
}: SubscriptionsListPaneHeaderProps) {
  const selecting = bulkSelection?.mode === true;
  const addFeedButton =
    addFeedLabel && onAddFeed ? (
      <Button type="button" variant="default" onClick={onAddFeed} className="min-h-11 shrink-0">
        <Plus aria-hidden="true" className="size-4" />
        {addFeedLabel}
      </Button>
    ) : null;
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
    <div className="mb-4 flex flex-col gap-3 border-b border-border/55 pb-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2
          ref={headingRef}
          tabIndex={-1}
          id={headingId}
          className="min-w-[4rem] truncate font-sans text-[1.08rem] font-semibold tracking-[-0.025em] text-foreground"
        >
          {heading}
        </h2>
        {bulkSelection ? (
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1 sm:justify-end">
            {searchField}
            <Button
              ref={bulkSelection.toggleButtonRef}
              type="button"
              variant="outline"
              disabled={bulkToggleDisabled}
              onClick={selecting ? bulkSelection.onEnd : bulkSelection.onStart}
              className="min-h-11 shrink-0"
            >
              {selecting ? bulkSelection.labels.end : bulkSelection.labels.start}
            </Button>
            {addFeedButton}
          </div>
        ) : addFeedButton ? (
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1 sm:justify-end">
            {searchField}
            {addFeedButton}
          </div>
        ) : (
          searchField
        )}
      </div>
      {bulkRunStatus ? <SubscriptionsBulkRunStatusView status={bulkRunStatus} /> : null}
      {filterBar ? <SubscriptionsFilterBar {...filterBar} /> : null}
    </div>
  );
}
