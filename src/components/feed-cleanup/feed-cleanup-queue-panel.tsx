import { summarizeCleanupCandidate } from "@/lib/feed-cleanup";
import { cn } from "@/lib/utils";
import type { FeedCleanupQueuePanelProps } from "./feed-cleanup.types";

function ShortcutBadge({ label }: { label: string }) {
  return (
    <span aria-hidden="true">
      <kbd className="rounded-md border border-border/80 bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
        {label}
      </kbd>
    </span>
  );
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
  selectedStateLabel = "Selected",
  focusedStateLabel = "Focused",
  reviewStatusLabel = "Review",
  deferredLabel = "Deferred",
  keepLabel = "Keep",
  deleteLabel = "Delete",
  onKeepSelection = () => {},
  onDeferSelection = () => {},
  onDeleteSelection = () => {},
  bulkSelectionScopeLabel = "Selected set",
  bulkKeepActionLabel = "Keep selected",
  bulkDeferActionLabel = "Defer selected",
  bulkDeleteActionLabel = "Delete selected",
  keyboardHints = {
    moveLabel: "Move",
    moveKeys: "J / K",
    selectLabel: "Select",
    selectKeys: "Space",
    reviewLabel: "Review",
    reviewKeys: "Enter",
    keepKeys: "Shift+K",
    deferKeys: "L",
    deleteKeys: "D",
  },
  unreadCountLabel,
  starredCountLabel,
  deferredBadgeLabel,
  reasonLabels,
  priorityToneLabels,
  summaryLabels,
}: FeedCleanupQueuePanelProps) {
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-3 py-2 shadow-[0_14px_30px_-24px_hsl(var(--primary)/0.65)]">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">{selectedCountLabel}</span>
            <span className="text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
              {bulkSelectionScopeLabel}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label={bulkKeepActionLabel}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              onClick={onKeepSelection}
            >
              {keepLabel}
              <ShortcutBadge label={keyboardHints.keepKeys} />
            </button>
            <button
              type="button"
              aria-label={bulkDeferActionLabel}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground"
              onClick={onDeferSelection}
            >
              {deferredLabel}
              <ShortcutBadge label={keyboardHints.deferKeys} />
            </button>
            <button
              type="button"
              aria-label={bulkDeleteActionLabel}
              className="inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive"
              onClick={onDeleteSelection}
            >
              {deleteLabel}
              <ShortcutBadge label={keyboardHints.deleteKeys} />
            </button>
          </div>
        </div>
      ) : null}
      {!integrityMode ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span>{keyboardHints.moveLabel}</span>
          <ShortcutBadge label={keyboardHints.moveKeys} />
          <span>{keyboardHints.selectLabel}</span>
          <ShortcutBadge label={keyboardHints.selectKeys} />
          <span>{keyboardHints.reviewLabel}</span>
          <ShortcutBadge label={keyboardHints.reviewKeys} />
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
            const isSelected = selectedFeedIds.has(candidate.feedId);
            const isFocused = focusedFeedId === candidate.feedId;
            const statusLabel = candidate.deferred ? deferredLabel : reviewStatusLabel;
            return (
              <div
                key={candidate.feedId}
                data-testid={`feed-cleanup-queue-row-${candidate.feedId}`}
                data-selected={isSelected}
                data-focused={isFocused}
                className={cn(
                  "rounded-3xl border px-4 py-4 transition-[border-color,background-color,box-shadow] duration-200",
                  selectedCandidate?.feedId === candidate.feedId
                    ? "border-primary/40 bg-primary/5"
                    : "border-border/80 bg-card/60",
                  isFocused && "shadow-[0_0_0_1px_hsl(var(--primary)/0.55),0_0_0_4px_hsl(var(--primary)/0.12)]",
                  isSelected && "border-primary/45 bg-primary/[0.08]",
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
                    {isSelected ? (
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-primary">
                        {selectedStateLabel}
                      </span>
                    ) : null}
                    {isFocused ? (
                      <span className="rounded-full border border-border bg-background px-2 py-0.5">
                        {focusedStateLabel}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-border bg-background px-2 py-0.5">{statusLabel}</span>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={candidate.title}
                  onClick={() => onSelectCandidate(candidate.feedId)}
                  className="flex w-full cursor-pointer flex-col gap-3 text-left"
                >
                  <div
                    data-testid={`feed-cleanup-queue-card-header-${candidate.feedId}`}
                    className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <span className="line-clamp-1 font-medium text-foreground">{candidate.title}</span>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1">
                          {candidate.folderName ?? "—"}
                        </span>
                        <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1">
                          {candidate.unreadCount} {unreadCountLabel.toLowerCase()}
                        </span>
                        <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1">
                          {candidate.starredCount} {starredCountLabel.toLowerCase()}
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
                          queueSummary.tone === "high"
                            ? "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100"
                            : queueSummary.tone === "medium"
                              ? "bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-100"
                              : "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100",
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
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.reasonKeys.slice(0, 2).map((reason) => (
                      <span
                        key={reason}
                        className="rounded-full border border-border/80 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground"
                      >
                        {reasonLabels[reason]}
                      </span>
                    ))}
                    {candidate.reasonKeys.length > 2 ? (
                      <span className="rounded-full border border-border/80 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground">
                        +{candidate.reasonKeys.length - 2}
                      </span>
                    ) : null}
                    {candidate.reasonKeys.length === 0 && selectedCandidate?.feedId !== candidate.feedId ? (
                      <span className="rounded-full border border-border/80 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground">
                        {summaryLabels.healthy_feed}
                      </span>
                    ) : null}
                  </div>
                  {selectedCandidate?.feedId === candidate.feedId ? (
                    <p className="text-sm leading-6 text-muted-foreground">{summaryLabels[queueSummary.summaryKey]}</p>
                  ) : null}
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
