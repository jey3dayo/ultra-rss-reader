import { Globe, Rss } from "lucide-react";
import type { ReactNode } from "react";
import { LabelChip } from "@/design-system";
import { formatShortDateTime } from "@/lib/datetime";
import { resolveFeedDetailTone } from "@/lib/subscriptions/subscription-status-tone";
import { isOverloaded } from "@/lib/subscriptions/subscription-update-frequency";
import { formatSubscriptionDate } from "@/lib/subscriptions/subscriptions-index";
import type {
  SubscriptionDetailCandidate,
  SubscriptionDetailMetrics,
  SubscriptionListRow,
} from "@/lib/subscriptions/subscriptions-index.types";

function formatLatestArticleMetric(value: string | null, locale: string, emptyLabel: string): string {
  const formatted = formatSubscriptionDate(value, locale);
  return formatted === "—" ? emptyLabel : formatted;
}

export type FeedUrlDetail = {
  text: string;
  onCopy: () => void;
  copyLabel: string;
};

export function formatOptionalDateTime(value: string | null | undefined, locale: string): string | null {
  return value ? formatShortDateTime(value, locale) : null;
}

export function resolveShowReviewContext(
  hasFetchError: boolean,
  hasRemoteFetchFailure: boolean,
  row: SubscriptionListRow | null,
): boolean {
  return !(hasFetchError || hasRemoteFetchFailure) || (row !== null && row.status.labelKey !== "normal");
}

export function buildUrlDetail(
  url: string | null,
  onCopy: ((url: string) => void) | undefined,
  copyLabel: string | undefined,
): FeedUrlDetail | null {
  if (!url || !onCopy || !copyLabel) {
    return null;
  }
  return { text: url, onCopy: () => onCopy(url), copyLabel };
}

export function buildFeedUrlDetail(
  row: SubscriptionListRow | null,
  onCopyFeedUrl: ((feedUrl: string) => void) | undefined,
  copyFeedUrlLabel: string | undefined,
): FeedUrlDetail | null {
  return buildUrlDetail(row?.feed.url ?? null, onCopyFeedUrl, copyFeedUrlLabel);
}

export function buildDetailLinks(
  feedUrlHref: string | null,
  contentUrlHref: string | null,
  feedUrlLabel: string,
  contentUrlLabel: string,
  feedUrlDetail: FeedUrlDetail | null,
  contentUrlDetail: FeedUrlDetail | null,
) {
  return [
    ...(contentUrlHref && contentUrlHref !== feedUrlHref
      ? [
          {
            href: contentUrlHref,
            label: contentUrlLabel,
            icon: Globe,
            value: contentUrlDetail?.text,
            copyLabel: contentUrlDetail?.copyLabel,
            onCopy: contentUrlDetail?.onCopy,
          },
        ]
      : []),
    ...(feedUrlHref
      ? [
          {
            href: feedUrlHref,
            label: feedUrlLabel,
            icon: Rss,
            value: feedUrlDetail?.text,
            copyLabel: feedUrlDetail?.copyLabel,
            onCopy: feedUrlDetail?.onCopy,
          },
        ]
      : []),
  ];
}

export type DetailMetricsInput = {
  row: SubscriptionListRow;
  metrics: SubscriptionDetailMetrics;
  dateLocale: string;
  folderLabel: string;
  folderNoneLabel: string;
  latestArticleLabel: string;
  latestArticleEmptyLabel: string;
  updateFrequencyLabel: string;
  formatUpdateFrequencyValue: (recentArticleCount: number) => string;
  overloadedBadgeLabel: string;
  unreadCountLabel: string;
  starredCountLabel: string;
  displayModeLabel: string;
  displayModeValue: string;
};

export function buildDetailMetrics({
  row,
  metrics,
  dateLocale,
  folderLabel,
  folderNoneLabel,
  latestArticleLabel,
  latestArticleEmptyLabel,
  updateFrequencyLabel,
  formatUpdateFrequencyValue,
  overloadedBadgeLabel,
  unreadCountLabel,
  starredCountLabel,
  displayModeLabel,
  displayModeValue,
}: DetailMetricsInput) {
  const overloaded = isOverloaded({
    postsLast30Days: metrics.recentArticleCount,
    unreadCount: row.feed.unread_count,
  });
  const updateFrequencyValue: ReactNode = overloaded ? (
    <span className="flex flex-wrap items-center gap-1.5 whitespace-normal">
      {formatUpdateFrequencyValue(metrics.recentArticleCount)}
      <LabelChip data-testid="subscriptions-detail-overloaded-badge" tone="warning" size="compact">
        {overloadedBadgeLabel}
      </LabelChip>
    </span>
  ) : (
    formatUpdateFrequencyValue(metrics.recentArticleCount)
  );
  return [
    {
      label: latestArticleLabel,
      value: formatLatestArticleMetric(metrics.latestArticleAt, dateLocale, latestArticleEmptyLabel),
    },
    {
      label: updateFrequencyLabel,
      value: updateFrequencyValue,
    },
    { label: unreadCountLabel, value: row.feed.unread_count },
    { label: starredCountLabel, value: metrics.starredCount },
    { label: folderLabel, value: row.folderName ?? folderNoneLabel },
    { label: displayModeLabel, value: displayModeValue },
  ];
}

export function buildRecentArticles(previewArticles: SubscriptionDetailMetrics["previewArticles"], dateLocale: string) {
  return previewArticles.map((article) => ({
    id: article.id,
    title: article.title,
    publishedAt: formatSubscriptionDate(article.published_at, dateLocale),
    url: article.url,
  }));
}

export function resolveBadgeLabel(
  hasFetchError: boolean,
  fetchErrorHeading: string,
  detailCandidate: SubscriptionDetailCandidate | null,
): string | undefined {
  return hasFetchError ? fetchErrorHeading : detailCandidate?.statusLabel;
}

export function resolveBadgeTone(hasFetchError: boolean, detailCandidate: SubscriptionDetailCandidate | null) {
  return resolveFeedDetailTone(hasFetchError ? "danger" : (detailCandidate?.tone ?? "neutral"));
}

export function resolveReasonBox(
  showReviewContext: boolean,
  detailCandidate: SubscriptionDetailCandidate | null,
  reasonHeading: string,
  subordinate: boolean,
) {
  if (!showReviewContext || !detailCandidate?.reasonBoxBody) {
    return null;
  }

  return {
    title: reasonHeading,
    body: detailCandidate.reasonBoxBody,
    // A fetch failure card above the panel carries the primary explanation, so
    // the review reason steps back to a neutral tone when both are shown.
    tone: subordinate ? ("neutral" as const) : resolveFeedDetailTone(detailCandidate.tone),
  };
}
