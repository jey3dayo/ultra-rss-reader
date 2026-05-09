import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { describe, expect, it, vi } from "vitest";
import {
  invalidateArticleQueries,
  invalidateFeedQueries,
  invalidateSyncCompletedQueries,
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
    expect(queryKeys.feeds.byAccount("acc-1")).toEqual(["feeds", "acc-1"]);
    expect(queryKeys.articles.byFeed("feed-1", "unread")).toEqual(["articles", "feed-1", { mode: "unread" }]);
    expect(queryKeys.accountArticles.byAccount("acc-1", "all")).toEqual(["accountArticles", "acc-1", { mode: "all" }]);
    expect(queryKeys.accountArticles.byAccountPrefix("acc-1")).toEqual(["accountArticles", "acc-1"]);
    expect(queryKeys.feedArticleSummaries.root).toEqual(["feedArticleSummaries"]);
    expect(queryKeys.feedArticleSummaries.byAccount("acc-1")).toEqual(["feedArticleSummaries", "acc-1"]);
    expect(queryKeys.folderArticles.byFolder("folder-1", "starred")).toEqual([
      "folderArticles",
      "folder-1",
      { mode: "starred" },
    ]);
    expect(queryKeys.recentArticles.byAccount("acc-1", "all")).toEqual(["recentArticles", "acc-1", { mode: "all" }]);
    expect(queryKeys.search.byAccountAndQuery("acc-1", "fresh")).toEqual(["search", "acc-1", "fresh"]);
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
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["accountUnreadCount"] });
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
