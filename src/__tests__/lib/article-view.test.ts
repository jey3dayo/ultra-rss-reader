import { Result } from "@praha/byethrow";
import { sampleArticles, sampleFeeds } from "@tests/helpers/fixtures";
import { describe, expect, it, vi } from "vitest";
import type { FolderDto } from "@/api/tauri-commands";
import {
  buildArticleViewSummary,
  buildArticleViewSummaryResult,
  findLatestArticleOrNull,
  findSelectedArticle,
  formatArticleDate,
  normalizeArticleRemoteImageUrl,
  resolveArticleDateLocale,
  resolveArticleSummaryWebsiteHref,
  resolveArticleSummaryWebsiteLabel,
  shouldOpenArticleTitleInExternalBrowser,
} from "@/lib/articles/article-view";

describe("article-view utils", () => {
  it("resolves the selected article from feed articles", () => {
    const result = findSelectedArticle({
      selectedArticleId: "art-1",
      feedId: "feed-1",
      tagId: null,
      articles: sampleArticles,
      accountArticles: [],
      tagArticles: [],
    });

    expect(Result.unwrap(result)).toEqual(sampleArticles[0]);
  });

  it("resolves the selected article from account articles when no feed is selected", () => {
    const result = findSelectedArticle({
      selectedArticleId: "art-2",
      feedId: null,
      tagId: null,
      articles: [],
      accountArticles: sampleArticles,
      tagArticles: [],
    });

    expect(Result.unwrap(result)).toEqual(sampleArticles[1]);
  });

  it("prefers tag articles when a tag is selected", () => {
    const result = findSelectedArticle({
      selectedArticleId: "art-1",
      feedId: "feed-1",
      tagId: "tag-1",
      articles: [],
      accountArticles: [],
      tagArticles: [sampleArticles[0]],
    });

    expect(Result.unwrap(result)).toEqual(sampleArticles[0]);
  });

  it("returns an error when the selected article cannot be found", () => {
    const result = findSelectedArticle({
      selectedArticleId: "missing",
      feedId: "feed-1",
      tagId: null,
      articles: sampleArticles,
      accountArticles: [],
      tagArticles: [],
    });

    expect(Result.unwrapError(result)).toBe("article_not_found");
  });

  it("uses the external browser for article titles when the preference requires it", () => {
    expect(
      shouldOpenArticleTitleInExternalBrowser({
        openLinks: "default_browser",
        metaKey: false,
        ctrlKey: false,
      }),
    ).toBe(true);
  });

  it("uses the external browser for article titles on modifier-click", () => {
    expect(
      shouldOpenArticleTitleInExternalBrowser({
        openLinks: "in_app",
        metaKey: true,
        ctrlKey: false,
      }),
    ).toBe(true);
  });

  it("normalizes article remote image URLs to the reader image privacy contract", () => {
    expect(normalizeArticleRemoteImageUrl(" https://cdn.example.com/thumb.jpg?track=1 ")).toBe(
      "https://cdn.example.com/thumb.jpg?track=1",
    );
    expect(normalizeArticleRemoteImageUrl("/fixtures/article-thumbnail.png")).toBe("/fixtures/article-thumbnail.png");
    expect(normalizeArticleRemoteImageUrl("http://cdn.example.com/thumb.jpg")).toBeNull();
    expect(normalizeArticleRemoteImageUrl("HTTP://cdn.example.com/thumb.jpg")).toBeNull();
    expect(normalizeArticleRemoteImageUrl("//cdn.example.com/thumb.jpg")).toBeNull();
    expect(normalizeArticleRemoteImageUrl("data:image/svg+xml,<svg></svg>")).toBeNull();
    expect(normalizeArticleRemoteImageUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeArticleRemoteImageUrl("https://user:pass@cdn.example.com/thumb.jpg")).toBeNull();
    expect(normalizeArticleRemoteImageUrl("https://localhost/thumb.jpg")).toBeNull();
    expect(normalizeArticleRemoteImageUrl("https://127.0.0.1/thumb.jpg")).toBeNull();
    expect(normalizeArticleRemoteImageUrl("not a url")).toBeNull();
    expect(normalizeArticleRemoteImageUrl("   ")).toBeNull();
  });

  it("keeps article titles in the web preview on a regular click when configured", () => {
    expect(
      shouldOpenArticleTitleInExternalBrowser({
        openLinks: "in_app",
        metaKey: false,
        ctrlKey: false,
      }),
    ).toBe(false);
  });
});

describe("findLatestArticleOrNull", () => {
  it("ignores invalid dates when valid article dates are available", () => {
    const invalidNewestPosition = {
      ...sampleArticles[0],
      id: "invalid-newest-position",
      published_at: "not-a-date",
    };
    const validLatest = {
      ...sampleArticles[1],
      id: "valid-latest",
      published_at: "2026-03-02T10:00:00Z",
    };
    const validOlder = {
      ...sampleArticles[0],
      id: "valid-older",
      published_at: "2026-03-01T10:00:00Z",
    };

    expect(findLatestArticleOrNull([invalidNewestPosition, validOlder, validLatest])).toBe(validLatest);
  });

  it("falls back to the first article when every date is invalid", () => {
    const firstInvalid = {
      ...sampleArticles[0],
      id: "first-invalid",
      published_at: "not-a-date",
    };
    const secondInvalid = {
      ...sampleArticles[1],
      id: "second-invalid",
      published_at: "",
    };

    expect(findLatestArticleOrNull([firstInvalid, secondInvalid])).toBe(firstInvalid);
  });
});

describe("formatArticleDate", () => {
  it("formats a date string into uppercase weekday, date, and time", () => {
    // Use a fixed UTC date to avoid timezone issues
    const result = formatArticleDate("2026-03-25T10:00:00Z");
    // Should contain uppercase day and "AT" separator
    expect(result).toContain("AT");
    expect(result).toMatch(/[A-Z]+,/);
  });

  it("includes the year, month, and day", () => {
    const result = formatArticleDate("2026-01-15T14:30:00Z");
    expect(result).toContain("2026");
    expect(result).toContain("JANUARY");
  });

  it("returns the raw string for an invalid date", () => {
    expect(formatArticleDate("not-a-date")).toBe("not-a-date");
  });

  it("formats time with hours and minutes", () => {
    // Force a known locale-independent check
    const result = formatArticleDate("2026-06-01T00:00:00Z");
    expect(result).toContain("AT");
    // Time portion should be present after "AT"
    const timePart = result.split("AT")[1].trim();
    expect(timePart).toBeTruthy();
  });

  it("formats Japanese UI dates as a concise date and time label", () => {
    const result = formatArticleDate("2026-03-25T10:00:00Z", "ja");

    expect(result).toContain("2026年");
    expect(result).toMatch(/\d{1,2}:\d{2}/);
    expect(result).not.toContain("AT");
    expect(result).not.toContain("MARCH");
    expect(result).not.toContain("水曜日");
  });

  it("respects English regional locales when formatting article dates", () => {
    const result = formatArticleDate("2026-03-25T10:00:00Z", "en-GB");

    expect(result).toContain("AT");
    expect(result).toContain("25 MARCH 2026");
  });

  it("falls back when given an invalid locale tag", () => {
    const locale = resolveArticleDateLocale("en_US");

    expect(locale).toBe("en-US");
    expect(() => formatArticleDate("2026-03-25T10:00:00Z", locale)).not.toThrow();
    expect(formatArticleDate("2026-03-25T10:00:00Z", locale)).toContain("AT");
  });

  it("falls back when formatting with an invalid locale tag directly", () => {
    expect(() => formatArticleDate("2026-03-25T10:00:00Z", "en_US")).not.toThrow();
    expect(formatArticleDate("2026-03-25T10:00:00Z", "en_US")).toContain("AT");
  });
});

describe("resolveArticleDateLocale", () => {
  it("maps Japanese locales to ja", () => {
    expect(resolveArticleDateLocale("ja-JP")).toBe("ja");
  });

  it("preserves English regional locales", () => {
    expect(resolveArticleDateLocale("en-GB")).toBe("en-GB");
  });

  it("falls back unsupported locales to en", () => {
    expect(resolveArticleDateLocale("zh-CN")).toBe("en");
    expect(resolveArticleDateLocale(undefined)).toBe("en");
  });

  it("falls back invalid locale tags to en-US", () => {
    expect(resolveArticleDateLocale("en_US")).toBe("en-US");
  });

  it("uses the i18n English fallback when Intl supported locale lookup fails", () => {
    const supportedLocalesOfSpy = vi.spyOn(Intl.DateTimeFormat, "supportedLocalesOf").mockImplementationOnce(() => {
      throw new RangeError("invalid locale");
    });

    expect(resolveArticleDateLocale("en_US")).toBe("en-US");
    expect(supportedLocalesOfSpy).toHaveBeenCalledWith("en_US");

    supportedLocalesOfSpy.mockRestore();
  });
});

describe("article summary website helpers", () => {
  it("uses the feed site URL before the feed URL", () => {
    const feed = {
      ...sampleFeeds[0],
      site_url: "https://site.example.com/articles",
      url: "https://feed.example.com/rss",
    };

    expect(resolveArticleSummaryWebsiteHref(feed)).toBe("https://site.example.com/articles");
    expect(resolveArticleSummaryWebsiteLabel(feed)).toBe("site.example.com");
  });

  it("falls back to feed URL labels when site URL is missing", () => {
    const feed = {
      ...sampleFeeds[0],
      site_url: "",
      url: "https://feed.example.com/rss",
    };

    expect(resolveArticleSummaryWebsiteHref(feed)).toBe("https://feed.example.com/rss");
    expect(resolveArticleSummaryWebsiteLabel(feed)).toBe("feed.example.com");
  });

  it("omits website labels when no feed URL is available", () => {
    const feed = {
      ...sampleFeeds[0],
      site_url: "",
      url: "",
    };

    expect(resolveArticleSummaryWebsiteHref(feed)).toBeNull();
    expect(resolveArticleSummaryWebsiteLabel(feed)).toBeNull();
  });
});

describe("buildArticleViewSummary", () => {
  it("returns an explicit error when a selection has no summary", () => {
    const result = buildArticleViewSummaryResult({
      selection: { type: "all" },
      selectedFeedId: null,
      feeds: sampleFeeds,
      folders: [],
      tags: [],
      filteredArticles: sampleArticles,
      allFeedArticles: sampleArticles,
    });

    expect(Result.unwrapError(result)).toBe("summary_not_available");
  });

  it("returns an explicit error when the selected folder is missing", () => {
    const result = buildArticleViewSummaryResult({
      selection: { type: "folder", folderId: "missing-folder" },
      selectedFeedId: null,
      feeds: sampleFeeds,
      folders: [],
      tags: [],
      filteredArticles: sampleArticles,
      allFeedArticles: sampleArticles,
    });

    expect(Result.unwrapError(result)).toBe("folder_not_found");
    expect(
      buildArticleViewSummary({
        selection: { type: "folder", folderId: "missing-folder" },
        selectedFeedId: null,
        feeds: sampleFeeds,
        folders: [],
        tags: [],
        filteredArticles: sampleArticles,
        allFeedArticles: sampleArticles,
      }),
    ).toBeUndefined();
  });

  it("uses the feed id from the selection when resolving feed summaries", () => {
    const result = buildArticleViewSummaryResult({
      selection: { type: "feed", feedId: "feed-1" },
      selectedFeedId: null,
      feeds: sampleFeeds,
      folders: [],
      tags: [],
      filteredArticles: sampleArticles,
      allFeedArticles: sampleArticles,
    });

    expect(Result.unwrap(result)).toMatchObject({
      kind: "feed",
      feed: expect.objectContaining({ id: "feed-1" }),
    });
  });

  it("scopes the latest feed summary article to the selected feed", () => {
    const selectedFeedArticle = {
      ...sampleArticles[0],
      feed_id: "feed-1",
      title: "Selected feed post",
      published_at: "2026-03-01T10:00:00Z",
    };
    const otherFeedArticle = {
      ...sampleArticles[1],
      feed_id: "feed-2",
      title: "Other feed newer post",
      published_at: "2026-04-01T10:00:00Z",
    };

    const result = buildArticleViewSummaryResult({
      selection: { type: "feed", feedId: "feed-1" },
      selectedFeedId: null,
      feeds: sampleFeeds,
      folders: [],
      tags: [],
      filteredArticles: [selectedFeedArticle],
      allFeedArticles: [selectedFeedArticle, otherFeedArticle],
    });

    expect(Result.unwrap(result)).toMatchObject({
      kind: "feed",
      latestArticleTitle: "Selected feed post",
      latestArticlePublishedAt: "2026-03-01T10:00:00Z",
    });
  });

  it("counts folder feeds and unread visible articles for folder summaries", () => {
    const folders: FolderDto[] = [
      {
        id: "folder-1",
        account_id: "acc-1",
        name: "Work",
        sort_order: 0,
      },
    ];
    const folderFeeds = sampleFeeds.map((feed, index) => ({
      ...feed,
      folder_id: index < 2 ? "folder-1" : "folder-other",
    }));
    const filteredArticles = [
      {
        ...sampleArticles[0],
        is_read: false,
        published_at: "2026-03-01T10:00:00Z",
      },
      {
        ...sampleArticles[1],
        is_read: true,
        published_at: "2026-03-02T10:00:00Z",
      },
    ];

    const result = buildArticleViewSummaryResult({
      selection: { type: "folder", folderId: "folder-1" },
      selectedFeedId: null,
      feeds: folderFeeds,
      folders,
      tags: [],
      filteredArticles,
      allFeedArticles: [],
    });

    expect(Result.unwrap(result)).toMatchObject({
      kind: "folder",
      feedCount: 2,
      unreadCount: 1,
      latestArticlePublishedAt: "2026-03-02T10:00:00Z",
    });
    expect(
      buildArticleViewSummary({
        selection: { type: "folder", folderId: "folder-1" },
        selectedFeedId: null,
        feeds: folderFeeds,
        folders,
        tags: [],
        filteredArticles,
        allFeedArticles: [],
      }),
    ).toMatchObject({
      kind: "folder",
      feedCount: 2,
      unreadCount: 1,
      latestArticlePublishedAt: "2026-03-02T10:00:00Z",
    });
  });
});
