import { Check, Clock3, Globe, Pencil, Rss, Trash2 } from "lucide-react";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import {
  DecisionButton,
  FeedDetailPanel,
  FeedFavicon,
  SurfaceCard,
  WorkspaceManagementActionButton,
} from "@/design-system";
import { normalizeFeedWebsiteUrlCandidate } from "@/lib/feed/feed";
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
}: SubscriptionDetailPaneProps) {
  const feedUrlHref = normalizeFeedWebsiteUrlCandidate(row?.feed.url ?? "");
  const contentUrlHref = normalizeFeedWebsiteUrlCandidate(row?.feed.site_url ?? "");
  const detailLinks = [
    ...(feedUrlHref ? [{ href: feedUrlHref, label: feedUrlLabel, icon: Rss }] : []),
    ...(contentUrlHref && contentUrlHref !== feedUrlHref
      ? [{ href: contentUrlHref, label: contentUrlLabel, icon: Globe }]
      : []),
  ];

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
        <div className="flex items-center lg:min-h-0 lg:flex-1">
          <p
            {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
            className={`${MOTION_CONTENT_SWAP_CLASS_NAME} w-full rounded-md border border-dashed border-[var(--workspace-low-wire-section-border)] bg-[var(--workspace-low-wire-group-surface)] px-5 py-6 text-sm text-foreground-soft shadow-none`}
          >
            {emptyLabel}
          </p>
        </div>
      ) : (
        <>
          <div
            data-testid="subscriptions-detail-scroll-region"
            key={row.feed.id}
            {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
            className={`${MOTION_CONTENT_SWAP_CLASS_NAME} lg:min-h-0 lg:flex-1 lg:overflow-y-auto`}
          >
            <div className="flex w-full flex-col gap-3.5 pb-4 pt-0.5 lg:min-h-full">
              <FeedDetailPanel
                surface="low-wire"
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
                    value: formatLatestArticleMetric(metrics.latestArticleAt, dateLocale, latestArticleEmptyLabel),
                  },
                  {
                    label: updateFrequencyLabel,
                    value: formatUpdateFrequencyValue(metrics.recentArticleCount),
                  },
                  { label: unreadCountLabel, value: row.feed.unread_count },
                  { label: starredCountLabel, value: metrics.starredCount },
                  { label: displayModeLabel, value: displayModeValue },
                ]}
                links={detailLinks}
                recentArticlesHeading={recentArticlesHeading}
                recentArticles={metrics.previewArticles.map((article) => ({
                  id: article.id,
                  title: article.title,
                  publishedAt: formatSubscriptionDate(article.published_at, dateLocale),
                  url: article.url,
                }))}
              />
            </div>
          </div>

          {decisionActions ? (
            <SurfaceCard
              data-testid="subscriptions-detail-decision-bar"
              key={`${row.feed.id}-decision-bar`}
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
          ) : managementActions ? (
            <div
              data-testid="subscriptions-detail-management-bar"
              key={`${row.feed.id}-management-bar`}
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
          ) : null}
        </>
      )}
    </section>
  );
}
