import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";
import {
  findSelectedArticle,
  formatArticleDate,
  resolveArticleDateLocale,
  shouldOpenExternalBrowser,
} from "@/lib/article-view";
import { sampleArticles } from "../../../tests/helpers/tauri-mocks";

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

  it("uses the external browser when the preference requires it", () => {
    expect(
      shouldOpenExternalBrowser({
        openLinks: "default_browser",
        cmdClickBrowser: "false",
        metaKey: false,
        ctrlKey: false,
      }),
    ).toBe(true);
  });

  it("uses the external browser for modifier-click when enabled", () => {
    expect(
      shouldOpenExternalBrowser({
        openLinks: "in_app",
        cmdClickBrowser: "true",
        metaKey: true,
        ctrlKey: false,
      }),
    ).toBe(true);
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

  it("formats Japanese UI dates with a Japanese locale", () => {
    const result = formatArticleDate("2026-03-25T10:00:00Z", "ja");

    expect(result).toContain("2026年");
    expect(result).not.toContain("AT");
    expect(result).not.toContain("MARCH");
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
