import { afterEach, describe, expect, it, vi } from "vitest";
import { mockDataSeedsEn } from "@/dev/mock-data-demo-en";
import {
  STORE_SCREENSHOT_ACCOUNT_ID,
  STORE_SCREENSHOT_ACCOUNT_NAME,
  STORE_SCREENSHOT_EXPANDED_FOLDER_ID,
  STORE_SCREENSHOT_SHOWCASE_ARTICLE_ID,
  STORE_SCREENSHOT_SHOWCASE_ARTICLE_TITLE,
} from "@/dev/store-screenshot-constants";
import { relativeStoreScreenshotPublishedAt, storeScreenshotSeeds } from "@/dev/store-screenshot-fixtures";

const isExampleHost = (url: string) => {
  const host = new URL(url).hostname;
  return host === "example.com" || host.endsWith(".example.com");
};

describe("store screenshot fixtures", () => {
  it("keeps references between accounts, folders, feeds, tags, and articles valid", () => {
    const accountIds = new Set(storeScreenshotSeeds.accounts.map((account) => account.id));
    const folderIds = new Set(storeScreenshotSeeds.folders.map((folder) => folder.id));
    const feedIds = new Set(storeScreenshotSeeds.feeds.map((feed) => feed.id));
    const articleIds = new Set(storeScreenshotSeeds.articles.map((article) => article.id));
    const tagIds = new Set(storeScreenshotSeeds.tags.map((tag) => tag.id));

    for (const folder of storeScreenshotSeeds.folders) {
      expect(accountIds.has(folder.account_id)).toBe(true);
    }
    for (const feed of storeScreenshotSeeds.feeds) {
      expect(accountIds.has(feed.account_id)).toBe(true);
      expect(feed.folder_id === null || folderIds.has(feed.folder_id)).toBe(true);
    }
    for (const article of storeScreenshotSeeds.articles) {
      expect(feedIds.has(article.feed_id)).toBe(true);
    }
    for (const articleTag of storeScreenshotSeeds.articleTags) {
      expect(articleIds.has(articleTag.article_id)).toBe(true);
      expect(tagIds.has(articleTag.tag_id)).toBe(true);
    }
    for (const articleId of Object.keys(relativeStoreScreenshotPublishedAt)) {
      expect(articleIds.has(articleId)).toBe(true);
    }
  });

  it("keeps third-party product names out of every name and text a store image can show (policy 10.1.1.3)", () => {
    const shownText = [
      ...storeScreenshotSeeds.accounts.map((account) => account.name),
      ...storeScreenshotSeeds.folders.map((folder) => folder.name),
      ...storeScreenshotSeeds.feeds.map((feed) => feed.title),
      ...storeScreenshotSeeds.tags.map((tag) => tag.name),
      ...storeScreenshotSeeds.articles.flatMap((article) => [
        article.title,
        article.summary ?? "",
        article.author ?? "",
        article.content_sanitized,
      ]),
    ];

    for (const text of shownText) {
      expect(text).not.toMatch(/freshrss/i);
    }
  });

  it("keeps every feed and article URL on example.com, so no real favicon or logo can load", () => {
    for (const feed of storeScreenshotSeeds.feeds) {
      expect(isExampleHost(feed.url)).toBe(true);
      expect(isExampleHost(feed.site_url)).toBe(true);
    }
    for (const article of storeScreenshotSeeds.articles) {
      if (article.url) {
        expect(isExampleHost(article.url)).toBe(true);
      }
    }
  });

  it("serves article thumbnails as paths, because article thumbnails reject data: URIs", () => {
    const thumbnails = storeScreenshotSeeds.articles.flatMap((article) =>
      article.thumbnail ? [article.thumbnail] : [],
    );

    expect(thumbnails.length).toBeGreaterThan(0);
    for (const thumbnail of thumbnails) {
      expect(thumbnail.startsWith("/")).toBe(true);
    }
  });

  it("matches the constants the capture script verifies against", () => {
    const account = storeScreenshotSeeds.accounts.find((candidate) => candidate.id === STORE_SCREENSHOT_ACCOUNT_ID);
    const showcase = storeScreenshotSeeds.articles.find(
      (article) => article.id === STORE_SCREENSHOT_SHOWCASE_ARTICLE_ID,
    );
    const feedsInExpandedFolder = storeScreenshotSeeds.feeds.filter(
      (feed) => feed.folder_id === STORE_SCREENSHOT_EXPANDED_FOLDER_ID,
    );

    expect(account?.name).toBe(STORE_SCREENSHOT_ACCOUNT_NAME);
    expect(showcase?.title).toBe(STORE_SCREENSHOT_SHOWCASE_ARTICLE_TITLE);
    expect(showcase?.is_read).toBe(false);
    expect(showcase?.thumbnail).toBeNull();
    expect(feedsInExpandedFolder.length).toBeGreaterThan(0);
  });

  it("is carried unchanged by the English demo seed, which only adds articles", () => {
    expect(mockDataSeedsEn.accounts).toEqual(storeScreenshotSeeds.accounts);
    expect(mockDataSeedsEn.folders).toEqual(storeScreenshotSeeds.folders);
    expect(mockDataSeedsEn.feeds).toEqual(storeScreenshotSeeds.feeds);
    expect(mockDataSeedsEn.tags).toEqual(storeScreenshotSeeds.tags);
    expect(mockDataSeedsEn.articleTags).toEqual(storeScreenshotSeeds.articleTags);
    expect(mockDataSeedsEn.articles.slice(0, storeScreenshotSeeds.articles.length)).toEqual(
      storeScreenshotSeeds.articles,
    );
  });
});

describe("store screenshot dataset selection", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("loads only the fixtures under VITE_DEV_MOCK_LOCALE=store, without the demo-only articles", async () => {
    vi.stubEnv("VITE_DEV_MOCK_LOCALE", "store");
    const { mockDataSeeds } = await import("@/dev/mock-data");

    expect(mockDataSeeds).toEqual(storeScreenshotSeeds);
    expect(mockDataSeeds.articles.length).toBeLessThan(mockDataSeedsEn.articles.length);
  });

  it("opens the Dev folder on startup only under the store dataset", async () => {
    vi.stubEnv("VITE_DEV_MOCK_LOCALE", "store");
    const store = await import("@/dev/mock-state");
    expect(store.mockPreferences.get("language")).toBe("en");
    expect(store.mockPreferences.get("startup_folder_expansion")).toBe("restore_previous");

    vi.resetModules();
    vi.stubEnv("VITE_DEV_MOCK_LOCALE", "en");
    const en = await import("@/dev/mock-state");
    expect(en.mockPreferences.has("startup_folder_expansion")).toBe(false);
  });
});
