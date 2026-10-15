import { describe, expect, it } from "vitest";
import { requireEnabledQueryValue } from "@/hooks/require-enabled-query-value";

describe("requireEnabledQueryValue", () => {
  it("returns the value when it is present", () => {
    expect(requireEnabledQueryValue("feed-1", "feedId")).toBe("feed-1");
  });

  it("throws the shared enabled-query message for a missing value", () => {
    expect(() => requireEnabledQueryValue(null, "accountId")).toThrow(
      "accountId is required when the query is enabled.",
    );
    expect(() => requireEnabledQueryValue("", "tagId")).toThrow("tagId is required when the query is enabled.");
  });
});
