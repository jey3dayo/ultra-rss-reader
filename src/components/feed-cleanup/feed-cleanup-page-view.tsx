import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { FeedCleanupPageViewProps } from "./feed-cleanup.types";
import { FeedCleanupOverviewPanel } from "./feed-cleanup-overview-panel";
import { FeedCleanupQueuePanel } from "./feed-cleanup-queue-panel";
import { FeedCleanupReviewPanel } from "./feed-cleanup-review-panel";

const FEED_CLEANUP_SPLIT_LAYOUT_WIDTH = 900;
const FEED_CLEANUP_WIDE_LAYOUT_WIDTH = 1180;

function resolveFeedCleanupLayoutWidth(measuredWidth: number | null): number {
  if (measuredWidth != null && measuredWidth > 0) {
    return measuredWidth;
  }

  if (typeof window === "undefined") {
    return 0;
  }

  return window.innerWidth >= 1024 ? Math.max(window.innerWidth - 280, 0) : window.innerWidth;
}

export function FeedCleanupPageView({
  title,
  subtitle,
  closeLabel,
  dateLocale,
  overviewLabel,
  filtersLabel,
  bulkActionsLabel,
  bulkVisibleCountLabel,
  bulkKeepVisibleLabel,
  bulkDeferVisibleLabel,
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
  visibleCandidateCount,
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
  priorityToneLabels,
  priorityLabels,
  summaryHeadlineLabels,
  summaryLabels,
  editing,
  editor,
  onClose,
  onToggleIntegrityMode,
  onToggleFilter,
  onToggleShowDeferred,
  onKeepVisible,
  onDeferVisible,
  onSelectCandidate,
  onSelectIntegrityIssue,
  onEdit,
  onKeep,
  onLater,
  onDelete,
}: FeedCleanupPageViewProps) {
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const [layoutWidth, setLayoutWidth] = useState(() => resolveFeedCleanupLayoutWidth(null));

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
    layoutWidth >= FEED_CLEANUP_WIDE_LAYOUT_WIDTH
      ? "wide"
      : layoutWidth >= FEED_CLEANUP_SPLIT_LAYOUT_WIDTH
        ? "split"
        : "stacked";

  const mainLayoutClassName =
    layoutMode === "wide"
      ? "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-6 overflow-hidden px-6 py-5"
      : layoutMode === "split"
        ? "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_300px] gap-5 overflow-hidden px-5 py-5"
        : "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5";

  const reviewPanelClassName = layoutMode === "stacked" ? "" : "sticky top-0 max-h-full self-start overflow-hidden";

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

      <div ref={layoutRef} className="min-h-0 flex flex-1 flex-col overflow-hidden">
        <FeedCleanupOverviewPanel
          overviewLabel={overviewLabel}
          filtersLabel={filtersLabel}
          bulkActionsLabel={bulkActionsLabel}
          bulkVisibleCountLabel={bulkVisibleCountLabel}
          bulkKeepVisibleLabel={bulkKeepVisibleLabel}
          bulkDeferVisibleLabel={bulkDeferVisibleLabel}
          summaryCards={summaryCards}
          integrityMode={integrityMode}
          integrityDetailLabels={integrityDetailLabels}
          filterOptions={filterOptions}
          filterCounts={filterCounts}
          activeFilterKeys={activeFilterKeys}
          visibleCandidateCount={visibleCandidateCount}
          showDeferred={showDeferred}
          showDeferredLabel={showDeferredLabel}
          onToggleFilter={onToggleFilter}
          onToggleShowDeferred={onToggleShowDeferred}
          onKeepVisible={onKeepVisible}
          onDeferVisible={onDeferVisible}
        />

        <div data-testid="feed-cleanup-layout" className={mainLayoutClassName}>
          <FeedCleanupQueuePanel
            integrityMode={integrityMode}
            queueLabel={queueLabel}
            integrityQueueLabel={integrityQueueLabel}
            integrityEmptyLabel={integrityEmptyLabel}
            integrityIssues={integrityIssues}
            selectedIntegrityIssue={selectedIntegrityIssue}
            integrityDetailLabels={integrityDetailLabels}
            onSelectIntegrityIssue={onSelectIntegrityIssue}
            emptyLabel={emptyLabel}
            queue={queue}
            selectedCandidate={selectedCandidate}
            onSelectCandidate={onSelectCandidate}
            unreadCountLabel={unreadCountLabel}
            starredCountLabel={starredCountLabel}
            deferredBadgeLabel={deferredBadgeLabel}
            reasonLabels={reasonLabels}
            priorityToneLabels={priorityToneLabels}
            summaryLabels={summaryLabels}
          />

          <FeedCleanupReviewPanel
            reviewLabel={reviewLabel}
            integrityMode={integrityMode}
            dateLocale={dateLocale}
            integrityEmptyLabel={integrityEmptyLabel}
            selectedIntegrityIssue={selectedIntegrityIssue}
            integrityDetailLabels={integrityDetailLabels}
            selectedCandidate={selectedCandidate}
            selectedSummary={selectedSummary}
            folderLabel={folderLabel}
            latestArticleLabel={latestArticleLabel}
            unreadCountLabel={unreadCountLabel}
            starredCountLabel={starredCountLabel}
            reasonsLabel={reasonsLabel}
            noSelectionLabel={noSelectionLabel}
            reasonLabels={reasonLabels}
            priorityToneLabels={priorityToneLabels}
            priorityLabels={priorityLabels}
            summaryHeadlineLabels={summaryHeadlineLabels}
            summaryLabels={summaryLabels}
            editing={editing}
            editor={editor}
            reviewPanelClassName={reviewPanelClassName}
            editLabel={editLabel}
            keepLabel={keepLabel}
            laterLabel={laterLabel}
            deleteLabel={deleteLabel}
            onEdit={onEdit}
            onKeep={onKeep}
            onLater={onLater}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
}
