import { Check, Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ControlChipButton } from "@/components/shared/control-chip-button";
import { DecisionButton } from "@/components/shared/decision-button";
import type { FeedCleanupOverviewPanelProps } from "./feed-cleanup.types";

export function FeedCleanupOverviewPanel({
  overviewLabel,
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
  const { t } = useTranslation("cleanup");
  const pendingCard = summaryCards[0];
  const decidedCard = summaryCards[1];

  return (
    <section className="border-b border-border/70 bg-background/95 px-4 py-4 sm:px-6">
      <h2 className="sr-only">{overviewLabel}</h2>
      <div className="space-y-4">
        <div data-testid="feed-cleanup-sidebar-summary" className="flex flex-wrap items-center gap-6">
          {pendingCard ? (
            <div className="flex items-center gap-4 rounded-[24px] border border-border/60 bg-card/52 px-4 py-3 shadow-elevation-1">
              <span className="inline-flex min-w-12 justify-center rounded-lg border border-border/70 bg-background px-3 py-2 font-sans text-2xl font-medium text-foreground">
                {pendingCard.value}
              </span>
              <div>
                <p className="font-sans text-base text-foreground">{pendingCard.label}</p>
                <p className="font-serif text-sm text-muted-foreground">{pendingCard.caption}</p>
              </div>
            </div>
          ) : null}
          {decidedCard ? (
            <div className="flex items-center gap-4 rounded-[24px] border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 shadow-elevation-1">
              <span className="inline-flex min-w-12 justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 font-sans text-2xl font-medium text-emerald-700 dark:text-emerald-300">
                {decidedCard.value}
              </span>
              <div>
                <p className="font-sans text-base text-foreground">{decidedCard.label}</p>
                <p className="font-serif text-sm text-muted-foreground">{decidedCard.caption}</p>
              </div>
            </div>
          ) : null}
        </div>

        {integrityMode ? (
          <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            {integrityDetailLabels.filter_note}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleCandidateCount > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/65 bg-card/55 px-3.5 py-3 shadow-elevation-1">
                <div className="min-w-0">
                  <p className="font-sans text-sm font-medium text-foreground">{bulkActionsLabel}</p>
                  <p className="font-serif text-sm text-muted-foreground">{bulkVisibleCountLabel}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <DecisionButton intent="keep" aria-label={bulkKeepVisibleLabel} onClick={onKeepVisible}>
                    <Check className="h-4 w-4" />
                    {bulkKeepVisibleLabel}
                  </DecisionButton>
                  <DecisionButton intent="defer" aria-label={bulkDeferVisibleLabel} onClick={onDeferVisible}>
                    <Clock3 className="h-4 w-4" />
                    {bulkDeferVisibleLabel}
                  </DecisionButton>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <ControlChipButton
                pressed={activeFilterKeys.size === 0}
                size="comfortable"
                className="gap-2 px-3.5"
                onClick={() => {
                  filterOptions.forEach((filter) => {
                    if (activeFilterKeys.has(filter.key)) {
                      onToggleFilter(filter.key);
                    }
                  });
                }}
              >
                <span>{t("all_candidates")}</span>
                <span className="rounded-full bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground dark:bg-background/70">
                  {pendingCard?.value ?? "0"}
                </span>
              </ControlChipButton>
              {filterOptions.map((filter) => (
                <ControlChipButton
                  key={filter.key}
                  pressed={activeFilterKeys.has(filter.key)}
                  size="comfortable"
                  className="gap-2 px-3.5"
                  aria-label={`${filter.label} ${filterCounts[filter.key]}`}
                  onClick={() => onToggleFilter(filter.key)}
                >
                  <span>{filter.label}</span>
                  <span className="rounded-full bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground dark:bg-background/70">
                    {filterCounts[filter.key]}
                  </span>
                </ControlChipButton>
              ))}
              <ControlChipButton
                pressed={showDeferred}
                size="comfortable"
                className="px-3.5"
                onClick={onToggleShowDeferred}
              >
                {showDeferredLabel}
              </ControlChipButton>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
