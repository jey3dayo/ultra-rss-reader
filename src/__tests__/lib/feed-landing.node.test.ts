import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";
import type { ArticleDto } from "@/api/tauri-commands";
import {
  hasWebPreviewUrl,
  resolveFeedLandingArticle,
  resolveFeedLandingArticleResult,
  resolveFeedLandingDisplay,
} from "@/lib/feed/feed-landing";

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
    expect(
      resolveFeedLandingArticle({
        articles: baseArticles,
        sortUnread: "newest_first",
      })?.id,
    ).toBe("art-new");
  });

  it("returns null when the unread landing list would be empty", () => {
    const allRead = baseArticles.map((article) => ({
      ...article,
      is_read: true,
    }));
    expect(
      resolveFeedLandingArticle({
        articles: allRead,
        sortUnread: "newest_first",
      }),
    ).toBeNull();
    expect(
      Result.unwrapError(
        resolveFeedLandingArticleResult({
          articles: allRead,
          sortUnread: "newest_first",
        }),
      ),
    ).toBe("no_visible_article");
  });

  it("returns the first visible starred article in starred mode", () => {
    const articles = baseArticles.map((article, index) => ({
      ...article,
      is_starred: index === 1,
    }));

    expect(
      resolveFeedLandingArticle({
        articles,
        sortUnread: "newest_first",
        viewMode: "starred",
      })?.id,
    ).toBe("art-old");
  });
});

describe("hasWebPreviewUrl", () => {
  it.each([
    ["https absolute URL", "https://example.com/new", true],
    ["http absolute URL", "http://example.com/new", true],
    ["whitespace-only URL", " \n\t ", false],
    ["javascript URL", "javascript:alert(1)", false],
    ["relative URL", "/articles/new", false],
    ["malformed URL", "https://", false],
  ])("returns %s capability as %s", (_label, articleUrl, expected) => {
    expect(hasWebPreviewUrl(articleUrl)).toBe(expected);
  });
});

describe("resolveFeedLandingDisplay", () => {
  it("enables web preview for preview-enabled feeds with a URL", () => {
    expect(
      resolveFeedLandingDisplay({
        feed: { reader_mode: "on", web_preview_mode: "on" },
        prefs: {
          reader_mode_default: "true",
          web_preview_mode_default: "false",
        },
        articleUrl: "https://example.com/new",
      }).webPreviewMode,
    ).toBe(true);
  });

  it("enables web preview when the landing article has no URL but the feed has a site URL", () => {
    const display = resolveFeedLandingDisplay({
      feed: { reader_mode: "on", site_url: "https://example.com", web_preview_mode: "on" },
      prefs: { reader_mode_default: "true", web_preview_mode_default: "false" },
      articleUrl: null,
    });

    expect(display.readerMode).toBe(true);
    expect(display.webPreviewMode).toBe(true);
    expect(display.fallbackReason).toBeNull();
  });

  it("falls back to reader mode when neither the landing article nor feed has a preview URL", () => {
    const display = resolveFeedLandingDisplay({
      feed: { reader_mode: "on", site_url: null, web_preview_mode: "on" },
      prefs: { reader_mode_default: "true", web_preview_mode_default: "false" },
      articleUrl: null,
    });

    expect(display.readerMode).toBe(true);
    expect(display.webPreviewMode).toBe(false);
    expect(display.fallbackReason).toBe("missing_web_preview");
  });

  it("falls back to reader mode when the landing article URL is whitespace-only", () => {
    const display = resolveFeedLandingDisplay({
      feed: { reader_mode: "on", web_preview_mode: "on" },
      prefs: { reader_mode_default: "true", web_preview_mode_default: "false" },
      articleUrl: " \n\t ",
    });

    expect(display.readerMode).toBe(true);
    expect(display.webPreviewMode).toBe(false);
    expect(display.fallbackReason).toBe("missing_web_preview");
  });

  it("lets a user-opened Web Preview session override a standard feed landing display", () => {
    const display = resolveFeedLandingDisplay({
      feed: { reader_mode: "on", web_preview_mode: "off" },
      prefs: { reader_mode_default: "true", web_preview_mode_default: "false" },
      articleUrl: "https://example.com/new",
      webPreviewSessionMode: "forced-on",
    });

    expect(display.readerMode).toBe(true);
    expect(display.webPreviewMode).toBe(true);
    expect(display.fallbackReason).toBeNull();
  });

  it("lets a user-closed Web Preview session override a preview-enabled feed landing display", () => {
    const display = resolveFeedLandingDisplay({
      feed: { reader_mode: "on", web_preview_mode: "on" },
      prefs: { reader_mode_default: "true", web_preview_mode_default: "false" },
      articleUrl: "https://example.com/new",
      webPreviewSessionMode: "forced-off",
    });

    expect(display.readerMode).toBe(true);
    expect(display.webPreviewMode).toBe(false);
    expect(display.fallbackReason).toBeNull();
  });
});
