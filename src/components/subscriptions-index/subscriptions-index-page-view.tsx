import type { RefObject } from "react";
import type { LocalFeedSyncStatusDto } from "@/api/tauri-commands";
import { WORKSPACE_CANVAS_CLASS, WORKSPACE_CHROME_SPACING_CLASS, workspaceSplitShellClassName } from "@/design-system";
import type { FeedRetryOutcomeKind } from "@/hooks/use-local-feed-sync-statuses";
import type { SubscriptionActionRail } from "@/lib/subscriptions/subscriptions-index";
import type {
  SubscriptionDetailCandidate,
  SubscriptionDetailMetrics,
  SubscriptionListGroup,
  SubscriptionListRow,
  SubscriptionSummaryFilterKey,
} from "@/lib/subscriptions/subscriptions-index.types";
import { hasTauriRuntime, shouldUseDesktopOverlayTitlebar } from "@/lib/window/window-chrome";
import { usePlatformStore } from "@/stores/platform-store";
import { SubscriptionDetailPane } from "./subscription-detail-pane";
import type { SubscriptionsBulkRunStatus } from "./subscriptions-bulk-run-status";
import type { SubscriptionsBulkSelection } from "./subscriptions-bulk-selection";
import type { SubscriptionsFilterBarModel } from "./subscriptions-filter-bar";
import type { SubscriptionsKeptBanner } from "./subscriptions-kept-banner";
import { SubscriptionsListPane } from "./subscriptions-list-pane";
import type {
  SubscriptionsActionableStatusLabels,
  SubscriptionsKeptMarker,
  SubscriptionsLatestArticleLabels,
} from "./subscriptions-list-row";
import type { SubscriptionsListLoadState, SubscriptionsLoadFailure } from "./subscriptions-load-status";
import type { SubscriptionsSearchCondition } from "./subscriptions-search-condition";

type SubscriptionsIndexPageViewProps = {
  filterBar: SubscriptionsFilterBarModel;
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
  selectedRemoteFetchFailure: { lastSuccessAt: string } | null;
  remoteFetchFailureLabels: {
    heading: string;
    body: string;
    lastSuccess: string;
  };
  selectedRetryOutcome: FeedRetryOutcomeKind | null;
  onRetryFeed: (feedId: string) => void;
  onEditFeed: () => void;
  isRetryingFeed: (feedId: string) => boolean;
  onCopyDiagnosticId: (diagnosticId: string) => void;
  copyFeedUrlLabel: string;
  onCopyFeedUrl: (feedUrl: string) => void;
  backToListLabel: string;
  onBackToList: () => void;
  emptyLabel: string;
  listLoadState: SubscriptionsListLoadState;
  summaryLoadFailure: SubscriptionsLoadFailure | null;
  searchQuery: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchClearLabel: string;
  addFeedLabel: string;
  onAddFeed?: () => void;
  detailEmptyLabel: string;
  statusLabels: SubscriptionsActionableStatusLabels;
  reasonTooltipLabels: Partial<Record<NonNullable<SubscriptionListRow["reasonTooltipKey"]>, string>>;
  fetchErrorLabel: string;
  remoteFetchFailureLabel: string;
  formatUnreadCountLabel: (count: number) => string;
  latestArticleLabels: SubscriptionsLatestArticleLabels;
  dateLocale: string;
  listScrollResetKey: number;
  listScrollTop: number;
  feedScrollRequest?: { feedId: string; sequence: number } | null;
  scrollRegionRef: RefObject<HTMLDivElement | null>;
  workspaceScrollRef: RefObject<HTMLDivElement | null>;
  viewportWidth: number;
  scrollReady: boolean;
  kept?: SubscriptionsKeptMarker;
  keptBanner?: SubscriptionsKeptBanner | null;
  searchCondition?: SubscriptionsSearchCondition | null;
  emptyShowAllLabel?: string;
  listHeadingRef?: RefObject<HTMLHeadingElement | null>;
  bulkSelection?: SubscriptionsBulkSelection;
  bulkRunStatus?: SubscriptionsBulkRunStatus | null;
  folderLabel: string;
  folderNoneLabel: string;
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
  actionRail: SubscriptionActionRail | null;
  isGroupExpanded: (groupKey: string) => boolean;
  onSelectSummaryFilter: (filterKey: SubscriptionSummaryFilterKey) => void;
  onSelectFeed: (feedId: string) => void;
  onListScrollTopChange: (scrollTop: number) => void;
  onSearchQueryChange: (query: string) => void;
  onToggleGroup: (groupKey: string) => void;
};

export function SubscriptionsIndexPageView({
  filterBar,
  inventoryHeading,
  detailHeading,
  groups,
  selectedFeedId,
  selectedRow,
  selectedMetrics,
  selectedDetailCandidate,
  selectedFetchError,
  fetchErrorLabels,
  selectedRemoteFetchFailure,
  remoteFetchFailureLabels,
  selectedRetryOutcome,
  onRetryFeed,
  onEditFeed,
  isRetryingFeed,
  onCopyDiagnosticId,
  copyFeedUrlLabel,
  onCopyFeedUrl,
  backToListLabel,
  onBackToList,
  emptyLabel,
  listLoadState,
  summaryLoadFailure,
  searchQuery,
  searchLabel,
  searchPlaceholder,
  searchClearLabel,
  addFeedLabel,
  onAddFeed,
  detailEmptyLabel,
  statusLabels,
  reasonTooltipLabels,
  fetchErrorLabel,
  remoteFetchFailureLabel,
  formatUnreadCountLabel,
  latestArticleLabels,
  dateLocale,
  listScrollResetKey,
  listScrollTop,
  feedScrollRequest,
  scrollRegionRef,
  workspaceScrollRef,
  viewportWidth,
  scrollReady,
  kept,
  keptBanner,
  searchCondition,
  emptyShowAllLabel,
  listHeadingRef,
  bulkSelection,
  bulkRunStatus,
  folderLabel,
  folderNoneLabel,
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
  actionRail,
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
              addFeedLabel={addFeedLabel}
              onAddFeed={onAddFeed}
              statusLabels={statusLabels}
              reasonTooltipLabels={reasonTooltipLabels}
              fetchErrorLabel={fetchErrorLabel}
              remoteFetchFailureLabel={remoteFetchFailureLabel}
              formatUnreadCountLabel={formatUnreadCountLabel}
              latestArticleLabels={latestArticleLabels}
              isGroupExpanded={isGroupExpanded}
              scrollResetKey={listScrollResetKey}
              initialScrollTop={listScrollTop}
              feedScrollRequest={feedScrollRequest}
              scrollRegionRef={scrollRegionRef}
              workspaceScrollRef={workspaceScrollRef}
              viewportWidth={viewportWidth}
              scrollReady={scrollReady}
              kept={kept}
              keptBanner={keptBanner}
              searchCondition={searchCondition}
              emptyShowAllLabel={emptyShowAllLabel}
              headingRef={listHeadingRef}
              filterBar={{ model: filterBar, loadFailure: summaryLoadFailure, onSelect: onSelectSummaryFilter }}
              bulkSelection={bulkSelection}
              bulkRunStatus={bulkRunStatus}
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
              remoteFetchFailure={selectedRemoteFetchFailure}
              remoteFetchFailureLabels={remoteFetchFailureLabels}
              retryOutcome={selectedRetryOutcome}
              onRetryFeed={onRetryFeed}
              onEditFeed={onEditFeed}
              isRetryingFeed={isRetryingFeed}
              onCopyDiagnosticId={onCopyDiagnosticId}
              copyFeedUrlLabel={copyFeedUrlLabel}
              onCopyFeedUrl={onCopyFeedUrl}
              backToListLabel={backToListLabel}
              onBackToList={onBackToList}
              emptyLabel={detailEmptyLabel}
              folderLabel={folderLabel}
              folderNoneLabel={folderNoneLabel}
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
              actionRail={actionRail}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
