import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { describe, expect, it, vi } from "vitest";
import {
  invalidateFeedQueries,
  isLatestFeedMutation,
  runFeedMutationWithOptimisticRollback,
  startLatestFeedMutation,
} from "@/components/reader/feed-query-cache";
import { queryKeys } from "@/lib/query/query-invalidation";

describe("invalidateFeedQueries", () => {
  it("invalidates feeds and folders by default", () => {
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);

    invalidateFeedQueries(queryClient);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.feeds.root });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.folders.root });
    expect(invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: queryKeys.accountUnreadCount.root,
    });
  });

  it("supports account unread count and selective feed invalidation", () => {
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);

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
});

describe("feed mutation helper contract", () => {
  it("rolls back optimistic state when the mutation result asks for rollback", async () => {
    const rollback = vi.fn();

    await expect(
      runFeedMutationWithOptimisticRollback({
        rollback,
        run: async () => ({ ok: false }),
        shouldRollback: (result) => !result.ok,
      }),
    ).resolves.toEqual({ ok: false });

    expect(rollback).toHaveBeenCalledTimes(1);
  });

  it("keeps latest request ids comparable across feed mutations", () => {
    const latestRequestIdRef = { current: 0 };

    const firstRequestId = startLatestFeedMutation({ latestRequestIdRef });
    const secondRequestId = startLatestFeedMutation({ latestRequestIdRef });

    expect(isLatestFeedMutation({ latestRequestIdRef }, firstRequestId)).toBe(false);
    expect(isLatestFeedMutation({ latestRequestIdRef }, secondRequestId)).toBe(true);
  });
});
