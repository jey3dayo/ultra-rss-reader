import { ExternalLink } from "lucide-react";
import { FeedCleanupCard, FeedCleanupDetailRow } from "@/components/feed-cleanup/feed-cleanup-card";
import { Button } from "@/components/ui/button";
import type { SubscriptionDetailMetrics, SubscriptionListRow } from "./subscriptions-index.types";

const detailLinkClassName =
  "inline-flex items-center gap-1 cursor-pointer underline decoration-border underline-offset-4 hover:text-foreground";

export function SubscriptionDetailPane({
  heading,
  emptyLabel,
  row,
  metrics,
  folderLabel,
  latestArticleLabel,
  unreadCountLabel,
  starredCountLabel,
  websiteUrlLabel,
  feedUrlLabel,
  displayModeLabel,
  displayModeValue,
  openCleanupLabel,
  onOpenCleanup,
}: {
  heading: string;
  emptyLabel: string;
  row: SubscriptionListRow | null;
  metrics: SubscriptionDetailMetrics | null;
  folderLabel: string;
  latestArticleLabel: string;
  unreadCountLabel: string;
  starredCountLabel: string;
  websiteUrlLabel: string;
  feedUrlLabel: string;
  displayModeLabel: string;
  displayModeValue: string;
  openCleanupLabel: string;
  onOpenCleanup: () => void;
}) {
  return (
    <section data-testid="subscriptions-detail-pane" className="flex min-h-0 flex-col px-4 py-4 sm:px-6">
      <h2 className="mb-3 text-sm font-semibold">{heading}</h2>
      {!row || !metrics ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <div className="space-y-4">
          <FeedCleanupCard className="rounded-2xl border-border/70 bg-card/70">
            <h3 className="text-base font-semibold">{row.feed.title}</h3>
            <dl className="mt-4 grid gap-2 text-sm">
              <FeedCleanupDetailRow label={folderLabel} value={row.folderName ?? "—"} />
              <FeedCleanupDetailRow
                label={latestArticleLabel}
                value={metrics.latestArticleAt ? new Date(metrics.latestArticleAt).toLocaleDateString() : "—"}
              />
              <FeedCleanupDetailRow label={unreadCountLabel} value={row.feed.unread_count} />
              <FeedCleanupDetailRow label={starredCountLabel} value={metrics.starredCount} />
              <FeedCleanupDetailRow
                label={websiteUrlLabel}
                value={
                  <a href={row.feed.site_url} target="_blank" rel="noreferrer" className={detailLinkClassName}>
                    {row.feed.site_url}
                    <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
                  </a>
                }
              />
              <FeedCleanupDetailRow
                label={feedUrlLabel}
                value={
                  <a href={row.feed.url} target="_blank" rel="noreferrer" className={detailLinkClassName}>
                    {row.feed.url}
                    <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
                  </a>
                }
              />
              <FeedCleanupDetailRow label={displayModeLabel} value={displayModeValue} />
            </dl>
          </FeedCleanupCard>

          <FeedCleanupCard className="rounded-2xl border-border/70 bg-card/55">
            <h3 className="text-sm font-semibold">Recent articles</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {metrics.previewArticles.map((article) => (
                <li key={article.id} className="flex items-center justify-between gap-3">
                  {article.url ? (
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noreferrer"
                      className={`${detailLinkClassName} line-clamp-1`}
                    >
                      {article.title}
                      <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="line-clamp-1">{article.title}</span>
                  )}
                  <span className="shrink-0 text-xs">{new Date(article.published_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          </FeedCleanupCard>

          <Button onClick={onOpenCleanup}>{openCleanupLabel}</Button>
        </div>
      )}
    </section>
  );
}
