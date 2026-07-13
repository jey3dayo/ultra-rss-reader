import {
  WORKSPACE_CANVAS_CLASS,
  WORKSPACE_CHROME_SPACING_CLASS,
  WorkspaceHeader,
  workspaceSplitShellClassName,
} from "@/design-system";
import type { SubscriptionDecisionActions } from "@/lib/subscriptions/subscriptions-index";
import type {
  SubscriptionDetailCandidate,
  SubscriptionDetailMetrics,
  SubscriptionListGroup,
  SubscriptionListRow,
  SubscriptionSummaryCard,
} from "@/lib/subscriptions/subscriptions-index.types";
import { hasTauriRuntime, shouldUseDesktopOverlayTitlebar } from "@/lib/window/window-chrome";
import { usePlatformStore } from "@/stores/platform-store";
import { SubscriptionDetailPane, type SubscriptionManagementActions } from "./subscription-detail-pane";
import { SubscriptionsListPane } from "./subscriptions-list-pane";
import {
  SubscriptionsOverviewSummary,
  type SubscriptionsOverviewSummaryLabels,
} from "./subscriptions-overview-summary";

type SubscriptionsIndexPageViewProps = {
  title: string;
  subtitle: string;
  summaryCards: SubscriptionSummaryCard[];
  summaryLabels: SubscriptionsOverviewSummaryLabels;
  reviewCriteriaLabel: string;
  inventoryHeading: string;
  detailHeading: string;
  groups: SubscriptionListGroup[];
  selectedFeedId: string | null;
  selectedRow: SubscriptionListRow | null;
  selectedMetrics: SubscriptionDetailMetrics | null;
  selectedDetailCandidate: SubscriptionDetailCandidate | null;
  emptyLabel: string;
  searchQuery: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchClearLabel: string;
  detailEmptyLabel: string;
  statusLabels: Record<SubscriptionListRow["status"]["labelKey"], string>;
  reasonTooltipLabels: Record<NonNullable<SubscriptionListRow["reasonTooltipKey"]>, string>;
  formatUnreadCountLabel: (count: number) => string;
  formatLatestArticleLabel: (value: string | null) => string;
  dateLocale: string;
  listScrollResetKey: number;
  listScrollTop: number;
  folderLabel: string;
  latestArticleLabel: string;
  latestArticleEmptyLabel: string;
  unreadCountLabel: string;
  starredCountLabel: string;
  reasonHeading: string;
  reasonHint: string;
  recentArticlesHeading: string;
  displayModeLabel: string;
  displayModeValue: string;
  decisionActions: SubscriptionDecisionActions | null;
  managementActions: SubscriptionManagementActions | null;
  backLabel: string;
  closeLabel: string;
  isGroupExpanded: (groupKey: string) => boolean;
  onSelectSummaryFilter: (filterKey: SubscriptionSummaryCard["filterKey"]) => void;
  onSelectFeed: (feedId: string) => void;
  onListScrollTopChange: (scrollTop: number) => void;
  onSearchQueryChange: (query: string) => void;
  onToggleGroup: (groupKey: string) => void;
  onBack: () => void;
  onClose: () => void;
};

export function SubscriptionsIndexPageView({
  title,
  summaryCards,
  summaryLabels,
  reviewCriteriaLabel,
  inventoryHeading,
  detailHeading,
  groups,
  selectedFeedId,
  selectedRow,
  selectedMetrics,
  selectedDetailCandidate,
  emptyLabel,
  searchQuery,
  searchLabel,
  searchPlaceholder,
  searchClearLabel,
  detailEmptyLabel,
  statusLabels,
  reasonTooltipLabels,
  formatUnreadCountLabel,
  formatLatestArticleLabel,
  dateLocale,
  listScrollResetKey,
  listScrollTop,
  folderLabel,
  latestArticleLabel,
  latestArticleEmptyLabel,
  unreadCountLabel,
  starredCountLabel,
  reasonHeading,
  reasonHint,
  recentArticlesHeading,
  displayModeLabel,
  displayModeValue,
  decisionActions,
  managementActions,
  backLabel,
  closeLabel,
  isGroupExpanded,
  onSelectSummaryFilter,
  onSelectFeed,
  onListScrollTopChange,
  onSearchQueryChange,
  onToggleGroup,
  onBack,
  onClose,
}: SubscriptionsIndexPageViewProps) {
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const useDesktopOverlay = shouldUseDesktopOverlayTitlebar({
    platformKind,
    hasTauriRuntime: hasTauriRuntime(),
  });

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-1 flex-col overflow-y-auto bg-background lg:overflow-hidden">
      <WorkspaceHeader title={title} backLabel={backLabel} onBack={onBack} closeLabel={closeLabel} onClose={onClose} />
      <div className={`${WORKSPACE_CHROME_SPACING_CLASS} pt-2 sm:pt-3`}>
        <div className={`${WORKSPACE_CANVAS_CLASS} gap-4 sm:gap-5 ${useDesktopOverlay ? "pl-6 sm:pl-6" : ""}`}>
          <SubscriptionsOverviewSummary
            cards={summaryCards}
            labels={summaryLabels}
            reviewCriteriaLabel={reviewCriteriaLabel}
            onSelectFilter={onSelectSummaryFilter}
          />
          <div
            data-testid="subscriptions-workspace-shell"
            className={workspaceSplitShellClassName("mt-0 bg-clip-padding")}
            style={{
              borderColor: "transparent",
              backgroundColor: "transparent",
              boxShadow: "var(--subscriptions-workspace-shadow)",
            }}
          >
            <SubscriptionsListPane
              heading={inventoryHeading}
              groups={groups}
              selectedFeedId={selectedFeedId}
              emptyLabel={emptyLabel}
              searchQuery={searchQuery}
              searchLabel={searchLabel}
              searchPlaceholder={searchPlaceholder}
              searchClearLabel={searchClearLabel}
              statusLabels={statusLabels}
              reasonTooltipLabels={reasonTooltipLabels}
              formatUnreadCountLabel={formatUnreadCountLabel}
              formatLatestArticleLabel={formatLatestArticleLabel}
              isGroupExpanded={isGroupExpanded}
              scrollResetKey={listScrollResetKey}
              initialScrollTop={listScrollTop}
              onSelectFeed={onSelectFeed}
              onListScrollTopChange={onListScrollTopChange}
              onSearchQueryChange={onSearchQueryChange}
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
              latestArticleEmptyLabel={latestArticleEmptyLabel}
              unreadCountLabel={unreadCountLabel}
              starredCountLabel={starredCountLabel}
              reasonHeading={reasonHeading}
              reasonHint={reasonHint}
              recentArticlesHeading={recentArticlesHeading}
              displayModeLabel={displayModeLabel}
              displayModeValue={displayModeValue}
              dateLocale={dateLocale}
              decisionActions={decisionActions}
              managementActions={managementActions}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
