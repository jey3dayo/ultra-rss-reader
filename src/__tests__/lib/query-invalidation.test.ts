import { hashKey } from "@tanstack/react-query";
import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { resetDiagnosticsReporterModuleGlobalsForTests } from "@tests/helpers/diagnostics-reporters";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ARTICLE_CACHE_QUERY_ROOTS,
  getReaderArticleQueryMode,
  invalidateAddFeedQueries,
  invalidateArticleMutationQueries,
  invalidateArticleQueries,
  invalidateDeleteFeedQueries,
  invalidateFeedQueries,
  invalidateSyncCompletedQueries,
  normalizeQueryAccountId,
  queryKeys,
  resetQueryInvalidationFailureReporterForTests,
  resolveAddFeedInvalidationQueryKeys,
  resolveArticleInvalidationQueryKeys,
  resolveArticleMutationInvalidationQueryKeys,
  resolveDeleteFeedInvalidationQueryKeys,
  resolveFeedInvalidationQueryKeys,
  setQueryInvalidationFailureReporterForDiagnostics,
} from "@/lib/query/query-invalidation";

function createInvalidateSpy() {
  const queryClient = createTestQueryClient();
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);

  return { invalidateQueries, queryClient };
}

describe("query-invalidation", () => {
  beforeEach(() => {
    resetDiagnosticsReporterModuleGlobalsForTests();
  });

  afterEach(() => {
    resetDiagnosticsReporterModuleGlobalsForTests();
  });

  it("keeps typed query key helpers aligned with existing tuple shapes", () => {
    expect(queryKeys.accounts.root).toEqual(["accounts"]);
    expect(queryKeys.feeds.byAccount("acc-1")).toEqual(["feeds", "acc-1"]);
    expect(queryKeys.feeds.byAccount(" acc-1 ")).toEqual(["feeds", "acc-1"]);
    expect(queryKeys.feeds.byAccount(" ")).toEqual(["feeds", null]);
    expect(queryKeys.articles.byFeed("feed-1", "unread")).toEqual(["articles", "feed-1", { mode: "unread" }]);
    expect(queryKeys.accountArticles.byAccount("acc-1", "all")).toEqual(["accountArticles", "acc-1", { mode: "all" }]);
    expect(queryKeys.accountArticles.byAccount(" acc-1 ", "all")).toEqual([
      "accountArticles",
      "acc-1",
      { mode: "all" },
    ]);
    expect(queryKeys.accountArticles.byAccount(" ", "all")).toEqual(["accountArticles", null, { mode: "all" }]);
    expect(queryKeys.accountArticles.byAccountPrefix("acc-1")).toEqual(["accountArticles", "acc-1"]);
    expect(queryKeys.accountArticles.byAccountPrefix(" acc-1 ")).toEqual(["accountArticles", "acc-1"]);
    expect(queryKeys.accountArticles.byAccountPrefix(" ")).toEqual(["accountArticles", null]);
    expect(queryKeys.feedArticleSummaries.root).toEqual(["feedArticleSummaries"]);
    expect(queryKeys.feedArticleSummaries.byAccount("acc-1")).toEqual(["feedArticleSummaries", "acc-1"]);
    expect(queryKeys.feedArticleSummaries.byAccount(" ")).toEqual(["feedArticleSummaries", null]);
    expect(queryKeys.feedArticleSummaries.subscriptionsIndex(" acc-1 ")).toEqual(["feedArticleSummaries", "acc-1"]);
    expect(queryKeys.feedArticleSummaries.subscriptionsIndex(" ")).toEqual(["feedArticleSummaries", null]);
    expect(queryKeys.folderArticles.byFolder("folder-1", "starred")).toEqual([
      "folderArticles",
      "folder-1",
      { mode: "starred" },
    ]);
    expect(queryKeys.recentArticles.byAccount("acc-1", "all")).toEqual(["recentArticles", "acc-1", { mode: "all" }]);
    expect(queryKeys.recentArticles.byAccount(" ", "all")).toEqual(["recentArticles", null, { mode: "all" }]);
    expect(queryKeys.accountUnreadCount.byAccount("acc-1")).toEqual(["accountUnreadCount", "acc-1"]);
    expect(queryKeys.accountUnreadCount.byAccount(null)).toEqual(["accountUnreadCount", null]);
    expect(queryKeys.accountUnreadCount.byAccount(" ")).toEqual(["accountUnreadCount", null]);
    expect(queryKeys.accountStarredCount.byAccount(" acc-1 ")).toEqual(["accountStarredCount", "acc-1"]);
    expect(queryKeys.accountStarredCount.byAccount(" ")).toEqual(["accountStarredCount", null]);
    expect(queryKeys.articlesByTag.byTagAndAccount("tag-1", "acc-1", "all")).toEqual([
      "articlesByTag",
      "tag-1",
      "acc-1",
      { mode: "all" },
    ]);
    expect(queryKeys.articlesByTag.byTagAndAccount("tag-1", " ", "all")).toEqual([
      "articlesByTag",
      "tag-1",
      null,
      { mode: "all" },
    ]);
    expect(queryKeys.tagArticleCounts.byAccount("acc-1")).toEqual(["tagArticleCounts", "acc-1"]);
    expect(queryKeys.tagArticleCounts.byAccount(null)).toEqual(["tagArticleCounts", null]);
    expect(queryKeys.tagArticleCounts.byAccount(" ")).toEqual(["tagArticleCounts", null]);
    expect(queryKeys.search.byAccountAndQuery("acc-1", "fresh")).toEqual(["search", "acc-1", "fresh"]);
    expect(queryKeys.search.byAccountAndQuery(" acc-1 ", "fresh")).toEqual(["search", "acc-1", "fresh"]);
    expect(queryKeys.search.byAccountAndQuery(" ", "fresh")).toEqual(["search", null, "fresh"]);
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
    expect(
      resolveFeedInvalidationQueryKeys({
        includeFolders: false,
        includeAccountUnreadCount: true,
      }),
    ).toEqual([["feeds"], ["accountUnreadCount"]]);
  });

  it("keeps mute, tag, and article mutation invalidation matrix explicit", () => {
    const articleVisibleListMatrix = [
      queryKeys.articles.root,
      queryKeys.accountArticles.root,
      queryKeys.folderArticles.root,
      queryKeys.starredArticles.root,
      queryKeys.accountUnreadCount.root,
      queryKeys.accountStarredCount.root,
      queryKeys.feeds.root,
      queryKeys.articlesByTag.root,
      queryKeys.tagArticleCounts.root,
      queryKeys.search.root,
      queryKeys.recentArticles.root,
      queryKeys.feedArticleSummaries.root,
    ];

    expect(resolveArticleMutationInvalidationQueryKeys("article-read-star")).toEqual(articleVisibleListMatrix);
    expect(resolveArticleMutationInvalidationQueryKeys("mute-keyword")).toEqual(articleVisibleListMatrix);
    expect(resolveArticleMutationInvalidationQueryKeys("tag-article-assignment")).toEqual([
      queryKeys.articles.root,
      queryKeys.accountArticles.root,
      queryKeys.folderArticles.root,
      queryKeys.starredArticles.root,
      queryKeys.accountUnreadCount.root,
      queryKeys.accountStarredCount.root,
      queryKeys.feeds.root,
      queryKeys.search.root,
      queryKeys.recentArticles.root,
      queryKeys.feedArticleSummaries.root,
    ]);
    expect(resolveArticleMutationInvalidationQueryKeys("tag-metadata")).toEqual([
      queryKeys.articlesByTag.root,
      queryKeys.tagArticleCounts.root,
    ]);
  });

  it("tags article mutation invalidation failures by matrix owner", async () => {
    const { invalidateQueries, queryClient } = createInvalidateSpy();
    const articleRejection = new Error("article mutation invalidation failed");
    const muteRejection = new Error("mute mutation invalidation failed");
    const tagRejection = new Error("tag mutation invalidation failed");
    const diagnosticsReporter = vi.fn();
    const restoreDiagnosticsReporter = setQueryInvalidationFailureReporterForDiagnostics(diagnosticsReporter);

    invalidateQueries.mockRejectedValueOnce(articleRejection);
    invalidateArticleMutationQueries(queryClient, "article-read-star");

    await vi.waitFor(() => {
      expect(diagnosticsReporter).toHaveBeenCalledWith([
        { actionOwner: "article-mutation", queryKey: ["articles"], error: articleRejection },
      ]);
    });

    invalidateQueries.mockReset();
    invalidateQueries.mockRejectedValueOnce(muteRejection);
    invalidateArticleMutationQueries(queryClient, "mute-keyword");

    await vi.waitFor(() => {
      expect(diagnosticsReporter).toHaveBeenCalledWith([
        { actionOwner: "mute-keyword-mutation", queryKey: ["articles"], error: muteRejection },
      ]);
    });

    invalidateQueries.mockReset();
    invalidateQueries.mockRejectedValueOnce(tagRejection);
    invalidateArticleMutationQueries(queryClient, "tag-article-assignment");

    await vi.waitFor(() => {
      expect(diagnosticsReporter).toHaveBeenCalledWith([
        { actionOwner: "tag-mutation", queryKey: ["articles"], error: tagRejection },
      ]);
    });

    restoreDiagnosticsReporter();
  });

  it("keeps add and delete feed invalidation on the shared feed mutation matrix", () => {
    const { invalidateQueries, queryClient } = createInvalidateSpy();
    const addFeedMatrix = [
      queryKeys.feeds.root,
      queryKeys.folders.root,
      queryKeys.accountUnreadCount.root,
      queryKeys.articles.root,
      queryKeys.accountArticles.root,
      queryKeys.folderArticles.root,
      queryKeys.starredArticles.root,
      queryKeys.accountStarredCount.root,
      queryKeys.articlesByTag.root,
      queryKeys.tagArticleCounts.root,
      queryKeys.search.root,
      queryKeys.recentArticles.root,
      queryKeys.feedArticleSummaries.root,
      queryKeys.feedArticleSummaries.subscriptionsIndex(" acc-1 "),
    ];
    const deleteFeedMatrix = [
      queryKeys.feeds.root,
      queryKeys.folders.root,
      queryKeys.accountUnreadCount.root,
      queryKeys.articles.root,
      queryKeys.accountArticles.root,
      queryKeys.folderArticles.root,
      queryKeys.starredArticles.root,
      queryKeys.accountStarredCount.root,
      queryKeys.articlesByTag.root,
      queryKeys.tagArticleCounts.root,
      queryKeys.search.root,
      queryKeys.recentArticles.root,
      queryKeys.feedArticleSummaries.root,
      queryKeys.feedArticleSummaries.subscriptionsIndex(" "),
    ];

    invalidateAddFeedQueries(queryClient, { accountId: " acc-1 " });
    invalidateDeleteFeedQueries(queryClient, { accountId: " " });

    expect(resolveAddFeedInvalidationQueryKeys({ accountId: " acc-1 " })).toEqual(addFeedMatrix);
    expect(resolveDeleteFeedInvalidationQueryKeys({ accountId: " " })).toEqual(deleteFeedMatrix);
    expect(invalidateQueries.mock.calls.map(([options]) => options)).toEqual(
      [...addFeedMatrix, ...deleteFeedMatrix].map((queryKey) => ({ queryKey })),
    );
  });

  it("aggregates add feed invalidation failures with the add-feed owner", async () => {
    const { invalidateQueries, queryClient } = createInvalidateSpy();
    const feedsRejection = new Error("feeds invalidation failed");
    const articlesRejection = new Error("articles invalidation failed");
    const diagnosticsReporter = vi.fn();
    const restoreDiagnosticsReporter = setQueryInvalidationFailureReporterForDiagnostics(diagnosticsReporter);

    invalidateQueries
      .mockRejectedValueOnce(feedsRejection)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(articlesRejection);

    invalidateAddFeedQueries(queryClient, { accountId: "acc-1" });

    await vi.waitFor(() => {
      expect(diagnosticsReporter).toHaveBeenCalledWith([
        { actionOwner: "add-feed", queryKey: ["feeds"], error: feedsRejection },
        { actionOwner: "add-feed", queryKey: ["articles"], error: articlesRejection },
      ]);
    });
    expect(diagnosticsReporter).toHaveBeenCalledOnce();

    restoreDiagnosticsReporter();
  });

  it("aggregates delete feed invalidation failures with the delete-feed owner", async () => {
    const { invalidateQueries, queryClient } = createInvalidateSpy();
    const foldersRejection = new Error("folders invalidation failed");
    const accountScopedRejection = new Error("account scoped invalidation failed");
    const diagnosticsReporter = vi.fn();
    const restoreDiagnosticsReporter = setQueryInvalidationFailureReporterForDiagnostics(diagnosticsReporter);

    invalidateQueries.mockImplementation((filters) => {
      const queryKey = filters?.queryKey ?? [];
      if (queryKey[0] === "folders") {
        return Promise.reject(foldersRejection);
      }
      if (queryKey[0] === "feedArticleSummaries" && queryKey[1] === "acc-1") {
        return Promise.reject(accountScopedRejection);
      }

      return Promise.resolve();
    });

    invalidateDeleteFeedQueries(queryClient, { accountId: "acc-1" });

    await vi.waitFor(() => {
      expect(diagnosticsReporter).toHaveBeenCalledWith([
        { actionOwner: "delete-feed", queryKey: ["folders"], error: foldersRejection },
        { actionOwner: "delete-feed", queryKey: ["feedArticleSummaries", "acc-1"], error: accountScopedRejection },
      ]);
    });
    expect(diagnosticsReporter).toHaveBeenCalledOnce();

    restoreDiagnosticsReporter();
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
        failures: [
          {
            actionOwner: "unknown",
            queryKey: ["feeds"],
            error: rejection,
          },
        ],
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
        { actionOwner: "unknown", queryKey: ["feeds"], error: feedRejection },
        {
          actionOwner: "unknown",
          queryKey: ["accountUnreadCount"],
          error: unreadRejection,
        },
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

  it("restores the default reporter when a custom invalidation reporter leaks past a test boundary", async () => {
    const { invalidateQueries, queryClient } = createInvalidateSpy();
    const leakedDiagnosticsReporter = vi.fn();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rejection = new Error("invalidate failed");

    setQueryInvalidationFailureReporterForDiagnostics(leakedDiagnosticsReporter);
    resetQueryInvalidationFailureReporterForTests();
    invalidateQueries.mockRejectedValueOnce(rejection);

    invalidateFeedQueries(queryClient, {
      includeFolders: false,
    });

    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith("Query invalidation failed:", {
        failures: [{ actionOwner: "unknown", queryKey: ["feeds"], error: rejection }],
      });
    });

    expect(leakedDiagnosticsReporter).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("tags log-only invalidation failures with the user action owner", async () => {
    const { invalidateQueries, queryClient } = createInvalidateSpy();
    const rejection = new Error("delete feed invalidate failed");
    const diagnosticsReporter = vi.fn();
    const restoreDiagnosticsReporter = setQueryInvalidationFailureReporterForDiagnostics(diagnosticsReporter);

    invalidateQueries.mockRejectedValueOnce(rejection);

    invalidateFeedQueries(queryClient, {
      actionOwner: "delete-feed",
      includeFeeds: true,
      includeFolders: false,
    });

    await vi.waitFor(() => {
      expect(diagnosticsReporter).toHaveBeenCalledWith([
        { actionOwner: "delete-feed", queryKey: ["feeds"], error: rejection },
      ]);
    });

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

  it("tags sync completed invalidation failures by background and manual owner", async () => {
    const { invalidateQueries, queryClient } = createInvalidateSpy();
    const backgroundRejection = new Error("background sync invalidation failed");
    const manualRejection = new Error("manual sync invalidation failed");
    const diagnosticsReporter = vi.fn();
    const restoreDiagnosticsReporter = setQueryInvalidationFailureReporterForDiagnostics(diagnosticsReporter);

    invalidateQueries.mockRejectedValueOnce(backgroundRejection);

    invalidateSyncCompletedQueries(queryClient);

    await vi.waitFor(() => {
      expect(diagnosticsReporter).toHaveBeenCalledWith([
        { actionOwner: "background-sync-completed", queryKey: ["feeds"], error: backgroundRejection },
      ]);
    });

    invalidateQueries.mockReset();
    invalidateQueries.mockRejectedValueOnce(manualRejection);

    invalidateSyncCompletedQueries(queryClient, { actionOwner: "manual-sync-completed" });

    await vi.waitFor(() => {
      expect(diagnosticsReporter).toHaveBeenCalledWith([
        { actionOwner: "manual-sync-completed", queryKey: ["feeds"], error: manualRejection },
      ]);
    });

    restoreDiagnosticsReporter();
  });
});
