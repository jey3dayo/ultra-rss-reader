import { describe, expect, it } from "vitest";
import {
  resolveSubscriptionUpdateFrequencyTier,
  SUBSCRIPTION_UPDATE_FREQUENCY_HIGH_THRESHOLD,
  SUBSCRIPTION_UPDATE_FREQUENCY_MEDIUM_THRESHOLD,
} from "@/lib/subscriptions/subscription-update-frequency";

describe("resolveSubscriptionUpdateFrequencyTier", () => {
  it("classifies each tier including the exact threshold boundaries and fractional flooring", () => {
    expect(resolveSubscriptionUpdateFrequencyTier(0)).toBe("none");
    expect(resolveSubscriptionUpdateFrequencyTier(SUBSCRIPTION_UPDATE_FREQUENCY_MEDIUM_THRESHOLD - 1)).toBe("low");
    expect(resolveSubscriptionUpdateFrequencyTier(3.9)).toBe("low");
    expect(resolveSubscriptionUpdateFrequencyTier(SUBSCRIPTION_UPDATE_FREQUENCY_MEDIUM_THRESHOLD)).toBe("medium");
    expect(resolveSubscriptionUpdateFrequencyTier(SUBSCRIPTION_UPDATE_FREQUENCY_HIGH_THRESHOLD - 1)).toBe("medium");
    expect(resolveSubscriptionUpdateFrequencyTier(SUBSCRIPTION_UPDATE_FREQUENCY_HIGH_THRESHOLD)).toBe("high");
    expect(resolveSubscriptionUpdateFrequencyTier(500)).toBe("high");
  });

  it("normalizes negative and non-finite counts toward none", () => {
    expect(resolveSubscriptionUpdateFrequencyTier(-5)).toBe("none");
    expect(resolveSubscriptionUpdateFrequencyTier(Number.NaN)).toBe("none");
    expect(resolveSubscriptionUpdateFrequencyTier(Number.POSITIVE_INFINITY)).toBe("none");
  });
});
