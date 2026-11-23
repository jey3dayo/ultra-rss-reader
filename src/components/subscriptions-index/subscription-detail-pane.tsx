import { cva } from "class-variance-authority";
import { ArrowLeft, Copy, Globe, Pencil, RefreshCw, Rss } from "lucide-react";
import { type ReactNode, useRef } from "react";
import type { LocalFeedSyncStatusDto } from "@/api/tauri-commands";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import { Button, FeedDetailPanel, FeedFavicon, LabelChip, SurfaceCard } from "@/design-system";
import type { FeedRetryOutcomeKind } from "@/hooks/use-local-feed-sync-statuses";
import { formatShortDateTime } from "@/lib/datetime";
import { normalizeFeedWebsiteUrlCandidate } from "@/lib/feed/feed";
import { resolveFeedDetailTone } from "@/lib/subscriptions/subscription-status-tone";
import { isOverloaded } from "@/lib/subscriptions/subscription-update-frequency";
import type { SubscriptionActionRail as SubscriptionActionRailModel } from "@/lib/subscriptions/subscriptions-index";
import { formatSubscriptionDate } from "@/lib/subscriptions/subscriptions-index";
import type {
  SubscriptionDetailCandidate,
  SubscriptionDetailMetrics,
  SubscriptionListRow,
} from "@/lib/subscriptions/subscriptions-index.types";
import { SubscriptionActionRail, type SubscriptionRailFocusHandoff } from "./subscription-action-rail";

type FetchErrorLabels = {
  heading: string;
  lastAttempt: string;
  lastSuccess?: string;
  errorCount?: (count: number) => string;
  copyDiagnosticId: string;
  retry: string;
  retrying: string;
  editFeedUrl: string;
  urlChangeGuidance?: string;
  reason: (kind: NonNullable<LocalFeedSyncStatusDto["error_kind"]>) => string;
  retryOutcome: (kind: FeedRetryOutcomeKind) => string;
};

const retryOutcomeVariants = cva("text-sm leading-relaxed", {
  variants: {
    tone: {
      neutral: "text-foreground-soft",
      warning: "text-state-warning-foreground",
      danger: "text-state-danger-foreground",
    },
  },
});

const RETRY_OUTCOME_PRESENTATION = {
  succeeded: { tone: "neutral", role: "status" },
  busy: { tone: "neutral", role: "status" },
  incomplete: { tone: "warning", role: "alert" },
  failed: { tone: "danger", role: "alert" },
  "refresh-failed": { tone: "danger", role: "alert" },
} as const satisfies Record<FeedRetryOutcomeKind, { tone: "neutral" | "warning" | "danger"; role: "status" | "alert" }>;

type SubscriptionDetailPaneProps = {
  heading: string;
  emptyLabel: string;
  row: SubscriptionListRow | null;
  metrics: SubscriptionDetailMetrics | null;
  detailCandidate: SubscriptionDetailCandidate | null;
  folderLabel: string;
  latestArticleLabel: string;
  latestArticleEmptyLabel?: string;
  updateFrequencyLabel: string;
  formatUpdateFrequencyValue: (recentArticleCount: number) => string;
  overloadedBadgeLabel: string;
  unreadCountLabel: string;
  starredCountLabel: string;
  reasonHeading: string;
  recentArticlesHeading: string;
  feedUrlLabel: string;
  contentUrlLabel: string;
  displayModeLabel: string;
  displayModeValue: string;
  dateLocale: string;
  actionRail: SubscriptionActionRailModel | null;
  fetchError?: LocalFeedSyncStatusDto | null;
  fetchErrorLabels?: FetchErrorLabels;
  remoteFetchFailure?: { lastSuccessAt: string } | null;
  remoteFetchFailureLabels?: {
    heading: string;
    body: string;
    lastSuccess: string;
  };
  retryOutcome?: FeedRetryOutcomeKind | null;
  onRetryFeed?: (feedId: string) => void;
  onEditFeed?: () => void;
  isRetryingFeed?: (feedId: string) => boolean;
  onCopyDiagnosticId?: (diagnosticId: string) => void;
  copyFeedUrlLabel?: string;
  onCopyFeedUrl?: (feedUrl: string) => void;
  backToListLabel?: string;
  onBackToList?: () => void;
};

function formatLatestArticleMetric(value: string | null, locale: string, emptyLabel: string): string {
  const formatted = formatSubscriptionDate(value, locale);
  return formatted === "—" ? emptyLabel : formatted;
}

type FeedUrlDetail = {
  text: string;
  onCopy: () => void;
  copyLabel: string;
};

function formatOptionalDateTime(value: string | null | undefined, locale: string): string | null {
  return value ? formatShortDateTime(value, locale) : null;
}

function resolveShowReviewContext(
  hasFetchError: boolean,
  hasRemoteFetchFailure: boolean,
  row: SubscriptionListRow | null,
): boolean {
  return !(hasFetchError || hasRemoteFetchFailure) || (row !== null && row.status.labelKey !== "normal");
}

function buildFeedUrlDetail(
  row: SubscriptionListRow | null,
  onCopyFeedUrl: ((feedUrl: string) => void) | undefined,
  copyFeedUrlLabel: string | undefined,
): FeedUrlDetail | null {
  if (!row || !onCopyFeedUrl || !copyFeedUrlLabel) {
    return null;
  }
  return { text: row.feed.url, onCopy: () => onCopyFeedUrl(row.feed.url), copyLabel: copyFeedUrlLabel };
}

function SubscriptionDetailBackToList({ label, onBackToList }: { label: string; onBackToList: () => void }) {
  return (
    <div className="mb-3 lg:hidden">
      <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={onBackToList}>
        <ArrowLeft className="size-4" />
        {label}
      </Button>
    </div>
  );
}

function buildDetailLinks(
  feedUrlHref: string | null,
  contentUrlHref: string | null,
  feedUrlLabel: string,
  contentUrlLabel: string,
  feedUrlDetail: FeedUrlDetail | null,
) {
  return [
    ...(contentUrlHref && contentUrlHref !== feedUrlHref
      ? [{ href: contentUrlHref, label: contentUrlLabel, icon: Globe }]
      : []),
    ...(feedUrlHref
      ? [
          {
            href: feedUrlHref,
            label: feedUrlLabel,
            icon: Rss,
            ...(feedUrlDetail
              ? {
                  detailText: feedUrlDetail.text,
                  onCopyDetail: feedUrlDetail.onCopy,
                  copyDetailLabel: feedUrlDetail.copyLabel,
                }
              : {}),
          },
        ]
      : []),
  ];
}

type DetailMetricsInput = {
  row: SubscriptionListRow;
  metrics: SubscriptionDetailMetrics;
  dateLocale: string;
  folderLabel: string;
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

function buildDetailMetrics({
  row,
  metrics,
  dateLocale,
  folderLabel,
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
    { label: folderLabel, value: row.folderName ?? "—" },
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
    { label: displayModeLabel, value: displayModeValue },
  ];
}

function buildRecentArticles(previewArticles: SubscriptionDetailMetrics["previewArticles"], dateLocale: string) {
  return previewArticles.map((article) => ({
    id: article.id,
    title: article.title,
    publishedAt: formatSubscriptionDate(article.published_at, dateLocale),
    url: article.url,
  }));
}

function resolveBadgeLabel(
  hasFetchError: boolean,
  fetchErrorHeading: string,
  detailCandidate: SubscriptionDetailCandidate | null,
): string | undefined {
  return hasFetchError ? fetchErrorHeading : detailCandidate?.statusLabel;
}

function resolveBadgeTone(hasFetchError: boolean, detailCandidate: SubscriptionDetailCandidate | null) {
  return resolveFeedDetailTone(hasFetchError ? "danger" : (detailCandidate?.tone ?? "neutral"));
}

function resolveReasonBox(
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

function SubscriptionEmptyState({ emptyLabel }: { emptyLabel: string }) {
  return (
    <div className="flex items-center lg:min-h-0 lg:flex-1">
      <p
        {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
        className={`${MOTION_CONTENT_SWAP_CLASS_NAME} w-full rounded-md border border-dashed border-[var(--workspace-low-wire-section-border)] bg-[var(--workspace-low-wire-group-surface)] px-5 py-6 text-sm text-foreground-soft shadow-none`}
      >
        {emptyLabel}
      </p>
    </div>
  );
}

type FetchErrorDetailCardProps = {
  errorKind: NonNullable<LocalFeedSyncStatusDto["error_kind"]>;
  labels: FetchErrorLabels;
  retryOutcome: FeedRetryOutcomeKind | null;
  formattedLastAttempt: string | null;
  formattedLastSuccess: string | null;
  errorCount: number;
  diagnosticId: string | null | undefined;
  feedId: string;
  onRetryFeed: (feedId: string) => void;
  onEditFeed: () => void;
  isRetryingFeed: (feedId: string) => boolean;
  onCopyDiagnosticId: (diagnosticId: string) => void;
};

function FetchErrorDetailCard({
  errorKind,
  labels,
  retryOutcome,
  formattedLastAttempt,
  formattedLastSuccess,
  errorCount,
  diagnosticId,
  feedId,
  onRetryFeed,
  onEditFeed,
  isRetryingFeed,
  onCopyDiagnosticId,
}: FetchErrorDetailCardProps) {
  const isRetrying = isRetryingFeed(feedId);

  return (
    <SurfaceCard
      data-testid="subscriptions-fetch-error-detail"
      variant="section"
      tone="default"
      padding="compact"
      className="flex flex-col gap-3 rounded-md border border-state-danger-border/70 bg-state-danger-surface/70 p-3.5 shadow-none sm:p-4"
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-state-danger-foreground">{labels.heading}</h3>
        <p className="mt-1 text-sm leading-relaxed text-foreground">{labels.reason(errorKind)}</p>
        {errorKind === "private_address_blocked" && labels.urlChangeGuidance ? (
          <p
            data-testid="subscriptions-fetch-error-url-guidance"
            className="mt-1 text-sm leading-relaxed text-foreground-soft"
          >
            {labels.urlChangeGuidance}
          </p>
        ) : null}
        {formattedLastAttempt ? (
          <p className="mt-1 text-xs text-foreground-soft">
            {labels.lastAttempt}: {formattedLastAttempt}
          </p>
        ) : null}
        {formattedLastSuccess && labels.lastSuccess ? (
          <p className="mt-1 text-xs text-foreground-soft">
            {labels.lastSuccess}: {formattedLastSuccess}
          </p>
        ) : null}
        {errorCount >= 2 && labels.errorCount ? (
          <p className="mt-1 text-xs text-foreground-soft">{labels.errorCount(errorCount)}</p>
        ) : null}
        {retryOutcome ? (
          <p
            role={RETRY_OUTCOME_PRESENTATION[retryOutcome].role}
            data-testid="subscriptions-fetch-error-retry-outcome"
            className={retryOutcomeVariants({ tone: RETRY_OUTCOME_PRESENTATION[retryOutcome].tone, className: "mt-2" })}
          >
            {labels.retryOutcome(retryOutcome)}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {errorKind === "private_address_blocked" ? (
          <Button type="button" size="sm" variant="ghost" onClick={onEditFeed}>
            <Pencil className="size-4" />
            {labels.editFeedUrl}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isRetrying}
          aria-busy={isRetrying}
          onClick={() => onRetryFeed(feedId)}
        >
          <RefreshCw className="size-4" />
          {isRetrying ? labels.retrying : labels.retry}
        </Button>
        {diagnosticId ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onCopyDiagnosticId(diagnosticId)}>
            <Copy className="size-4" />
            {labels.copyDiagnosticId}
          </Button>
        ) : null}
      </div>
    </SurfaceCard>
  );
}

type RemoteFetchFailureDetailCardProps = {
  labels: NonNullable<SubscriptionDetailPaneProps["remoteFetchFailureLabels"]>;
  formattedLastSuccess: string | null;
};

function RemoteFetchFailureDetailCard({ labels, formattedLastSuccess }: RemoteFetchFailureDetailCardProps) {
  return (
    <SurfaceCard
      data-testid="subscriptions-remote-fetch-failure-detail"
      variant="section"
      tone="default"
      padding="compact"
      className="flex flex-col gap-3 rounded-md border border-state-danger-border/70 bg-state-danger-surface/70 p-3.5 shadow-none sm:p-4"
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-state-danger-foreground">{labels.heading}</h3>
        {labels.body ? <p className="mt-1 text-sm leading-relaxed text-foreground">{labels.body}</p> : null}
        {formattedLastSuccess ? (
          <p className="mt-1 text-xs text-foreground-soft">
            {labels.lastSuccess}: {formattedLastSuccess}
          </p>
        ) : null}
      </div>
    </SurfaceCard>
  );
}

type SubscriptionFetchStatusCardProps = {
  fetchError: LocalFeedSyncStatusDto | null | undefined;
  fetchErrorLabels: FetchErrorLabels;
  remoteFetchFailure: { lastSuccessAt: string } | null;
  remoteFetchFailureLabels: NonNullable<SubscriptionDetailPaneProps["remoteFetchFailureLabels"]>;
  retryOutcome: FeedRetryOutcomeKind | null | undefined;
  formattedLastAttempt: string | null;
  formattedLastSuccess: string | null;
  dateLocale: string;
  feedId: string;
  onRetryFeed: (feedId: string) => void;
  onEditFeed: () => void;
  isRetryingFeed: (feedId: string) => boolean;
  onCopyDiagnosticId: (diagnosticId: string) => void;
};

function SubscriptionFetchStatusCard({
  fetchError,
  fetchErrorLabels,
  remoteFetchFailure,
  remoteFetchFailureLabels,
  retryOutcome,
  formattedLastAttempt,
  formattedLastSuccess,
  dateLocale,
  feedId,
  onRetryFeed,
  onEditFeed,
  isRetryingFeed,
  onCopyDiagnosticId,
}: SubscriptionFetchStatusCardProps) {
  if (fetchError?.error_kind) {
    return (
      <FetchErrorDetailCard
        errorKind={fetchError.error_kind}
        labels={fetchErrorLabels}
        retryOutcome={retryOutcome ?? null}
        formattedLastAttempt={formattedLastAttempt}
        formattedLastSuccess={formattedLastSuccess}
        errorCount={fetchError.error_count}
        diagnosticId={fetchError.diagnostic_id}
        feedId={feedId}
        onRetryFeed={onRetryFeed}
        onEditFeed={onEditFeed}
        isRetryingFeed={isRetryingFeed}
        onCopyDiagnosticId={onCopyDiagnosticId}
      />
    );
  }
  if (remoteFetchFailure) {
    return (
      <RemoteFetchFailureDetailCard
        labels={remoteFetchFailureLabels}
        formattedLastSuccess={formatShortDateTime(remoteFetchFailure.lastSuccessAt, dateLocale)}
      />
    );
  }
  return null;
}

export function SubscriptionDetailPane({
  heading,
  emptyLabel,
  row,
  metrics,
  detailCandidate,
  folderLabel,
  latestArticleLabel,
  latestArticleEmptyLabel = "—",
  updateFrequencyLabel,
  formatUpdateFrequencyValue,
  overloadedBadgeLabel,
  unreadCountLabel,
  starredCountLabel,
  reasonHeading,
  recentArticlesHeading,
  feedUrlLabel,
  contentUrlLabel,
  displayModeLabel,
  displayModeValue,
  dateLocale,
  actionRail,
  fetchError,
  remoteFetchFailure = null,
  remoteFetchFailureLabels = {
    heading: "Fetch failed",
    body: "",
    lastSuccess: "Last succeeded",
  },
  fetchErrorLabels = {
    heading: "Fetch error",
    lastAttempt: "Last attempt",
    lastSuccess: "Last succeeded",
    errorCount: (count: number) => `${count} consecutive failures`,
    copyDiagnosticId: "Copy diagnostic number",
    retry: "Retry",
    retrying: "Retrying",
    editFeedUrl: "Check feed settings",
    urlChangeGuidance:
      "The feed URL can't be changed in the app. To use a different URL, unsubscribe from the bottom of these details, then add the feed again with the correct URL.",
    reason: (kind) => kind,
    retryOutcome: (kind) => kind,
  },
  retryOutcome = null,
  onRetryFeed = () => undefined,
  onEditFeed = () => undefined,
  isRetryingFeed = () => false,
  onCopyDiagnosticId = () => undefined,
  copyFeedUrlLabel,
  onCopyFeedUrl,
  backToListLabel,
  onBackToList,
}: SubscriptionDetailPaneProps) {
  // Lives in the pane, which survives selection changes, so a decision click
  // in one row's rail can hand focus to the rail mounted for the next row.
  const railFocusHandoffRef = useRef<SubscriptionRailFocusHandoff | null>(null);
  const feedUrlHref = normalizeFeedWebsiteUrlCandidate(row?.feed.url ?? "");
  const contentUrlHref = normalizeFeedWebsiteUrlCandidate(row?.feed.site_url ?? "");
  const hasFetchError = Boolean(fetchError?.error_kind);
  const hasRemoteFetchFailure = !hasFetchError && remoteFetchFailure !== null;
  const showReviewContext = resolveShowReviewContext(hasFetchError, hasRemoteFetchFailure, row);
  const formattedLastAttempt = formatOptionalDateTime(fetchError?.last_attempt_at, dateLocale);
  const formattedLastSuccess = formatOptionalDateTime(fetchError?.last_success_at, dateLocale);
  const feedUrlDetail = buildFeedUrlDetail(row, onCopyFeedUrl, copyFeedUrlLabel);

  return (
    <section
      data-testid="subscriptions-detail-pane"
      aria-label={heading}
      className="flex flex-col rounded-md px-4 py-4 sm:px-5 sm:py-5 lg:min-h-0"
      style={{
        backgroundColor: "var(--subscriptions-detail-surface)",
      }}
    >
      {!row || !metrics ? (
        <SubscriptionEmptyState emptyLabel={emptyLabel} />
      ) : (
        <>
          {onBackToList && backToListLabel ? (
            <SubscriptionDetailBackToList label={backToListLabel} onBackToList={onBackToList} />
          ) : null}
          <div
            data-testid="subscriptions-detail-scroll-region"
            key={row.feed.id}
            {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
            className={`${MOTION_CONTENT_SWAP_CLASS_NAME} lg:min-h-0 lg:flex-1 lg:overflow-y-auto`}
          >
            <div className="flex w-full flex-col gap-3.5 pb-4 pt-0.5 lg:min-h-full">
              <SubscriptionFetchStatusCard
                fetchError={fetchError}
                fetchErrorLabels={fetchErrorLabels}
                remoteFetchFailure={remoteFetchFailure}
                remoteFetchFailureLabels={remoteFetchFailureLabels}
                retryOutcome={retryOutcome}
                formattedLastAttempt={formattedLastAttempt}
                formattedLastSuccess={formattedLastSuccess}
                dateLocale={dateLocale}
                feedId={row.feed.id}
                onRetryFeed={onRetryFeed}
                onEditFeed={onEditFeed}
                isRetryingFeed={isRetryingFeed}
                onCopyDiagnosticId={onCopyDiagnosticId}
              />
              <FeedDetailPanel
                surface="low-wire"
                title={row.feed.title}
                titleHref={row.feed.site_url}
                leadingVisual={
                  <FeedFavicon
                    title={row.feed.title}
                    url={row.feed.url}
                    siteUrl={row.feed.site_url}
                    iconUrl={row.feed.icon_url}
                    size="lg"
                  />
                }
                badgeLabel={resolveBadgeLabel(
                  hasFetchError || hasRemoteFetchFailure,
                  hasRemoteFetchFailure ? remoteFetchFailureLabels.heading : fetchErrorLabels.heading,
                  detailCandidate,
                )}
                badgeTone={resolveBadgeTone(hasFetchError || hasRemoteFetchFailure, detailCandidate)}
                reasonBox={resolveReasonBox(
                  showReviewContext,
                  detailCandidate,
                  reasonHeading,
                  hasFetchError || hasRemoteFetchFailure,
                )}
                metrics={buildDetailMetrics({
                  row,
                  metrics,
                  dateLocale,
                  folderLabel,
                  latestArticleLabel,
                  latestArticleEmptyLabel,
                  updateFrequencyLabel,
                  formatUpdateFrequencyValue,
                  overloadedBadgeLabel,
                  unreadCountLabel,
                  starredCountLabel,
                  displayModeLabel,
                  displayModeValue,
                })}
                links={buildDetailLinks(feedUrlHref, contentUrlHref, feedUrlLabel, contentUrlLabel, feedUrlDetail)}
                recentArticlesHeading={recentArticlesHeading}
                recentArticles={buildRecentArticles(metrics.previewArticles, dateLocale)}
              />
            </div>
          </div>

          {actionRail ? (
            <SubscriptionActionRail
              key={`${row.feed.id}-action-rail`}
              actionRail={actionRail}
              feedId={row.feed.id}
              focusHandoffRef={railFocusHandoffRef}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
