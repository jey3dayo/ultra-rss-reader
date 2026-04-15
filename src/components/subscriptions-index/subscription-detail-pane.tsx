import { FeedDetailPanel } from "@/components/shared/feed-detail-panel";
import type {
  SubscriptionDetailCandidate,
  SubscriptionDetailMetrics,
  SubscriptionListRow,
} from "./subscriptions-index.types";

export function SubscriptionDetailPane({
  heading,
  emptyLabel,
  row,
  metrics,
  detailCandidate,
  folderLabel,
  latestArticleLabel,
  unreadCountLabel,
  starredCountLabel,
  reasonHeading,
  reasonHint,
  recentArticlesHeading,
  displayModeLabel,
  displayModeValue,
  openCleanupLabel,
  onOpenCleanup,
}: {
  heading: string;
  emptyLabel: string;
  row: SubscriptionListRow | null;
  metrics: SubscriptionDetailMetrics | null;
  detailCandidate: SubscriptionDetailCandidate | null;
  folderLabel: string;
  latestArticleLabel: string;
  unreadCountLabel: string;
  starredCountLabel: string;
  reasonHeading: string;
  reasonHint: string;
  recentArticlesHeading: string;
  displayModeLabel: string;
  displayModeValue: string;
  openCleanupLabel: string;
  onOpenCleanup: () => void;
}) {
  return (
    <section
      data-testid="subscriptions-detail-pane"
      className="flex min-h-0 flex-col bg-background/40 px-4 py-4 sm:px-6"
    >
      <h2 className="sr-only">{heading}</h2>
      {!row || !metrics ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <FeedDetailPanel
            title={row.feed.title}
            titleHref={row.feed.site_url}
            badgeLabel={detailCandidate?.statusLabel}
            badgeTone={detailCandidate?.tone ?? "neutral"}
            summaryText={detailCandidate?.reasonBoxBody ? undefined : (detailCandidate?.summary ?? reasonHint)}
            reasonBox={
              detailCandidate?.reasonBoxBody
                ? {
                    title: reasonHeading,
                    body: detailCandidate.reasonBoxBody,
                    tone: detailCandidate.tone,
                  }
                : null
            }
            reasonChips={detailCandidate?.reasonLabels ?? []}
            metrics={[
              { label: folderLabel, value: row.folderName ?? "—" },
              {
                label: latestArticleLabel,
                value: metrics.latestArticleAt ? new Date(metrics.latestArticleAt).toLocaleDateString() : "—",
              },
              { label: unreadCountLabel, value: row.feed.unread_count },
              { label: starredCountLabel, value: metrics.starredCount },
              { label: displayModeLabel, value: displayModeValue },
            ]}
            links={[]}
            recentArticlesHeading={recentArticlesHeading}
            recentArticles={metrics.previewArticles.map((article) => ({
              id: article.id,
              title: article.title,
              publishedAt: new Date(article.published_at).toLocaleDateString(),
              url: article.url,
            }))}
            primaryAction={{ label: openCleanupLabel, onClick: onOpenCleanup, ariaLabel: openCleanupLabel }}
          />
        </div>
      )}
    </section>
  );
}
