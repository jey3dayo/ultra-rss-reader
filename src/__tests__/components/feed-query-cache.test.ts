import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { describe, expect, it, vi } from "vitest";
import { invalidateFeedQueries } from "@/components/reader/feed-query-cache";

describe("invalidateFeedQueries", () => {
  it("invalidates feeds and folders by default", () => {
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);

    invalidateFeedQueries(queryClient);

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["feeds"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["folders"] });
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ["accountUnreadCount"] });
  });

  it("supports account unread count and selective feed invalidation", () => {
    const queryClient = createTestQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue(undefined);

    invalidateFeedQueries(queryClient, {
      includeFeeds: false,
      includeAccountUnreadCount: true,
    });

    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ["feeds"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["folders"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["accountUnreadCount"] });
  });
});
