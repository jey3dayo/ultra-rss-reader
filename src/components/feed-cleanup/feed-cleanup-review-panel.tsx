import { Check, Clock3, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DecisionButton } from "@/components/shared/decision-button";
import { FeedDetailPanel } from "@/components/shared/feed-detail-panel";
import { SurfaceCard } from "@/components/shared/surface-card";
import { buildCleanupReasonFacts } from "@/lib/feed-cleanup";
import { cn } from "@/lib/utils";
import type { FeedCleanupReviewPanelProps } from "./feed-cleanup.types";
import { FeedCleanupCard, FeedCleanupDetailRow } from "./feed-cleanup-card";

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

export function FeedCleanupReviewPanel({
  reviewLabel,
  integrityMode,
  dateLocale,
  integrityEmptyLabel,
  selectedIntegrityIssue,
  integrityDetailLabels,
  selectedCandidate,
  selectedFeed,
  selectedMetrics,
  selectedSummary,
  folderLabel,
  latestArticleLabel,
  unreadCountLabel,
  starredCountLabel,
  reasonsLabel,
  noSelectionLabel,
  reasonLabels,
  summaryHeadlineLabels,
  summaryLabels,
  editing,
  editor,
  reviewPanelClassName,
  editLabel,
  keepLabel = "Keep",
  laterLabel = "Defer",
  deleteLabel = "Delete",
  onEdit,
  onKeep,
  onLater,
  onDelete,
}: FeedCleanupReviewPanelProps) {
  const { t } = useTranslation("cleanup");
  const reasonFacts = selectedCandidate ? buildCleanupReasonFacts(selectedCandidate) : [];

  return (
    <section
      data-testid="feed-cleanup-review-panel"
      className={cn("typography-lane-cleanup-review flex min-h-0 flex-col px-4 py-4 sm:px-6", reviewPanelClassName)}
      style={{ backgroundColor: "var(--cleanup-review-surface)" }}
    >
      <h3 className="sr-only">{reviewLabel}</h3>
      {integrityMode ? (
        selectedIntegrityIssue ? (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <FeedCleanupCard
              className="border-border/65 shadow-none"
              style={{ backgroundColor: "var(--cleanup-card-surface)" }}
            >
              <div className="space-y-4">
                <SurfaceCard
                  variant="info"
                  tone="default"
                  padding="compact"
                  className="border-state-warning-border bg-state-warning-surface text-state-warning-foreground shadow-none"
                >
                  <p className="text-sm font-semibold">{integrityDetailLabels.needs_repair}</p>
                  <p className="mt-1 text-sm text-current/88">{integrityDetailLabels.summary}</p>
                </SurfaceCard>
                <dl className="grid gap-2 text-sm">
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
              </div>
            </FeedCleanupCard>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-border px-4 py-6 font-serif text-sm text-foreground-soft">
            {integrityEmptyLabel}
          </p>
        )
      ) : selectedCandidate && editing ? (
        editor
      ) : selectedCandidate && selectedFeed && selectedMetrics && selectedSummary ? (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-4">
            <FeedDetailPanel
              title={selectedCandidate.title}
              titleHref={selectedFeed.site_url}
              badgeLabel={summaryHeadlineLabels[selectedSummary.titleKey]}
              badgeTone={selectedSummary.tone}
              reasonBox={{
                title: reasonsLabel,
                body:
                  reasonFacts.length > 0
                    ? reasonFacts
                        .map((fact) =>
                          fact.key === "stale_days"
                            ? t("fact_stale_days", { count: fact.value })
                            : fact.key === "unread_count"
                              ? t("fact_unread_count", { count: fact.value })
                              : t("fact_starred_count", { count: fact.value }),
                        )
                        .join(" / ")
                    : summaryLabels[selectedSummary.summaryKey],
                tone: selectedSummary.tone,
              }}
              metrics={[
                { label: folderLabel, value: selectedCandidate.folderName ?? "—" },
                { label: latestArticleLabel, value: formatDate(selectedCandidate.latestArticleAt, dateLocale) },
                { label: unreadCountLabel, value: selectedCandidate.unreadCount },
                { label: starredCountLabel, value: selectedCandidate.starredCount },
              ]}
              links={[]}
              recentArticlesHeading={t("recent_articles")}
              recentArticles={selectedMetrics.previewArticles.map((article) => ({
                id: article.id,
                title: article.title,
                publishedAt: new Date(article.published_at).toLocaleDateString(dateLocale),
                url: article.url,
              }))}
              primaryAction={{
                label: editLabel,
                onClick: onEdit,
                ariaLabel: editLabel,
              }}
              reasonChips={selectedCandidate.reasonKeys.map((reasonKey) => reasonLabels[reasonKey])}
            />
            <SurfaceCard
              data-testid="feed-cleanup-review-actions"
              variant="section"
              tone="default"
              padding="compact"
              className="grid grid-cols-3 gap-2 rounded-lg px-4 shadow-none sm:px-5"
            >
              <DecisionButton
                intent="keep"
                size="lg"
                aria-label={keepLabel}
                onClick={onKeep}
                className="w-full min-w-0"
              >
                <Check className="h-4 w-4" />
                {keepLabel}
              </DecisionButton>
              <DecisionButton
                intent="defer"
                size="lg"
                aria-label={laterLabel}
                onClick={onLater}
                className="w-full min-w-0"
              >
                <Clock3 className="h-4 w-4" />
                {laterLabel}
              </DecisionButton>
              <DecisionButton
                intent="delete"
                size="lg"
                aria-label={deleteLabel}
                onClick={onDelete}
                className="w-full min-w-0"
              >
                <Trash2 className="h-4 w-4" />
                {deleteLabel}
              </DecisionButton>
            </SurfaceCard>
          </div>
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border px-4 py-6 font-serif text-sm text-foreground-soft">
          {noSelectionLabel}
        </p>
      )}
    </section>
  );
}
