import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import { Button } from "@/design-system";
import type { SubscriptionsFilterBarProps } from "./subscriptions-filter-bar";

type SubscriptionsListEmptyStateProps = {
  emptyLabel: string;
  filterBar?: SubscriptionsFilterBarProps;
  searchQuery: string;
  searchClearLabel: string;
  emptyShowAllLabel?: string;
  addFeedLabel?: string;
  onAddFeed?: () => void;
  onSearchQueryChange: (query: string) => void;
};

export function SubscriptionsListEmptyState({
  emptyLabel,
  filterBar,
  searchQuery,
  searchClearLabel,
  emptyShowAllLabel,
  addFeedLabel,
  onAddFeed,
  onSearchQueryChange,
}: SubscriptionsListEmptyStateProps) {
  const description = filterBar?.model.activeDescription;
  const activeFilterKey = filterBar?.model.options.find((option) => option.isActive)?.filterKey ?? "all";
  const showAllAction = activeFilterKey !== "all" && emptyShowAllLabel && filterBar ? filterBar : null;
  const showAddFeedAction = Boolean(addFeedLabel && onAddFeed);
  const hasActions = searchQuery.length > 0 || showAllAction !== null || showAddFeedAction;

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
          {showAddFeedAction ? (
            <Button
              type="button"
              variant="outline"
              onClick={onAddFeed}
              className="min-h-11 hover:bg-[color:var(--subscriptions-list-row-hover)]"
            >
              {addFeedLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
