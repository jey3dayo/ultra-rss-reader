import { WorkspaceHeader } from "@/components/shared/workspace-header";
import { SubscriptionDetailPane } from "./subscription-detail-pane";
import type {
  SubscriptionDetailCandidate,
  SubscriptionDetailMetrics,
  SubscriptionListGroup,
  SubscriptionListRow,
  SubscriptionSummaryCard,
} from "./subscriptions-index.types";
import { SubscriptionsListPane } from "./subscriptions-list-pane";
import { SubscriptionsOverviewSummary } from "./subscriptions-overview-summary";

export function SubscriptionsIndexPageView({
  title,
  subtitle,
  summaryCards,
  inventoryHeading,
  detailHeading,
  groups,
  selectedFeedId,
  selectedRow,
  selectedMetrics,
  selectedDetailCandidate,
  emptyLabel,
  detailEmptyLabel,
  statusLabels,
  formatUnreadCountLabel,
  formatLatestArticleLabel,
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
  backLabel,
  closeLabel,
  onSelectFeed,
  onOpenCleanup,
  onBack,
  onClose,
}: {
  title: string;
  subtitle: string;
  summaryCards: SubscriptionSummaryCard[];
  inventoryHeading: string;
  detailHeading: string;
  groups: SubscriptionListGroup[];
  selectedFeedId: string | null;
  selectedRow: SubscriptionListRow | null;
  selectedMetrics: SubscriptionDetailMetrics | null;
  selectedDetailCandidate: SubscriptionDetailCandidate | null;
  emptyLabel: string;
  detailEmptyLabel: string;
  statusLabels: Record<SubscriptionListRow["status"]["labelKey"], string>;
  formatUnreadCountLabel: (count: number) => string;
  formatLatestArticleLabel: (value: string | null) => string;
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
  backLabel: string;
  closeLabel: string;
  onSelectFeed: (feedId: string) => void;
  onOpenCleanup: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="flex h-dvh max-h-dvh min-h-0 flex-1 flex-col overflow-hidden"
      style={{ backgroundImage: "var(--subscriptions-shell-bg)" }}
    >
      <WorkspaceHeader
        eyebrow="Workspace"
        title={title}
        subtitle={subtitle}
        backLabel={backLabel}
        onBack={onBack}
        closeLabel={closeLabel}
        onClose={onClose}
      />
      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 sm:px-5 sm:pb-5">
        <div className="mx-auto flex min-h-0 w-full max-w-[1500px] flex-1 flex-col">
          <SubscriptionsOverviewSummary cards={summaryCards} />
          <div
            data-testid="subscriptions-workspace-shell"
            className="mt-3 grid min-h-0 flex-1 overflow-hidden rounded-xl border border-border/70 lg:mt-4 lg:grid-cols-[minmax(0,1.02fr)_minmax(380px,0.98fr)]"
            style={{
              backgroundColor: "var(--subscriptions-workspace-surface)",
              boxShadow: "var(--subscriptions-workspace-shadow)",
            }}
          >
            <SubscriptionsListPane
              heading={inventoryHeading}
              groups={groups}
              selectedFeedId={selectedFeedId}
              emptyLabel={emptyLabel}
              statusLabels={statusLabels}
              formatUnreadCountLabel={formatUnreadCountLabel}
              formatLatestArticleLabel={formatLatestArticleLabel}
              onSelectFeed={onSelectFeed}
            />
            <SubscriptionDetailPane
              heading={detailHeading}
              emptyLabel={detailEmptyLabel}
              row={selectedRow}
              metrics={selectedMetrics}
              detailCandidate={selectedDetailCandidate}
              folderLabel={folderLabel}
              latestArticleLabel={latestArticleLabel}
              unreadCountLabel={unreadCountLabel}
              starredCountLabel={starredCountLabel}
              reasonHeading={reasonHeading}
              reasonHint={reasonHint}
              recentArticlesHeading={recentArticlesHeading}
              displayModeLabel={displayModeLabel}
              displayModeValue={displayModeValue}
              openCleanupLabel={openCleanupLabel}
              onOpenCleanup={onOpenCleanup}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
