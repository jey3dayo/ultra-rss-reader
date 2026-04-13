import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedCleanupReviewPanel } from "@/components/feed-cleanup/feed-cleanup-review-panel";

describe("FeedCleanupReviewPanel", () => {
  it("stacks action buttons on narrow layouts", () => {
    render(
      <FeedCleanupReviewPanel
        reviewLabel="Review"
        integrityMode={false}
        dateLocale="en-US"
        integrityEmptyLabel="No integrity issues selected."
        selectedIntegrityIssue={null}
        integrityDetailLabels={{
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
        }}
        selectedCandidate={{
          feedId: "feed-1",
          title: "Old Product Blog",
          folderId: "folder-1",
          folderName: "Work",
          latestArticleAt: "2025-11-01T00:00:00.000Z",
          staleDays: 120,
          unreadCount: 0,
          starredCount: 0,
          reasonKeys: ["stale_90d", "no_unread", "no_stars"],
        }}
        selectedSummary={{
          tone: "high",
          titleKey: "review_now",
          summaryKey: "stale_and_inactive",
        }}
        folderLabel="Folder"
        latestArticleLabel="Latest article"
        unreadCountLabel="Unread"
        starredCountLabel="Starred"
        reasonsLabel="Why this feed is here"
        noSelectionLabel="Select a feed to review."
        reasonLabels={{
          stale_90d: "No new article for 90+ days",
          no_unread: "No unread articles",
          no_stars: "No starred articles",
        }}
        priorityToneLabels={{
          high: "High priority",
          medium: "Medium priority",
          low: "Low priority",
        }}
        priorityLabels={{
          review_now: "Review now",
          consider: "Consider",
          keep: "Keep",
        }}
        summaryHeadlineLabels={{
          review_now: "Strong cleanup candidate",
          consider: "Worth a quick check",
          keep: "Looks healthy",
        }}
        summaryLabels={{
          stale_and_inactive: "90+ days quiet with no unread backlog.",
          stale_with_no_stars: "This feed is stale and has no saved articles.",
          inactive_without_signals: "No unread or starred articles are left here.",
          stale_but_supported: "The feed is quiet, but it may still matter.",
          healthy_feed: "This subscription still looks healthy.",
        }}
        editing={false}
        editor={null}
        reviewPanelClassName="w-full"
        editLabel="Edit Feed"
        keepLabel="Keep"
        laterLabel="Later"
        deleteLabel="Delete"
        onEdit={() => {}}
        onKeep={() => {}}
        onLater={() => {}}
        onDelete={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByTestId("feed-cleanup-review-summary-header")).toHaveClass("flex-col");
    expect(screen.getByTestId("feed-cleanup-review-summary-header")).toHaveClass("sm:flex-row");
    expect(screen.getByText("Folder").closest("div")).toHaveClass("flex-col");
    expect(screen.getByText("Folder").closest("div")).toHaveClass("sm:flex-row");
    expect(screen.getByTestId("feed-cleanup-review-actions")).toHaveClass("flex-col");
    expect(screen.getByTestId("feed-cleanup-review-actions")).toHaveClass("sm:flex-row");
    expect(screen.getByRole("button", { name: "Edit Feed" })).toHaveClass("w-full");
    expect(screen.getByRole("button", { name: "Edit Feed" })).toHaveClass("sm:w-auto");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("w-full");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("sm:w-auto");
  });
});
