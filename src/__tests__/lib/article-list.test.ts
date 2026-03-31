import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";
import type { ArticleDto } from "@/api/tauri-commands";
import {
  countUnreadArticles,
  getAdjacentArticleId,
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

  it("returns an error when no articles are available", () => {
    const result = getAdjacentArticleId([], null, 1);

    expect(Result.unwrapError(result)).toBe("no_articles");
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
