import { describe, expect, it } from "vitest";
import type { ArticleDto } from "@/api/tauri-commands";
import { resolveFeedLandingArticle, resolveFeedLandingMode } from "@/lib/feed-landing";

const baseArticles: ArticleDto[] = [
  {
    id: "art-new",
    feed_id: "feed-1",
    title: "Newest unread",
    content_sanitized: "<p>new</p>",
    summary: null,
    url: "https://example.com/new",
    author: null,
    published_at: "2026-04-02T09:00:00Z",
    thumbnail: null,
    is_read: false,
    is_starred: false,
  },
  {
    id: "art-old",
    feed_id: "feed-1",
    title: "Older unread",
    content_sanitized: "<p>old</p>",
    summary: null,
    url: "https://example.com/old",
    author: null,
    published_at: "2026-04-01T09:00:00Z",
    thumbnail: null,
    is_read: false,
    is_starred: false,
  },
];

describe("resolveFeedLandingArticle", () => {
  it("returns the first visible unread article using newest-first ordering", () => {
    expect(resolveFeedLandingArticle({ articles: baseArticles, sortUnread: "newest_first" })?.id).toBe("art-new");
  });

  it("returns null when the unread landing list would be empty", () => {
    const allRead = baseArticles.map((article) => ({ ...article, is_read: true }));
    expect(resolveFeedLandingArticle({ articles: allRead, sortUnread: "newest_first" })).toBeNull();
  });
});

describe("resolveFeedLandingMode", () => {
  it("uses browser mode for widescreen feeds with a URL", () => {
    expect(
      resolveFeedLandingMode({
        feedDisplayMode: "widescreen",
        defaultDisplayMode: "normal",
        articleUrl: "https://example.com/new",
      }),
    ).toBe("browser");
  });

  it("falls back to reader mode when the landing article has no URL", () => {
    expect(
      resolveFeedLandingMode({
        feedDisplayMode: "widescreen",
        defaultDisplayMode: "normal",
        articleUrl: null,
      }),
    ).toBe("reader");
  });
});
