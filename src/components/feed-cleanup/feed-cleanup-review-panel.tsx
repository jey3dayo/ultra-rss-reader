import { useTranslation } from "react-i18next";
import { FeedDetailPanel } from "@/components/shared/feed-detail-panel";
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
  noSelectionLabel,
  reasonLabels,
  summaryHeadlineLabels,
  summaryLabels,
  editing,
  editor,
  reviewPanelClassName,
  editLabel,
  onEdit,
}: FeedCleanupReviewPanelProps) {
  const { t } = useTranslation("cleanup");
  const reasonFacts = selectedCandidate ? buildCleanupReasonFacts(selectedCandidate) : [];

  return (
    <section
      data-testid="feed-cleanup-review-panel"
      className={cn("flex min-h-0 flex-col bg-background/40 px-4 py-4 sm:px-6", reviewPanelClassName)}
    >
      <h3 className="sr-only">{reviewLabel}</h3>
      {integrityMode ? (
        selectedIntegrityIssue ? (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <FeedCleanupCard className="rounded-3xl border-border/70 bg-[linear-gradient(180deg,hsl(var(--card)/0.9),hsl(var(--background)/0.97))]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-amber-100">
                  <p className="text-sm font-semibold">{integrityDetailLabels.needs_repair}</p>
                  <p className="mt-1 text-sm text-current/85">{integrityDetailLabels.summary}</p>
                </div>
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
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            {integrityEmptyLabel}
          </p>
        )
      ) : selectedCandidate && editing ? (
        editor
      ) : selectedCandidate && selectedFeed && selectedMetrics && selectedSummary ? (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <FeedDetailPanel
            title={selectedCandidate.title}
            titleHref={selectedFeed.site_url}
            badgeLabel={summaryHeadlineLabels[selectedSummary.titleKey]}
            badgeTone={selectedSummary.tone}
            reasonBox={{
              title: t("reason_box_title"),
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
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          {noSelectionLabel}
        </p>
      )}
    </section>
  );
}
