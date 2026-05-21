import { Result } from "@praha/byethrow";
import { sampleArticles, sampleFeeds } from "@tests/helpers/fixtures";
import {
  requireSampleArticle,
  requireSampleReadArticle,
  requireSampleStarredArticle,
  requireSampleUnreadArticle,
} from "@tests/helpers/reader-fixtures";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArticleDto } from "@/api/tauri-commands";
import {
  areArticleListsEquivalent,
  buildArticleGroupItems,
  buildArticleListFeedNameMap,
  buildArticleListSourcePlanKey,
  buildFolderFeedIdSet,
  calculateArticleNavigationScrollTop,
  collectRetainedArticlesFromSources,
  countStarredArticles,
  countUnreadArticles,
  formatArticleTime,
  getAdjacentArticleId,
  getAdjacentItemId,
  getUnreadArticleIds,
  groupArticles,
  MAX_RETAINED_ARTICLES_SNAPSHOT_SIZE,
  mergeResolvedArticlesWithRetained,
  mergeRetainedArticlesSnapshot,
  resolveArticleGroupLabelToken,
  resolveArticleListMarkAllReadCount,
  resolveEffectiveRetainedArticleIds,
  selectVisibleArticles,
} from "@/lib/articles/article-list";
import { type ReaderFilter, type ReaderSourcePlan, resolveReaderSourcePlan } from "@/lib/reader/reader-query";

afterEach(() => {
  vi.useRealTimers();
});

function buildTestSourcePlan(params: {
  accountId?: string;
  sourceFilter: ReaderFilter;
  effectiveViewMode: ReaderFilter;
}): ReaderSourcePlan {
  const accountId = params.accountId ?? "acc-1";

  if (params.sourceFilter === "starred") {
    return resolveReaderSourcePlan({ type: "smart", kind: "starred" }, params.effectiveViewMode, accountId);
  }

  if (params.sourceFilter !== params.effectiveViewMode) {
    throw new Error(`Unsupported test source plan: ${params.sourceFilter}/${params.effectiveViewMode}`);
  }

  return resolveReaderSourcePlan({ type: "all" }, params.sourceFilter, accountId);
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

  it("parses each article published_at at most once when sorting visible articles", () => {
    const RealDate = Date;
    let constructedDates = 0;
    const CountingDate = class extends RealDate {
      constructor(...args: ConstructorParameters<DateConstructor>) {
        constructedDates += 1;
        super(...args);
      }
    };
    CountingDate.now = RealDate.now;
    CountingDate.parse = RealDate.parse;
    CountingDate.UTC = RealDate.UTC;

    vi.stubGlobal("Date", CountingDate);

    const articles: ArticleDto[] = Array.from({ length: 6 }, (_, index) => ({
      ...sampleArticles[0],
      id: `article-${index}`,
      is_read: false,
      published_at: new RealDate(Date.UTC(2026, 2, 25, 10, index)).toISOString(),
    }));

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

    expect(result.map((article) => article.id)).toEqual([
      "article-5",
      "article-4",
      "article-3",
      "article-2",
      "article-1",
      "article-0",
    ]);
    expect(constructedDates).toBeLessThanOrEqual(articles.length);
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

  it("preserves search result source order instead of applying unread date sort", () => {
    const result = selectVisibleArticles({
      articles: [],
      accountArticles: [],
      tagArticles: [],
      searchResults: [
        {
          ...sampleArticles[0],
          id: "ranked-first-older",
          is_read: false,
          published_at: "2026-03-24T10:00:00Z",
        },
        {
          ...sampleArticles[1],
          id: "ranked-second-newer",
          is_read: false,
          published_at: "2026-03-25T10:00:00Z",
        },
      ],
      feedId: null,
      tagId: null,
      viewMode: "unread",
      sourceFilter: null,
      showSearch: true,
      searchQuery: "Article",
      sortUnread: "newest_first",
      retainedArticleIds: new Set(),
    });

    expect(result.map((article) => article.id)).toEqual(["ranked-first-older", "ranked-second-newer"]);
  });

  it("keeps retained read search results in source order for unread searches", () => {
    const result = selectVisibleArticles({
      articles: [],
      accountArticles: [],
      tagArticles: [],
      searchResults: [
        {
          ...sampleArticles[0],
          id: "retained-read-result",
          is_read: true,
          published_at: "2026-03-24T10:00:00Z",
        },
        {
          ...sampleArticles[1],
          id: "unread-result",
          is_read: false,
          published_at: "2026-03-25T10:00:00Z",
        },
      ],
      feedId: null,
      tagId: null,
      viewMode: "unread",
      sourceFilter: null,
      showSearch: true,
      searchQuery: "Article",
      sortUnread: "newest_first",
      retainedArticleIds: new Set(["retained-read-result"]),
    });

    expect(result.map((article) => article.id)).toEqual(["retained-read-result", "unread-result"]);
  });

  it("keeps the normal article source when search is open with an empty query", () => {
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
      searchQuery: "",
      sortUnread: "newest_first",
    });

    expect(result.map((article) => article.id)).toEqual(["art-1", "art-2"]);
  });

  it("applies unread date sort when search is not active", () => {
    const result = selectVisibleArticles({
      articles: [],
      accountArticles: [
        {
          ...sampleArticles[0],
          id: "older-unread",
          is_read: false,
          published_at: "2026-03-24T10:00:00Z",
        },
        {
          ...sampleArticles[1],
          id: "newer-unread",
          is_read: false,
          published_at: "2026-03-25T10:00:00Z",
        },
      ],
      tagArticles: [],
      searchResults: [],
      feedId: null,
      tagId: null,
      viewMode: "unread",
      sourceFilter: null,
      showSearch: false,
      searchQuery: "",
      sortUnread: "newest_first",
      retainedArticleIds: new Set(),
    });

    expect(result.map((article) => article.id)).toEqual(["newer-unread", "older-unread"]);
  });

  it("filters account articles to the selected folder feed ids before unread filtering", () => {
    const result = selectVisibleArticles({
      articles: [],
      accountArticles: [
        {
          ...sampleArticles[0],
          id: "art-folder",
          feed_id: "feed-1",
          is_read: false,
        },
        {
          ...sampleArticles[1],
          id: "art-other",
          feed_id: "feed-2",
          is_read: false,
        },
        {
          ...sampleArticles[0],
          id: "art-read",
          feed_id: "feed-1",
          is_read: true,
        },
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
        {
          ...sampleArticles[0],
          id: "starred-feed",
          feed_id: "feed-1",
          is_starred: true,
          is_read: true,
        },
        {
          ...sampleArticles[1],
          id: "starred-other",
          feed_id: "feed-2",
          is_starred: true,
          is_read: true,
        },
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

  it("filters search results to the selected feed source", () => {
    const result = selectVisibleArticles({
      articles: [],
      accountArticles: [],
      tagArticles: [],
      searchResults: [
        { ...sampleArticles[0], id: "art-feed", feed_id: "feed-1" },
        { ...sampleArticles[1], id: "art-other", feed_id: "feed-2" },
      ],
      feedId: "feed-1",
      tagId: null,
      viewMode: "all",
      sourceFilter: null,
      showSearch: true,
      searchQuery: "Article",
      sortUnread: "newest_first",
      retainedArticleIds: new Set(),
    });

    expect(result.map((article) => article.id)).toEqual(["art-feed"]);
  });

  it("filters search results to the selected tag source", () => {
    const taggedArticle = {
      ...sampleArticles[0],
      id: "tagged-match",
      feed_id: "feed-1",
    };
    const untaggedArticle = {
      ...sampleArticles[1],
      id: "untagged-match",
      feed_id: "feed-1",
    };

    const result = selectVisibleArticles({
      articles: [],
      accountArticles: [],
      tagArticles: [taggedArticle],
      searchResults: [taggedArticle, untaggedArticle],
      feedId: null,
      tagId: "tag-1",
      viewMode: "all",
      sourceFilter: null,
      showSearch: true,
      searchQuery: "Article",
      sortUnread: "newest_first",
      retainedArticleIds: new Set(),
    });

    expect(result.map((article) => article.id)).toEqual(["tagged-match"]);
  });

  it("keeps smart unread searches limited to unread articles", () => {
    const result = selectVisibleArticles({
      articles: [],
      accountArticles: [],
      tagArticles: [],
      searchResults: [
        {
          ...sampleArticles[0],
          id: "search-unread",
          is_read: false,
          is_starred: false,
        },
        {
          ...sampleArticles[1],
          id: "search-read",
          is_read: true,
          is_starred: true,
        },
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
        {
          ...sampleArticles[0],
          id: "starred-unread",
          is_read: false,
          is_starred: true,
        },
        {
          ...sampleArticles[1],
          id: "starred-read",
          is_read: true,
          is_starred: true,
        },
        {
          ...sampleArticles[0],
          id: "plain-unread",
          is_read: false,
          is_starred: false,
        },
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
        {
          ...sampleArticles[0],
          id: "starred-read",
          is_starred: true,
          is_read: true,
        },
        {
          ...sampleArticles[1],
          id: "starred-unread",
          is_starred: true,
          is_read: false,
        },
        {
          ...sampleArticles[2],
          id: "plain-unread",
          is_starred: false,
          is_read: false,
        },
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
        {
          ...sampleArticles[0],
          id: "starred-read",
          is_starred: true,
          is_read: true,
        },
        {
          ...sampleArticles[1],
          id: "starred-unread",
          is_starred: true,
          is_read: false,
        },
        {
          ...sampleArticles[2],
          id: "plain-unread",
          is_starred: false,
          is_read: false,
        },
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

  it("uses tag articles as the source when a tag is selected even if feed and account sources are present", () => {
    const result = selectVisibleArticles({
      articles: [{ ...sampleArticles[0], id: "feed-source", feed_id: "feed-1" }],
      accountArticles: [{ ...sampleArticles[1], id: "account-source", feed_id: "feed-2" }],
      tagArticles: [{ ...sampleArticles[2], id: "tag-source", feed_id: "feed-3" }],
      searchResults: [],
      feedId: "feed-1",
      tagId: "tag-1",
      viewMode: "all",
      sourceFilter: null,
      showSearch: false,
      searchQuery: "",
      sortUnread: "newest_first",
    });

    expect(result.map((article) => article.id)).toEqual(["tag-source"]);
  });

  it("does not fall back to feed or account articles while selected tag articles are unresolved", () => {
    const result = selectVisibleArticles({
      articles: [{ ...sampleArticles[0], id: "feed-source", feed_id: "feed-1" }],
      accountArticles: [{ ...sampleArticles[1], id: "account-source", feed_id: "feed-2" }],
      tagArticles: undefined,
      searchResults: [],
      feedId: "feed-1",
      tagId: "tag-1",
      viewMode: "all",
      sourceFilter: null,
      showSearch: false,
      searchQuery: "",
      sortUnread: "newest_first",
    });

    expect(result).toEqual([]);
  });

  it("returns no visible folder articles when the selected folder has no feeds", () => {
    const result = selectVisibleArticles({
      articles: [],
      accountArticles: [
        { ...sampleArticles[0], id: "account-feed-1", feed_id: "feed-1" },
        { ...sampleArticles[1], id: "account-feed-2", feed_id: "feed-2" },
      ],
      tagArticles: [],
      searchResults: [],
      feedId: null,
      tagId: null,
      folderFeedIds: new Set(),
      viewMode: "all",
      sourceFilter: null,
      showSearch: false,
      searchQuery: "",
      sortUnread: "newest_first",
    });

    expect(result).toEqual([]);
  });

  it("applies the active footer filter to tag articles", () => {
    const tagArticles = [
      {
        ...sampleArticles[0],
        id: "tag-unread",
        is_read: false,
        is_starred: false,
      },
      {
        ...sampleArticles[1],
        id: "tag-starred",
        is_read: true,
        is_starred: true,
      },
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
        {
          ...sampleArticles[0],
          id: "viewed-first",
          published_at: "2026-04-20T00:00:00Z",
        },
        {
          ...sampleArticles[1],
          id: "viewed-second",
          published_at: "2026-04-22T00:00:00Z",
        },
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

    expect(Object.keys(result)).toEqual(["Tech Blog", "News", "Fresh Inbox"]);
  });

  it("groups articles with missing feed titles under the unknown-feed sentinel", () => {
    const result = groupArticles({
      articles: [{ ...sampleArticles[0], feed_id: "missing-feed" }],
      groupBy: "feed",
      feedNameMap: new Map(),
    });

    expect(Object.keys(result)).toEqual(["__unknown_feed__"]);
    expect(result.__unknown_feed__?.map((article) => article.id)).toEqual(["art-1"]);
  });

  it("groups older articles by long local date label", () => {
    const result = groupArticles({
      articles: [{ ...sampleArticles[0], published_at: "2026-03-01T10:00:00Z" }],
      groupBy: "date",
      feedNameMap: new Map(),
    });

    expect(Object.keys(result)[0]).toContain("2026");
  });

  it("groups invalid article dates under their original fallback label", () => {
    const result = groupArticles({
      articles: [{ ...sampleArticles[0], id: "invalid-date", published_at: "not-a-date" }],
      groupBy: "date",
      feedNameMap: new Map(),
    });

    expect(Object.keys(result)).toEqual(["not-a-date"]);
    expect(result["not-a-date"]?.map((article) => article.id)).toEqual(["invalid-date"]);
  });

  it("groups blank article dates under the raw fallback label", () => {
    const result = groupArticles({
      articles: [{ ...sampleArticles[0], id: "blank-date", published_at: "" }],
      groupBy: "date",
      feedNameMap: new Map(),
    });

    expect(Object.keys(result)).toEqual([""]);
    expect(result[""]?.map((article) => article.id)).toEqual(["blank-date"]);
  });

  it("treats future article dates as today-or-newer group labels", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 10, 12, 0, 0));

    const result = groupArticles({
      articles: [{ ...sampleArticles[0], id: "future-date", published_at: "2026-05-11T00:00:00Z" }],
      groupBy: "date",
      feedNameMap: new Map(),
    });

    expect(Object.keys(result)).toEqual(["TODAY"]);
    expect(result.TODAY?.map((article) => article.id)).toEqual(["future-date"]);
  });

  it("groups UTC timestamp inputs by local day boundaries", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 10, 1, 0, 0));

    const result = groupArticles({
      articles: [
        {
          ...sampleArticles[0],
          id: "local-today",
          published_at: new Date(2026, 4, 10, 0, 30, 0).toISOString(),
        },
        {
          ...sampleArticles[1],
          id: "local-yesterday",
          published_at: new Date(2026, 4, 9, 23, 30, 0).toISOString(),
        },
      ],
      groupBy: "date",
      feedNameMap: new Map(),
    });

    expect(Object.keys(result)).toEqual(["TODAY", "YESTERDAY"]);
    expect(result.TODAY?.map((article) => article.id)).toEqual(["local-today"]);
    expect(result.YESTERDAY?.map((article) => article.id)).toEqual(["local-yesterday"]);
  });

  it("formats invalid and blank article times with raw fallback labels", () => {
    expect(formatArticleTime("not-a-date")).toBe("not-a-date");
    expect(formatArticleTime("")).toBe("");
  });

  it("sorts same timestamps and invalid dates deterministically", () => {
    const result = selectVisibleArticles({
      articles: [],
      accountArticles: [
        {
          ...sampleArticles[0],
          id: "same-b",
          published_at: "2026-03-25T10:00:00Z",
        },
        {
          ...sampleArticles[1],
          id: "invalid-a",
          published_at: "not-a-date",
        },
        {
          ...sampleArticles[2],
          id: "same-a",
          published_at: "2026-03-25T10:00:00Z",
        },
      ],
      tagArticles: [],
      searchResults: [],
      feedId: null,
      tagId: null,
      viewMode: "all",
      sourceFilter: null,
      showSearch: false,
      searchQuery: "",
      sortUnread: "newest_first",
      retainedArticleIds: new Set(),
    });

    expect(result.map((article) => article.id)).toEqual(["same-a", "same-b", "invalid-a"]);
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

  it("uses the later retained source identity when sources contain duplicate article ids", () => {
    const staleRetainedArticle = {
      ...sampleArticles[0],
      id: "retained-duplicate",
      title: "Stale retained row",
      is_read: true,
      is_starred: false,
    };
    const currentRetainedArticle = {
      ...staleRetainedArticle,
      title: "Current retained row",
      is_read: false,
      is_starred: true,
    };

    const retained = collectRetainedArticlesFromSources({
      retainedArticleIds: new Set(["retained-duplicate"]),
      sources: [[staleRetainedArticle], [currentRetainedArticle]],
    });

    expect(retained).toEqual([currentRetainedArticle]);
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

  it("replaces stale retained snapshot row identity with current source rows for the same context", () => {
    const staleRetainedArticle = {
      ...sampleArticles[0],
      id: "retained-duplicate",
      title: "Stale retained row",
      is_read: true,
      is_starred: false,
    };
    const currentRetainedArticle = {
      ...staleRetainedArticle,
      title: "Current retained row",
      is_read: false,
      is_starred: true,
    };

    const next = mergeRetainedArticlesSnapshot({
      previous: {
        contextKey: "feed:feed-1:unread",
        articles: [staleRetainedArticle],
      },
      contextKey: "feed:feed-1:unread",
      retainedArticleIds: new Set(["retained-duplicate"]),
      currentRetainedArticles: [currentRetainedArticle],
    });

    expect(next?.articles).toEqual([currentRetainedArticle]);
  });

  it("refreshes retained snapshot title, read, and star fields from the latest source row", () => {
    const staleRetainedArticle = {
      ...sampleArticles[0],
      id: "retained-freshness",
      title: "Stale title",
      is_read: false,
      is_starred: false,
    };
    const currentRetainedArticle = {
      ...staleRetainedArticle,
      title: "Fresh title",
      is_read: true,
      is_starred: true,
    };

    const next = mergeRetainedArticlesSnapshot({
      previous: {
        contextKey: "account:acc-1:articles:unread",
        articles: [staleRetainedArticle],
      },
      contextKey: "account:acc-1:articles:unread",
      retainedArticleIds: new Set(["retained-freshness"]),
      currentRetainedArticles: [currentRetainedArticle],
    });

    expect(next?.articles).toEqual([currentRetainedArticle]);
  });

  it("drops stale retained snapshot rows when the article list context changes", () => {
    const currentRetainedArticle = {
      ...sampleArticles[1],
      id: "retained-current-context",
      title: "Current context retained row",
    };

    const next = mergeRetainedArticlesSnapshot({
      previous: {
        contextKey: "feed:feed-1:unread",
        articles: [{ ...sampleArticles[0], id: "retained-previous-context" }],
      },
      contextKey: "tag:tag-1:unread",
      retainedArticleIds: new Set(["retained-previous-context", "retained-current-context"]),
      currentRetainedArticles: [currentRetainedArticle],
    });

    expect(next?.contextKey).toBe("tag:tag-1:unread");
    expect(next?.articles).toEqual([currentRetainedArticle]);
  });

  it("prepends retained articles missing from the current primary source", () => {
    const result = mergeResolvedArticlesWithRetained({
      resolvedPrimarySourceArticles: [sampleArticles[1]],
      retainedArticlesSnapshot: {
        contextKey: "feed:feed-1",
        articles: [sampleArticles[0], sampleArticles[1]],
      },
      retainedArticleIds: new Set(["art-1", "art-2"]),
      contextKey: "feed:feed-1",
    });

    expect(result?.map((article) => article.id)).toEqual(["art-1", "art-2"]);
  });

  it("compares article lists by stable row fields", () => {
    expect(areArticleListsEquivalent([sampleArticles[0]], [sampleArticles[0], sampleArticles[1]])).toBe(false);
    expect(areArticleListsEquivalent([sampleArticles[0], sampleArticles[1]], [sampleArticles[0]])).toBe(false);
    expect(areArticleListsEquivalent([sampleArticles[0]], [{ ...sampleArticles[0], summary: "changed" }])).toBe(true);
    expect(areArticleListsEquivalent([sampleArticles[0]], [{ ...sampleArticles[0], title: "changed" }])).toBe(false);
    expect(
      areArticleListsEquivalent([sampleArticles[0], sampleArticles[1]], [sampleArticles[1], sampleArticles[0]]),
    ).toBe(false);
  });

  it("returns false for article lists with different lengths before comparing row fields", () => {
    const articleWithThrowingId: ArticleDto = { ...sampleArticles[0] };
    Object.defineProperty(articleWithThrowingId, "id", {
      get: () => {
        throw new Error("row fields should not be read for length mismatches");
      },
    });

    expect(areArticleListsEquivalent([articleWithThrowingId], [])).toBe(false);
  });

  it("returns unread ids and unread count from the currently visible list", () => {
    expect(getUnreadArticleIds(sampleArticles)).toEqual([requireSampleUnreadArticle().id]);
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

  it("uses selected source unread totals for feed and folder mark-all-read even when visible rows are empty", () => {
    expect(
      resolveArticleListMarkAllReadCount({
        selection: { type: "feed", feedId: "feed-1" },
        selectedFeedUnreadCount: 7,
        folderUnreadCount: 13,
        filteredArticles: [],
      }),
    ).toBe(7);
    expect(
      resolveArticleListMarkAllReadCount({
        selection: { type: "folder", folderId: "folder-1" },
        selectedFeedUnreadCount: 7,
        folderUnreadCount: 13,
        filteredArticles: [],
      }),
    ).toBe(13);
  });

  it("retains the selected starred smart-view row in all mode", () => {
    const retainedArticleIds = new Set([requireSampleUnreadArticle().id]);
    const selectedArticle = requireSampleStarredArticle();
    const result = resolveEffectiveRetainedArticleIds({
      sourcePlan: buildTestSourcePlan({
        sourceFilter: "starred",
        effectiveViewMode: "all",
      }),
      retainedArticleIds,
      selectedArticleId: selectedArticle.id,
    });

    expect([...result]).toEqual([requireSampleUnreadArticle().id, selectedArticle.id]);
    expect(result).not.toBe(retainedArticleIds);
  });

  it("caps retained article ids when adding the selected starred smart-view row", () => {
    const retainedArticleIds = new Set(
      Array.from({ length: MAX_RETAINED_ARTICLES_SNAPSHOT_SIZE }, (_, index) => `retained-${index}`),
    );
    const selectedArticleId = "selected-starred";

    const result = resolveEffectiveRetainedArticleIds({
      sourcePlan: buildTestSourcePlan({
        sourceFilter: "starred",
        effectiveViewMode: "all",
      }),
      retainedArticleIds,
      selectedArticleId,
    });

    expect(result).toHaveLength(MAX_RETAINED_ARTICLES_SNAPSHOT_SIZE);
    expect([...result]).toEqual([...retainedArticleIds].slice(1).concat(selectedArticleId));
  });

  it("builds a stable article list source plan key from semantic fields", () => {
    const firstPlan = buildTestSourcePlan({
      sourceFilter: "starred",
      effectiveViewMode: "all",
    });
    const equivalentPlan = buildTestSourcePlan({
      sourceFilter: "starred",
      effectiveViewMode: "all",
    });
    const changedPlan = buildTestSourcePlan({
      sourceFilter: "unread",
      effectiveViewMode: "unread",
    });

    expect(buildArticleListSourcePlanKey(firstPlan)).toBe(buildArticleListSourcePlanKey(equivalentPlan));
    expect(buildArticleListSourcePlanKey(firstPlan)).not.toBe(buildArticleListSourcePlanKey(changedPlan));
  });

  it("scopes article list source plan keys by account switch context", () => {
    const firstAccountPlan = buildTestSourcePlan({
      accountId: "acc-1",
      sourceFilter: "unread",
      effectiveViewMode: "unread",
    });
    const secondAccountPlan = buildTestSourcePlan({
      accountId: "acc-2",
      sourceFilter: "unread",
      effectiveViewMode: "unread",
    });

    expect(buildArticleListSourcePlanKey(firstAccountPlan)).not.toBe(buildArticleListSourcePlanKey(secondAccountPlan));
  });

  it("reuses retained article ids when selected row retention is unnecessary", () => {
    const retainedArticleIds = new Set([requireSampleUnreadArticle().id]);
    const selectedArticle = requireSampleReadArticle();

    expect(
      resolveEffectiveRetainedArticleIds({
        sourcePlan: buildTestSourcePlan({
          sourceFilter: "starred",
          effectiveViewMode: "unread",
        }),
        retainedArticleIds,
        selectedArticleId: selectedArticle.id,
      }),
    ).toBe(retainedArticleIds);
    expect(
      resolveEffectiveRetainedArticleIds({
        sourcePlan: buildTestSourcePlan({
          sourceFilter: "all",
          effectiveViewMode: "all",
        }),
        retainedArticleIds,
        selectedArticleId: selectedArticle.id,
      }),
    ).toBe(retainedArticleIds);
  });

  it("drops retained article snapshots when the source context changes", () => {
    const previous = {
      contextKey: "account:acc-1:articles:unread",
      articles: [{ ...requireSampleUnreadArticle(), id: "retained-1" }],
    };

    const result = mergeRetainedArticlesSnapshot({
      previous,
      contextKey: "account:acc-2:articles:unread",
      retainedArticleIds: new Set(["retained-1"]),
      currentRetainedArticles: [],
    });

    expect(result).toBeNull();
  });

  it("caps retained article snapshots to the newest retained ids", () => {
    const retainedArticles = Array.from({ length: MAX_RETAINED_ARTICLES_SNAPSHOT_SIZE + 2 }, (_, index) => ({
      ...requireSampleUnreadArticle(),
      id: `retained-${index}`,
    }));
    const retainedArticleIds = new Set(retainedArticles.map((article) => article.id));

    const result = mergeRetainedArticlesSnapshot({
      previous: null,
      contextKey: "account:acc-1:articles:unread",
      retainedArticleIds,
      currentRetainedArticles: retainedArticles,
    });

    expect(result?.articles).toHaveLength(MAX_RETAINED_ARTICLES_SNAPSHOT_SIZE);
    expect(result?.articles.map((article) => article.id)).toEqual(
      retainedArticles.slice(2).map((article) => article.id),
    );
  });

  it("returns the adjacent article id", () => {
    const result = getAdjacentArticleId(sampleArticles, requireSampleArticle("art-1").id, 1);

    expect(Result.unwrap(result)).toBe(requireSampleArticle("art-2").id);
  });

  it("keeps navigation similarity limited to pure adjacent id lookup", () => {
    expect(Result.unwrap(getAdjacentItemId(["a", "b", "c"], "b", 1))).toBe("c");
    expect(Result.unwrap(getAdjacentItemId(["a", "b", "c"], "b", -1))).toBe("a");
    expect(Result.unwrap(getAdjacentItemId(["a", "b", "c"], null, 1))).toBe("a");
    expect(Result.unwrapError(getAdjacentItemId([], null, 1))).toBe("no_items");
  });

  it("clamps adjacent navigation at list edges", () => {
    expect(Result.unwrap(getAdjacentItemId(["a", "b", "c"], "a", -1))).toBe("a");
    expect(Result.unwrap(getAdjacentItemId(["a", "b", "c"], "c", 1))).toBe("c");
    expect(Result.unwrap(getAdjacentItemId(["a", "b", "c"], "missing", -1))).toBe("a");
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

  it("clamps downward navigation scroll to the maximum scroll top", () => {
    const result = calculateArticleNavigationScrollTop({
      currentScrollTop: 720,
      viewportTop: 100,
      viewportHeight: 360,
      itemTop: 520,
      itemHeight: 96,
      direction: 1,
      stickyTopOffset: 32,
      edgePadding: 12,
      maxScrollTop: 800,
    });

    expect(result).toBe(800);
  });

  it("uses the visible unread rows for non-feed and non-folder mark-all-read counts", () => {
    const filteredArticles = [
      { ...sampleArticles[0], id: "visible-unread", is_read: false },
      { ...sampleArticles[1], id: "visible-read", is_read: true },
      { ...sampleArticles[2], id: "another-visible-unread", is_read: false },
    ];

    expect(
      resolveArticleListMarkAllReadCount({
        selection: { type: "smart", kind: "recent" },
        selectedFeedUnreadCount: 12,
        folderUnreadCount: 34,
        filteredArticles,
      }),
    ).toBe(2);
    expect(
      resolveArticleListMarkAllReadCount({
        selection: { type: "tag", tagId: "tag-1" },
        selectedFeedUnreadCount: 12,
        folderUnreadCount: 34,
        filteredArticles,
      }),
    ).toBe(2);
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
