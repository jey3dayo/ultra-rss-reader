import { Check, Clock3, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DecisionButton } from "@/components/shared/decision-button";
import { LabelChip } from "@/components/shared/label-chip";
import { SurfaceCard } from "@/components/shared/surface-card";
import { Checkbox } from "@/components/ui/checkbox";
import type { FeedCleanupTone } from "@/lib/feed-cleanup";
import { buildCleanupReasonFacts, summarizeCleanupCandidate } from "@/lib/feed-cleanup";
import { cn } from "@/lib/utils";
import type { FeedCleanupQueuePanelProps } from "./feed-cleanup.types";

function resolvePriorityTone(tone: FeedCleanupTone) {
  if (tone === "high") {
    return "danger";
  }

  if (tone === "medium") {
    return "warning";
  }

  return "success";
}

export function FeedCleanupQueuePanel({
  integrityMode,
  queueLabel,
  integrityQueueLabel,
  integrityEmptyLabel,
  integrityIssues,
  selectedIntegrityIssue,
  integrityDetailLabels,
  onSelectIntegrityIssue,
  emptyLabel,
  queue,
  selectedCandidate,
  selectedFeedIds = new Set<string>(),
  focusedFeedId = null,
  onSelectCandidate,
  onToggleCandidateSelection = onSelectCandidate,
  bulkBarVisible = false,
  selectedCountLabel = "",
  selectCandidateLabel = "Select candidate",
  deferredLabel = "Deferred",
  keepLabel = "Keep",
  deleteLabel = "Delete",
  onKeepSelection = () => {},
  onDeferSelection = () => {},
  onDeleteSelection = () => {},
  onKeepCandidate = onSelectCandidate,
  onDeferCandidate = onSelectCandidate,
  onDeleteCandidate = onSelectCandidate,
  bulkKeepActionLabel = "Keep selected",
  bulkDeferActionLabel = "Defer selected",
  bulkDeleteActionLabel = "Delete selected",
  unreadCountLabel,
  starredCountLabel,
  deferredBadgeLabel,
  reasonLabels,
  priorityToneLabels,
  summaryLabels,
  queueListClassName = "min-h-0 flex-1 space-y-3 overflow-y-auto pr-1",
}: FeedCleanupQueuePanelProps) {
  const { t } = useTranslation("cleanup");

  return (
    <section className="flex h-full min-h-0 flex-col px-4 py-4 sm:px-6 sm:py-5 lg:border-r lg:border-border/70">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-sans text-sm font-medium tracking-[0.02em]">
          {integrityMode ? integrityQueueLabel : queueLabel}
        </h3>
        {!integrityMode ? (
          <span className="font-sans text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
            {queue.length}
          </span>
        ) : null}
      </div>
      {!integrityMode && bulkBarVisible ? (
        <SurfaceCard
          variant="section"
          tone="subtle"
          padding="compact"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md shadow-none"
        >
          <div className="flex items-center gap-3 text-sm font-medium text-foreground">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-[var(--radius-md)] border border-border/70 bg-surface-1/80">
              <Check className="h-3.5 w-3.5" />
            </span>
            <span>{selectedCountLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DecisionButton intent="keep" aria-label={bulkKeepActionLabel} onClick={onKeepSelection}>
              <Check className="h-4 w-4" />
              {keepLabel}
            </DecisionButton>
            <DecisionButton intent="defer" aria-label={bulkDeferActionLabel} onClick={onDeferSelection}>
              <Clock3 className="h-4 w-4" />
              {deferredLabel}
            </DecisionButton>
            <DecisionButton intent="delete" aria-label={bulkDeleteActionLabel} onClick={onDeleteSelection}>
              <Trash2 className="h-4 w-4" />
              {deleteLabel}
            </DecisionButton>
          </div>
        </SurfaceCard>
      ) : null}
      <div data-testid="feed-cleanup-queue-list" className={queueListClassName}>
        {integrityMode ? (
          integrityIssues.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
              {integrityEmptyLabel}
            </p>
          ) : (
            integrityIssues.map((issue) => (
              <button
                key={issue.missing_feed_id}
                type="button"
                aria-label={`${integrityDetailLabels.queue_item_title}: ${issue.missing_feed_id}`}
                onClick={() => onSelectIntegrityIssue(issue.missing_feed_id)}
                className={cn(
                  "flex w-full cursor-pointer flex-col gap-2 rounded-md border px-4 py-3 text-left transition-colors",
                  selectedIntegrityIssue?.missing_feed_id === issue.missing_feed_id
                    ? "border-amber-500/50 bg-amber-500/10"
                    : "border-border bg-card hover:bg-muted/60",
                )}
              >
                <span className="line-clamp-1 font-medium text-foreground">
                  {`${integrityDetailLabels.queue_item_title}: ${issue.missing_feed_id}`}
                </span>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span>{issue.article_count}</span>
                  <span>{integrityDetailLabels.queue_item_articles_label}</span>
                  <span>·</span>
                  <span>{issue.latest_article_title ?? integrityDetailLabels.unknown_article}</span>
                </div>
              </button>
            ))
          )
        ) : queue.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          queue.map((candidate) => {
            const queueSummary = summarizeCleanupCandidate(candidate);
            const reasonFacts = buildCleanupReasonFacts(candidate);
            const isSelected = selectedFeedIds.has(candidate.feedId);
            const isFocused = focusedFeedId === candidate.feedId;
            const isCurrent = selectedCandidate?.feedId === candidate.feedId;
            const checkboxId = `feed-cleanup-checkbox-${candidate.feedId}`;

            return (
              <SurfaceCard
                key={candidate.feedId}
                data-testid={`feed-cleanup-queue-row-${candidate.feedId}`}
                data-selected={isSelected}
                data-focused={isFocused}
                variant="section"
                tone={isCurrent || isSelected ? "default" : "subtle"}
                padding="compact"
                className={cn(
                  "rounded-md transition-colors duration-150",
                  isCurrent || isSelected
                    ? "border-border-strong bg-card/56 shadow-none"
                    : "border-border/55 bg-background/28 shadow-none",
                  isFocused && "ring-1 ring-primary/30",
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label
                    data-testid={`feed-cleanup-selection-hit-area-${candidate.feedId}`}
                    htmlFor={checkboxId}
                    className="-m-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-lg)] p-2"
                  >
                    <Checkbox
                      id={checkboxId}
                      aria-label={`${selectCandidateLabel} ${candidate.title}`}
                      checked={isSelected}
                      onCheckedChange={() => onToggleCandidateSelection(candidate.feedId)}
                    />
                  </label>
                  <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-muted-foreground">
                    {candidate.deferred ? (
                      <LabelChip tone="muted" size="compact">
                        {deferredLabel}
                      </LabelChip>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <button
                    type="button"
                    aria-label={candidate.title}
                    onClick={() => onSelectCandidate(candidate.feedId)}
                    className="flex min-w-0 flex-1 cursor-pointer flex-col gap-2.5 text-left"
                  >
                    <div
                      data-testid={`feed-cleanup-queue-card-header-${candidate.feedId}`}
                      className="flex flex-col gap-2.5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <span className="line-clamp-1 font-sans font-medium text-foreground">{candidate.title}</span>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                            <LabelChip tone="muted" size="compact">
                              {candidate.folderName ?? "—"}
                            </LabelChip>
                            <LabelChip tone="muted" size="compact">
                              {candidate.unreadCount} {unreadCountLabel}
                            </LabelChip>
                            <LabelChip tone="muted" size="compact">
                              {candidate.starredCount} {starredCountLabel}
                            </LabelChip>
                          </div>
                        </div>
                        <div
                          data-testid={`feed-cleanup-queue-card-status-${candidate.feedId}`}
                          className="flex flex-wrap items-start gap-1.5 sm:shrink-0 sm:flex-col sm:items-end sm:gap-1"
                        >
                          <LabelChip tone={resolvePriorityTone(queueSummary.tone)}>
                            {priorityToneLabels[queueSummary.tone]}
                          </LabelChip>
                          {candidate.deferred ? (
                            <LabelChip tone="muted" size="compact">
                              {deferredBadgeLabel}
                            </LabelChip>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {candidate.reasonKeys.map((reasonKey) => (
                        <LabelChip key={reasonKey} tone="warning" size="compact">
                          {reasonLabels[reasonKey]}
                        </LabelChip>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {reasonFacts.slice(0, 2).map((fact) => (
                        <LabelChip key={fact.key} tone="muted" size="compact">
                          {fact.key === "stale_days"
                            ? t("fact_stale_days", { count: fact.value })
                            : fact.key === "unread_count"
                              ? t("fact_unread_count", { count: fact.value })
                              : t("fact_starred_count", { count: fact.value })}
                        </LabelChip>
                      ))}
                      {reasonFacts.length > 2 ? (
                        <LabelChip tone="muted" size="compact">
                          +{reasonFacts.length - 2}
                        </LabelChip>
                      ) : null}
                      {reasonFacts.length === 0 && selectedCandidate?.feedId !== candidate.feedId ? (
                        <LabelChip tone="muted" size="compact">
                          {summaryLabels.healthy_feed}
                        </LabelChip>
                      ) : null}
                    </div>
                    {selectedCandidate?.feedId === candidate.feedId ? (
                      <p className="font-serif text-sm leading-6 text-muted-foreground">
                        {summaryLabels[queueSummary.summaryKey]}
                      </p>
                    ) : null}
                  </button>
                  {isSelected || selectedCandidate?.feedId === candidate.feedId ? (
                    <div className="flex flex-wrap items-center gap-2 lg:flex-shrink-0">
                      <DecisionButton
                        intent="keep"
                        onClick={(event) => {
                          event.stopPropagation();
                          onKeepCandidate(candidate.feedId);
                        }}
                      >
                        <Check className="h-4 w-4" />
                        {keepLabel}
                      </DecisionButton>
                      <DecisionButton
                        intent="defer"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeferCandidate(candidate.feedId);
                        }}
                      >
                        <Clock3 className="h-4 w-4" />
                        {deferredLabel}
                      </DecisionButton>
                      <DecisionButton
                        intent="delete"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteCandidate(candidate.feedId);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        {deleteLabel}
                      </DecisionButton>
                    </div>
                  ) : null}
                </div>
              </SurfaceCard>
            );
          })
        )}
      </div>
    </section>
  );
}
