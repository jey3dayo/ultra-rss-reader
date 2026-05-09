import { afterEach, describe, expect, it } from "vitest";
import {
  AccountDtoListSchema,
  ArticleDtoListSchema,
  FeedDtoListSchema,
  FolderDtoListSchema,
  TagDtoListSchema,
} from "@/api/schemas";
import {
  DEV_MOCK_FIXTURE_BOUNDARIES,
  listDevMockFixtureBoundaryKeys,
  mockAccounts,
  mockArticles,
  mockDataSeeds,
  mockFeeds,
  mockFolders,
  mockTags,
  resetMockDataForDevMocks,
} from "@/dev/mock-data";

function requireFirstItem<T>(items: readonly T[], label: string): T {
  const item = items[0];
  if (item === undefined) {
    throw new Error(`${label} fixture is empty`);
  }
  return item;
}

describe("dev mock data", () => {
  afterEach(() => {
    resetMockDataForDevMocks();
  });

  it("keeps exported DTO fixtures aligned with frontend response schemas", () => {
    expect(AccountDtoListSchema.parse(mockAccounts)).toEqual(mockAccounts);
    expect(FolderDtoListSchema.parse(mockFolders)).toEqual(mockFolders);
    expect(FeedDtoListSchema.parse(mockFeeds)).toEqual(mockFeeds);
    expect(ArticleDtoListSchema.parse(mockArticles)).toEqual(mockArticles);
    expect(TagDtoListSchema.parse(mockTags)).toEqual(mockTags);
  });

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

  it("resets mutable runtime state from fresh seed clones", () => {
    resetMockDataForDevMocks();
    const seedSnapshot = structuredClone(mockDataSeeds);
    const initialAccounts = structuredClone(mockAccounts);
    const initialFeeds = structuredClone(mockFeeds);
    const initialArticles = structuredClone(mockArticles);
    const initialFirstAccount = requireFirstItem(mockAccounts, "account");
    const initialFirstFeed = requireFirstItem(mockFeeds, "feed");
    const initialFirstArticle = requireFirstItem(mockArticles, "article");

    mockAccounts[0] = {
      ...initialFirstAccount,
      name: "mutated account",
    };
    mockFeeds[0] = {
      ...initialFirstFeed,
      unread_count: 999,
    };
    mockArticles[0] = {
      ...initialFirstArticle,
      is_read: true,
      title: "mutated article",
    };
    mockAccounts.push({
      id: "acc-dev-mutation",
      kind: "Local",
      name: "mutation",
      username: null,
      server_url: null,
      sync_interval_secs: 1,
      sync_on_startup: false,
      sync_on_wake: false,
      keep_read_items_days: 1,
    });

    resetMockDataForDevMocks();

    expect(mockDataSeeds).toEqual(seedSnapshot);
    expect(mockAccounts).toEqual(initialAccounts);
    expect(mockFeeds).toEqual(initialFeeds);
    expect(mockArticles).toEqual(initialArticles);
    expect(mockAccounts[0]).not.toBe(mockDataSeeds.accounts[0]);
    expect(mockFeeds[0]).not.toBe(mockDataSeeds.feeds[0]);
    expect(mockArticles[0]).not.toBe(mockDataSeeds.articles[0]);
    expect(mockAccounts[0]).not.toBe(initialFirstAccount);
    expect(mockFeeds[0]).not.toBe(initialFirstFeed);
    expect(mockArticles[0]).not.toBe(initialFirstArticle);

    const resetFirstAccount = requireFirstItem(mockAccounts, "account");
    mockAccounts[0] = {
      ...resetFirstAccount,
      name: "mutated after reset",
    };
    resetMockDataForDevMocks();

    expect(mockDataSeeds).toEqual(seedSnapshot);
    expect(mockAccounts).toEqual(initialAccounts);
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

  it("documents fixture boundaries by dev usage surface", () => {
    expect(DEV_MOCK_FIXTURE_BOUNDARIES).toEqual({
      reader: ["accounts", "folders", "feeds", "articles", "tags", "articleTags"],
      settings: ["accounts", "folders", "feeds", "tags"],
      browser: ["articles"],
      subscriptions: ["accounts", "folders", "feeds", "articles"],
    });
    expect(listDevMockFixtureBoundaryKeys("browser")).toEqual(["articles"]);
  });

  it("keeps dev fixture boundaries aligned with seed groups and usage surfaces", () => {
    const seedGroups = new Set(Object.keys(mockDataSeeds));

    for (const fixtureKeys of Object.values(DEV_MOCK_FIXTURE_BOUNDARIES)) {
      expect(fixtureKeys.every((fixtureKey) => seedGroups.has(fixtureKey))).toBe(true);
    }

    expect(listDevMockFixtureBoundaryKeys("reader")).toEqual(
      expect.arrayContaining(["accounts", "folders", "feeds", "articles", "tags", "articleTags"]),
    );
    expect(listDevMockFixtureBoundaryKeys("settings")).not.toEqual(expect.arrayContaining(["articles", "articleTags"]));
    expect(listDevMockFixtureBoundaryKeys("browser")).toEqual(["articles"]);
    expect(listDevMockFixtureBoundaryKeys("subscriptions")).not.toEqual(expect.arrayContaining(["tags", "articleTags"]));
  });
});
