import { describe, expect, it } from "vitest";
import { resolveAdjacentSubscriptionFeedId } from "@/lib/subscriptions/subscription-list-navigation";

describe("resolveAdjacentSubscriptionFeedId", () => {
  const feedIds = ["feed-1", "feed-2", "feed-3"];

  it("resolves the next and previous ids in the displayed order", () => {
    expect(resolveAdjacentSubscriptionFeedId(feedIds, "feed-1", 1)).toBe("feed-2");
    expect(resolveAdjacentSubscriptionFeedId(feedIds, "feed-2", 1)).toBe("feed-3");
    expect(resolveAdjacentSubscriptionFeedId(feedIds, "feed-3", -1)).toBe("feed-2");
    expect(resolveAdjacentSubscriptionFeedId(feedIds, "feed-2", -1)).toBe("feed-1");
  });

  it("stops at both ends instead of wrapping", () => {
    expect(resolveAdjacentSubscriptionFeedId(feedIds, "feed-1", -1)).toBeNull();
    expect(resolveAdjacentSubscriptionFeedId(feedIds, "feed-3", 1)).toBeNull();
  });

  it("returns null when the current id is missing or not part of the order", () => {
    expect(resolveAdjacentSubscriptionFeedId(feedIds, null, 1)).toBeNull();
    // Collapsed groups are excluded by the caller, so an id outside the
    // given order (e.g. a row inside a collapsed group) never resolves.
    expect(resolveAdjacentSubscriptionFeedId(feedIds, "feed-collapsed", 1)).toBeNull();
    expect(resolveAdjacentSubscriptionFeedId([], "feed-1", 1)).toBeNull();
  });
});
