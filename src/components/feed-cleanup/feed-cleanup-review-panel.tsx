import { DeleteButton } from "@/components/shared/delete-button";
import { Button } from "@/components/ui/button";
import type { FeedCleanupTone } from "@/lib/feed-cleanup";
import { cn } from "@/lib/utils";
import { FeedCleanupCard, FeedCleanupDetailRow } from "./feed-cleanup-card";
import type { FeedCleanupReviewPanelProps } from "./feed-cleanup.types";

function formatDate(value: string | null, locale: string): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function resolveToneClassName(tone: FeedCleanupTone | null) {
  if (tone === "high") {
    return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100";
  }

  if (tone === "medium") {
    return "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100";
  }

  return "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100";
}

export function FeedCleanupReviewPanel({
  reviewLabel,
  integrityMode,
  dateLocale,
  integrityEmptyLabel,
  selectedIntegrityIssue,
  integrityDetailLabels,
  selectedCandidate,
  selectedSummary,
  folderLabel,
  latestArticleLabel,
  unreadCountLabel,
  starredCountLabel,
  reasonsLabel,
  noSelectionLabel,
  reasonLabels,
  priorityToneLabels,
  priorityLabels,
  summaryHeadlineLabels,
  summaryLabels,
  editing,
  editor,
  reviewPanelClassName,
  editLabel,
  keepLabel,
  laterLabel,
  deleteLabel,
  onEdit,
  onKeep,
  onLater,
  onDelete,
}: FeedCleanupReviewPanelProps) {
  const toneClassName = resolveToneClassName(selectedSummary?.tone ?? null);

  return (
    <section
      data-testid="feed-cleanup-review-panel"
      className={cn("flex min-h-0 flex-col px-5 py-4", reviewPanelClassName)}
    >
      <h3 className="mb-3 text-sm font-semibold">{reviewLabel}</h3>
      {integrityMode ? (
        selectedIntegrityIssue ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                <p className="text-xs font-medium uppercase tracking-[0.16em] opacity-70">
                  {integrityDetailLabels.needs_repair_badge}
                </p>
                <h4 className="mt-1 text-base font-semibold text-current">{integrityDetailLabels.needs_repair}</h4>
                <p className="mt-3 text-sm text-current/80">{integrityDetailLabels.summary}</p>
              </div>

              <FeedCleanupCard>
                <h4 className="text-base font-semibold">
                  {`${integrityDetailLabels.queue_item_title}: ${selectedIntegrityIssue.missing_feed_id}`}
                </h4>
                <dl className="mt-4 grid gap-2 text-sm">
                  <FeedCleanupDetailRow
                    label={integrityDetailLabels.missing_feed_id}
                    value={selectedIntegrityIssue.missing_feed_id}
                  />
                  <FeedCleanupDetailRow
                    label={integrityDetailLabels.article_count}
                    value={selectedIntegrityIssue.article_count}
                  />
                  <FeedCleanupDetailRow
                    label={integrityDetailLabels.latest_article}
                    value={selectedIntegrityIssue.latest_article_title ?? integrityDetailLabels.unknown_article}
                  />
                  <FeedCleanupDetailRow
                    label={integrityDetailLabels.latest_published_at}
                    value={formatDate(selectedIntegrityIssue.latest_article_published_at, dateLocale)}
                  />
                </dl>
              </FeedCleanupCard>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            {integrityEmptyLabel}
          </p>
        )
      ) : selectedCandidate && editing ? (
        editor
      ) : selectedCandidate ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {selectedSummary ? (
              <div className={cn("rounded-2xl border px-4 py-4", toneClassName)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.16em] opacity-70">
                      {priorityLabels[selectedSummary.titleKey]}
                    </p>
                    <h4 className="mt-1 text-base font-semibold text-current">
                      {summaryHeadlineLabels[selectedSummary.titleKey]}
                    </h4>
                  </div>
                  <span className="rounded-full border border-current/15 px-2.5 py-1 text-[11px] font-medium text-current">
                    {priorityToneLabels[selectedSummary.tone]}
                  </span>
                </div>
                <p className="mt-3 text-sm text-current/80">{summaryLabels[selectedSummary.summaryKey]}</p>
              </div>
            ) : null}

            <FeedCleanupCard>
              <h4 className="text-base font-semibold">{selectedCandidate.title}</h4>
              <dl className="mt-4 grid gap-2 text-sm">
                <FeedCleanupDetailRow label={folderLabel} value={selectedCandidate.folderName ?? "—"} />
                <FeedCleanupDetailRow
                  label={latestArticleLabel}
                  value={formatDate(selectedCandidate.latestArticleAt, dateLocale)}
                />
                <FeedCleanupDetailRow label={unreadCountLabel} value={selectedCandidate.unreadCount} />
                <FeedCleanupDetailRow label={starredCountLabel} value={selectedCandidate.starredCount} />
              </dl>
            </FeedCleanupCard>

            <FeedCleanupCard>
              <h4 className="mb-2 text-sm font-semibold">{reasonsLabel}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {selectedCandidate.reasonKeys.map((reason) => (
                  <li key={reason}>{reasonLabels[reason]}</li>
                ))}
              </ul>
            </FeedCleanupCard>
          </div>

          <div className="border-t border-border/70 pt-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={onEdit}>
                {editLabel}
              </Button>
              <Button variant="outline" onClick={onKeep}>
                {keepLabel}
              </Button>
              <Button variant="secondary" onClick={onLater}>
                {laterLabel}
              </Button>
              <DeleteButton onClick={onDelete}>{deleteLabel}</DeleteButton>
            </div>
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          {noSelectionLabel}
        </p>
      )}
    </section>
  );
}
