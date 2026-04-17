import { WorkspaceHeader } from "@/components/shared/workspace-header";
import {
  WORKSPACE_CANVAS_CLASS,
  WORKSPACE_CHROME_SPACING_CLASS,
  workspaceSplitShellClassName,
} from "@/components/shared/workspace-pane-layout";
import { hasTauriRuntime, shouldUseDesktopOverlayTitlebar } from "@/lib/window-chrome";
import { usePlatformStore } from "@/stores/platform-store";
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
  listScrollTop,
  folderLabel,
  latestArticleLabel,
  unreadCountLabel,
  starredCountLabel,
  reasonHeading,
  reasonHint,
  recentArticlesHeading,
  displayModeLabel,
  displayModeValue,
  batchReviewLabel,
  batchReviewDescription,
  decisionActions,
  backLabel,
  closeLabel,
  isGroupExpanded,
  onSelectSummaryFilter,
  onSelectFeed,
  onListScrollTopChange,
  onToggleGroup,
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
  listScrollTop: number;
  folderLabel: string;
  latestArticleLabel: string;
  unreadCountLabel: string;
  starredCountLabel: string;
  reasonHeading: string;
  reasonHint: string;
  recentArticlesHeading: string;
  displayModeLabel: string;
  displayModeValue: string;
  batchReviewLabel?: string;
  batchReviewDescription?: string;
  decisionActions: {
    keepLabel: string;
    deferLabel: string;
    deleteLabel: string;
    onKeep: () => void;
    onDefer: () => void;
    onDelete: () => void;
  } | null;
  backLabel: string;
  closeLabel: string;
  isGroupExpanded: (groupKey: string) => boolean;
  onSelectSummaryFilter: (filterKey: SubscriptionSummaryCard["filterKey"]) => void;
  onSelectFeed: (feedId: string) => void;
  onListScrollTopChange: (scrollTop: number) => void;
  onToggleGroup: (groupKey: string) => void;
  onOpenCleanup: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const useDesktopOverlay = shouldUseDesktopOverlayTitlebar({
    platformKind,
    hasTauriRuntime: hasTauriRuntime(),
  });

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-1 flex-col overflow-y-auto bg-background lg:overflow-hidden">
      <WorkspaceHeader
        eyebrow="Workspace"
        title={title}
        subtitle={subtitle}
        backLabel={backLabel}
        onBack={onBack}
        closeLabel={closeLabel}
        onClose={onClose}
      />
      <div className={`${WORKSPACE_CHROME_SPACING_CLASS} pt-1 sm:pt-1.5`}>
        <div className={`${WORKSPACE_CANVAS_CLASS} gap-3.5 sm:gap-4 ${useDesktopOverlay ? "pl-6 sm:pl-6" : ""}`}>
          <SubscriptionsOverviewSummary
            cards={summaryCards}
            onSelectFilter={onSelectSummaryFilter}
            batchActionLabel={batchReviewLabel}
            batchActionDescription={batchReviewDescription}
            onOpenBatchAction={batchReviewLabel ? onOpenCleanup : null}
          />
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
              isGroupExpanded={isGroupExpanded}
              initialScrollTop={listScrollTop}
              onSelectFeed={onSelectFeed}
              onListScrollTopChange={onListScrollTopChange}
              onToggleGroup={onToggleGroup}
            />
            <SubscriptionDetailPane
              heading={detailHeading}
              row={selectedRow}
              metrics={selectedMetrics}
              detailCandidate={selectedDetailCandidate}
              emptyLabel={detailEmptyLabel}
              folderLabel={folderLabel}
              latestArticleLabel={latestArticleLabel}
              unreadCountLabel={unreadCountLabel}
              starredCountLabel={starredCountLabel}
              reasonHeading={reasonHeading}
              reasonHint={reasonHint}
              recentArticlesHeading={recentArticlesHeading}
              displayModeLabel={displayModeLabel}
              displayModeValue={displayModeValue}
              decisionActions={decisionActions}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
