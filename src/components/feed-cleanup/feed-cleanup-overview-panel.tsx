import { Button } from "@/components/ui/button";
import type { FeedCleanupOverviewPanelProps } from "./feed-cleanup.types";
import { FeedCleanupCard } from "./feed-cleanup-card";

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
    <section className="border-b border-border/70 bg-gradient-to-b from-card/60 to-background/90">
      <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
          <div className="space-y-1 pt-1">
            <h3 className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">{overviewLabel}</h3>
          </div>
          <div
            data-testid="feed-cleanup-sidebar-summary"
            className="grid w-full gap-2 sm:grid-cols-2 lg:flex-1 lg:grid-cols-4"
          >
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-border/60 bg-background/80 px-3.5 py-3 backdrop-blur-sm"
              >
                <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  {card.label}
                </p>
                <span className="mt-2 block text-[1.75rem] font-semibold leading-none tracking-tight text-foreground">
                  {card.value}
                </span>
                <p className="mt-1.5 line-clamp-1 text-[11px] leading-4 text-muted-foreground">{card.caption}</p>
              </div>
            ))}
          </div>
        </div>

        {integrityMode ? (
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            {integrityDetailLabels.filter_note}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
            <FeedCleanupCard className="rounded-2xl border-border/70 bg-card/55 px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">{filtersLabel}</p>
                <span className="text-[11px] text-muted-foreground">{bulkVisibleCountLabel}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
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
                  className="justify-start rounded-full border px-3"
                  onClick={onToggleShowDeferred}
                >
                  {showDeferredLabel}
                </Button>
              </div>
            </FeedCleanupCard>

            <FeedCleanupCard className="rounded-2xl border-border/70 bg-card/55 px-4 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  {bulkActionsLabel}
                </p>
                <span className="text-[11px] text-muted-foreground">{bulkVisibleCountLabel}</span>
              </div>
              <div className="mt-3 flex flex-col gap-2">
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
            </FeedCleanupCard>
          </div>
        )}
      </div>
    </section>
  );
}
