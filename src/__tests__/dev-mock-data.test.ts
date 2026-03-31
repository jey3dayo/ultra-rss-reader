import { describe, expect, it } from "vitest";
import { mockArticles, mockFeeds } from "@/dev-mock-data";

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
});
