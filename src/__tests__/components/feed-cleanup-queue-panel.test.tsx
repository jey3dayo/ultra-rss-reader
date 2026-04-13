import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedCleanupQueuePanel } from "@/components/feed-cleanup/feed-cleanup-queue-panel";

describe("FeedCleanupQueuePanel", () => {
  it("stacks the queue card header on narrow layouts", () => {
    render(
      <FeedCleanupQueuePanel
        integrityMode={false}
        queueLabel="Cleanup Queue"
        integrityQueueLabel="Broken references"
        integrityEmptyLabel="No broken references."
        integrityIssues={[]}
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
        onSelectIntegrityIssue={() => {}}
        emptyLabel="No cleanup candidates right now."
        queue={[
          {
            feedId: "feed-1",
            title: "Old Product Blog",
            folderId: "folder-1",
            folderName: "Work",
            latestArticleAt: "2025-11-01T00:00:00.000Z",
            staleDays: 120,
            unreadCount: 0,
            starredCount: 0,
            reasonKeys: ["stale_90d", "no_unread", "no_stars"],
          },
        ]}
        selectedCandidate={null}
        onSelectCandidate={() => {}}
        unreadCountLabel="Unread"
        starredCountLabel="Starred"
        deferredBadgeLabel="Deferred"
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
        summaryLabels={{
          stale_and_inactive: "90+ days quiet with no unread backlog.",
          stale_with_no_stars: "This feed is stale and has no saved articles.",
          inactive_without_signals: "No unread or starred articles are left here.",
          stale_but_supported: "The feed is quiet, but it may still matter.",
          healthy_feed: "This subscription still looks healthy.",
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Cleanup Queue" })).toBeInTheDocument();
    expect(screen.getByTestId("feed-cleanup-queue-card-header-feed-1")).toHaveClass("flex-col");
    expect(screen.getByTestId("feed-cleanup-queue-card-header-feed-1")).toHaveClass("sm:flex-row");
    expect(screen.getByTestId("feed-cleanup-queue-card-status-feed-1")).toHaveClass("items-start");
    expect(screen.getByTestId("feed-cleanup-queue-card-status-feed-1")).toHaveClass("sm:items-end");
  });

  it("renders explicit selection and focus affordances for cleanup rows", () => {
    render(
      <FeedCleanupQueuePanel
        integrityMode={false}
        queueLabel="Cleanup Queue"
        integrityQueueLabel="Broken references"
        integrityEmptyLabel="No broken references."
        integrityIssues={[]}
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
        onSelectIntegrityIssue={() => {}}
        emptyLabel="No cleanup candidates right now."
        queue={[
          {
            feedId: "feed-1",
            title: "Old Product Blog",
            folderId: "folder-1",
            folderName: "Work",
            latestArticleAt: "2025-11-01T00:00:00.000Z",
            staleDays: 120,
            unreadCount: 0,
            starredCount: 0,
            reasonKeys: ["stale_90d", "no_unread", "no_stars"],
          },
        ]}
        selectedCandidate={null}
        selectedFeedIds={new Set(["feed-1"])}
        focusedFeedId="feed-1"
        onSelectCandidate={() => {}}
        onToggleCandidateSelection={() => {}}
        unreadCountLabel="Unread"
        starredCountLabel="Starred"
        deferredBadgeLabel="Deferred"
        deferredLabel="Deferred"
        reviewStatusLabel="Review"
        selectedCountLabel="1 selected"
        selectCandidateLabel="Select candidate"
        selectedStateLabel="Selected"
        focusedStateLabel="Focused"
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
        summaryLabels={{
          stale_and_inactive: "90+ days quiet with no unread backlog.",
          stale_with_no_stars: "This feed is stale and has no saved articles.",
          inactive_without_signals: "No unread or starred articles are left here.",
          stale_but_supported: "The feed is quiet, but it may still matter.",
          healthy_feed: "This subscription still looks healthy.",
        }}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Select candidate Old Product Blog" })).toBeInTheDocument();
    expect(screen.getByTestId("feed-cleanup-queue-row-feed-1")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("feed-cleanup-queue-row-feed-1")).toHaveAttribute("data-focused", "true");
  });

  it("surfaces keyboard hints inside the bulk decision bar", () => {
    render(
      <FeedCleanupQueuePanel
        integrityMode={false}
        queueLabel="Cleanup Queue"
        integrityQueueLabel="Broken references"
        integrityEmptyLabel="No broken references."
        integrityIssues={[]}
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
        onSelectIntegrityIssue={() => {}}
        emptyLabel="No cleanup candidates right now."
        queue={[
          {
            feedId: "feed-1",
            title: "Old Product Blog",
            folderId: "folder-1",
            folderName: "Work",
            latestArticleAt: "2025-11-01T00:00:00.000Z",
            staleDays: 120,
            unreadCount: 0,
            starredCount: 0,
            reasonKeys: ["stale_90d", "no_unread", "no_stars"],
          },
        ]}
        selectedCandidate={null}
        selectedFeedIds={new Set(["feed-1"])}
        bulkBarVisible
        selectedCountLabel="1 selected"
        onSelectCandidate={() => {}}
        unreadCountLabel="Unread"
        starredCountLabel="Starred"
        deferredBadgeLabel="Deferred"
        deferredLabel="Defer"
        reviewStatusLabel="Review"
        keepLabel="Keep"
        deleteLabel="Delete"
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
        summaryLabels={{
          stale_and_inactive: "90+ days quiet with no unread backlog.",
          stale_with_no_stars: "This feed is stale and has no saved articles.",
          inactive_without_signals: "No unread or starred articles are left here.",
          stale_but_supported: "The feed is quiet, but it may still matter.",
          healthy_feed: "This subscription still looks healthy.",
        }}
      />,
    );

    expect(screen.getByText("Shift+K")).toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.getByText("D")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep selected" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Defer selected" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete selected" })).toBeInTheDocument();
  });

  it("uses a larger dedicated hit area for bulk selection", () => {
    render(
      <FeedCleanupQueuePanel
        integrityMode={false}
        queueLabel="Cleanup Queue"
        integrityQueueLabel="Broken references"
        integrityEmptyLabel="No broken references."
        integrityIssues={[]}
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
        onSelectIntegrityIssue={() => {}}
        emptyLabel="No cleanup candidates right now."
        queue={[
          {
            feedId: "feed-1",
            title: "Old Product Blog",
            folderId: "folder-1",
            folderName: "Work",
            latestArticleAt: "2025-11-01T00:00:00.000Z",
            staleDays: 120,
            unreadCount: 0,
            starredCount: 0,
            reasonKeys: ["stale_90d", "no_unread", "no_stars"],
          },
        ]}
        selectedCandidate={null}
        onSelectCandidate={() => {}}
        onToggleCandidateSelection={() => {}}
        unreadCountLabel="Unread"
        starredCountLabel="Starred"
        deferredBadgeLabel="Deferred"
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
        summaryLabels={{
          stale_and_inactive: "90+ days quiet with no unread backlog.",
          stale_with_no_stars: "This feed is stale and has no saved articles.",
          inactive_without_signals: "No unread or starred articles are left here.",
          stale_but_supported: "The feed is quiet, but it may still matter.",
          healthy_feed: "This subscription still looks healthy.",
        }}
      />,
    );

    expect(screen.getByTestId("feed-cleanup-selection-hit-area-feed-1")).toHaveClass("p-2");
  });
});
