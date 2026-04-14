import { SubscriptionDetailPane } from "./subscription-detail-pane";
import type {
  SubscriptionDetailMetrics,
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
  rows,
  selectedFeedId,
  selectedRow,
  selectedMetrics,
  emptyLabel,
  detailEmptyLabel,
  statusLabels,
  formatFolderLabel,
  formatUnreadCountLabel,
  formatLatestArticleLabel,
  folderLabel,
  latestArticleLabel,
  unreadCountLabel,
  starredCountLabel,
  websiteUrlLabel,
  feedUrlLabel,
  displayModeLabel,
  displayModeValue,
  openCleanupLabel,
  onSelectFeed,
  onOpenCleanup,
}: {
  title: string;
  subtitle: string;
  summaryCards: SubscriptionSummaryCard[];
  inventoryHeading: string;
  detailHeading: string;
  rows: SubscriptionListRow[];
  selectedFeedId: string | null;
  selectedRow: SubscriptionListRow | null;
  selectedMetrics: SubscriptionDetailMetrics | null;
  emptyLabel: string;
  detailEmptyLabel: string;
  statusLabels: Record<SubscriptionListRow["status"]["labelKey"], string>;
  formatFolderLabel: (folderName: string | null) => string;
  formatUnreadCountLabel: (count: number) => string;
  formatLatestArticleLabel: (value: string | null) => string;
  folderLabel: string;
  latestArticleLabel: string;
  unreadCountLabel: string;
  starredCountLabel: string;
  websiteUrlLabel: string;
  feedUrlLabel: string;
  displayModeLabel: string;
  displayModeValue: string;
  openCleanupLabel: string;
  onSelectFeed: (feedId: string) => void;
  onOpenCleanup: () => void;
}) {
  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="border-b border-border px-6 py-5">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <SubscriptionsOverviewSummary cards={summaryCards} />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] overflow-hidden">
        <SubscriptionsListPane
          heading={inventoryHeading}
          rows={rows}
          selectedFeedId={selectedFeedId}
          emptyLabel={emptyLabel}
          statusLabels={statusLabels}
          formatFolderLabel={formatFolderLabel}
          formatUnreadCountLabel={formatUnreadCountLabel}
          formatLatestArticleLabel={formatLatestArticleLabel}
          onSelectFeed={onSelectFeed}
        />
        <SubscriptionDetailPane
          heading={detailHeading}
          emptyLabel={detailEmptyLabel}
          row={selectedRow}
          metrics={selectedMetrics}
          folderLabel={folderLabel}
          latestArticleLabel={latestArticleLabel}
          unreadCountLabel={unreadCountLabel}
          starredCountLabel={starredCountLabel}
          websiteUrlLabel={websiteUrlLabel}
          feedUrlLabel={feedUrlLabel}
          displayModeLabel={displayModeLabel}
          displayModeValue={displayModeValue}
          openCleanupLabel={openCleanupLabel}
          onOpenCleanup={onOpenCleanup}
        />
      </div>
    </div>
  );
}
