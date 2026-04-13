import { DeleteButton } from "@/components/shared/delete-button";
import { Button } from "@/components/ui/button";
import type { FeedCleanupTone } from "@/lib/feed-cleanup";
import { cn } from "@/lib/utils";
import type { FeedCleanupReviewPanelProps } from "./feed-cleanup.types";
import { FeedCleanupCard, FeedCleanupDetailRow } from "./feed-cleanup-card";

function ShortcutBadge({ label }: { label: string }) {
  return (
    <span aria-hidden="true">
      <kbd className="rounded-md border border-border/80 bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
        {label}
      </kbd>
    </span>
  );
}

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
  currentStatusLabel = "Current status",
  currentStatusValue = "Review",
  deferLabel,
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
}: FeedCleanupReviewPanelProps) {
  const toneClassName = resolveToneClassName(selectedSummary?.tone ?? null);
  const resolvedDeferLabel = deferLabel ?? laterLabel;

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
            <div className="rounded-2xl border border-border/80 bg-card/70 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                    Feed console
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-foreground">{selectedCandidate.title}</h4>
                </div>
              </div>
            </div>

            {selectedSummary ? (
              <div className={cn("rounded-2xl border px-4 py-4", toneClassName)}>
                <div
                  data-testid="feed-cleanup-review-summary-header"
                  className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                >
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
            <div data-testid="feed-cleanup-review-actions" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <div className="flex w-full flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/80 px-3 py-2 sm:w-auto">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                    {currentStatusLabel}
                  </span>
                  <span
                    data-testid="feed-cleanup-current-status-value"
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground"
                  >
                    {currentStatusValue}
                  </span>
                </div>
                <div className="inline-flex rounded-full border border-border bg-background p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-pressed={currentStatusValue === keepLabel}
                    className={cn(
                      "rounded-full px-3",
                      currentStatusValue === keepLabel && "bg-primary text-primary-foreground hover:bg-primary/90",
                    )}
                    onClick={onKeep}
                  >
                    {keepLabel}
                    <ShortcutBadge label={keyboardHints.keepKeys} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-pressed={currentStatusValue === resolvedDeferLabel}
                    className={cn(
                      "rounded-full px-3",
                      currentStatusValue === resolvedDeferLabel &&
                        "bg-secondary text-secondary-foreground hover:bg-secondary/90",
                    )}
                    onClick={onLater}
                  >
                    {resolvedDeferLabel}
                    <ShortcutBadge label={keyboardHints.deferKeys} />
                  </Button>
                </div>
              </div>
              <DeleteButton className="w-full justify-center sm:w-auto" onClick={onDelete}>
                {deleteLabel}
                <ShortcutBadge label={keyboardHints.deleteKeys} />
              </DeleteButton>
              <Button variant="ghost" className="w-full justify-center sm:w-auto" onClick={onEdit}>
                {editLabel}
              </Button>
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
