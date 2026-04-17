import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";
import type { ArticleDto } from "@/api/tauri-commands";
import {
  calculateArticleNavigationScrollTop,
  countUnreadArticles,
  getAdjacentArticleId,
  getAdjacentItemId,
  getUnreadArticleIds,
  groupArticles,
  selectVisibleArticles,
} from "@/lib/article-list";
import { sampleArticles, sampleFeeds } from "../../../tests/helpers/tauri-mocks";

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
      showSearch: false,
      searchQuery: "",
      sortUnread: "newest_first",
      retainedArticleIds: new Set(),
    });

    expect(result.map((article) => article.id)).toEqual(["art-folder"]);
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
      smartViewKind: "unread",
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
      smartViewKind: "starred",
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
      smartViewKind: "starred",
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
      smartViewKind: "starred",
    });

    expect(result.map((article) => article.id)).toEqual(["starred-unread"]);
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

  it("returns unread ids and unread count from the currently visible list", () => {
    expect(getUnreadArticleIds(sampleArticles)).toEqual(["art-1"]);
    expect(countUnreadArticles(sampleArticles)).toBe(1);
  });

  it("returns the adjacent article id", () => {
    const result = getAdjacentArticleId(sampleArticles, "art-1", 1);

    expect(Result.unwrap(result)).toBe("art-2");
  });

  it("returns the adjacent id from an ordered id list", () => {
    expect(getAdjacentItemId(["a", "b", "c"], "b", 1)).toBe("c");
    expect(getAdjacentItemId(["a", "b", "c"], "b", -1)).toBe("a");
    expect(getAdjacentItemId(["a", "b", "c"], null, 1)).toBe("a");
    expect(getAdjacentItemId([], null, 1)).toBeNull();
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
      showSearch: false,
      searchQuery: "",
      sortUnread: "newest_first",
    });

    expect(result.map((a) => a.id)).toEqual(["still-starred"]);
  });
});
