import { Check, Clock3, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ControlChipButton } from "@/components/shared/control-chip-button";
import { DecisionButton, denseDecisionButtonClassName } from "@/components/shared/decision-button";
import { LabelChip } from "@/components/shared/label-chip";
import { SurfaceCard } from "@/components/shared/surface-card";
import type { FeedCleanupOverviewPanelProps } from "./feed-cleanup.types";

export function FeedCleanupOverviewPanel({
  overviewLabel,
  filtersLabel,
  bulkActionsLabel,
  bulkVisibleCountLabel,
  allCandidateCount,
  bulkKeepVisibleLabel,
  bulkDeferVisibleLabel,
  bulkDeleteVisibleLabel,
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
  onDeleteVisible,
}: FeedCleanupOverviewPanelProps) {
  const { t } = useTranslation("cleanup");
  const bulkActionsDisabled = visibleCandidateCount === 0;

  return (
    <section
      className="border-b border-border/55 px-4 py-5 sm:px-6 sm:py-5"
      style={{ backgroundColor: "var(--cleanup-summary-surface)" }}
    >
      <h2 className="sr-only">{overviewLabel}</h2>
      <div className="space-y-4">
        <div data-testid="feed-cleanup-sidebar-summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
          {summaryCards.map((card) => (
            <SurfaceCard
              key={`${card.label}-${card.caption}`}
              variant="section"
              tone="emphasis"
              padding="compact"
              className="flex items-center gap-3 border-border/50 shadow-none"
            >
              <span className="inline-flex min-w-10 justify-center rounded-md border border-border/60 bg-surface-1/68 px-2.5 py-2 font-sans text-[1.75rem] font-medium text-foreground">
                {card.value}
              </span>
              <div>
                <p className="font-sans text-[0.95rem] text-foreground">{card.label}</p>
                <p className="font-serif text-sm text-foreground-soft">{card.caption}</p>
              </div>
            </SurfaceCard>
          ))}
        </div>

        {integrityMode ? (
          <SurfaceCard
            variant="section"
            tone="default"
            padding="compact"
            className="border-state-warning-border bg-state-warning-surface text-sm text-state-warning-foreground shadow-none"
          >
            {integrityDetailLabels.filter_note}
          </SurfaceCard>
        ) : (
          <SurfaceCard
            data-testid="feed-cleanup-bulk-actions"
            variant="section"
            tone="default"
            padding="default"
            className="border-border/55 shadow-none"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-sans text-sm font-medium text-foreground">{filtersLabel}</p>
                  <p className="font-serif text-sm text-foreground-soft">{bulkVisibleCountLabel}</p>
                </div>
                <fieldset className="m-0 min-w-0 border-0 p-0">
                  <legend className="sr-only">{filtersLabel}</legend>
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-0">
                    <div data-testid="feed-cleanup-all-filter" className="shrink-0">
                      <ControlChipButton
                        pressed={activeFilterKeys.size === 0}
                        size="comfortable"
                        className="gap-2 rounded-md px-3.5"
                        onClick={() => {
                          filterOptions.forEach((filter) => {
                            if (activeFilterKeys.has(filter.key)) {
                              onToggleFilter(filter.key);
                            }
                          });
                        }}
                      >
                        <span>{t("all_candidates")}</span>
                        <LabelChip tone="neutral" size="compact" className="rounded-sm px-1.5">
                          {allCandidateCount}
                        </LabelChip>
                      </ControlChipButton>
                    </div>
                    <div aria-hidden="true" className="hidden h-7 w-px shrink-0 bg-border/65 sm:mx-3.5 sm:block" />
                    <div
                      data-testid="feed-cleanup-secondary-filters"
                      className="flex min-w-0 flex-wrap gap-2 sm:flex-1 sm:items-center"
                    >
                      {filterOptions.map((filter) => (
                        <ControlChipButton
                          key={filter.key}
                          pressed={activeFilterKeys.has(filter.key)}
                          size="comfortable"
                          className="gap-2 rounded-md px-3.5"
                          aria-label={`${filter.label} ${filterCounts[filter.key]}`}
                          onClick={() => onToggleFilter(filter.key)}
                        >
                          <span>{filter.label}</span>
                          <LabelChip tone="neutral" size="compact" className="rounded-sm px-1.5">
                            {filterCounts[filter.key]}
                          </LabelChip>
                        </ControlChipButton>
                      ))}
                      <ControlChipButton
                        pressed={showDeferred}
                        size="comfortable"
                        className="rounded-md px-3.5"
                        onClick={onToggleShowDeferred}
                      >
                        {showDeferredLabel}
                      </ControlChipButton>
                    </div>
                  </div>
                </fieldset>
              </div>
              <div className="flex min-h-[4.25rem] min-w-0 flex-col justify-between gap-2 lg:min-w-[18rem] lg:items-end">
                <p className="font-sans text-sm font-medium text-foreground">{bulkActionsLabel}</p>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <DecisionButton
                    intent="keep"
                    aria-label={bulkKeepVisibleLabel}
                    onClick={onKeepVisible}
                    disabled={bulkActionsDisabled}
                    className={denseDecisionButtonClassName}
                  >
                    <Check className="h-4 w-4" />
                    {bulkKeepVisibleLabel}
                  </DecisionButton>
                  <DecisionButton
                    intent="defer"
                    aria-label={bulkDeferVisibleLabel}
                    onClick={onDeferVisible}
                    disabled={bulkActionsDisabled}
                    className={denseDecisionButtonClassName}
                  >
                    <Clock3 className="h-4 w-4" />
                    {bulkDeferVisibleLabel}
                  </DecisionButton>
                  <DecisionButton
                    intent="delete"
                    aria-label={bulkDeleteVisibleLabel}
                    onClick={onDeleteVisible}
                    disabled={bulkActionsDisabled}
                    className={denseDecisionButtonClassName}
                  >
                    <Trash2 className="h-4 w-4" />
                    {bulkDeleteVisibleLabel}
                  </DecisionButton>
                </div>
              </div>
            </div>
          </SurfaceCard>
        )}
      </div>
    </section>
  );
}
