import { describe, expect, it } from "vitest";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import {
  isLegacyOverlayBrowserUrl,
  parseDevIntent,
  pickDevIntentArticle,
  pickDevIntentFeed,
  resolveActiveDevIntentBrowserUrl,
  resolveDevIntentBrowserUrl,
} from "@/lib/dev-intent";

const feeds: FeedDto[] = [
  {
    id: "feed-1",
    account_id: "acc-1",
    folder_id: null,
    title: "Tech",
    url: "https://example.com/feed.xml",
    site_url: "https://example.com",
    unread_count: 5,
    reader_mode: "on",
    web_preview_mode: "off",
  },
  {
    id: "feed-2",
    account_id: "acc-1",
    folder_id: null,
    title: "マガポケ（シャンフロ）",
    url: "https://pocket.shonenmagazine.com/feed",
    site_url: "https://pocket.shonenmagazine.com",
    unread_count: 2,
    reader_mode: "on",
    web_preview_mode: "on",
  },
];

const articles: ArticleDto[] = [
  {
    id: "article-1",
    feed_id: "feed-2",
    title: "Read article",
    content_sanitized: "<p>done</p>",
    summary: "done",
    url: "https://example.com/read",
    author: null,
    published_at: "2026-04-03T00:00:00.000Z",
    thumbnail: null,
    is_read: true,
    is_starred: false,
  },
  {
    id: "article-2",
    feed_id: "feed-2",
    title: "Unread article",
    content_sanitized: "<p>new</p>",
    summary: "new",
    url: "https://example.com/unread",
    author: null,
    published_at: "2026-04-03T00:00:00.000Z",
    thumbnail: "https://example.com/thumb.png",
    is_read: false,
    is_starred: false,
  },
];

describe("dev-intent helpers", () => {
  it("parses known dev scenario ids", () => {
    expect(parseDevIntent("open-add-feed-dialog")).toBe("open-add-feed-dialog");
    expect(parseDevIntent("open-settings-reading")).toBe("open-settings-reading");
    expect(parseDevIntent("open-settings-reading-display-mode")).toBe("open-settings-reading-display-mode");
  });

  it("keeps the image viewer overlay intent backward compatible", () => {
    expect(parseDevIntent("image-viewer-overlay")).toBe("image-viewer-overlay");
    expect(parseDevIntent("unknown")).toBeNull();
    expect(parseDevIntent(undefined)).toBeNull();
  });

  it("prefers manga-like widescreen feeds", () => {
    expect(pickDevIntentFeed(feeds)?.id).toBe("feed-2");
  });

  it("prefers unread articles with URLs", () => {
    expect(pickDevIntentArticle(articles)?.id).toBe("article-2");
  });

  it("uses the local mock page for the image viewer overlay intent", () => {
    expect(resolveDevIntentBrowserUrl("image-viewer-overlay", "https://example.com")).toContain(
      "/dev-image-viewer.html",
    );
  });

  it("recognizes the legacy overlay browser URL", () => {
    const overlayUrl = resolveDevIntentBrowserUrl("image-viewer-overlay", "https://example.com");
    expect(isLegacyOverlayBrowserUrl(overlayUrl)).toBe(true);
    expect(isLegacyOverlayBrowserUrl("https://example.com")).toBe(false);
  });

  it("preserves an active legacy overlay browser URL even without env intent", () => {
    const overlayUrl = resolveDevIntentBrowserUrl("image-viewer-overlay", "https://example.com");
    expect(resolveActiveDevIntentBrowserUrl(null, overlayUrl, "https://example.com/article")).toBe(overlayUrl);
  });
});
