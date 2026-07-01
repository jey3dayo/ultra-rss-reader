import { hashKey } from "@tanstack/react-query";
import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { resetDiagnosticsReporterModuleGlobalsForTests } from "@tests/helpers/diagnostics-reporters";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QUERY_CACHE_KEY_VERSION } from "@/api/schemas/runtime-contracts";
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
  QUERY_KEY_ROOTS,
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
    expect(queryKeys.accounts.root).toEqual([QUERY_CACHE_KEY_VERSION, "accounts"]);
    expect(queryKeys.feeds.byAccount("acc-1")).toEqual([QUERY_CACHE_KEY_VERSION, "feeds", "acc-1"]);
    expect(queryKeys.feeds.byAccount(" acc-1 ")).toEqual([QUERY_CACHE_KEY_VERSION, "feeds", "acc-1"]);
    expect(queryKeys.feeds.byAccount(" ")).toEqual([QUERY_CACHE_KEY_VERSION, "feeds", null]);
    expect(queryKeys.articles.byFeed("feed-1", "unread")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "articles",
      "feed-1",
      { mode: "unread" },
    ]);
    expect(queryKeys.accountArticles.byAccount("acc-1", "all")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "accountArticles",
      "acc-1",
      { mode: "all" },
    ]);
    expect(queryKeys.accountArticles.byAccount(" acc-1 ", "all")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "accountArticles",
      "acc-1",
      { mode: "all" },
    ]);
    expect(queryKeys.accountArticles.byAccount(" ", "all")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "accountArticles",
      null,
      { mode: "all" },
    ]);
    expect(queryKeys.accountArticles.byAccountPrefix("acc-1")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "accountArticles",
      "acc-1",
    ]);
    expect(queryKeys.accountArticles.byAccountPrefix(" acc-1 ")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "accountArticles",
      "acc-1",
    ]);
    expect(queryKeys.accountArticles.byAccountPrefix(" ")).toEqual([QUERY_CACHE_KEY_VERSION, "accountArticles", null]);
    expect(queryKeys.feedArticleSummaries.root).toEqual([QUERY_CACHE_KEY_VERSION, "feedArticleSummaries"]);
    expect(queryKeys.feedArticleSummaries.byAccount("acc-1")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "feedArticleSummaries",
      "acc-1",
    ]);
    expect(queryKeys.feedArticleSummaries.byAccount(" ")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "feedArticleSummaries",
      null,
    ]);
    expect(queryKeys.feedArticleSummaries.subscriptionsIndex(" acc-1 ")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "feedArticleSummaries",
      "acc-1",
    ]);
    expect(queryKeys.feedArticleSummaries.subscriptionsIndex(" ")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "feedArticleSummaries",
      null,
    ]);
    expect(queryKeys.folderArticles.byFolder("folder-1", "starred")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "folderArticles",
      "folder-1",
      { mode: "starred" },
    ]);
    expect(queryKeys.recentArticles.byAccount("acc-1", "all")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "recentArticles",
      "acc-1",
      { mode: "all" },
    ]);
    expect(queryKeys.recentArticles.byAccount(" ", "all")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "recentArticles",
      null,
      { mode: "all" },
    ]);
    expect(queryKeys.accountUnreadCount.byAccount("acc-1")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "accountUnreadCount",
      "acc-1",
    ]);
    expect(queryKeys.accountUnreadCount.byAccount(null)).toEqual([QUERY_CACHE_KEY_VERSION, "accountUnreadCount", null]);
    expect(queryKeys.accountUnreadCount.byAccount(" ")).toEqual([QUERY_CACHE_KEY_VERSION, "accountUnreadCount", null]);
    expect(queryKeys.accountStarredCount.byAccount(" acc-1 ")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "accountStarredCount",
      "acc-1",
    ]);
    expect(queryKeys.accountStarredCount.byAccount(" ")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "accountStarredCount",
      null,
    ]);
    expect(queryKeys.articlesByTag.byTagAndAccount("tag-1", "acc-1", "all")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "articlesByTag",
      "tag-1",
      "acc-1",
      { mode: "all" },
    ]);
    expect(queryKeys.articlesByTag.byTagAndAccount("tag-1", " ", "all")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "articlesByTag",
      "tag-1",
      null,
      { mode: "all" },
    ]);
    expect(queryKeys.tagArticleCounts.byAccount("acc-1")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "tagArticleCounts",
      "acc-1",
    ]);
    expect(queryKeys.tagArticleCounts.byAccount(null)).toEqual([QUERY_CACHE_KEY_VERSION, "tagArticleCounts", null]);
    expect(queryKeys.tagArticleCounts.byAccount(" ")).toEqual([QUERY_CACHE_KEY_VERSION, "tagArticleCounts", null]);
    expect(queryKeys.search.byAccountAndQuery("acc-1", "fresh")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "search",
      "acc-1",
      "fresh",
    ]);
    expect(queryKeys.search.byAccountAndQuery(" acc-1 ", "fresh")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "search",
      "acc-1",
      "fresh",
    ]);
    expect(queryKeys.search.byAccountAndQuery(" ", "fresh")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "search",
      null,
      "fresh",
    ]);
  });

  it("keeps every schema-owned query root behind the query cache version segment", () => {
    expect(Object.values(QUERY_KEY_ROOTS).map(([version]) => version)).toEqual(
      Array(Object.keys(QUERY_KEY_ROOTS).length).fill(QUERY_CACHE_KEY_VERSION),
    );
  });

  it("keeps reader article query key object segments stable for hashing and root matching", () => {
    const queryClient = createTestQueryClient();
    const articleKey = queryKeys.articles.byFeed("feed-1", "unread");
    const accountKey = queryKeys.accountArticles.byAccount("acc-1", "all");
    const tagKey = queryKeys.articlesByTag.byTagAndAccount("tag-1", "acc-1", "starred");

    queryClient.setQueryData(articleKey, ["feed article"]);
    queryClient.setQueryData(accountKey, ["account article"]);
    queryClient.setQueryData(tagKey, ["tag article"]);

    expect(hashKey(articleKey)).toBe(hashKey([QUERY_CACHE_KEY_VERSION, "articles", "feed-1", { mode: "unread" }]));
    expect(hashKey(accountKey)).toBe(hashKey([QUERY_CACHE_KEY_VERSION, "accountArticles", "acc-1", { mode: "all" }]));
    expect(hashKey(tagKey)).toBe(
      hashKey([QUERY_CACHE_KEY_VERSION, "articlesByTag", "tag-1", "acc-1", { mode: "starred" }]),
    );
    expect(queryClient.getQueryCache().findAll({ queryKey: queryKeys.articles.root })).toHaveLength(1);
    expect(queryClient.getQueryCache().findAll({ queryKey: queryKeys.accountArticles.root })).toHaveLength(1);
    expect(queryClient.getQueryCache().findAll({ queryKey: queryKeys.articlesByTag.root })).toHaveLength(1);
  });

  it("keeps composite query keys in typed manual helpers instead of generated single-id hooks", () => {
    expect(queryKeys.accountArticles.byAccount("acc-1", "unread")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "accountArticles",
      "acc-1",
      { mode: "unread" },
    ]);
    expect(queryKeys.articlesByTag.byTagAndAccount("tag-1", "acc-1", "starred")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "articlesByTag",
      "tag-1",
      "acc-1",
      { mode: "starred" },
    ]);
    expect(queryKeys.search.byAccountAndQuery("acc-1", "news")).toEqual([
      QUERY_CACHE_KEY_VERSION,
      "search",
      "acc-1",
      "news",
    ]);
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
      queryKeys.folderArticles.root,
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
    expect(resolveFeedInvalidationQueryKeys()).toEqual([queryKeys.feeds.root, queryKeys.folders.root]);
    expect(
      resolveFeedInvalidationQueryKeys({
        includeFeeds: false,
        includeFolders: false,
        includeAccountUnreadCount: true,
      }),
    ).toEqual([queryKeys.accountUnreadCount.root]);
  });

  it("keeps article invalidation target keys explicit", () => {
    expect(resolveArticleInvalidationQueryKeys()).toEqual([
      queryKeys.articles.root,
      queryKeys.accountArticles.root,
      queryKeys.folderArticles.root,
      queryKeys.starredArticles.root,
      queryKeys.accountUnreadCount.root,
      queryKeys.accountStarredCount.root,
      queryKeys.feeds.root,
      queryKeys.articlesByTag.root,
      queryKeys.search.root,
      queryKeys.recentArticles.root,
      queryKeys.feedArticleSummaries.root,
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
    ).toEqual([queryKeys.tagArticleCounts.root, queryKeys.feedIntegrityReport.root]);
  });

  it("documents mutation owner invalidation query key sets", () => {
    expect(resolveArticleInvalidationQueryKeys({ includeTagArticleCounts: true })).toEqual([
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
    ]);
    expect(
      resolveArticleInvalidationQueryKeys({
        includeAccountUnreadCount: false,
        includeFeeds: false,
      }),
    ).toEqual([
      queryKeys.articles.root,
      queryKeys.accountArticles.root,
      queryKeys.folderArticles.root,
      queryKeys.starredArticles.root,
      queryKeys.accountStarredCount.root,
      queryKeys.articlesByTag.root,
      queryKeys.search.root,
      queryKeys.recentArticles.root,
      queryKeys.feedArticleSummaries.root,
    ]);
    expect(
      resolveFeedInvalidationQueryKeys({
        includeFolders: false,
        includeAccountUnreadCount: true,
      }),
    ).toEqual([queryKeys.feeds.root, queryKeys.accountUnreadCount.root]);
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
        { actionOwner: "article-mutation", queryKey: queryKeys.articles.root, error: articleRejection },
      ]);
    });

    invalidateQueries.mockReset();
    invalidateQueries.mockRejectedValueOnce(muteRejection);
    invalidateArticleMutationQueries(queryClient, "mute-keyword");

    await vi.waitFor(() => {
      expect(diagnosticsReporter).toHaveBeenCalledWith([
        { actionOwner: "mute-keyword-mutation", queryKey: queryKeys.articles.root, error: muteRejection },
      ]);
    });

    invalidateQueries.mockReset();
    invalidateQueries.mockRejectedValueOnce(tagRejection);
    invalidateArticleMutationQueries(queryClient, "tag-article-assignment");

    await vi.waitFor(() => {
      expect(diagnosticsReporter).toHaveBeenCalledWith([
        { actionOwner: "tag-mutation", queryKey: queryKeys.articles.root, error: tagRejection },
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
        { actionOwner: "add-feed", queryKey: queryKeys.feeds.root, error: feedsRejection },
        { actionOwner: "add-feed", queryKey: queryKeys.articles.root, error: articlesRejection },
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
      if (queryKey[0] === QUERY_CACHE_KEY_VERSION && queryKey[1] === "folders") {
        return Promise.reject(foldersRejection);
      }
      if (
        queryKey[0] === QUERY_CACHE_KEY_VERSION &&
        queryKey[1] === "feedArticleSummaries" &&
        queryKey[2] === "acc-1"
      ) {
        return Promise.reject(accountScopedRejection);
      }

      return Promise.resolve();
    });

    invalidateDeleteFeedQueries(queryClient, { accountId: "acc-1" });

    await vi.waitFor(() => {
      expect(diagnosticsReporter).toHaveBeenCalledWith([
        { actionOwner: "delete-feed", queryKey: queryKeys.folders.root, error: foldersRejection },
        {
          actionOwner: "delete-feed",
          queryKey: queryKeys.feedArticleSummaries.subscriptionsIndex("acc-1"),
          error: accountScopedRejection,
        },
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

    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: queryKeys.feeds.root });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.folders.root });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.accountUnreadCount.root,
    });
  });

  it("invalidates article query keys by default", () => {
    const { invalidateQueries, queryClient } = createInvalidateSpy();

    invalidateArticleQueries(queryClient);

    expect(invalidateQueries.mock.calls.map(([options]) => options)).toEqual([
      { queryKey: queryKeys.articles.root },
      { queryKey: queryKeys.accountArticles.root },
      { queryKey: queryKeys.folderArticles.root },
      { queryKey: queryKeys.starredArticles.root },
      { queryKey: queryKeys.accountUnreadCount.root },
      { queryKey: queryKeys.accountStarredCount.root },
      { queryKey: queryKeys.feeds.root },
      { queryKey: queryKeys.articlesByTag.root },
      { queryKey: queryKeys.search.root },
      { queryKey: queryKeys.recentArticles.root },
      { queryKey: queryKeys.feedArticleSummaries.root },
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
      { queryKey: queryKeys.articles.root },
      { queryKey: queryKeys.tagArticleCounts.root },
      { queryKey: queryKeys.feedIntegrityReport.root },
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
            queryKey: queryKeys.feeds.root,
            error: rejection,
          },
        ],
      });
    });
    expect(invalidateQueries.mock.calls.map(([options]) => options)).toEqual([
      { queryKey: queryKeys.feeds.root },
      { queryKey: queryKeys.folders.root },
      { queryKey: queryKeys.accountUnreadCount.root },
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
        { actionOwner: "unknown", queryKey: queryKeys.feeds.root, error: feedRejection },
        {
          actionOwner: "unknown",
          queryKey: queryKeys.accountUnreadCount.root,
          error: unreadRejection,
        },
      ]);
    });
    expect(diagnosticsReporter).toHaveBeenCalledOnce();
    expect(invalidateQueries.mock.calls.map(([options]) => options)).toEqual([
      { queryKey: queryKeys.feeds.root },
      { queryKey: queryKeys.folders.root },
      { queryKey: queryKeys.accountUnreadCount.root },
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
        failures: [{ actionOwner: "unknown", queryKey: queryKeys.feeds.root, error: rejection }],
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
        { actionOwner: "delete-feed", queryKey: queryKeys.feeds.root, error: rejection },
      ]);
    });

    restoreDiagnosticsReporter();
  });

  it("invalidates scoped feed, article, and account status query keys after sync completion", () => {
    const { invalidateQueries, queryClient } = createInvalidateSpy();

    invalidateSyncCompletedQueries(queryClient);

    expect(invalidateQueries).not.toHaveBeenCalledWith();
    expect(invalidateQueries.mock.calls.map(([options]) => options)).toEqual([
      { queryKey: queryKeys.feeds.root },
      { queryKey: queryKeys.folders.root },
      { queryKey: queryKeys.accountUnreadCount.root },
      { queryKey: queryKeys.articles.root },
      { queryKey: queryKeys.accountArticles.root },
      { queryKey: queryKeys.folderArticles.root },
      { queryKey: queryKeys.starredArticles.root },
      { queryKey: queryKeys.accountStarredCount.root },
      { queryKey: queryKeys.articlesByTag.root },
      { queryKey: queryKeys.tagArticleCounts.root },
      { queryKey: queryKeys.search.root },
      { queryKey: queryKeys.feedIntegrityReport.root },
      { queryKey: queryKeys.recentArticles.root },
      { queryKey: queryKeys.feedArticleSummaries.root },
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
        { actionOwner: "background-sync-completed", queryKey: queryKeys.feeds.root, error: backgroundRejection },
      ]);
    });

    invalidateQueries.mockReset();
    invalidateQueries.mockRejectedValueOnce(manualRejection);

    invalidateSyncCompletedQueries(queryClient, { actionOwner: "manual-sync-completed" });

    await vi.waitFor(() => {
      expect(diagnosticsReporter).toHaveBeenCalledWith([
        { actionOwner: "manual-sync-completed", queryKey: queryKeys.feeds.root, error: manualRejection },
      ]);
    });

    restoreDiagnosticsReporter();
  });
});
