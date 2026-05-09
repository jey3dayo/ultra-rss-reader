import { hashKey } from "@tanstack/react-query";
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
  setQueryInvalidationFailureReporterForDiagnostics,
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

  it("keeps reader article query key object segments stable for hashing and root matching", () => {
    const queryClient = createTestQueryClient();
    const articleKey = queryKeys.articles.byFeed("feed-1", "unread");
    const accountKey = queryKeys.accountArticles.byAccount("acc-1", "all");
    const tagKey = queryKeys.articlesByTag.byTagAndAccount("tag-1", "acc-1", "starred");

    queryClient.setQueryData(articleKey, ["feed article"]);
    queryClient.setQueryData(accountKey, ["account article"]);
    queryClient.setQueryData(tagKey, ["tag article"]);

    expect(hashKey(articleKey)).toBe(hashKey(["articles", "feed-1", { mode: "unread" }]));
    expect(hashKey(accountKey)).toBe(hashKey(["accountArticles", "acc-1", { mode: "all" }]));
    expect(hashKey(tagKey)).toBe(hashKey(["articlesByTag", "tag-1", "acc-1", { mode: "starred" }]));
    expect(queryClient.getQueryCache().findAll({ queryKey: queryKeys.articles.root })).toHaveLength(1);
    expect(queryClient.getQueryCache().findAll({ queryKey: queryKeys.accountArticles.root })).toHaveLength(1);
    expect(queryClient.getQueryCache().findAll({ queryKey: queryKeys.articlesByTag.root })).toHaveLength(1);
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
      ["feedArticleSummaries"],
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
        includeFeedArticleSummaries: false,
      }),
    ).toEqual([["tagArticleCounts"], ["feedIntegrityReport"]]);
  });

  it("documents mutation owner invalidation query key sets", () => {
    expect(resolveArticleInvalidationQueryKeys({ includeTagArticleCounts: true })).toEqual([
      ["articles"],
      ["accountArticles"],
      ["folderArticles"],
      ["starredArticles"],
      ["accountUnreadCount"],
      ["accountStarredCount"],
      ["feeds"],
      ["articlesByTag"],
      ["tagArticleCounts"],
      ["search"],
      ["recentArticles"],
      ["feedArticleSummaries"],
    ]);
    expect(
      resolveArticleInvalidationQueryKeys({
        includeAccountUnreadCount: false,
        includeFeeds: false,
      }),
    ).toEqual([
      ["articles"],
      ["accountArticles"],
      ["folderArticles"],
      ["starredArticles"],
      ["accountStarredCount"],
      ["articlesByTag"],
      ["search"],
      ["recentArticles"],
      ["feedArticleSummaries"],
    ]);
    expect(resolveFeedInvalidationQueryKeys({ includeFolders: false, includeAccountUnreadCount: true })).toEqual([
      ["feeds"],
      ["accountUnreadCount"],
    ]);
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
      { queryKey: ["feedArticleSummaries"] },
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
      includeFeedArticleSummaries: false,
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

  it("routes log-only invalidation failures through the diagnostics reporter as one aggregation", async () => {
    const { invalidateQueries, queryClient } = createInvalidateSpy();
    const feedRejection = new Error("feed invalidate failed");
    const unreadRejection = new Error("unread invalidate failed");
    const diagnosticsReporter = vi.fn();
    const restoreDiagnosticsReporter = setQueryInvalidationFailureReporterForDiagnostics(diagnosticsReporter);

    invalidateQueries
      .mockRejectedValueOnce(feedRejection)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(unreadRejection);

    invalidateFeedQueries(queryClient, {
      includeAccountUnreadCount: true,
    });

    await vi.waitFor(() => {
      expect(diagnosticsReporter).toHaveBeenCalledWith([
        { queryKey: ["feeds"], error: feedRejection },
        { queryKey: ["accountUnreadCount"], error: unreadRejection },
      ]);
    });
    expect(diagnosticsReporter).toHaveBeenCalledOnce();
    expect(invalidateQueries.mock.calls.map(([options]) => options)).toEqual([
      { queryKey: ["feeds"] },
      { queryKey: ["folders"] },
      { queryKey: ["accountUnreadCount"] },
    ]);

    restoreDiagnosticsReporter();
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
      { queryKey: ["feedArticleSummaries"] },
    ]);
  });
});
