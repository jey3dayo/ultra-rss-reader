import { describe, expect, it } from "vitest";
import { isOverloaded, resolveSubscriptionUpdatePace } from "@/lib/subscriptions/subscription-update-frequency";

describe("isOverloaded", () => {
  it("requires both thresholds and respects their boundaries", () => {
    expect(isOverloaded({ postsLast30Days: 90, unreadCount: 100 })).toBe(true);
    expect(isOverloaded({ postsLast30Days: 89, unreadCount: 100 })).toBe(false);
    expect(isOverloaded({ postsLast30Days: 99, unreadCount: 90 })).toBe(false);
    expect(isOverloaded({ postsLast30Days: 90, unreadCount: 99 })).toBe(false);
  });
});

describe("resolveSubscriptionUpdatePace", () => {
  it("resolves none, daily, and weekly paces from the 30-day window", () => {
    expect(resolveSubscriptionUpdatePace(0)).toEqual({ unit: "none" });
    expect(resolveSubscriptionUpdatePace(30)).toEqual({ unit: "day", count: 1 });
    expect(resolveSubscriptionUpdatePace(484)).toEqual({ unit: "day", count: 16 });
    expect(resolveSubscriptionUpdatePace(1)).toEqual({ unit: "week", count: 1 });
    expect(resolveSubscriptionUpdatePace(10)).toEqual({ unit: "week", count: 2 });
  });
});
