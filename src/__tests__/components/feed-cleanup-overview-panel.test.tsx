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
    allCandidateCount: 3,
    bulkKeepVisibleLabel: "Keep all visible",
    bulkDeferVisibleLabel: "Defer all visible",
    bulkDeleteVisibleLabel: "Delete visible",
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
    onDeleteVisible: vi.fn(),
  };
}

describe("FeedCleanupOverviewPanel", () => {
  it("keeps summary cards informational while emphasizing the bulk action zone", () => {
    render(<FeedCleanupOverviewPanel {...buildProps()} />);

    const sectionBody = screen.getByTestId("feed-cleanup-sidebar-summary").parentElement;
    const summary = screen.getByTestId("feed-cleanup-sidebar-summary");
    const bulkActions = screen.getByTestId("feed-cleanup-bulk-actions");
    const summaryCard = within(summary).getByText("Pending").closest('[data-surface-card="section"]');
    const visibleCountChip = bulkActions.querySelector('[data-label-chip="neutral"]');

    expect(sectionBody).toHaveClass("space-y-3.5");
    expect(summary).toHaveTextContent("Pending");
    expect(summary).toHaveTextContent("Done");
    expect(summaryCard).toHaveClass("bg-card/52");
    expect(visibleCountChip).not.toBeNull();
    expect(visibleCountChip).toHaveClass("rounded-sm");
    expect(visibleCountChip).toHaveAttribute("data-label-chip", "neutral");
    expect(within(summary).getByText("Needs review")).toHaveClass("text-foreground-soft");
    expect(within(summary).queryByRole("button")).toBeNull();
    expect(bulkActions).toHaveClass("bg-card/36");
    expect(within(bulkActions).getByRole("button", { name: "Keep all visible" })).toHaveClass(
      "rounded-md",
      "min-w-[7.5rem]",
      "h-7",
      "px-3",
      "sm:px-3.5",
    );
    expect(within(bulkActions).getByRole("button", { name: "Defer all visible" })).toHaveClass(
      "rounded-md",
      "min-w-[7.5rem]",
      "h-7",
      "px-3",
      "sm:px-3.5",
    );
    expect(within(bulkActions).getByRole("button", { name: "Delete visible" })).toHaveClass(
      "rounded-md",
      "min-w-[7.5rem]",
      "h-7",
      "px-3",
      "sm:px-3.5",
    );
  });

  it("exposes the filter cluster with a label and keeps the all-candidates count stable", () => {
    render(
      <FeedCleanupOverviewPanel
        {...buildProps()}
        visibleCandidateCount={2}
        allCandidateCount={3}
        filterCounts={{
          stale_90d: 2,
          no_unread: 1,
          no_stars: 0,
        }}
      />,
    );

    const filterGroup = screen.getByRole("group", { name: "Filters" });
    const allCandidatesButton = within(filterGroup).getByRole("button", { name: "All3", pressed: true });
    const staleButton = within(filterGroup).getByRole("button", { name: "90+ days stale 2" });

    expect(filterGroup).toBeInTheDocument();
    expect(allCandidatesButton).toHaveTextContent("All");
    expect(allCandidatesButton).toHaveTextContent("3");
    expect(allCandidatesButton).toHaveClass("rounded-md", "data-[pressed]:bg-surface-4");
    expect(staleButton).toHaveClass("rounded-md");
    expect(allCandidatesButton).toHaveClass("data-[pressed]:border-border-strong");
    expect(within(allCandidatesButton).getByText("3")).toHaveClass("rounded-sm");
    expect(within(allCandidatesButton).getByText("3").closest("span")).toHaveAttribute("data-label-chip", "neutral");
    expect(screen.getByTestId("feed-cleanup-bulk-actions")).toBeInTheDocument();
    expect(screen.getByTestId("feed-cleanup-all-filter")).toBeInTheDocument();
    expect(screen.getByTestId("feed-cleanup-secondary-filters")).toBeInTheDocument();
    expect(screen.getByText("3 visible")).toHaveClass("text-foreground-soft");
  });

  it("wires the bulk visible actions", async () => {
    const user = userEvent.setup();
    const props = buildProps();

    render(<FeedCleanupOverviewPanel {...props} />);

    await user.click(screen.getByRole("button", { name: "Keep all visible" }));
    await user.click(screen.getByRole("button", { name: "Defer all visible" }));
    await user.click(screen.getByRole("button", { name: "Delete visible" }));

    expect(props.onKeepVisible).toHaveBeenCalledTimes(1);
    expect(props.onDeferVisible).toHaveBeenCalledTimes(1);
    expect(props.onDeleteVisible).toHaveBeenCalledTimes(1);
  });

  it("hides bulk visible actions in integrity mode", () => {
    render(<FeedCleanupOverviewPanel {...buildProps()} integrityMode={true} />);

    expect(
      screen.getByText("Cleanup filters are hidden while you review broken references.").closest("div"),
    ).toHaveClass("border-state-warning-border", "bg-state-warning-surface", "text-state-warning-foreground");
    expect(screen.queryByRole("button", { name: "Keep all visible" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Defer all visible" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete visible" })).toBeNull();
  });

  it("keeps bulk visible actions mounted but disabled when no candidates are visible", () => {
    render(<FeedCleanupOverviewPanel {...buildProps()} visibleCandidateCount={0} bulkVisibleCountLabel="0 visible" />);

    expect(screen.getByTestId("feed-cleanup-bulk-actions")).toBeInTheDocument();
    expect(screen.getByText("0 visible")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep all visible" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Defer all visible" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete visible" })).toBeDisabled();
  });
});
