import { type ReactNode, useEffect, useRef, useState } from "react";
import type { FeedIntegrityIssueDto } from "@/api/schemas/feed-integrity";
import { DeleteButton } from "@/components/shared/delete-button";
import { Button } from "@/components/ui/button";
import type {
  FeedCleanupCandidate,
  FeedCleanupReasonKey,
  FeedCleanupSummaryKey,
  FeedCleanupTitleKey,
  FeedCleanupTone,
} from "@/lib/feed-cleanup";
import { summarizeCleanupCandidate } from "@/lib/feed-cleanup";
import { cn } from "@/lib/utils";

type FilterOption = {
  key: "stale_90d" | "no_unread" | "no_stars";
  label: string;
};

const FEED_CLEANUP_COMPACT_THREE_COLUMN_WIDTH = 980;
const FEED_CLEANUP_WIDE_THREE_COLUMN_WIDTH = 1180;

function resolveFeedCleanupLayoutWidth(measuredWidth: number | null): number {
  if (measuredWidth != null && measuredWidth > 0) {
    return measuredWidth;
  }

  if (typeof window === "undefined") {
    return 0;
  }

  return window.innerWidth >= 1024 ? Math.max(window.innerWidth - 280, 0) : window.innerWidth;
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

export function FeedCleanupPageView({
  title,
  subtitle,
  closeLabel,
  dateLocale,
  overviewLabel,
  filtersLabel,
  queueLabel,
  reviewLabel,
  summaryCards,
  integrityIssue,
  integrityMode,
  integrityQueueLabel,
  integrityEmptyLabel,
  integrityIssues,
  selectedIntegrityIssue,
  integrityDetailLabels,
  filterOptions,
  filterCounts,
  activeFilterKeys,
  queue,
  selectedCandidate,
  selectedSummary,
  showDeferred,
  showDeferredLabel,
  emptyLabel,
  keepLabel,
  laterLabel,
  deleteLabel,
  editLabel,
  folderLabel,
  latestArticleLabel,
  unreadCountLabel,
  starredCountLabel,
  reasonsLabel,
  noSelectionLabel,
  deferredBadgeLabel,
  reasonLabels,
  priorityLabels,
  summaryHeadlineLabels,
  summaryLabels,
  editing,
  editor,
  onClose,
  onToggleIntegrityMode,
  onToggleFilter,
  onToggleShowDeferred,
  onSelectCandidate,
  onSelectIntegrityIssue,
  onEdit,
  onKeep,
  onLater,
  onDelete,
}: {
  title: string;
  subtitle: string;
  closeLabel: string;
  dateLocale: string;
  overviewLabel: string;
  filtersLabel: string;
  queueLabel: string;
  reviewLabel: string;
  summaryCards: ReadonlyArray<{
    label: string;
    value: string;
    caption: string;
  }>;
  integrityIssue: {
    title: string;
    body: string;
    actionLabel: string;
  } | null;
  integrityMode: boolean;
  integrityQueueLabel: string;
  integrityEmptyLabel: string;
  integrityIssues: FeedIntegrityIssueDto[];
  selectedIntegrityIssue: FeedIntegrityIssueDto | null;
  integrityDetailLabels: {
    missing_feed_id: string;
    article_count: string;
    latest_article: string;
    latest_published_at: string;
    needs_repair: string;
    needs_repair_badge: string;
    summary: string;
    unknown_article: string;
    queue_item_title: string;
    queue_item_articles_label: string;
    filter_note: string;
  };
  filterOptions: FilterOption[];
  filterCounts: Record<FilterOption["key"], number>;
  activeFilterKeys: Set<FilterOption["key"]>;
  queue: Array<FeedCleanupCandidate & { deferred?: boolean }>;
  selectedCandidate: (FeedCleanupCandidate & { deferred?: boolean }) | null;
  selectedSummary: {
    tone: FeedCleanupTone;
    titleKey: FeedCleanupTitleKey;
    summaryKey: FeedCleanupSummaryKey;
  } | null;
  showDeferred: boolean;
  showDeferredLabel: string;
  emptyLabel: string;
  keepLabel: string;
  laterLabel: string;
  deleteLabel: string;
  editLabel: string;
  folderLabel: string;
  latestArticleLabel: string;
  unreadCountLabel: string;
  starredCountLabel: string;
  reasonsLabel: string;
  noSelectionLabel: string;
  deferredBadgeLabel: string;
  reasonLabels: Record<FeedCleanupReasonKey, string>;
  priorityLabels: Record<FeedCleanupTitleKey, string>;
  summaryHeadlineLabels: Record<FeedCleanupTitleKey, string>;
  summaryLabels: Record<FeedCleanupSummaryKey, string>;
  editing: boolean;
  editor: ReactNode;
  onClose: () => void;
  onToggleIntegrityMode: () => void;
  onToggleFilter: (key: FilterOption["key"]) => void;
  onToggleShowDeferred: () => void;
  onSelectCandidate: (candidateId: string) => void;
  onSelectIntegrityIssue: (missingFeedId: string) => void;
  onEdit: () => void;
  onKeep: () => void;
  onLater: () => void;
  onDelete: () => void;
}) {
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const [layoutWidth, setLayoutWidth] = useState(() => resolveFeedCleanupLayoutWidth(null));
  const toneClassName =
    selectedSummary?.tone === "high"
      ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
      : selectedSummary?.tone === "medium"
        ? "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100"
        : "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100";

  useEffect(() => {
    const updateLayoutWidth = () => {
      setLayoutWidth(resolveFeedCleanupLayoutWidth(layoutRef.current?.getBoundingClientRect().width ?? null));
    };

    updateLayoutWidth();

    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            updateLayoutWidth();
          });

    if (layoutRef.current && observer) {
      observer.observe(layoutRef.current);
    }

    window.addEventListener("resize", updateLayoutWidth);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateLayoutWidth);
    };
  }, []);

  const layoutMode =
    layoutWidth >= FEED_CLEANUP_WIDE_THREE_COLUMN_WIDTH
      ? "three-wide"
      : layoutWidth >= FEED_CLEANUP_COMPACT_THREE_COLUMN_WIDTH
        ? "three-compact"
        : "two-column";

  const layoutClassName =
    layoutMode === "three-wide"
      ? "grid-cols-[260px_minmax(0,1fr)_320px] overflow-hidden"
      : layoutMode === "three-compact"
        ? "grid-cols-[220px_minmax(0,1fr)_300px] overflow-hidden"
        : "overflow-y-auto lg:grid-cols-[240px_minmax(280px,1fr)]";

  const reviewPanelClassName =
    layoutMode === "two-column"
      ? "lg:col-span-2"
      : "col-span-1 sticky top-4 max-h-[calc(100dvh-7.5rem)] self-start overflow-hidden";

  return (
    <div
      data-testid="feed-cleanup-page"
      className="flex h-dvh max-h-dvh min-h-0 flex-1 flex-col overflow-hidden bg-background"
    >
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <Button variant="ghost" onClick={onClose}>
            {closeLabel}
          </Button>
        </div>
      </div>

      {integrityIssue ? (
        <div className="border-b border-border bg-amber-50/70 px-6 py-3 text-amber-950 dark:bg-amber-500/10 dark:text-amber-100">
          <div className="rounded-2xl border border-amber-200/80 bg-background/80 px-4 py-3 dark:border-amber-500/30 dark:bg-background/20">
            <p className="text-sm font-semibold">{integrityIssue.title}</p>
            <p className="mt-1 text-sm opacity-80">{integrityIssue.body}</p>
            <Button variant="outline" className="mt-3" onClick={onToggleIntegrityMode}>
              {integrityIssue.actionLabel}
            </Button>
          </div>
        </div>
      ) : null}

      <div
        ref={layoutRef}
        data-testid="feed-cleanup-layout"
        className={cn("grid min-h-0 flex-1 gap-0", layoutClassName)}
      >
        <section className="min-h-0 border-b border-border bg-sidebar/60 px-4 py-4 lg:border-r lg:border-b-0">
          <h3 className="mb-3 text-sm font-semibold">{overviewLabel}</h3>
          <div
            data-testid="feed-cleanup-sidebar-summary"
            className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-border/70 bg-card/70 p-2"
          >
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-xl border border-border/70 bg-background/80 px-3 py-2 shadow-sm">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {card.label}
                </p>
                <div className="mt-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-lg font-semibold text-foreground">{card.value}</span>
                  <span className="text-[11px] text-muted-foreground">{card.caption}</span>
                </div>
              </div>
            ))}
          </div>

          <h3 className="mb-3 text-sm font-semibold">{filtersLabel}</h3>
          {integrityMode ? (
            <div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              {integrityDetailLabels.filter_note}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
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
                className="w-full justify-start rounded-full border px-3"
                onClick={onToggleShowDeferred}
              >
                {showDeferredLabel}
              </Button>
            </div>
          )}
        </section>

        <section className="min-h-0 border-b border-border px-4 py-4 lg:border-r lg:border-b-0">
          <h3 className="mb-3 text-sm font-semibold">{integrityMode ? integrityQueueLabel : queueLabel}</h3>
          <div className="h-[calc(100%-2rem)] space-y-2 overflow-y-auto pr-1">
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
                          {priorityLabels[queueSummary.titleKey]}
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

                  <div className="rounded-xl border border-border bg-card px-4 py-4">
                    <h4 className="text-base font-semibold">
                      {`${integrityDetailLabels.queue_item_title}: ${selectedIntegrityIssue.missing_feed_id}`}
                    </h4>
                    <dl className="mt-4 grid gap-2 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground">{integrityDetailLabels.missing_feed_id}</dt>
                        <dd>{selectedIntegrityIssue.missing_feed_id}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground">{integrityDetailLabels.article_count}</dt>
                        <dd>{selectedIntegrityIssue.article_count}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground">{integrityDetailLabels.latest_article}</dt>
                        <dd>{selectedIntegrityIssue.latest_article_title ?? integrityDetailLabels.unknown_article}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-muted-foreground">{integrityDetailLabels.latest_published_at}</dt>
                        <dd>{formatDate(selectedIntegrityIssue.latest_article_published_at, dateLocale)}</dd>
                      </div>
                    </dl>
                  </div>
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
                        {priorityLabels[selectedSummary.titleKey]}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-current/80">{summaryLabels[selectedSummary.summaryKey]}</p>
                  </div>
                ) : null}

                <div className="rounded-xl border border-border bg-card px-4 py-4">
                  <h4 className="text-base font-semibold">{selectedCandidate.title}</h4>
                  <dl className="mt-4 grid gap-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">{folderLabel}</dt>
                      <dd>{selectedCandidate.folderName ?? "—"}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">{latestArticleLabel}</dt>
                      <dd>{formatDate(selectedCandidate.latestArticleAt, dateLocale)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">{unreadCountLabel}</dt>
                      <dd>{selectedCandidate.unreadCount}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">{starredCountLabel}</dt>
                      <dd>{selectedCandidate.starredCount}</dd>
                    </div>
                  </dl>
                </div>

                <div className="rounded-xl border border-border bg-card px-4 py-4">
                  <h4 className="mb-2 text-sm font-semibold">{reasonsLabel}</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {selectedCandidate.reasonKeys.map((reason) => (
                      <li key={reason}>{reasonLabels[reason]}</li>
                    ))}
                  </ul>
                </div>
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
      </div>
    </div>
  );
}
