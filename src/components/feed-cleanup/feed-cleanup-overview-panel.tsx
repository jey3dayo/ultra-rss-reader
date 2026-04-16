import { Check, Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ControlChipButton } from "@/components/shared/control-chip-button";
import { DecisionButton } from "@/components/shared/decision-button";
import { LabelChip } from "@/components/shared/label-chip";
import { SurfaceCard } from "@/components/shared/surface-card";
import type { FeedCleanupOverviewPanelProps } from "./feed-cleanup.types";

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
  const { t } = useTranslation("cleanup");

  return (
    <section
      className="border-b border-border/70 px-4 py-4 sm:px-6"
      style={{ backgroundColor: "var(--cleanup-summary-surface)" }}
    >
      <h2 className="sr-only">{overviewLabel}</h2>
      <div className="space-y-4">
        <div data-testid="feed-cleanup-sidebar-summary" className="flex flex-wrap items-center gap-4">
          {summaryCards.map((card) => (
            <SurfaceCard
              key={`${card.label}-${card.caption}`}
              variant="section"
              tone="default"
              padding="compact"
              className="flex items-center gap-4 border-border/70 bg-surface-1 shadow-none"
            >
              <span className="inline-flex min-w-12 justify-center rounded-md border border-border/70 bg-surface-1/72 px-3 py-2 font-sans text-2xl font-medium text-foreground">
                {card.value}
              </span>
              <div>
                <p className="font-sans text-base text-foreground">{card.label}</p>
                <p className="font-serif text-sm text-muted-foreground">{card.caption}</p>
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
          <div className="space-y-3">
            {visibleCandidateCount > 0 ? (
              <SurfaceCard
                data-testid="feed-cleanup-bulk-actions"
                variant="section"
                tone="emphasis"
                padding="default"
                className="flex flex-wrap items-center justify-between gap-3 shadow-none"
              >
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
              </SurfaceCard>
            ) : null}

            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="sr-only">{filtersLabel}</legend>
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
                  <LabelChip tone="muted" size="compact">
                    {visibleCandidateCount}
                  </LabelChip>
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
                    <LabelChip tone="muted" size="compact">
                      {filterCounts[filter.key]}
                    </LabelChip>
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
            </fieldset>
          </div>
        )}
      </div>
    </section>
  );
}
