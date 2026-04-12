import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { FeedCleanupOverviewPanel } from "./feed-cleanup-overview-panel";

const meta = {
  title: "Feed Cleanup/OverviewPanel",
  component: FeedCleanupOverviewPanel,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof FeedCleanupOverviewPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

const baseArgs = {
  overviewLabel: "Overview",
  filtersLabel: "Filters",
  bulkActionsLabel: "Bulk actions",
  bulkVisibleCountLabel: "2 visible now",
  bulkKeepVisibleLabel: "Keep all visible",
  bulkDeferVisibleLabel: "Defer all visible",
  summaryCards: [
    { label: "Candidates", value: "2", caption: "feeds" },
    { label: "Review now", value: "1", caption: "high priority" },
    { label: "Deferred", value: "0", caption: "later" },
    { label: "Integrity", value: "1", caption: "issue" },
  ],
  integrityDetailLabels: {
    missing_feed_id: "Missing feed ID",
    article_count: "Article count",
    latest_article: "Latest article",
    latest_published_at: "Latest published at",
    needs_repair: "Needs repair",
    needs_repair_badge: "Repair now",
    summary: "These articles reference a feed that no longer exists.",
    unknown_article: "Unknown article",
    queue_item_title: "Missing feed",
    queue_item_articles_label: "articles",
    filter_note: "Cleanup filters are hidden while you review broken references.",
  },
  filterOptions: [
    { key: "stale_90d", label: "90+ days inactive" },
    { key: "no_unread", label: "No unread" },
    { key: "no_stars", label: "No stars" },
  ],
  filterCounts: {
    stale_90d: 1,
    no_unread: 1,
    no_stars: 1,
  },
  visibleCandidateCount: 2,
  showDeferredLabel: "Show deferred",
} as const;

function InteractiveOverviewPanel({ initialIntegrityMode }: { initialIntegrityMode: boolean }) {
  const [activeFilterKeys, setActiveFilterKeys] = useState<Set<"stale_90d" | "no_unread" | "no_stars">>(
    () => new Set(["stale_90d"]),
  );
  const [showDeferred, setShowDeferred] = useState(false);

  return (
    <div className="max-w-[280px]">
      <FeedCleanupOverviewPanel
        {...baseArgs}
        integrityMode={initialIntegrityMode}
        activeFilterKeys={activeFilterKeys}
        showDeferred={showDeferred}
        onToggleFilter={(key) => {
          setActiveFilterKeys((current) => {
            const next = new Set(current);
            if (next.has(key)) {
              next.delete(key);
            } else {
              next.add(key);
            }
            return next;
          });
        }}
        onToggleShowDeferred={() => {
          setShowDeferred((current) => !current);
        }}
        onKeepVisible={() => {}}
        onDeferVisible={() => {}}
      />
    </div>
  );
}

export const CleanupMode: Story = {
  args: {
    ...baseArgs,
    integrityMode: false,
    activeFilterKeys: new Set(["stale_90d"]),
    showDeferred: false,
    onToggleFilter: () => {},
    onToggleShowDeferred: () => {},
    onKeepVisible: () => {},
    onDeferVisible: () => {},
  },
  render: (args) => <InteractiveOverviewPanel initialIntegrityMode={args.integrityMode} />,
};

export const IntegrityMode: Story = {
  args: {
    ...baseArgs,
    integrityMode: true,
    activeFilterKeys: new Set(["stale_90d"]),
    showDeferred: false,
    onToggleFilter: () => {},
    onToggleShowDeferred: () => {},
    onKeepVisible: () => {},
    onDeferVisible: () => {},
  },
  render: (args) => <InteractiveOverviewPanel initialIntegrityMode={args.integrityMode} />,
};
