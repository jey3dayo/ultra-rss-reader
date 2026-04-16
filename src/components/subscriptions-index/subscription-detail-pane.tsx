import { FeedDetailPanel } from "@/components/shared/feed-detail-panel";
import { FeedFavicon } from "@/components/shared/feed-favicon";
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
      className="flex flex-col px-4 py-5 sm:px-6 sm:py-5 lg:min-h-0"
      style={{
        backgroundColor: "var(--subscriptions-detail-surface)",
        backgroundImage: "var(--subscriptions-detail-pane-surface)",
      }}
    >
      <div className="mb-5 border-b border-border/50 pb-4">
        <h2 className="font-sans text-[1.02rem] font-normal tracking-[-0.02em] text-foreground-soft">{heading}</h2>
      </div>
      {!row || !metrics ? (
        <div className="flex items-center lg:min-h-0 lg:flex-1">
          <p className="w-full rounded-md border border-dashed border-border/70 bg-surface-1/78 px-5 py-6 text-sm text-foreground-soft">
            {emptyLabel}
          </p>
        </div>
      ) : (
        <div className="pr-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
          <div className="flex w-full flex-col pb-7 pt-1 lg:min-h-full">
            <FeedDetailPanel
              title={row.feed.title}
              titleHref={row.feed.site_url}
              leadingVisual={
                <FeedFavicon title={row.feed.title} url={row.feed.url} siteUrl={row.feed.site_url} size="lg" />
              }
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
        </div>
      )}
    </section>
  );
}
