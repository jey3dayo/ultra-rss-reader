import { parse } from "valibot";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AccountDtoListSchema,
  ArticleDtoListSchema,
  FeedDtoListSchema,
  FolderDtoListSchema,
  TagDtoListSchema,
} from "@/api/schemas";
import { mockDataSeedsEn, relativeMockArticlePublishedAtEn } from "@/dev/mock-data-demo-en";

describe("dev mock data (English demo locale)", () => {
  it("keeps exported English seed DTOs aligned with frontend response schemas", () => {
    expect(parse(AccountDtoListSchema, mockDataSeedsEn.accounts)).toEqual(mockDataSeedsEn.accounts);
    expect(parse(FolderDtoListSchema, mockDataSeedsEn.folders)).toEqual(mockDataSeedsEn.folders);
    expect(parse(FeedDtoListSchema, mockDataSeedsEn.feeds)).toEqual(mockDataSeedsEn.feeds);
    expect(parse(ArticleDtoListSchema, mockDataSeedsEn.articles)).toEqual(mockDataSeedsEn.articles);
    expect(parse(TagDtoListSchema, mockDataSeedsEn.tags)).toEqual(mockDataSeedsEn.tags);
  });

  it("keeps folder-to-account references valid", () => {
    const accountIds = new Set(mockDataSeedsEn.accounts.map((account) => account.id));

    for (const folder of mockDataSeedsEn.folders) {
      expect(accountIds.has(folder.account_id)).toBe(true);
    }
  });

  it("keeps feed-to-folder and feed-to-account references valid", () => {
    const accountIds = new Set(mockDataSeedsEn.accounts.map((account) => account.id));
    const folderIds = new Set(mockDataSeedsEn.folders.map((folder) => folder.id));

    for (const feed of mockDataSeedsEn.feeds) {
      expect(accountIds.has(feed.account_id)).toBe(true);
      if (feed.folder_id !== null) {
        expect(folderIds.has(feed.folder_id)).toBe(true);
      }
    }
  });

  it("keeps article-to-feed references valid", () => {
    const feedIds = new Set(mockDataSeedsEn.feeds.map((feed) => feed.id));

    for (const article of mockDataSeedsEn.articles) {
      expect(feedIds.has(article.feed_id)).toBe(true);
    }
  });

  it("keeps articleTag references valid against articles and tags", () => {
    const articleIds = new Set(mockDataSeedsEn.articles.map((article) => article.id));
    const tagIds = new Set(mockDataSeedsEn.tags.map((tag) => tag.id));

    for (const articleTag of mockDataSeedsEn.articleTags) {
      expect(articleIds.has(articleTag.article_id)).toBe(true);
      expect(tagIds.has(articleTag.tag_id)).toBe(true);
    }
  });

  it("keeps the relative-date map pointing at real English seed articles", () => {
    const articleIds = new Set(mockDataSeedsEn.articles.map((article) => article.id));

    for (const relativeArticleId of Object.keys(relativeMockArticlePublishedAtEn)) {
      expect(articleIds.has(relativeArticleId)).toBe(true);
    }
  });

  it("provides at least one long-form article for reader keyboard-navigation checks", () => {
    const hasLongArticle = mockDataSeedsEn.articles.some((article) => article.content_sanitized.length > 2000);

    expect(hasLongArticle).toBe(true);
  });

  it("does not attribute fictional headlines to real news organizations", () => {
    const realOrganizationNames = ["NHK", "The Verge", "Ars Technica", "TechCrunch", "Reuters", "BBC", "CNN"];

    for (const feed of mockDataSeedsEn.feeds) {
      expect(realOrganizationNames).not.toContain(feed.title);
    }
    for (const article of mockDataSeedsEn.articles) {
      if (article.author) {
        expect(realOrganizationNames).not.toContain(article.author);
      }
    }
  });

  it("does not leak Japanese characters into English demo article text", () => {
    const containsJapanese = (value: string) => /[぀-ヿ一-龯]/.test(value);

    for (const article of mockDataSeedsEn.articles) {
      expect(containsJapanese(article.title)).toBe(false);
      expect(containsJapanese(article.summary ?? "")).toBe(false);
      expect(containsJapanese(article.content_sanitized)).toBe(false);
    }
  });

  it("does not leak Japanese characters into English demo feed or folder titles", () => {
    const containsJapanese = (value: string) => /[぀-ヿ一-龯]/.test(value);

    for (const feed of mockDataSeedsEn.feeds) {
      expect(containsJapanese(feed.title)).toBe(false);
    }
    for (const folder of mockDataSeedsEn.folders) {
      expect(containsJapanese(folder.name)).toBe(false);
    }
    for (const tag of mockDataSeedsEn.tags) {
      expect(containsJapanese(tag.name)).toBe(false);
    }
  });
});

describe("dev mock data locale switching (mock-data.ts seam)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to the Japanese seed set when VITE_DEV_MOCK_LOCALE is unset", async () => {
    const { mockDataSeeds } = await import("@/dev/mock-data");

    expect(mockDataSeeds.accounts.some((account) => account.name === "FreshRSS")).toBe(true);
    expect(mockDataSeeds.feeds.some((feed) => feed.title === "AUTOMATON")).toBe(true);
  });

  it("falls back to Japanese seeds for an unrecognized VITE_DEV_MOCK_LOCALE value", async () => {
    vi.stubEnv("VITE_DEV_MOCK_LOCALE", "fr");
    const { mockDataSeeds } = await import("@/dev/mock-data");

    expect(mockDataSeeds.feeds.some((feed) => feed.title === "AUTOMATON")).toBe(true);
  });

  it("switches to the English demo seed set when VITE_DEV_MOCK_LOCALE=en", async () => {
    vi.stubEnv("VITE_DEV_MOCK_LOCALE", "en");
    const { mockDataSeeds } = await import("@/dev/mock-data");
    const { mockDataSeedsEn: expectedEnSeeds } = await import("@/dev/mock-data-demo-en");

    expect(mockDataSeeds).toEqual(expectedEnSeeds);
    expect(mockDataSeeds.feeds.some((feed) => feed.title === "Tech Digest")).toBe(true);
  });

  it("seeds the language preference default to English only under the English demo locale", async () => {
    vi.stubEnv("VITE_DEV_MOCK_LOCALE", "en");
    const { mockPreferences } = await import("@/dev/mock-state");

    expect(mockPreferences.get("language")).toBe("en");
  });

  it("leaves the language preference unset (frontend default) under the default Japanese locale", async () => {
    const { mockPreferences } = await import("@/dev/mock-state");

    expect(mockPreferences.has("language")).toBe(false);
  });

  it("seeds an English mute keyword list under VITE_DEV_MOCK_LOCALE=en", async () => {
    vi.stubEnv("VITE_DEV_MOCK_LOCALE", "en");
    const { mockMuteKeywords, resetDevMockDataState } = await import("@/dev/mock-state");
    resetDevMockDataState();

    const containsJapanese = (value: string) => /[぀-ヿ一-龯]/.test(value);

    expect(mockMuteKeywords.length).toBeGreaterThan(0);
    for (const rule of mockMuteKeywords) {
      expect(containsJapanese(rule.keyword)).toBe(false);
    }
  });

  it("keeps the existing Japanese mute keyword list under the default locale", async () => {
    const { mockMuteKeywords, resetDevMockDataState } = await import("@/dev/mock-state");
    resetDevMockDataState();

    expect(mockMuteKeywords.some((rule) => rule.keyword === "セール告知")).toBe(true);
  });
});
