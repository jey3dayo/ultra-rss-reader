import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FeedCleanupOverviewPanel } from "@/components/feed-cleanup/feed-cleanup-overview-panel";

function buildProps() {
  return {
    overviewLabel: "Overview",
    filtersLabel: "Filters",
    bulkActionsLabel: "Bulk actions",
    bulkVisibleCountLabel: "3 visible",
    bulkKeepVisibleLabel: "Keep all visible",
    bulkDeferVisibleLabel: "Defer all visible",
    summaryCards: [
      { label: "Pending", value: "3", caption: "Needs review" },
      { label: "Done", value: "1", caption: "Already decided" },
    ],
    integrityMode: false,
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
      { key: "stale_90d" as const, label: "90+ days stale" },
      { key: "no_unread" as const, label: "No unread" },
    ],
    filterCounts: {
      stale_90d: 2,
      no_unread: 1,
      no_stars: 0,
    },
    activeFilterKeys: new Set<"stale_90d" | "no_unread" | "no_stars">(),
    visibleCandidateCount: 3,
    showDeferred: false,
    showDeferredLabel: "Show deferred",
    onToggleFilter: vi.fn(),
    onToggleShowDeferred: vi.fn(),
    onKeepVisible: vi.fn(),
    onDeferVisible: vi.fn(),
  };
}

describe("FeedCleanupOverviewPanel", () => {
  it("shows bulk visible actions above the queue section", () => {
    render(<FeedCleanupOverviewPanel {...buildProps()} />);

    expect(screen.getByRole("button", { name: "Keep all visible" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Defer all visible" })).toBeInTheDocument();
  });

  it("wires the bulk visible actions", async () => {
    const user = userEvent.setup();
    const props = buildProps();

    render(<FeedCleanupOverviewPanel {...props} />);

    await user.click(screen.getByRole("button", { name: "Keep all visible" }));
    await user.click(screen.getByRole("button", { name: "Defer all visible" }));

    expect(props.onKeepVisible).toHaveBeenCalledTimes(1);
    expect(props.onDeferVisible).toHaveBeenCalledTimes(1);
  });

  it("hides bulk visible actions in integrity mode", () => {
    render(<FeedCleanupOverviewPanel {...buildProps()} integrityMode={true} />);

    expect(screen.queryByRole("button", { name: "Keep all visible" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Defer all visible" })).toBeNull();
  });
});
