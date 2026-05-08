import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { describe, expect, it, vi } from "vitest";
import { invalidateArticleQueries, invalidateFeedQueries } from "@/lib/query/query-invalidation";

function createInvalidateSpy() {
  const queryClient = createTestQueryClient();
  const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);

  return { invalidateQueries, queryClient };
}

describe("query-invalidation", () => {
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
      includeSearch: false,
      includeFeedIntegrityReport: true,
      includeRecentArticles: false,
    });

    expect(invalidateQueries.mock.calls.map(([options]) => options)).toEqual([
      { queryKey: ["articles"] },
      { queryKey: ["feedIntegrityReport"] },
    ]);
  });
});
