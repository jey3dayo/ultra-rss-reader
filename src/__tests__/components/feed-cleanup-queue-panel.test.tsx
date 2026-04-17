import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FeedCleanupQueueCandidate } from "@/components/feed-cleanup/feed-cleanup.types";
import { FeedCleanupQueuePanel } from "@/components/feed-cleanup/feed-cleanup-queue-panel";

function buildProps() {
  const candidate: FeedCleanupQueueCandidate = {
    feedId: "feed-1",
    title: "Old Product Blog",
    folderId: "folder-1",
    folderName: "Work",
    latestArticleAt: "2025-11-01T00:00:00.000Z",
    staleDays: 120,
    unreadCount: 0,
    starredCount: 0,
    reasonKeys: ["stale_90d", "no_unread", "no_stars"],
  };
  return {
    integrityMode: false,
    queueLabel: "Cleanup Queue",
    integrityQueueLabel: "Broken references",
    integrityEmptyLabel: "No broken references.",
    integrityIssues: [],
    selectedIntegrityIssue: null,
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
    onSelectIntegrityIssue: () => {},
    emptyLabel: "No cleanup candidates right now.",
    queue: [candidate],
    selectedCandidate: null,
    onSelectCandidate: vi.fn(),
    unreadCountLabel: "Unread",
    starredCountLabel: "Starred",
    deferredBadgeLabel: "Deferred",
    keepLabel: "Keep",
    deferredLabel: "Later",
    deleteLabel: "Delete",
    reasonLabels: {
      stale_90d: "No new article for 90+ days",
      no_unread: "No unread",
      no_stars: "No stars",
    },
    priorityToneLabels: {
      high: "High priority",
      medium: "Medium priority",
      low: "Low priority",
    },
    summaryLabels: {
      stale_and_inactive: "90+ days quiet with no unread backlog.",
      stale_with_no_stars: "This feed is stale and has no saved articles.",
      inactive_without_signals: "No unread or starred articles are left here.",
      stale_but_supported: "The feed is quiet, but it may still matter.",
      healthy_feed: "This subscription still looks healthy.",
    },
  };
}

describe("FeedCleanupQueuePanel", () => {
  it("keeps the selection rail mounted and disabled before anything is selected", () => {
    render(<FeedCleanupQueuePanel {...buildProps()} />);

    const selectionRail = screen.getByTestId("feed-cleanup-selection-rail");

    expect(selectionRail).toBeInTheDocument();
    expect(screen.getByText("Selected set")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep selected" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Defer selected" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete selected" })).toBeDisabled();
  });

  it("renders reason chips and compact fact pills", () => {
    render(<FeedCleanupQueuePanel {...buildProps()} />);

    expect(screen.getByRole("heading", { name: "Cleanup Queue" })).toBeInTheDocument();
    expect(screen.getByText("No new article for 90+ days")).toBeInTheDocument();
    expect(screen.getByText("No unread")).toBeInTheDocument();
    expect(screen.getByText("No stars")).toBeInTheDocument();
    expect(screen.getByText("Work").closest("span")).toHaveAttribute("data-label-chip", "neutral");
    expect(screen.getByText("Updated 120 days ago")).toBeInTheDocument();
  });

  it("shows bulk actions when rows are selected", () => {
    render(
      <FeedCleanupQueuePanel
        {...buildProps()}
        selectedFeedIds={new Set(["feed-1"])}
        bulkBarVisible={true}
        selectedCountLabel="1 selected"
      />,
    );

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByTestId("feed-cleanup-selection-rail")).toHaveClass("rounded-md", "bg-card/52");
    expect(screen.getByRole("button", { name: "Keep selected" })).toHaveClass("bg-state-success-surface");
    expect(screen.getByRole("button", { name: "Keep selected" })).toHaveClass("min-w-[7.5rem]");
    expect(screen.getByRole("button", { name: "Defer selected" })).toHaveClass("min-w-[7.5rem]");
    expect(screen.getByRole("button", { name: "Delete selected" })).toHaveClass("min-w-[7.5rem]");
    expect(screen.getByRole("button", { name: "Defer selected" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete selected" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep selected" })).toBeEnabled();
  });

  it("shows inline row actions for the active row", async () => {
    const user = userEvent.setup();
    const onKeepCandidate = vi.fn();

    render(
      <FeedCleanupQueuePanel
        {...buildProps()}
        selectedCandidate={buildProps().queue[0]}
        selectedFeedIds={new Set(["feed-1"])}
        onKeepCandidate={onKeepCandidate}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: "Keep" })[0]);

    expect(onKeepCandidate).toHaveBeenCalledWith("feed-1");
  });

  it("selects a candidate when the row is clicked", async () => {
    const user = userEvent.setup();
    const onSelectCandidate = vi.fn();

    render(<FeedCleanupQueuePanel {...buildProps()} onSelectCandidate={onSelectCandidate} />);

    await user.click(screen.getByRole("button", { name: "Old Product Blog" }));

    expect(onSelectCandidate).toHaveBeenCalledWith("feed-1");
  });

  it("keeps the explicit checkbox hit area", () => {
    render(<FeedCleanupQueuePanel {...buildProps()} />);

    expect(screen.getByTestId("feed-cleanup-selection-hit-area-feed-1")).toHaveClass("p-2");
    expect(screen.getByTestId("feed-cleanup-selection-hit-area-feed-1")).toHaveClass("min-h-11");
    expect(screen.getByTestId("feed-cleanup-selection-hit-area-feed-1")).toHaveClass("rounded-md");
  });

  it("uses subdued surface cards for selected rows while keeping row actions available", () => {
    render(
      <FeedCleanupQueuePanel
        {...buildProps()}
        selectedCandidate={buildProps().queue[0]}
        selectedFeedIds={new Set(["feed-1"])}
      />,
    );

    const queueRow = screen.getByTestId("feed-cleanup-queue-row-feed-1");

    expect(queueRow).toHaveClass("rounded-md");
    expect(queueRow).toHaveClass("border-border-strong");
    expect(queueRow).toHaveClass("bg-card/52");
    expect(within(queueRow).getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(within(queueRow).getByRole("button", { name: "Keep" })).toHaveClass("min-w-[7.5rem]");
    expect(within(queueRow).getByRole("button", { name: "Later" })).toHaveClass("min-w-[7.5rem]");
    expect(within(queueRow).getByRole("button", { name: "Delete" })).toHaveClass("min-w-[7.5rem]");
  });

  it("keeps unselected rows on a muted surface", () => {
    render(<FeedCleanupQueuePanel {...buildProps()} />);

    const queueRow = screen.getByTestId("feed-cleanup-queue-row-feed-1");

    expect(queueRow).toHaveStyle({ backgroundColor: "var(--cleanup-card-surface-muted)" });
    expect(queueRow).toHaveClass("hover:bg-surface-1/72");
  });

  it("uses rounded-md for empty states and integrity queue rows", () => {
    const { rerender } = render(<FeedCleanupQueuePanel {...buildProps()} queue={[]} />);

    expect(screen.getByText("No cleanup candidates right now.")).toHaveClass("rounded-md", "text-foreground-soft");

    rerender(
      <FeedCleanupQueuePanel
        {...buildProps()}
        integrityMode={true}
        integrityIssues={[
          {
            missing_feed_id: "missing-feed",
            article_count: 2,
            latest_article_title: "Broken article",
            latest_article_published_at: "2026-03-31T10:00:00Z",
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Missing feed: missing-feed" })).toHaveClass(
      "rounded-md",
      "hover:bg-surface-2",
    );
  });
});
