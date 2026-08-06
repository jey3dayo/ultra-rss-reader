import { parse } from "valibot";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AccountDtoListSchema,
  ArticleDtoListSchema,
  FeedDtoListSchema,
  FolderDtoListSchema,
  TagDtoListSchema,
} from "@/api/schemas";
import {
  DEV_MOCK_FIXTURE_BOUNDARIES,
  DEV_MOCK_NETWORK_ISOLATION_POLICY,
  listDevMockFixtureBoundaryKeys,
  mockAccounts,
  mockArticles,
  mockDataSeeds,
  mockFeeds,
  mockFolders,
  mockTags,
  resetMockDataForDevMocks,
} from "@/dev/mock-data";
import { buildSubscriptionReviewCandidates } from "@/lib/subscriptions/subscription-review-candidates";
import { buildSubscriptionsIndexSummary } from "@/lib/subscriptions/subscriptions-index";

function requireFirstItem<T>(items: readonly T[], label: string): T {
  const item = items[0];
  if (item === undefined) {
    throw new Error(`${label} fixture is empty`);
  }
  return item;
}

function buildMockFeedArticleSummaries() {
  return mockFeeds.map((feed) => {
    const feedArticles = mockArticles.filter((article) => article.feed_id === feed.id);
    const latestArticleAt = feedArticles
      .map((article) => article.published_at)
      .filter((publishedAt): publishedAt is string => publishedAt !== null)
      .sort()
      .at(-1);

    return {
      feed_id: feed.id,
      latest_article_at: latestArticleAt ?? null,
      starred_count: feedArticles.filter((article) => article.is_starred).length,
      recent_article_count: feedArticles.length,
    };
  });
}

describe("dev mock data", () => {
  afterEach(() => {
    vi.useRealTimers();
    resetMockDataForDevMocks();
  });

  it("keeps exported DTO fixtures aligned with frontend response schemas", () => {
    expect(parse(AccountDtoListSchema, mockAccounts)).toEqual(mockAccounts);
    expect(parse(FolderDtoListSchema, mockFolders)).toEqual(mockFolders);
    expect(parse(FeedDtoListSchema, mockFeeds)).toEqual(mockFeeds);
    expect(parse(ArticleDtoListSchema, mockArticles)).toEqual(mockArticles);
    expect(parse(TagDtoListSchema, mockTags)).toEqual(mockTags);
  });

  it("does not include the known ORB-blocked thumbnail URL", () => {
    const blockedUrl = "https://images.unsplash.com/photo-1529927120475-1f638e42f5c3?w=400&h=300&fit=crop";

    expect(mockArticles.some((article) => article.thumbnail === blockedUrl)).toBe(false);
  });

  it("keeps real-domain dev fixtures isolated from accidental asset network requests", () => {
    expect(DEV_MOCK_NETWORK_ISOLATION_POLICY).toMatchObject({
      realDomainUrls: "allowed-for-text-and-recorded-navigation-only",
      remoteAssetUrls: "forbidden",
      faviconRequests: "use-runtime-mocks-or-local-rendering-only",
      externalOpen: "record-only",
      browserWebview: "state-only",
      feedDiscovery: "synthetic",
    });

    expect(mockFeeds.some((feed) => new URL(feed.url).hostname !== "example.com")).toBe(true);
    expect(
      mockArticles.some(
        (article) => typeof article.url === "string" && new URL(article.url).hostname !== "example.com",
      ),
    ).toBe(true);
    expect(mockArticles.map((article) => article.thumbnail).filter(Boolean)).toEqual([]);
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

  it("regenerates relative today and yesterday article dates at reset time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T12:00:00+09:00"));
    resetMockDataForDevMocks();
    const initialTodayArticle = requireFirstItem(
      mockArticles.filter((article) => article.id === "art-1"),
      "today article",
    );
    const initialYesterdayArticle = requireFirstItem(
      mockArticles.filter((article) => article.id === "art-3"),
      "yesterday article",
    );

    vi.setSystemTime(new Date("2026-04-21T12:00:00+09:00"));
    resetMockDataForDevMocks();
    const resetTodayArticle = requireFirstItem(
      mockArticles.filter((article) => article.id === "art-1"),
      "reset today article",
    );
    const resetYesterdayArticle = requireFirstItem(
      mockArticles.filter((article) => article.id === "art-3"),
      "reset yesterday article",
    );

    expect(initialTodayArticle.published_at).toContain("2026-04-20T");
    expect(initialYesterdayArticle.published_at).toContain("2026-04-19T");
    expect(resetTodayArticle.published_at).toContain("2026-04-21T");
    expect(resetYesterdayArticle.published_at).toContain("2026-04-20T");
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

  it("provides non-zero subscription review and stale samples for workspace debugging", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T13:00:00+09:00"));
    resetMockDataForDevMocks();

    const feedArticleSummaries = buildMockFeedArticleSummaries();
    const candidates = buildSubscriptionReviewCandidates({
      feeds: mockFeeds,
      folders: mockFolders,
      feedArticleSummaries,
      now: new Date("2026-06-26T13:00:00+09:00"),
      hiddenFeedIds: new Set(),
    });
    const summary = buildSubscriptionsIndexSummary({
      feeds: mockFeeds,
      candidates,
      feedArticleSummaryMap: new Map(feedArticleSummaries.map((s) => [s.feed_id, s])),
    });

    expect(summary.reviewCount).toBeGreaterThanOrEqual(3);
    expect(summary.staleCount).toBeGreaterThanOrEqual(3);
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
    expect(listDevMockFixtureBoundaryKeys("subscriptions")).not.toEqual(
      expect.arrayContaining(["tags", "articleTags"]),
    );
  });
});
