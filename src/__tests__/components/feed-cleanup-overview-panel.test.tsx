import { render, screen, within } from "@testing-library/react";
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
  it("keeps summary cards informational while emphasizing the bulk action zone", () => {
    render(<FeedCleanupOverviewPanel {...buildProps()} />);

    const summary = screen.getByTestId("feed-cleanup-sidebar-summary");
    const bulkActions = screen.getByTestId("feed-cleanup-bulk-actions");
    const pendingCount = within(summary).getByText("3");

    expect(summary).toHaveTextContent("Pending");
    expect(summary).toHaveTextContent("Done");
    expect(pendingCount.closest("span")).toHaveClass("rounded-md");
    expect(within(summary).getByText("Needs review")).toHaveClass("text-foreground-soft");
    expect(within(summary).queryByRole("button")).toBeNull();
    expect(within(bulkActions).getAllByRole("button")).toHaveLength(2);
    expect(within(bulkActions).getByRole("button", { name: "Keep all visible" })).toHaveClass(
      "rounded-md",
      "min-w-[7.5rem]",
    );
    expect(within(bulkActions).getByRole("button", { name: "Defer all visible" })).toHaveClass(
      "rounded-md",
      "min-w-[7.5rem]",
    );
  });

  it("exposes the filter cluster with a label and keeps the all-candidates count stable", () => {
    render(
      <FeedCleanupOverviewPanel
        {...buildProps()}
        visibleCandidateCount={2}
        filterCounts={{
          stale_90d: 2,
          no_unread: 1,
          no_stars: 0,
        }}
      />,
    );

    const filterGroup = screen.getByRole("group", { name: "Filters" });
    const allCandidatesButton = within(filterGroup).getByRole("button", { name: "All2", pressed: true });
    const staleButton = within(filterGroup).getByRole("button", { name: "90+ days stale 2" });

    expect(filterGroup).toBeInTheDocument();
    expect(allCandidatesButton).toHaveTextContent("All");
    expect(allCandidatesButton).toHaveTextContent("2");
    expect(allCandidatesButton).toHaveClass("rounded-md");
    expect(staleButton).toHaveClass("rounded-md");
    expect(within(allCandidatesButton).getByText("2")).toHaveClass("rounded-sm");
    expect(within(allCandidatesButton).queryByText("3")).toBeNull();
    expect(screen.getByTestId("feed-cleanup-bulk-actions")).toBeInTheDocument();
    expect(screen.getByText("3 visible")).toHaveClass("text-foreground-soft");
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

    expect(
      screen.getByText("Cleanup filters are hidden while you review broken references.").closest("div"),
    ).toHaveClass("border-state-warning-border", "bg-state-warning-surface", "text-state-warning-foreground");
    expect(screen.queryByRole("button", { name: "Keep all visible" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Defer all visible" })).toBeNull();
  });
});
