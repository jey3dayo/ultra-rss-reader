import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedCleanupDeleteDialog } from "@/components/feed-cleanup/feed-cleanup-delete-dialog";

describe("FeedCleanupDeleteDialog", () => {
  it("raises the destructive weight for bulk delete", () => {
    render(
      <FeedCleanupDeleteDialog
        candidates={[
          {
            feedId: "feed-1",
            title: "Old Product Blog",
            folderId: "folder-1",
            folderName: "Work",
            latestArticleAt: "2025-11-01T00:00:00.000Z",
            staleDays: 120,
            unreadCount: 0,
            starredCount: 0,
            reasonKeys: ["stale_90d", "no_unread"],
          },
          {
            feedId: "feed-2",
            title: "Dormant Changelog",
            folderId: null,
            folderName: null,
            latestArticleAt: "2025-10-01T00:00:00.000Z",
            staleDays: 160,
            unreadCount: 0,
            starredCount: 0,
            reasonKeys: ["stale_90d"],
          },
        ]}
        open
        title="Delete feed"
        bulkTitle="Delete feeds"
        bulkSummary="You are deleting 2 subscriptions."
        warningLabel="This action removes the selected subscriptions from this account."
        dateLocale="en-US"
        cancelLabel="Cancel"
        deleteLabel="Delete"
        latestArticleLabel="Latest article"
        unreadCountLabel="Unread"
        starredCountLabel="Starred"
        reasonsLabel="Why this feed is here"
        reasonLabels={{
          stale_90d: "No new article for 90+ days",
          no_unread: "No unread",
          no_stars: "No stars",
        }}
        pending={false}
        onOpenChange={() => {}}
        onConfirm={() => {}}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Delete feeds" });
    expect(within(dialog).getByText("You are deleting 2 subscriptions.")).toBeInTheDocument();
    expect(
      within(dialog).getByText("This action removes the selected subscriptions from this account."),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Old Product Blog")).toBeInTheDocument();
    expect(within(dialog).getByText("Dormant Changelog")).toBeInTheDocument();
  });
});
