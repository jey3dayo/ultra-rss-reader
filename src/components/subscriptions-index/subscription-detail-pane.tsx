import { Check, Clock3, Trash2 } from "lucide-react";
import { DecisionButton } from "@/components/shared/decision-button";
import { FeedDetailPanel } from "@/components/shared/feed-detail-panel";
import { FeedFavicon } from "@/components/shared/feed-favicon";
import { SurfaceCard } from "@/components/shared/surface-card";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import { formatSubscriptionDate } from "@/lib/subscriptions-index";
import type {
  SubscriptionDecisionActions,
  SubscriptionDetailCandidate,
  SubscriptionDetailMetrics,
  SubscriptionListRow,
} from "./subscriptions-index.types";

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
  dateLocale,
  decisionActions,
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
  dateLocale: string;
  decisionActions: SubscriptionDecisionActions | null;
}) {
  return (
    <section
      data-testid="subscriptions-detail-pane"
      className="flex flex-col rounded-md px-4 py-5 sm:px-6 sm:py-5 lg:min-h-0"
      style={{
        backgroundColor: "var(--subscriptions-detail-surface)",
      }}
    >
      <div className="mb-5 border-b border-border/50 pb-4">
        <h2 className="font-sans text-[1.02rem] font-normal tracking-[-0.02em] text-foreground-soft">{heading}</h2>
      </div>
      {!row || !metrics ? (
        <div className="flex items-center lg:min-h-0 lg:flex-1">
          <p
            {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
            className={`${MOTION_CONTENT_SWAP_CLASS_NAME} w-full rounded-md border border-dashed border-border/70 bg-surface-1/78 px-5 py-6 text-sm text-foreground-soft`}
          >
            {emptyLabel}
          </p>
        </div>
      ) : (
        <div
          data-testid="subscriptions-detail-scroll-region"
          key={row.feed.id}
          {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
          className={`${MOTION_CONTENT_SWAP_CLASS_NAME} lg:min-h-0 lg:flex-1 lg:overflow-y-auto`}
        >
          <div className="flex w-full flex-col gap-4 pb-7 pt-1 lg:min-h-full">
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
                  value: formatSubscriptionDate(metrics.latestArticleAt, dateLocale),
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
                publishedAt: formatSubscriptionDate(article.published_at, dateLocale),
                url: article.url,
              }))}
            />

            {decisionActions ? (
              <SurfaceCard
                data-testid="subscriptions-detail-decision-bar"
                {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
                variant="section"
                tone="default"
                padding="compact"
                className={`${MOTION_CONTENT_SWAP_CLASS_NAME} grid grid-cols-3 gap-2 rounded-md px-4 shadow-none sm:px-5`}
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
                      <Icon className="h-4 w-4" />
                      {action.label}
                    </DecisionButton>
                  );
                })}
              </SurfaceCard>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
