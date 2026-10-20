import { Check, Clock3, Copy, Globe, Pencil, RefreshCw, Rss, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import type { LocalFeedSyncStatusDto } from "@/api/tauri-commands";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import {
  Button,
  DecisionButton,
  FeedDetailPanel,
  FeedFavicon,
  LabelChip,
  SurfaceCard,
  WorkspaceManagementActionButton,
} from "@/design-system";
import { formatShortDateTime } from "@/lib/datetime";
import { normalizeFeedWebsiteUrlCandidate } from "@/lib/feed/feed";
import { isOverloaded } from "@/lib/subscriptions/subscription-update-frequency";
import type { SubscriptionDecisionActions } from "@/lib/subscriptions/subscriptions-index";
import { formatSubscriptionDate } from "@/lib/subscriptions/subscriptions-index";
import type {
  SubscriptionDetailCandidate,
  SubscriptionDetailMetrics,
  SubscriptionListRow,
} from "@/lib/subscriptions/subscriptions-index.types";

export type SubscriptionManagementActions = {
  editLabel: string;
  deleteLabel: string;
  onEdit: () => void;
  onDelete: () => void;
};

type FetchErrorLabels = {
  heading: string;
  lastAttempt: string;
  copyDiagnosticId: string;
  retry: string;
  retrying: string;
  editFeedUrl: string;
  reason: (kind: NonNullable<LocalFeedSyncStatusDto["error_kind"]>) => string;
};

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
  reasonHint: string;
  recentArticlesHeading: string;
  feedUrlLabel: string;
  contentUrlLabel: string;
  displayModeLabel: string;
  displayModeValue: string;
  dateLocale: string;
  decisionActions: SubscriptionDecisionActions | null;
  managementActions: SubscriptionManagementActions | null;
  fetchError?: LocalFeedSyncStatusDto | null;
  fetchErrorLabels?: FetchErrorLabels;
  onRetryFeed?: (feedId: string) => void;
  onEditFeed?: () => void;
  isRetryingFeed?: (feedId: string) => boolean;
  onCopyDiagnosticId?: (diagnosticId: string) => void;
};

type DecisionActionConfig = {
  key: "keep" | "defer" | "delete";
  intent: "keep" | "defer" | "delete";
  label: string;
  onClick: () => void;
  icon: typeof Check;
};

function buildDecisionActionConfigs(decisionActions: SubscriptionDecisionActions): DecisionActionConfig[] {
  return [
    {
      key: "keep",
      intent: "keep",
      label: decisionActions.keepLabel,
      onClick: decisionActions.onKeep,
      icon: Check,
    },
    {
      key: "defer",
      intent: "defer",
      label: decisionActions.deferLabel,
      onClick: decisionActions.onDefer,
      icon: Clock3,
    },
    {
      key: "delete",
      intent: "delete",
      label: decisionActions.deleteLabel,
      onClick: decisionActions.onDelete,
      icon: Trash2,
    },
  ];
}

function formatLatestArticleMetric(value: string | null, locale: string, emptyLabel: string): string {
  const formatted = formatSubscriptionDate(value, locale);
  return formatted === "—" ? emptyLabel : formatted;
}

function buildDetailLinks(
  feedUrlHref: string | null,
  contentUrlHref: string | null,
  feedUrlLabel: string,
  contentUrlLabel: string,
) {
  return [
    ...(contentUrlHref && contentUrlHref !== feedUrlHref
      ? [{ href: contentUrlHref, label: contentUrlLabel, icon: Globe }]
      : []),
    ...(feedUrlHref ? [{ href: feedUrlHref, label: feedUrlLabel, icon: Rss }] : []),
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
  return hasFetchError ? "high" : (detailCandidate?.tone ?? "neutral");
}

function resolveSummaryText(
  showReviewContext: boolean,
  detailCandidate: SubscriptionDetailCandidate | null,
  reasonHint: string,
): string | undefined {
  if (!showReviewContext) {
    return undefined;
  }

  return detailCandidate?.reasonBoxBody ? undefined : (detailCandidate?.summary ?? reasonHint);
}

function resolveReasonBox(
  showReviewContext: boolean,
  detailCandidate: SubscriptionDetailCandidate | null,
  reasonHeading: string,
) {
  if (!showReviewContext || !detailCandidate?.reasonBoxBody) {
    return null;
  }

  return {
    title: reasonHeading,
    body: detailCandidate.reasonBoxBody,
    tone: detailCandidate.tone,
  };
}

function resolveReasonChips(showReviewContext: boolean, detailCandidate: SubscriptionDetailCandidate | null): string[] {
  return showReviewContext ? (detailCandidate?.reasonLabels ?? []) : [];
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
  formattedLastAttempt: string | null;
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
  formattedLastAttempt,
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
        {formattedLastAttempt ? (
          <p className="mt-1 text-xs text-foreground-soft">
            {labels.lastAttempt}: {formattedLastAttempt}
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

type DecisionBarProps = {
  decisionActions: SubscriptionDecisionActions;
};

function DecisionBar({ decisionActions }: DecisionBarProps) {
  return (
    <SurfaceCard
      data-testid="subscriptions-detail-decision-bar"
      {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
      variant="section"
      tone="default"
      padding="compact"
      className={`${MOTION_CONTENT_SWAP_CLASS_NAME} mt-3 grid shrink-0 grid-cols-1 gap-2.5 rounded-md border-transparent bg-[var(--workspace-low-wire-action-surface)] px-3.5 pt-3.5 shadow-none backdrop-blur-sm sm:grid-cols-3 sm:px-4`}
    >
      {buildDecisionActionConfigs(decisionActions).map((action) => {
        const Icon = action.icon;

        return (
          <DecisionButton
            key={action.key}
            intent={action.intent}
            size="lg"
            aria-label={action.label}
            onClick={action.onClick}
          >
            <Icon className="size-4" />
            {action.label}
          </DecisionButton>
        );
      })}
    </SurfaceCard>
  );
}

type ManagementBarProps = {
  managementActions: SubscriptionManagementActions;
};

function ManagementBar({ managementActions }: ManagementBarProps) {
  return (
    <div
      data-testid="subscriptions-detail-management-bar"
      {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
      className={`${MOTION_CONTENT_SWAP_CLASS_NAME} mt-3 flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--workspace-low-wire-divider)] pt-3.5`}
    >
      <WorkspaceManagementActionButton
        intent="edit"
        label={managementActions.editLabel}
        onClick={managementActions.onEdit}
      >
        <Pencil className="size-4" />
        {managementActions.editLabel}
      </WorkspaceManagementActionButton>
      <WorkspaceManagementActionButton
        intent="delete"
        label={managementActions.deleteLabel}
        onClick={managementActions.onDelete}
      >
        <Trash2 className="size-4" />
        {managementActions.deleteLabel}
      </WorkspaceManagementActionButton>
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
  latestArticleLabel,
  latestArticleEmptyLabel = "—",
  updateFrequencyLabel,
  formatUpdateFrequencyValue,
  overloadedBadgeLabel,
  unreadCountLabel,
  starredCountLabel,
  reasonHeading,
  reasonHint,
  recentArticlesHeading,
  feedUrlLabel,
  contentUrlLabel,
  displayModeLabel,
  displayModeValue,
  dateLocale,
  decisionActions,
  managementActions,
  fetchError,
  fetchErrorLabels = {
    heading: "Fetch error",
    lastAttempt: "Last attempt",
    copyDiagnosticId: "Copy diagnostic number",
    retry: "Retry",
    retrying: "Retrying",
    editFeedUrl: "Review feed destination",
    reason: (kind) => kind,
  },
  onRetryFeed = () => undefined,
  onEditFeed = () => undefined,
  isRetryingFeed = () => false,
  onCopyDiagnosticId = () => undefined,
}: SubscriptionDetailPaneProps) {
  const feedUrlHref = normalizeFeedWebsiteUrlCandidate(row?.feed.url ?? "");
  const contentUrlHref = normalizeFeedWebsiteUrlCandidate(row?.feed.site_url ?? "");
  const hasFetchError = Boolean(fetchError?.error_kind);
  const showReviewContext = !hasFetchError || (row !== null && row.status.labelKey !== "normal");
  const formattedLastAttempt = fetchError?.last_attempt_at
    ? formatShortDateTime(fetchError.last_attempt_at, dateLocale)
    : null;

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
          <div
            data-testid="subscriptions-detail-scroll-region"
            key={row.feed.id}
            {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
            className={`${MOTION_CONTENT_SWAP_CLASS_NAME} lg:min-h-0 lg:flex-1 lg:overflow-y-auto`}
          >
            <div className="flex w-full flex-col gap-3.5 pb-4 pt-0.5 lg:min-h-full">
              {fetchError?.error_kind ? (
                <FetchErrorDetailCard
                  errorKind={fetchError.error_kind}
                  labels={fetchErrorLabels}
                  formattedLastAttempt={formattedLastAttempt}
                  diagnosticId={fetchError.diagnostic_id}
                  feedId={row.feed.id}
                  onRetryFeed={onRetryFeed}
                  onEditFeed={onEditFeed}
                  isRetryingFeed={isRetryingFeed}
                  onCopyDiagnosticId={onCopyDiagnosticId}
                />
              ) : null}
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
                badgeLabel={resolveBadgeLabel(hasFetchError, fetchErrorLabels.heading, detailCandidate)}
                badgeTone={resolveBadgeTone(hasFetchError, detailCandidate)}
                summaryText={resolveSummaryText(showReviewContext, detailCandidate, reasonHint)}
                reasonBox={resolveReasonBox(showReviewContext, detailCandidate, reasonHeading)}
                reasonChips={resolveReasonChips(showReviewContext, detailCandidate)}
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
                links={buildDetailLinks(feedUrlHref, contentUrlHref, feedUrlLabel, contentUrlLabel)}
                recentArticlesHeading={recentArticlesHeading}
                recentArticles={buildRecentArticles(metrics.previewArticles, dateLocale)}
              />
            </div>
          </div>

          {decisionActions ? (
            <DecisionBar key={`${row.feed.id}-decision-bar`} decisionActions={decisionActions} />
          ) : managementActions ? (
            <ManagementBar key={`${row.feed.id}-management-bar`} managementActions={managementActions} />
          ) : null}
        </>
      )}
    </section>
  );
}
