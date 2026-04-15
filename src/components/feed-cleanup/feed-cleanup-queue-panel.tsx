import { Check, Clock3, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FeedCleanupTone } from "@/lib/feed-cleanup";
import { buildCleanupReasonFacts, summarizeCleanupCandidate } from "@/lib/feed-cleanup";
import { cn } from "@/lib/utils";
import type { FeedCleanupQueuePanelProps } from "./feed-cleanup.types";

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
}: FeedCleanupQueuePanelProps) {
  const { t } = useTranslation("cleanup");
  const resolvePriorityClassName = (tone: FeedCleanupTone) => {
    if (tone === "high") {
      return "bg-rose-100 text-rose-900 dark:bg-rose-500/15 dark:text-rose-100";
    }

    if (tone === "medium") {
      return "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100";
    }

    return "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100";
  };

  return (
    <section className="min-h-0 px-4 py-4 sm:px-6 sm:py-5 lg:border-r lg:border-border/70">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{integrityMode ? integrityQueueLabel : queueLabel}</h3>
        {!integrityMode ? (
          <span className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
            {queue.length}
          </span>
        ) : null}
      </div>
      {!integrityMode && bulkBarVisible ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-3">
          <div className="flex items-center gap-3 text-sm font-medium text-foreground">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-border/70 bg-background/80">
              <Check className="h-3.5 w-3.5" />
            </span>
            <span>{selectedCountLabel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label={bulkKeepActionLabel}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-600"
              onClick={onKeepSelection}
            >
              <Check className="h-4 w-4" />
              {keepLabel}
            </button>
            <button
              type="button"
              aria-label={bulkDeferActionLabel}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-700"
              onClick={onDeferSelection}
            >
              <Clock3 className="h-4 w-4" />
              {deferredLabel}
            </button>
            <button
              type="button"
              aria-label={bulkDeleteActionLabel}
              className="inline-flex items-center gap-2 rounded-xl bg-red-950/90 px-3 py-2 text-sm font-medium text-red-100 transition-colors hover:bg-red-900"
              onClick={onDeleteSelection}
            >
              <Trash2 className="h-4 w-4" />
              {deleteLabel}
            </button>
          </div>
        </div>
      ) : null}
      <div data-testid="feed-cleanup-queue-list" className="space-y-3 pr-1 lg:h-[calc(100%-2rem)] lg:overflow-y-auto">
        {integrityMode ? (
          integrityIssues.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
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
                  "flex w-full cursor-pointer flex-col gap-2 rounded-2xl border px-4 py-3 text-left transition-colors",
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
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          queue.map((candidate) => {
            const queueSummary = summarizeCleanupCandidate(candidate);
            const reasonFacts = buildCleanupReasonFacts(candidate);
            const isSelected = selectedFeedIds.has(candidate.feedId);
            const isFocused = focusedFeedId === candidate.feedId;
            const isCurrent = selectedCandidate?.feedId === candidate.feedId;
            return (
              <div
                key={candidate.feedId}
                data-testid={`feed-cleanup-queue-row-${candidate.feedId}`}
                data-selected={isSelected}
                data-focused={isFocused}
                className={cn(
                  "rounded-xl border px-3 py-3 transition-colors duration-150",
                  isCurrent || isSelected ? "border-border/70 bg-card/75" : "border-border/60 bg-transparent",
                  isFocused && "ring-1 ring-primary/30",
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label
                    data-testid={`feed-cleanup-selection-hit-area-${candidate.feedId}`}
                    className="-m-2 inline-flex rounded-full p-2"
                  >
                    <input
                      type="checkbox"
                      aria-label={`${selectCandidateLabel} ${candidate.title}`}
                      aria-checked={isSelected}
                      checked={isSelected}
                      onChange={() => onToggleCandidateSelection(candidate.feedId)}
                      className="peer sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-6 w-6 rounded-full border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30",
                        isSelected
                          ? "border-primary bg-primary shadow-[inset_0_0_0_4px_hsl(var(--primary-foreground))]"
                          : "border-border bg-background",
                      )}
                    />
                  </label>
                  <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] text-muted-foreground">
                    {candidate.deferred ? (
                      <span className="rounded-full border border-border bg-background px-2 py-0.5">
                        {deferredLabel}
                      </span>
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
                          <span className="line-clamp-1 font-medium text-foreground">{candidate.title}</span>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                            <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5">
                              {candidate.folderName ?? "—"}
                            </span>
                            <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5">
                              {candidate.unreadCount} {unreadCountLabel}
                            </span>
                            <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5">
                              {candidate.starredCount} {starredCountLabel}
                            </span>
                          </div>
                        </div>
                        <div
                          data-testid={`feed-cleanup-queue-card-status-${candidate.feedId}`}
                          className="flex flex-wrap items-start gap-1.5 sm:shrink-0 sm:flex-col sm:items-end sm:gap-1"
                        >
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[11px] font-medium",
                              resolvePriorityClassName(queueSummary.tone),
                            )}
                          >
                            {priorityToneLabels[queueSummary.tone]}
                          </span>
                          {candidate.deferred ? (
                            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                              {deferredBadgeLabel}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {candidate.reasonKeys.map((reasonKey) => (
                        <span
                          key={reasonKey}
                          className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-foreground"
                        >
                          {reasonLabels[reasonKey]}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {reasonFacts.slice(0, 2).map((fact) => (
                        <span
                          key={fact.key}
                          className="rounded-full border border-border/80 bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {fact.key === "stale_days"
                            ? t("fact_stale_days", { count: fact.value })
                            : fact.key === "unread_count"
                              ? t("fact_unread_count", { count: fact.value })
                              : t("fact_starred_count", { count: fact.value })}
                        </span>
                      ))}
                      {reasonFacts.length > 2 ? (
                        <span className="rounded-full border border-border/80 bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground">
                          +{reasonFacts.length - 2}
                        </span>
                      ) : null}
                      {reasonFacts.length === 0 && selectedCandidate?.feedId !== candidate.feedId ? (
                        <span className="rounded-full border border-border/80 bg-background/80 px-2 py-0.5 text-[11px] text-muted-foreground">
                          {summaryLabels.healthy_feed}
                        </span>
                      ) : null}
                    </div>
                    {selectedCandidate?.feedId === candidate.feedId ? (
                      <p className="text-sm leading-6 text-muted-foreground">
                        {summaryLabels[queueSummary.summaryKey]}
                      </p>
                    ) : null}
                  </button>
                  {isSelected || selectedCandidate?.feedId === candidate.feedId ? (
                    <div className="flex flex-wrap items-center gap-2 lg:flex-shrink-0">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600/90 px-3 py-2 text-sm font-medium text-emerald-50 transition-colors hover:bg-emerald-500"
                        onClick={(event) => {
                          event.stopPropagation();
                          onKeepCandidate(candidate.feedId);
                        }}
                      >
                        <Check className="h-4 w-4" />
                        {keepLabel}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-xl bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-zinc-700"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeferCandidate(candidate.feedId);
                        }}
                      >
                        <Clock3 className="h-4 w-4" />
                        {deferredLabel}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-xl bg-red-950/90 px-3 py-2 text-sm font-medium text-red-100 transition-colors hover:bg-red-900"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteCandidate(candidate.feedId);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        {deleteLabel}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
