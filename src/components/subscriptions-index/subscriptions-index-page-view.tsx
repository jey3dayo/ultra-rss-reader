import type { RefObject } from "react";
import type { LocalFeedSyncStatusDto } from "@/api/tauri-commands";
import { WORKSPACE_CANVAS_CLASS, WORKSPACE_CHROME_SPACING_CLASS, workspaceSplitShellClassName } from "@/design-system";
import type { FeedRetryOutcomeKind } from "@/hooks/use-local-feed-sync-statuses";
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
import type { SubscriptionsBulkSelection } from "./subscriptions-bulk-selection";
import { SubscriptionsListPane } from "./subscriptions-list-pane";
import type { SubscriptionsKeptMarker } from "./subscriptions-list-row";
import type { SubscriptionsListLoadState, SubscriptionsLoadFailure } from "./subscriptions-load-status";
import {
  SubscriptionsOverviewSummary,
  type SubscriptionsOverviewSummaryLabels,
} from "./subscriptions-overview-summary";

type SubscriptionsIndexPageViewProps = {
  summaryCards: SubscriptionSummaryCard[];
  summaryLabels: SubscriptionsOverviewSummaryLabels;
  inventoryHeading: string;
  detailHeading: string;
  groups: SubscriptionListGroup[];
  selectedFeedId: string | null;
  selectedRow: SubscriptionListRow | null;
  selectedMetrics: SubscriptionDetailMetrics | null;
  selectedDetailCandidate: SubscriptionDetailCandidate | null;
  selectedFetchError: LocalFeedSyncStatusDto | null;
  fetchErrorLabels: {
    heading: string;
    lastAttempt: string;
    copyDiagnosticId: string;
    retry: string;
    retrying: string;
    editFeedUrl: string;
    reason: (kind: NonNullable<LocalFeedSyncStatusDto["error_kind"]>) => string;
    retryOutcome: (kind: FeedRetryOutcomeKind) => string;
  };
  selectedRetryOutcome: FeedRetryOutcomeKind | null;
  onRetryFeed: (feedId: string) => void;
  onEditFeed: () => void;
  isRetryingFeed: (feedId: string) => boolean;
  onCopyDiagnosticId: (diagnosticId: string) => void;
  emptyLabel: string;
  listLoadState: SubscriptionsListLoadState;
  summaryLoadFailure: SubscriptionsLoadFailure | null;
  searchQuery: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchClearLabel: string;
  detailEmptyLabel: string;
  statusLabels: Record<SubscriptionListRow["status"]["labelKey"], string>;
  reasonTooltipLabels: Partial<Record<NonNullable<SubscriptionListRow["reasonTooltipKey"]>, string>>;
  fetchErrorLabel: string;
  formatUnreadCountLabel: (count: number) => string;
  formatLatestArticleLabel: (value: string) => string;
  dateLocale: string;
  listScrollResetKey: number;
  listScrollTop: number;
  scrollRegionRef: RefObject<HTMLDivElement | null>;
  workspaceScrollRef: RefObject<HTMLDivElement | null>;
  viewportWidth: number;
  scrollReady: boolean;
  kept?: SubscriptionsKeptMarker;
  bulkSelection?: SubscriptionsBulkSelection;
  folderLabel: string;
  latestArticleLabel: string;
  latestArticleEmptyLabel: string;
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
  decisionActions: SubscriptionDecisionActions | null;
  managementActions: SubscriptionManagementActions | null;
  isGroupExpanded: (groupKey: string) => boolean;
  onSelectSummaryFilter: (filterKey: SubscriptionSummaryCard["filterKey"]) => void;
  onSelectFeed: (feedId: string) => void;
  onListScrollTopChange: (scrollTop: number) => void;
  onSearchQueryChange: (query: string) => void;
  onToggleGroup: (groupKey: string) => void;
};

export function SubscriptionsIndexPageView({
  summaryCards,
  summaryLabels,
  inventoryHeading,
  detailHeading,
  groups,
  selectedFeedId,
  selectedRow,
  selectedMetrics,
  selectedDetailCandidate,
  selectedFetchError,
  fetchErrorLabels,
  selectedRetryOutcome,
  onRetryFeed,
  onEditFeed,
  isRetryingFeed,
  onCopyDiagnosticId,
  emptyLabel,
  listLoadState,
  summaryLoadFailure,
  searchQuery,
  searchLabel,
  searchPlaceholder,
  searchClearLabel,
  detailEmptyLabel,
  statusLabels,
  reasonTooltipLabels,
  fetchErrorLabel,
  formatUnreadCountLabel,
  formatLatestArticleLabel,
  dateLocale,
  listScrollResetKey,
  listScrollTop,
  scrollRegionRef,
  workspaceScrollRef,
  viewportWidth,
  scrollReady,
  kept,
  bulkSelection,
  folderLabel,
  latestArticleLabel,
  latestArticleEmptyLabel,
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
  decisionActions,
  managementActions,
  isGroupExpanded,
  onSelectSummaryFilter,
  onSelectFeed,
  onListScrollTopChange,
  onSearchQueryChange,
  onToggleGroup,
}: SubscriptionsIndexPageViewProps) {
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const useDesktopOverlay = shouldUseDesktopOverlayTitlebar({
    platformKind,
    hasTauriRuntime: hasTauriRuntime(),
  });

  return (
    <div className="contents">
      <div className={`${WORKSPACE_CHROME_SPACING_CLASS} pt-2 sm:pt-3`}>
        <div className={`${WORKSPACE_CANVAS_CLASS} gap-4 sm:gap-5 ${useDesktopOverlay ? "pl-6 sm:pl-6" : ""}`}>
          <SubscriptionsOverviewSummary
            cards={summaryCards}
            labels={summaryLabels}
            loadFailure={summaryLoadFailure}
            onSelectFilter={onSelectSummaryFilter}
          />
          <div
            data-testid="subscriptions-workspace-shell"
            className={workspaceSplitShellClassName("mt-0 bg-clip-padding")}
            style={{
              backgroundColor: "transparent",
              boxShadow: "var(--subscriptions-workspace-shadow)",
            }}
          >
            <SubscriptionsListPane
              heading={inventoryHeading}
              groups={groups}
              selectedFeedId={selectedFeedId}
              emptyLabel={emptyLabel}
              loadState={listLoadState}
              searchQuery={searchQuery}
              searchLabel={searchLabel}
              searchPlaceholder={searchPlaceholder}
              searchClearLabel={searchClearLabel}
              statusLabels={statusLabels}
              reasonTooltipLabels={reasonTooltipLabels}
              fetchErrorLabel={fetchErrorLabel}
              formatUnreadCountLabel={formatUnreadCountLabel}
              formatLatestArticleLabel={formatLatestArticleLabel}
              isGroupExpanded={isGroupExpanded}
              scrollResetKey={listScrollResetKey}
              initialScrollTop={listScrollTop}
              scrollRegionRef={scrollRegionRef}
              workspaceScrollRef={workspaceScrollRef}
              viewportWidth={viewportWidth}
              scrollReady={scrollReady}
              kept={kept}
              bulkSelection={bulkSelection}
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
              fetchError={selectedFetchError}
              fetchErrorLabels={fetchErrorLabels}
              retryOutcome={selectedRetryOutcome}
              onRetryFeed={onRetryFeed}
              onEditFeed={onEditFeed}
              isRetryingFeed={isRetryingFeed}
              onCopyDiagnosticId={onCopyDiagnosticId}
              emptyLabel={detailEmptyLabel}
              folderLabel={folderLabel}
              latestArticleLabel={latestArticleLabel}
              latestArticleEmptyLabel={latestArticleEmptyLabel}
              updateFrequencyLabel={updateFrequencyLabel}
              formatUpdateFrequencyValue={formatUpdateFrequencyValue}
              overloadedBadgeLabel={overloadedBadgeLabel}
              unreadCountLabel={unreadCountLabel}
              starredCountLabel={starredCountLabel}
              reasonHeading={reasonHeading}
              recentArticlesHeading={recentArticlesHeading}
              feedUrlLabel={feedUrlLabel}
              contentUrlLabel={contentUrlLabel}
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
