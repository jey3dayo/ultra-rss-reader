import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { FeedCleanupQueueCandidate } from "@/components/feed-cleanup/feed-cleanup.types";
import { FeedCleanupReviewPanel } from "@/components/feed-cleanup/feed-cleanup-review-panel";

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
    reviewLabel: "Review",
    integrityMode: false,
    dateLocale: "en-US",
    integrityEmptyLabel: "No integrity issues selected.",
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
    selectedCandidate: candidate,
    selectedFeed: {
      id: "feed-1",
      account_id: "acc-1",
      folder_id: "folder-1",
      title: "Old Product Blog",
      url: "https://example.com/feed.xml",
      site_url: "https://example.com",
      unread_count: 0,
      reader_mode: "inherit" as const,
      web_preview_mode: "inherit" as const,
    },
    selectedMetrics: {
      latestArticleAt: "2025-11-01T00:00:00.000Z",
      starredCount: 0,
      previewArticles: [
        {
          id: "art-1",
          feed_id: "feed-1",
          title: "Old article",
          content_sanitized: "<p>old</p>",
          summary: null,
          url: "https://example.com/old/1",
          author: null,
          published_at: "2025-11-01T00:00:00.000Z",
          thumbnail: null,
          is_read: true,
          is_starred: false,
        },
      ],
    },
    selectedSummary: {
      tone: "high" as const,
      titleKey: "review_now" as const,
      summaryKey: "stale_and_inactive" as const,
    },
    folderLabel: "Folder",
    latestArticleLabel: "Latest article",
    unreadCountLabel: "Unread",
    starredCountLabel: "Starred",
    reasonsLabel: "Why this feed is here",
    noSelectionLabel: "Select a feed to review.",
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
    priorityLabels: {
      review_now: "Review now",
      consider: "Consider",
      keep: "Keep",
    },
    summaryHeadlineLabels: {
      review_now: "Strong cleanup candidate",
      consider: "Worth a quick check",
      keep: "Looks healthy",
    },
    summaryLabels: {
      stale_and_inactive: "90+ days quiet with no unread backlog.",
      stale_with_no_stars: "This feed is stale and has no saved articles.",
      inactive_without_signals: "No unread or starred articles are left here.",
      stale_but_supported: "The feed is quiet, but it may still matter.",
      healthy_feed: "This subscription still looks healthy.",
    },
    editing: false,
    editor: null,
    reviewPanelClassName: "w-full",
    editLabel: "Edit Feed",
    keepLabel: "Keep",
    laterLabel: "Defer",
    deleteLabel: "Delete",
    onEdit: () => {},
    onKeep: () => {},
    onLater: () => {},
    onDelete: () => {},
  };
}

describe("FeedCleanupReviewPanel", () => {
  it("renders a unified detail panel with reason box and edit action", () => {
    render(<FeedCleanupReviewPanel {...buildProps()} />);

    const panel = screen.getByTestId("feed-cleanup-review-panel");
    expect(panel).toHaveStyle({ backgroundColor: "var(--cleanup-review-surface)" });
    const detailScrollRegion = panel.querySelector("div.overflow-y-auto");
    expect(detailScrollRegion).toBeTruthy();
    expect(detailScrollRegion).toHaveClass("min-h-0");
    expect(detailScrollRegion).toHaveClass("flex-1");
    expect(detailScrollRegion).toHaveClass("overflow-y-auto");

    expect(screen.getByRole("link", { name: "Old Product Blog" })).toHaveAttribute("href", "https://example.com");
    expect(screen.getByRole("link", { name: "Old Product Blog" }).querySelector("h3")).toHaveClass("font-sans");
    expect(screen.getByTestId("feed-detail-status")).toBeInTheDocument();
    expect(screen.getByTestId("feed-detail-reason-box")).toBeInTheDocument();
    expect(screen.getByText("Why this feed is here")).toBeInTheDocument();
    expect(screen.getByText("Updated 120 days ago / Unread 0 / Starred 0")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open website" })).toBeNull();
    expect(screen.getByRole("button", { name: "Edit Feed" })).toBeInTheDocument();
  });

  it("shows review actions for the selected candidate", () => {
    render(<FeedCleanupReviewPanel {...buildProps()} />);

    const actions = screen.getByTestId("feed-cleanup-review-actions");
    expect(actions).toHaveClass("rounded-[var(--radius-surface-section)]");
    expect(within(actions).getByRole("button", { name: "Keep" })).toBeInTheDocument();
    expect(within(actions).getByRole("button", { name: "Defer" })).toBeInTheDocument();
    expect(within(actions).getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("shows the no-selection message when nothing is selected", () => {
    render(
      <FeedCleanupReviewPanel
        {...buildProps()}
        selectedCandidate={null}
        selectedFeed={null}
        selectedMetrics={null}
        selectedSummary={null}
      />,
    );

    expect(screen.getByText("Select a feed to review.")).toHaveClass("rounded-md");
  });

  it("renders integrity details in integrity mode", () => {
    render(
      <FeedCleanupReviewPanel
        {...buildProps()}
        integrityMode={true}
        selectedIntegrityIssue={{
          missing_feed_id: "missing-feed",
          article_count: 2,
          latest_article_title: "Broken article",
          latest_article_published_at: "2026-03-31T10:00:00Z",
        }}
      />,
    );

    expect(screen.getByText("Needs repair")).toBeInTheDocument();
    const panel = screen.getByTestId("feed-cleanup-review-panel");
    expect(screen.getByText("Needs repair").closest('[data-surface-card="section"]')).toHaveClass(
      "rounded-[var(--radius-surface-section)]",
    );
    expect(screen.getByText("Needs repair").closest('[data-surface-card="info"]')).toHaveClass(
      "rounded-[var(--radius-surface-info)]",
      "border-state-warning-border",
      "bg-state-warning-surface",
      "text-state-warning-foreground",
    );
    expect(within(panel).getByText("missing-feed")).toBeInTheDocument();
  });
});
