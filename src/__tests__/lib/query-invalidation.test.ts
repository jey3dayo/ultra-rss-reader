import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { describe, expect, it, vi } from "vitest";
import {
  ARTICLE_CACHE_QUERY_ROOTS,
  getReaderArticleQueryMode,
  invalidateArticleQueries,
  invalidateFeedQueries,
  invalidateSyncCompletedQueries,
  normalizeQueryAccountId,
  queryKeys,
  resolveArticleInvalidationQueryKeys,
  resolveFeedInvalidationQueryKeys,
} from "@/lib/query/query-invalidation";

function createInvalidateSpy() {
  const queryClient = createTestQueryClient();
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);

  return { invalidateQueries, queryClient };
}

describe("query-invalidation", () => {
  it("keeps typed query key helpers aligned with existing tuple shapes", () => {
    expect(queryKeys.accounts.root).toEqual(["accounts"]);
    expect(queryKeys.feeds.byAccount("acc-1")).toEqual(["feeds", "acc-1"]);
    expect(queryKeys.articles.byFeed("feed-1", "unread")).toEqual(["articles", "feed-1", { mode: "unread" }]);
    expect(queryKeys.accountArticles.byAccount("acc-1", "all")).toEqual(["accountArticles", "acc-1", { mode: "all" }]);
    expect(queryKeys.accountArticles.byAccountPrefix("acc-1")).toEqual(["accountArticles", "acc-1"]);
    expect(queryKeys.feedArticleSummaries.root).toEqual(["feedArticleSummaries"]);
    expect(queryKeys.feedArticleSummaries.byAccount("acc-1")).toEqual(["feedArticleSummaries", "acc-1"]);
    expect(queryKeys.feedArticleSummaries.subscriptionsIndex(" acc-1 ")).toEqual(["feedArticleSummaries", "acc-1"]);
    expect(queryKeys.feedArticleSummaries.subscriptionsIndex(" ")).toEqual(["feedArticleSummaries", null]);
    expect(queryKeys.folderArticles.byFolder("folder-1", "starred")).toEqual([
      "folderArticles",
      "folder-1",
      { mode: "starred" },
    ]);
    expect(queryKeys.recentArticles.byAccount("acc-1", "all")).toEqual(["recentArticles", "acc-1", { mode: "all" }]);
    expect(queryKeys.accountUnreadCount.byAccount("acc-1")).toEqual(["accountUnreadCount", "acc-1"]);
    expect(queryKeys.accountUnreadCount.byAccount(null)).toEqual(["accountUnreadCount", null]);
    expect(queryKeys.articlesByTag.byTagAndAccount("tag-1", "acc-1", "all")).toEqual([
      "articlesByTag",
      "tag-1",
      "acc-1",
      { mode: "all" },
    ]);
    expect(queryKeys.tagArticleCounts.byAccount("acc-1")).toEqual(["tagArticleCounts", "acc-1"]);
    expect(queryKeys.tagArticleCounts.byAccount(null)).toEqual(["tagArticleCounts", null]);
    expect(queryKeys.search.byAccountAndQuery("acc-1", "fresh")).toEqual(["search", "acc-1", "fresh"]);
  });

  it("normalizes account ids used in query keys", () => {
    expect(normalizeQueryAccountId(" acc-1\n")).toBe("acc-1");
    expect(normalizeQueryAccountId(" \t\n")).toBeNull();
    expect(normalizeQueryAccountId(null)).toBeNull();
    expect(normalizeQueryAccountId(undefined)).toBeNull();
  });

  it("keeps article cache patch roots aligned with invalidation roots", () => {
    expect(ARTICLE_CACHE_QUERY_ROOTS).toEqual([
      queryKeys.articles.root,
      queryKeys.accountArticles.root,
      queryKeys.articlesByTag.root,
      queryKeys.search.root,
      queryKeys.starredArticles.root,
      queryKeys.recentArticles.root,
    ]);
  });

  it("reads reader article query modes from typed query key shapes", () => {
    expect(getReaderArticleQueryMode(queryKeys.articles.byFeed("feed-1", "unread"))).toBe("unread");
    expect(getReaderArticleQueryMode(queryKeys.accountArticles.byAccount("acc-1", "starred"))).toBe("starred");
    expect(getReaderArticleQueryMode(queryKeys.folderArticles.byFolder("folder-1", "all"))).toBe("all");
    expect(getReaderArticleQueryMode(queryKeys.recentArticles.byAccount("acc-1", "all"))).toBe("all");
    expect(getReaderArticleQueryMode(queryKeys.accountArticles.byAccountPrefix("acc-1"))).toBeNull();
    expect(getReaderArticleQueryMode(queryKeys.search.byAccountAndQuery("acc-1", "fresh"))).toBeNull();
  });

  it("keeps feed invalidation target keys explicit", () => {
    expect(resolveFeedInvalidationQueryKeys()).toEqual([["feeds"], ["folders"]]);
    expect(
      resolveFeedInvalidationQueryKeys({
        includeFeeds: false,
        includeFolders: false,
        includeAccountUnreadCount: true,
      }),
    ).toEqual([["accountUnreadCount"]]);
  });

  it("keeps article invalidation target keys explicit", () => {
    expect(resolveArticleInvalidationQueryKeys()).toEqual([
      ["articles"],
      ["accountArticles"],
      ["folderArticles"],
      ["starredArticles"],
      ["accountUnreadCount"],
      ["accountStarredCount"],
      ["feeds"],
      ["articlesByTag"],
      ["search"],
      ["recentArticles"],
    ]);
    expect(
      resolveArticleInvalidationQueryKeys({
        includeArticles: false,
        includeAccountArticles: false,
        includeStarredArticles: false,
        includeAccountUnreadCount: false,
        includeAccountStarredCount: false,
        includeFeeds: false,
        includeArticlesByTag: false,
        includeTagArticleCounts: true,
        includeSearch: false,
        includeFeedIntegrityReport: true,
        includeRecentArticles: false,
      }),
    ).toEqual([["tagArticleCounts"], ["feedIntegrityReport"]]);
  });

  it("invalidates feed query keys with opt-in account unread count", () => {
    const { invalidateQueries, queryClient } = createInvalidateSpy();

    invalidateFeedQueries(queryClient, {
      includeFeeds: false,
      includeAccountUnreadCount: true,
    });

    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ["feeds"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["folders"] });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["accountUnreadCount"],
    });
  });

  it("invalidates article query keys by default", () => {
    const { invalidateQueries, queryClient } = createInvalidateSpy();

    invalidateArticleQueries(queryClient);

    expect(invalidateQueries.mock.calls.map(([options]) => options)).toEqual([
      { queryKey: ["articles"] },
      { queryKey: ["accountArticles"] },
      { queryKey: ["folderArticles"] },
      { queryKey: ["starredArticles"] },
      { queryKey: ["accountUnreadCount"] },
      { queryKey: ["accountStarredCount"] },
      { queryKey: ["feeds"] },
      { queryKey: ["articlesByTag"] },
      { queryKey: ["search"] },
      { queryKey: ["recentArticles"] },
    ]);
  });

  it("supports selective article query invalidation", () => {
    const { invalidateQueries, queryClient } = createInvalidateSpy();

    invalidateArticleQueries(queryClient, {
      includeAccountArticles: false,
      includeStarredArticles: false,
      includeAccountUnreadCount: false,
      includeAccountStarredCount: false,
      includeFeeds: false,
      includeArticlesByTag: false,
      includeTagArticleCounts: true,
      includeSearch: false,
      includeFeedIntegrityReport: true,
      includeRecentArticles: false,
    });

    expect(invalidateQueries.mock.calls.map(([options]) => options)).toEqual([
      { queryKey: ["articles"] },
      { queryKey: ["tagArticleCounts"] },
      { queryKey: ["feedIntegrityReport"] },
    ]);
  });

  it("warns on invalidation rejection while continuing later query keys", async () => {
    const { invalidateQueries, queryClient } = createInvalidateSpy();
    const rejection = new Error("invalidate failed");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    invalidateQueries.mockRejectedValueOnce(rejection);

    invalidateFeedQueries(queryClient, {
      includeAccountUnreadCount: true,
    });

    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith("Query invalidation failed:", {
        queryKey: ["feeds"],
        error: rejection,
      });
    });
    expect(invalidateQueries.mock.calls.map(([options]) => options)).toEqual([
      { queryKey: ["feeds"] },
      { queryKey: ["folders"] },
      { queryKey: ["accountUnreadCount"] },
    ]);

    warnSpy.mockRestore();
  });

  it("invalidates scoped feed, article, and account status query keys after sync completion", () => {
    const { invalidateQueries, queryClient } = createInvalidateSpy();

    invalidateSyncCompletedQueries(queryClient);

    expect(invalidateQueries).not.toHaveBeenCalledWith();
    expect(invalidateQueries.mock.calls.map(([options]) => options)).toEqual([
      { queryKey: ["feeds"] },
      { queryKey: ["folders"] },
      { queryKey: ["accountUnreadCount"] },
      { queryKey: ["articles"] },
      { queryKey: ["accountArticles"] },
      { queryKey: ["folderArticles"] },
      { queryKey: ["starredArticles"] },
      { queryKey: ["accountStarredCount"] },
      { queryKey: ["articlesByTag"] },
      { queryKey: ["tagArticleCounts"] },
      { queryKey: ["search"] },
      { queryKey: ["feedIntegrityReport"] },
      { queryKey: ["recentArticles"] },
    ]);
  });
});
