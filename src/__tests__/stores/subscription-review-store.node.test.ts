import { beforeEach, describe, expect, it } from "vitest";
import { useSubscriptionReviewStore } from "@/stores/subscription-review-store";

function keptOf(accountId: string): string[] {
  return [...(useSubscriptionReviewStore.getState().kept.get(accountId) ?? [])].sort();
}

describe("useSubscriptionReviewStore", () => {
  beforeEach(() => {
    useSubscriptionReviewStore.setState(useSubscriptionReviewStore.getInitialState());
  });

  it("keeps decisions separate per account", () => {
    const { keep, unkeep } = useSubscriptionReviewStore.getState();
    keep("acc-1", "feed-a");
    keep("acc-2", "feed-a");
    keep("acc-2", "feed-b");
    unkeep("acc-1", "feed-a");

    expect(keptOf("acc-1")).toEqual([]);
    expect(keptOf("acc-2")).toEqual(["feed-a", "feed-b"]);
  });

  it("returns the previous set on clear and adds it back with restore without dropping newer decisions", () => {
    const { keep, clear, restore } = useSubscriptionReviewStore.getState();
    keep("acc-1", "feed-a");
    keep("acc-1", "feed-b");
    keep("acc-2", "feed-c");

    const snapshot = clear("acc-1");
    keep("acc-1", "feed-z");

    expect([...snapshot].sort()).toEqual(["feed-a", "feed-b"]);
    expect(keptOf("acc-2")).toEqual(["feed-c"]);

    restore("acc-1", snapshot);

    expect(keptOf("acc-1")).toEqual(["feed-a", "feed-b", "feed-z"]);
  });

  it("keeps the same state reference when restore adds nothing", () => {
    const { keep, restore } = useSubscriptionReviewStore.getState();
    keep("acc-1", "feed-a");

    const before = useSubscriptionReviewStore.getState().kept;
    restore("acc-1", new Set(["feed-a"]));
    restore("acc-1", new Set());
    restore("acc-other", new Set());

    expect(useSubscriptionReviewStore.getState().kept).toBe(before);
  });

  it("forgets only the given feeds and leaves the state untouched when none matched", () => {
    const { keep, forget } = useSubscriptionReviewStore.getState();
    keep("acc-1", "feed-a");
    keep("acc-1", "feed-b");
    keep("acc-1", "feed-c");

    forget("acc-1", ["feed-a", "feed-c", "feed-missing"]);
    expect(keptOf("acc-1")).toEqual(["feed-b"]);

    const before = useSubscriptionReviewStore.getState().kept;
    forget("acc-1", ["feed-missing"]);
    forget("acc-other", ["feed-b"]);
    expect(useSubscriptionReviewStore.getState().kept).toBe(before);
  });
});
