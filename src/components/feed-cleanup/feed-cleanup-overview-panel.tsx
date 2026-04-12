import { Button } from "@/components/ui/button";
import type { FeedCleanupIntegrityDetailLabels } from "./feed-cleanup-review-panel";

export type FeedCleanupFilterOption = {
  key: "stale_90d" | "no_unread" | "no_stars";
  label: string;
};

export type FeedCleanupSummaryCard = {
  label: string;
  value: string;
  caption: string;
};

type FeedCleanupOverviewPanelProps = {
  overviewLabel: string;
  filtersLabel: string;
  bulkActionsLabel: string;
  bulkVisibleCountLabel: string;
  bulkKeepVisibleLabel: string;
  bulkDeferVisibleLabel: string;
  summaryCards: ReadonlyArray<FeedCleanupSummaryCard>;
  integrityMode: boolean;
  integrityDetailLabels: FeedCleanupIntegrityDetailLabels;
  filterOptions: ReadonlyArray<FeedCleanupFilterOption>;
  filterCounts: Record<FeedCleanupFilterOption["key"], number>;
  activeFilterKeys: Set<FeedCleanupFilterOption["key"]>;
  visibleCandidateCount: number;
  showDeferred: boolean;
  showDeferredLabel: string;
  onToggleFilter: (key: FeedCleanupFilterOption["key"]) => void;
  onToggleShowDeferred: () => void;
  onKeepVisible: () => void;
  onDeferVisible: () => void;
};

export function FeedCleanupOverviewPanel({
  overviewLabel,
  filtersLabel,
  bulkActionsLabel,
  bulkVisibleCountLabel,
  bulkKeepVisibleLabel,
  bulkDeferVisibleLabel,
  summaryCards,
  integrityMode,
  integrityDetailLabels,
  filterOptions,
  filterCounts,
  activeFilterKeys,
  visibleCandidateCount,
  showDeferred,
  showDeferredLabel,
  onToggleFilter,
  onToggleShowDeferred,
  onKeepVisible,
  onDeferVisible,
}: FeedCleanupOverviewPanelProps) {
  return (
    <section className="min-h-0 border-b border-border bg-sidebar/60 px-4 py-4 lg:border-r lg:border-b-0">
      <h3 className="mb-3 text-sm font-semibold">{overviewLabel}</h3>
      <div
        data-testid="feed-cleanup-sidebar-summary"
        className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-border/70 bg-card/70 p-2"
      >
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border/70 bg-background/80 px-3 py-2 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{card.label}</p>
            <div className="mt-1.5 flex items-baseline justify-between gap-2">
              <span className="text-lg font-semibold text-foreground">{card.value}</span>
              <span className="text-[11px] text-muted-foreground">{card.caption}</span>
            </div>
          </div>
        ))}
      </div>

      <h3 className="mb-3 text-sm font-semibold">{filtersLabel}</h3>
      {integrityMode ? (
        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          {integrityDetailLabels.filter_note}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((filter) => (
              <Button
                key={filter.key}
                variant={activeFilterKeys.has(filter.key) ? "secondary" : "ghost"}
                className="justify-between rounded-full border px-3"
                aria-label={`${filter.label} ${filterCounts[filter.key]}`}
                onClick={() => onToggleFilter(filter.key)}
              >
                <span>{filter.label}</span>
                <span className="rounded-full bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {filterCounts[filter.key]}
                </span>
              </Button>
            ))}
            <Button
              variant={showDeferred ? "secondary" : "ghost"}
              className="w-full justify-start rounded-full border px-3"
              onClick={onToggleShowDeferred}
            >
              {showDeferredLabel}
            </Button>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/70 px-3 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {bulkActionsLabel}
              </p>
              <span className="text-[11px] text-muted-foreground">{bulkVisibleCountLabel}</span>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                disabled={visibleCandidateCount === 0}
                onClick={onKeepVisible}
              >
                {bulkKeepVisibleLabel}
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                disabled={visibleCandidateCount === 0}
                onClick={onDeferVisible}
              >
                {bulkDeferVisibleLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
