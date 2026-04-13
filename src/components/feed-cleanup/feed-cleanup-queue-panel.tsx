import { summarizeCleanupCandidate } from "@/lib/feed-cleanup";
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
  onSelectCandidate,
  unreadCountLabel,
  starredCountLabel,
  deferredBadgeLabel,
  reasonLabels,
  priorityToneLabels,
  summaryLabels,
}: FeedCleanupQueuePanelProps) {
  return (
    <section className="min-h-0 border-b border-border px-4 py-4 lg:border-r lg:border-b-0">
      <h3 className="mb-3 text-sm font-semibold">{integrityMode ? integrityQueueLabel : queueLabel}</h3>
      <div data-testid="feed-cleanup-queue-list" className="space-y-2 pr-1 lg:h-[calc(100%-2rem)] lg:overflow-y-auto">
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
            return (
              <button
                key={candidate.feedId}
                type="button"
                aria-label={candidate.title}
                onClick={() => onSelectCandidate(candidate.feedId)}
                className={cn(
                  "flex w-full cursor-pointer flex-col gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                  selectedCandidate?.feedId === candidate.feedId
                    ? "border-primary/60 bg-primary/10"
                    : "border-border bg-card hover:bg-muted/60",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="line-clamp-1 font-medium text-foreground">{candidate.title}</span>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span>{candidate.folderName ?? "—"}</span>
                      <span>·</span>
                      <span>{candidate.staleDays ?? 0}d</span>
                      <span>·</span>
                      <span>
                        {candidate.unreadCount} {unreadCountLabel.toLowerCase()}
                      </span>
                      <span>·</span>
                      <span>
                        {candidate.starredCount} {starredCountLabel.toLowerCase()}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
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
                  {candidate.reasonKeys.map((reason) => (
                    <span
                      key={reason}
                      className="rounded-full border border-border/80 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground"
                    >
                      {reasonLabels[reason]}
                    </span>
                  ))}
                  {candidate.reasonKeys.length === 0 ? (
                    <span className="rounded-full border border-border/80 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground">
                      {summaryLabels.healthy_feed}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
