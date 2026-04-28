import { describe, expect, it } from "vitest";
import { mockAccounts, mockArticles, mockFeeds, mockFolders } from "@/dev-mock-data";

describe("dev mock data", () => {
  it("does not include the known ORB-blocked thumbnail URL", () => {
    const blockedUrl = "https://images.unsplash.com/photo-1529927120475-1f638e42f5c3?w=400&h=300&fit=crop";

    expect(mockArticles.some((article) => article.thumbnail === blockedUrl)).toBe(false);
  });

  it("keeps initial unread counts in sync with unread mock articles", () => {
    for (const feed of mockFeeds) {
      const unreadCount = mockArticles.filter((article) => article.feed_id === feed.id && !article.is_read).length;
      expect(feed.unread_count).toBe(unreadCount);
    }
  });

  it("provides enough sample rows for keyboard navigation debugging", () => {
    const freshRssFeedIds = new Set(
      mockFeeds.filter((feed) => feed.account_id === "acc-freshrss").map((feed) => feed.id),
    );
    const freshRssArticles = mockArticles.filter((article) => freshRssFeedIds.has(article.feed_id));

    expect(mockAccounts.length).toBeGreaterThanOrEqual(2);
    expect(mockFolders.filter((folder) => folder.account_id === "acc-freshrss").length).toBeGreaterThanOrEqual(5);
    expect(freshRssFeedIds.size).toBeGreaterThanOrEqual(12);
    expect(freshRssArticles.length).toBeGreaterThanOrEqual(20);
  });
});
