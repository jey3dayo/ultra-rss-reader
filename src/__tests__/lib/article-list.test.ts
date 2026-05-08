import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";
import type { ArticleDto } from "@/api/tauri-commands";
import {
  areArticleListsEquivalent,
  buildArticleGroupItems,
  buildArticleListFeedNameMap,
  buildFolderFeedIdSet,
  calculateArticleNavigationScrollTop,
  collectRetainedArticlesFromSources,
  countStarredArticles,
  countUnreadArticles,
  getAdjacentArticleId,
  getAdjacentItemId,
  getUnreadArticleIds,
  groupArticles,
  mergeResolvedArticlesWithRetained,
  mergeRetainedArticlesSnapshot,
  resolveArticleGroupLabelToken,
  resolveArticleListMarkAllReadCount,
  resolveEffectiveRetainedArticleIds,
  selectVisibleArticles,
} from "@/lib/article-list";
import type { ReaderFilter, ReaderSourcePlan } from "@/lib/reader-query";
import { sampleArticles, sampleFeeds } from "@tests/helpers/tauri-mocks";

function buildTestSourcePlan(params: {
  sourceFilter: ReaderFilter;
  effectiveViewMode: ReaderFilter;
}): ReaderSourcePlan {
  return {
    query: {
      source: "articles",
      scope: { type: "account", accountId: "acc-1" },
      filter: params.sourceFilter,
    },
    sourceKind: "account",
    sourceKey: `account:acc-1:articles:${params.sourceFilter}`,
    accountId: "acc-1",
    folderId: null,
    feedId: null,
    tagId: null,
    accountMode: params.sourceFilter,
    folderMode: "all",
    feedMode: "all",
    tagMode: "all",
    recentMode: "all",
    effectiveViewMode: params.effectiveViewMode,
    preservesRecentOrder: false,
  };
}

describe("article-list utils", () => {
  it("filters and sorts account articles for unread view", () => {
    const articles: ArticleDto[] = [
      {
        ...sampleArticles[0],
        id: "older-unread",
        published_at: "2026-03-24T10:00:00Z",
      },
      {
        ...sampleArticles[0],
        id: "newer-unread",
        published_at: "2026-03-25T10:00:00Z",
      },
      sampleArticles[1],
    ];

    const result = selectVisibleArticles({
      articles: [],
      accountArticles: articles,
      tagArticles: [],
      searchResults: [],
      feedId: null,
      tagId: null,
      viewMode: "unread",
      sourceFilter: null,
      showSearch: false,
      searchQuery: "",
      sortUnread: "newest_first",
    });

    expect(result.map((article) => article.id)).toEqual(["newer-unread", "older-unread"]);
  });

  it("prefers search results when search is open", () => {
    const result = selectVisibleArticles({
      articles: sampleArticles,
      accountArticles: [],
      tagArticles: [],
      searchResults: [sampleArticles[1]],
      feedId: "feed-1",
      tagId: null,
      viewMode: "all",
      sourceFilter: null,
      showSearch: true,
      searchQuery: "Second",
      sortUnread: "newest_first",
    });

    expect(result).toEqual([sampleArticles[1]]);
  });

  it("filters account articles to the selected folder feed ids before unread filtering", () => {
    const result = selectVisibleArticles({
      articles: [],
      accountArticles: [
        { ...sampleArticles[0], id: "art-folder", feed_id: "feed-1", is_read: false },
        { ...sampleArticles[1], id: "art-other", feed_id: "feed-2", is_read: false },
        { ...sampleArticles[0], id: "art-read", feed_id: "feed-1", is_read: true },
      ],
      tagArticles: [],
      searchResults: [],
      feedId: null,
      tagId: null,
      folderFeedIds: new Set(["feed-1"]),
      viewMode: "unread",
      sourceFilter: null,
      showSearch: false,
      searchQuery: "",
      sortUnread: "newest_first",
      retainedArticleIds: new Set(),
    });

    expect(result.map((article) => article.id)).toEqual(["art-folder"]);
  });

  it("filters feed articles by feed id when the source is account-scoped starred articles", () => {
    const result = selectVisibleArticles({
      articles: [
        { ...sampleArticles[0], id: "starred-feed", feed_id: "feed-1", is_starred: true, is_read: true },
        { ...sampleArticles[1], id: "starred-other", feed_id: "feed-2", is_starred: true, is_read: true },
      ],
      accountArticles: [],
      tagArticles: [],
      searchResults: [],
      feedId: "feed-1",
      tagId: null,
      viewMode: "starred",
      sourceFilter: null,
      showSearch: false,
      searchQuery: "",
      sortUnread: "newest_first",
      retainedArticleIds: new Set(),
    });

    expect(result.map((article) => article.id)).toEqual(["starred-feed"]);
  });

  it("filters search results to the selected folder feed ids", () => {
    const result = selectVisibleArticles({
      articles: [],
      accountArticles: [],
      tagArticles: [],
      searchResults: [
        { ...sampleArticles[0], id: "art-folder", feed_id: "feed-1" },
        { ...sampleArticles[1], id: "art-other", feed_id: "feed-2" },
      ],
      feedId: null,
      tagId: null,
      folderFeedIds: new Set(["feed-1"]),
      viewMode: "all",
      sourceFilter: null,
      showSearch: true,
      searchQuery: "Article",
      sortUnread: "newest_first",
      retainedArticleIds: new Set(),
    });

    expect(result.map((article) => article.id)).toEqual(["art-folder"]);
  });

  it("keeps smart unread searches limited to unread articles", () => {
    const result = selectVisibleArticles({
      articles: [],
      accountArticles: [],
      tagArticles: [],
      searchResults: [
        { ...sampleArticles[0], id: "search-unread", is_read: false, is_starred: false },
        { ...sampleArticles[1], id: "search-read", is_read: true, is_starred: true },
      ],
      feedId: null,
      tagId: null,
      viewMode: "unread",
      sourceFilter: "unread",
      showSearch: true,
      searchQuery: "search",
      sortUnread: "newest_first",
      retainedArticleIds: new Set(),
    });

    expect(result.map((article) => article.id)).toEqual(["search-unread"]);
  });

  it("keeps smart starred searches limited to unread starred articles when footer mode is unread", () => {
    const result = selectVisibleArticles({
      articles: [],
      accountArticles: [],
      tagArticles: [],
      searchResults: [
        { ...sampleArticles[0], id: "starred-unread", is_read: false, is_starred: true },
        { ...sampleArticles[1], id: "starred-read", is_read: true, is_starred: true },
        { ...sampleArticles[0], id: "plain-unread", is_read: false, is_starred: false },
      ],
      feedId: null,
      tagId: null,
      viewMode: "unread",
      sourceFilter: "starred",
      showSearch: true,
      searchQuery: "search",
      sortUnread: "newest_first",
      retainedArticleIds: new Set(),
    });

    expect(result.map((article) => article.id)).toEqual(["starred-unread"]);
  });

  it("keeps starred smart view limited to starred articles when footer mode is all", () => {
    const result = selectVisibleArticles({
      articles: [],
      accountArticles: [
        { ...sampleArticles[0], id: "starred-read", is_starred: true, is_read: true },
        { ...sampleArticles[1], id: "starred-unread", is_starred: true, is_read: false },
        { ...sampleArticles[2], id: "plain-unread", is_starred: false, is_read: false },
      ],
      tagArticles: [],
      searchResults: [],
      feedId: null,
      tagId: null,
      viewMode: "all",
      showSearch: false,
      searchQuery: "",
      sortUnread: "newest_first",
      retainedArticleIds: new Set(),
      sourceFilter: "starred",
    });

    expect(result.map((article) => article.id)).toEqual(["starred-read", "starred-unread"]);
  });

  it("keeps starred smart view limited to unread starred articles when footer mode is unread", () => {
    const result = selectVisibleArticles({
      articles: [],
      accountArticles: [
        { ...sampleArticles[0], id: "starred-read", is_starred: true, is_read: true },
        { ...sampleArticles[1], id: "starred-unread", is_starred: true, is_read: false },
        { ...sampleArticles[2], id: "plain-unread", is_starred: false, is_read: false },
      ],
      tagArticles: [],
      searchResults: [],
      feedId: null,
      tagId: null,
      viewMode: "unread",
      showSearch: false,
      searchQuery: "",
      sortUnread: "newest_first",
      retainedArticleIds: new Set(),
      sourceFilter: "starred",
    });

    expect(result.map((article) => article.id)).toEqual(["starred-unread"]);
  });

  it("applies the active footer filter to tag articles", () => {
    const tagArticles = [
      { ...sampleArticles[0], id: "tag-unread", is_read: false, is_starred: false },
      { ...sampleArticles[1], id: "tag-starred", is_read: true, is_starred: true },
    ];

    const unreadResult = selectVisibleArticles({
      articles: [],
      accountArticles: [],
      tagArticles,
      searchResults: [],
      feedId: null,
      tagId: "tag-1",
      viewMode: "unread",
      showSearch: false,
      searchQuery: "",
      sortUnread: "newest_first",
      retainedArticleIds: new Set(),
      sourceFilter: null,
    });
    const starredResult = selectVisibleArticles({
      articles: [],
      accountArticles: [],
      tagArticles,
      searchResults: [],
      feedId: null,
      tagId: "tag-1",
      viewMode: "starred",
      showSearch: false,
      searchQuery: "",
      sortUnread: "newest_first",
      retainedArticleIds: new Set(),
      sourceFilter: null,
    });

    expect(unreadResult.map((article) => article.id)).toEqual(["tag-unread"]);
    expect(starredResult.map((article) => article.id)).toEqual(["tag-starred"]);
  });

  it("keeps recently viewed articles in history order", () => {
    const result = selectVisibleArticles({
      articles: [],
      accountArticles: [
        { ...sampleArticles[0], id: "viewed-first", published_at: "2026-04-20T00:00:00Z" },
        { ...sampleArticles[1], id: "viewed-second", published_at: "2026-04-22T00:00:00Z" },
      ],
      tagArticles: [],
      searchResults: [],
      feedId: null,
      tagId: null,
      viewMode: "all",
      showSearch: false,
      searchQuery: "",
      sortUnread: "newest_first",
      sourceFilter: "all",
      preservesSourceOrder: true,
    });

    expect(result.map((article) => article.id)).toEqual(["viewed-first", "viewed-second"]);
  });

  it("groups articles by feed title", () => {
    const feedNameMap = new Map(sampleFeeds.map((feed) => [feed.id, feed.title]));

    const result = groupArticles({
      articles: sampleArticles,
      groupBy: "feed",
      feedNameMap,
    });

    expect(Object.keys(result)).toEqual(["Tech Blog"]);
  });

  it("groups older articles by long local date label", () => {
    const result = groupArticles({
      articles: [{ ...sampleArticles[0], published_at: "2026-03-01T10:00:00Z" }],
      groupBy: "date",
      feedNameMap: new Map(),
    });

    expect(Object.keys(result)[0]).toContain("2026");
  });

  it("resolves built-in article group label translation tokens", () => {
    expect(resolveArticleGroupLabelToken("TODAY")).toBe("today");
    expect(resolveArticleGroupLabelToken("YESTERDAY")).toBe("yesterday");
    expect(resolveArticleGroupLabelToken("__unknown_feed__")).toBe("unknown_feed");
    expect(resolveArticleGroupLabelToken("Tech Blog")).toBeNull();
  });

  it("builds article group row items from group context", () => {
    const result = buildArticleGroupItems({
      articles: sampleArticles.slice(0, 2),
      feedNameMap: new Map([["feed-1", "Tech Blog"]]),
      selectedArticleId: "art-2",
      recentlyReadIds: new Set(["art-1"]),
    });

    expect(result).toEqual([
      {
        article: sampleArticles[0],
        feedName: "Tech Blog",
        isSelected: false,
        isRecentlyRead: true,
      },
      {
        article: sampleArticles[1],
        feedName: "Tech Blog",
        isSelected: true,
        isRecentlyRead: false,
      },
    ]);
  });

  it("builds feed lookup helpers for list grouping and folder filtering", () => {
    expect(buildArticleListFeedNameMap(sampleFeeds)).toEqual(new Map(sampleFeeds.map((feed) => [feed.id, feed.title])));
    expect(buildFolderFeedIdSet(sampleFeeds, "folder-1")).toEqual(
      new Set(sampleFeeds.filter((feed) => feed.folder_id === "folder-1").map((feed) => feed.id)),
    );
    expect(buildFolderFeedIdSet(sampleFeeds, null)).toBeNull();
  });

  it("collects retained articles from multiple sources without duplicates", () => {
    const retained = collectRetainedArticlesFromSources({
      retainedArticleIds: new Set(["art-1", "retained-copy"]),
      sources: [[sampleArticles[0]], undefined, [sampleArticles[0], { ...sampleArticles[1], id: "retained-copy" }]],
    });

    expect(retained.map((article) => article.id)).toEqual(["art-1", "retained-copy"]);
  });

  it("merges retained article snapshots and preserves equivalent references", () => {
    const previous = {
      contextKey: "account:acc-1",
      articles: [sampleArticles[0]],
    };

    const next = mergeRetainedArticlesSnapshot({
      previous,
      contextKey: "account:acc-1",
      retainedArticleIds: new Set(["art-1"]),
      currentRetainedArticles: [],
    });

    expect(next).toBe(previous);
    expect(
      mergeRetainedArticlesSnapshot({
        previous,
        contextKey: "account:acc-1",
        retainedArticleIds: new Set(),
        currentRetainedArticles: [],
      }),
    ).toBeNull();
  });

  it("prepends retained articles missing from the current primary source", () => {
    const result = mergeResolvedArticlesWithRetained({
      resolvedPrimarySourceArticles: [sampleArticles[1]],
      retainedArticlesSnapshot: { contextKey: "feed:feed-1", articles: [sampleArticles[0], sampleArticles[1]] },
      retainedArticleIds: new Set(["art-1", "art-2"]),
      contextKey: "feed:feed-1",
    });

    expect(result?.map((article) => article.id)).toEqual(["art-1", "art-2"]);
  });

  it("compares article lists by stable row fields", () => {
    expect(areArticleListsEquivalent([sampleArticles[0]], [{ ...sampleArticles[0], summary: "changed" }])).toBe(true);
    expect(areArticleListsEquivalent([sampleArticles[0]], [{ ...sampleArticles[0], title: "changed" }])).toBe(false);
  });

  it("returns unread ids and unread count from the currently visible list", () => {
    expect(getUnreadArticleIds(sampleArticles)).toEqual(["art-1"]);
    expect(countUnreadArticles(sampleArticles)).toBe(1);
    expect(countStarredArticles(sampleArticles)).toBe(1);
  });

  it("resolves the mark-all-read confirmation count for each article list selection", () => {
    const filteredArticles = [
      { ...sampleArticles[0], is_read: false },
      { ...sampleArticles[1], is_read: false },
      { ...sampleArticles[2], is_read: true },
    ];

    expect(
      resolveArticleListMarkAllReadCount({
        selection: { type: "feed", feedId: "feed-1" },
        selectedFeedUnreadCount: 12,
        folderUnreadCount: 34,
        filteredArticles,
      }),
    ).toBe(12);
    expect(
      resolveArticleListMarkAllReadCount({
        selection: { type: "folder", folderId: "folder-1" },
        selectedFeedUnreadCount: 12,
        folderUnreadCount: 34,
        filteredArticles,
      }),
    ).toBe(34);
    expect(
      resolveArticleListMarkAllReadCount({
        selection: { type: "all" },
        selectedFeedUnreadCount: 12,
        folderUnreadCount: 34,
        filteredArticles,
      }),
    ).toBe(2);
  });

  it("retains the selected starred smart-view row in all mode", () => {
    const retainedArticleIds = new Set(["art-1"]);
    const result = resolveEffectiveRetainedArticleIds({
      sourcePlan: buildTestSourcePlan({ sourceFilter: "starred", effectiveViewMode: "all" }),
      retainedArticleIds,
      selectedArticleId: "art-2",
    });

    expect([...result]).toEqual(["art-1", "art-2"]);
    expect(result).not.toBe(retainedArticleIds);
  });

  it("reuses retained article ids when selected row retention is unnecessary", () => {
    const retainedArticleIds = new Set(["art-1"]);

    expect(
      resolveEffectiveRetainedArticleIds({
        sourcePlan: buildTestSourcePlan({ sourceFilter: "starred", effectiveViewMode: "unread" }),
        retainedArticleIds,
        selectedArticleId: "art-2",
      }),
    ).toBe(retainedArticleIds);
    expect(
      resolveEffectiveRetainedArticleIds({
        sourcePlan: buildTestSourcePlan({ sourceFilter: "all", effectiveViewMode: "all" }),
        retainedArticleIds,
        selectedArticleId: "art-2",
      }),
    ).toBe(retainedArticleIds);
  });

  it("returns the adjacent article id", () => {
    const result = getAdjacentArticleId(sampleArticles, "art-1", 1);

    expect(Result.unwrap(result)).toBe("art-2");
  });

  it("returns the adjacent id from an ordered id list", () => {
    expect(Result.unwrap(getAdjacentItemId(["a", "b", "c"], "b", 1))).toBe("c");
    expect(Result.unwrap(getAdjacentItemId(["a", "b", "c"], "b", -1))).toBe("a");
    expect(Result.unwrap(getAdjacentItemId(["a", "b", "c"], null, 1))).toBe("a");
    expect(Result.unwrapError(getAdjacentItemId([], null, 1))).toBe("no_items");
  });

  it("returns an error when no articles are available", () => {
    const result = getAdjacentArticleId([], null, 1);

    expect(Result.unwrapError(result)).toBe("no_articles");
  });

  it("positions the previous article below the sticky header when navigating upward", () => {
    const result = calculateArticleNavigationScrollTop({
      currentScrollTop: 240,
      viewportTop: 100,
      viewportHeight: 360,
      itemTop: 220,
      itemHeight: 72,
      direction: -1,
      stickyTopOffset: 32,
      edgePadding: 12,
      maxScrollTop: 800,
    });

    expect(result).toBe(316);
  });

  it("scrolls just enough to reveal the next article when navigating downward", () => {
    const result = calculateArticleNavigationScrollTop({
      currentScrollTop: 240,
      viewportTop: 100,
      viewportHeight: 360,
      itemTop: 430,
      itemHeight: 72,
      direction: 1,
      stickyTopOffset: 32,
      edgePadding: 12,
      maxScrollTop: 800,
    });

    expect(result).toBe(294);
  });

  it("keeps the scroll position when the next article is already comfortably visible", () => {
    const result = calculateArticleNavigationScrollTop({
      currentScrollTop: 240,
      viewportTop: 100,
      viewportHeight: 360,
      itemTop: 260,
      itemHeight: 72,
      direction: 1,
      stickyTopOffset: 32,
      edgePadding: 12,
      maxScrollTop: 800,
    });

    expect(result).toBeNull();
  });

  it("clamps upward navigation scroll at the top of the list", () => {
    const result = calculateArticleNavigationScrollTop({
      currentScrollTop: 30,
      viewportTop: 100,
      viewportHeight: 360,
      itemTop: 110,
      itemHeight: 72,
      direction: -1,
      stickyTopOffset: 32,
      edgePadding: 12,
      maxScrollTop: 800,
    });

    expect(result).toBe(0);
  });

  it("keeps retained articles visible in unread view even after they become read", () => {
    const readArticle: ArticleDto = {
      ...sampleArticles[0],
      id: "recently-read",
      is_read: true,
      published_at: "2026-03-25T12:00:00Z",
    };
    const unreadArticle: ArticleDto = {
      ...sampleArticles[0],
      id: "still-unread",
      is_read: false,
      published_at: "2026-03-25T11:00:00Z",
    };
    const oldReadArticle: ArticleDto = {
      ...sampleArticles[1],
      id: "old-read",
      is_read: true,
      published_at: "2026-03-24T08:00:00Z",
    };

    const retainedArticleIds = new Set(["recently-read"]);

    const result = selectVisibleArticles({
      articles: [],
      accountArticles: [readArticle, unreadArticle, oldReadArticle],
      tagArticles: [],
      searchResults: [],
      feedId: null,
      tagId: null,
      viewMode: "unread",
      sourceFilter: null,
      showSearch: false,
      searchQuery: "",
      sortUnread: "newest_first",
      retainedArticleIds,
    });

    expect(result.map((a) => a.id)).toEqual(["recently-read", "still-unread"]);
  });

  it("excludes read articles from unread view when retainedArticleIds is not provided", () => {
    const readArticle: ArticleDto = {
      ...sampleArticles[0],
      id: "read-article",
      is_read: true,
      published_at: "2026-03-25T12:00:00Z",
    };
    const unreadArticle: ArticleDto = {
      ...sampleArticles[0],
      id: "unread-article",
      is_read: false,
      published_at: "2026-03-25T11:00:00Z",
    };

    const result = selectVisibleArticles({
      articles: [],
      accountArticles: [readArticle, unreadArticle],
      tagArticles: [],
      searchResults: [],
      feedId: null,
      tagId: null,
      viewMode: "unread",
      sourceFilter: null,
      showSearch: false,
      searchQuery: "",
      sortUnread: "newest_first",
    });

    expect(result.map((a) => a.id)).toEqual(["unread-article"]);
  });

  it("keeps retained articles visible in starred view even after they are unstarred", () => {
    const unstarredArticle: ArticleDto = {
      ...sampleArticles[1],
      id: "just-unstarred",
      is_starred: false,
      published_at: "2026-03-25T12:00:00Z",
    };
    const starredArticle: ArticleDto = {
      ...sampleArticles[1],
      id: "still-starred",
      is_starred: true,
      published_at: "2026-03-25T11:00:00Z",
    };

    const result = selectVisibleArticles({
      articles: [],
      accountArticles: [unstarredArticle, starredArticle],
      tagArticles: [],
      searchResults: [],
      feedId: null,
      tagId: null,
      viewMode: "starred",
      sourceFilter: null,
      showSearch: false,
      searchQuery: "",
      sortUnread: "newest_first",
      retainedArticleIds: new Set(["just-unstarred"]),
    });

    expect(result.map((a) => a.id)).toEqual(["just-unstarred", "still-starred"]);
  });

  it("excludes unstarred articles from starred view when retainedArticleIds is not provided", () => {
    const unstarredArticle: ArticleDto = {
      ...sampleArticles[1],
      id: "not-starred",
      is_starred: false,
      published_at: "2026-03-25T12:00:00Z",
    };
    const starredArticle: ArticleDto = {
      ...sampleArticles[1],
      id: "still-starred",
      is_starred: true,
      published_at: "2026-03-25T11:00:00Z",
    };

    const result = selectVisibleArticles({
      articles: [],
      accountArticles: [unstarredArticle, starredArticle],
      tagArticles: [],
      searchResults: [],
      feedId: null,
      tagId: null,
      viewMode: "starred",
      sourceFilter: null,
      showSearch: false,
      searchQuery: "",
      sortUnread: "newest_first",
    });

    expect(result.map((a) => a.id)).toEqual(["still-starred"]);
  });
});
