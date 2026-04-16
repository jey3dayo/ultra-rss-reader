import { WorkspaceHeader } from "@/components/shared/workspace-header";
import {
  WORKSPACE_CANVAS_CLASS,
  WORKSPACE_CHROME_SPACING_CLASS,
  workspaceSplitShellClassName,
} from "@/components/shared/workspace-pane-layout";
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
      className="flex h-dvh max-h-dvh min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden"
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
      <div className={`${WORKSPACE_CHROME_SPACING_CLASS} pt-3 sm:pt-4`}>
        <div className={`${WORKSPACE_CANVAS_CLASS} gap-4 sm:gap-5`}>
          <SubscriptionsOverviewSummary cards={summaryCards} />
          <div
            data-testid="subscriptions-workspace-shell"
            className={workspaceSplitShellClassName("mt-0 rounded-xl border-border/55")}
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
