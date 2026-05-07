import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";
import type { FolderDto } from "@/api/tauri-commands";
import {
  buildArticleViewSummary,
  buildArticleViewSummaryResult,
  findSelectedArticle,
  formatArticleDate,
  resolveArticleDateLocale,
  resolveArticleSummaryWebsiteHref,
  resolveArticleSummaryWebsiteLabel,
  shouldOpenArticleTitleInExternalBrowser,
} from "@/lib/article-view";
import { sampleArticles, sampleFeeds } from "../../../tests/helpers/tauri-mocks";

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
      { ...sampleArticles[0], is_read: false, published_at: "2026-03-01T10:00:00Z" },
      { ...sampleArticles[1], is_read: true, published_at: "2026-03-02T10:00:00Z" },
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
