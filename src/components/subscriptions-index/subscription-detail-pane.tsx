import { ArrowLeft } from "lucide-react";
import { useRef } from "react";
import type { LocalFeedSyncStatusDto } from "@/api/tauri-commands";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import { Button, FeedDetailPanel, FeedFavicon } from "@/design-system";
import type { FeedRetryOutcomeKind } from "@/hooks/use-local-feed-sync-statuses";
import { normalizeFeedWebsiteUrlCandidate } from "@/lib/feed/feed";
import type { SubscriptionActionRail as SubscriptionActionRailModel } from "@/lib/subscriptions/subscriptions-index";
import type {
  SubscriptionDetailCandidate,
  SubscriptionDetailMetrics,
  SubscriptionListRow,
} from "@/lib/subscriptions/subscriptions-index.types";
import { SubscriptionActionRail, type SubscriptionRailFocusHandoff } from "./subscription-action-rail";
import {
  buildDetailLinks,
  buildDetailMetrics,
  buildFeedUrlDetail,
  buildRecentArticles,
  buildUrlDetail,
  formatOptionalDateTime,
  resolveBadgeLabel,
  resolveBadgeTone,
  resolveReasonBox,
  resolveShowReviewContext,
} from "./subscription-detail-builders";
import { type FetchErrorLabels, SubscriptionFetchStatusCard } from "./subscription-detail-fetch-status-card";

type SubscriptionDetailPaneProps = {
  heading: string;
  emptyLabel: string;
  row: SubscriptionListRow | null;
  metrics: SubscriptionDetailMetrics | null;
  detailCandidate: SubscriptionDetailCandidate | null;
  folderLabel: string;
  folderNoneLabel: string;
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
  copyContentUrlLabel?: string;
  onCopyContentUrl?: (url: string) => void;
  backToListLabel?: string;
  onBackToList?: () => void;
};

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

export function SubscriptionDetailPane({
  heading,
  emptyLabel,
  row,
  metrics,
  detailCandidate,
  folderLabel,
  folderNoneLabel,
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
  copyContentUrlLabel,
  onCopyContentUrl,
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
  const contentUrlDetail = buildUrlDetail(contentUrlHref, onCopyContentUrl, copyContentUrlLabel);

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
                })}
                links={buildDetailLinks(
                  feedUrlHref,
                  contentUrlHref,
                  feedUrlLabel,
                  contentUrlLabel,
                  feedUrlDetail,
                  contentUrlDetail,
                )}
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
