import { installNodeTestStorage } from "@tests/helpers/node-test-storage";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_STORED_SUBSCRIPTION_REVIEW_STORAGE_LENGTH, STORAGE_KEYS } from "@/constants/storage";
import { resetRuntimeDiagnosticOnceSuppressionForTests } from "@/lib/runtime/diagnostics";
import {
  readSubscriptionReviewDecisions,
  resetSubscriptionReviewStorageFailureWarnings,
  writeSubscriptionReviewDecisions,
} from "@/lib/subscriptions/subscription-review-storage";

const nodeTestStorage = installNodeTestStorage();

function storedRaw(): string | null {
  return localStorage.getItem(STORAGE_KEYS.subscriptionReviewDecisions);
}

describe("subscription-review-storage", () => {
  afterAll(() => {
    nodeTestStorage.restore();
  });

  beforeEach(() => {
    resetSubscriptionReviewStorageFailureWarnings();
    resetRuntimeDiagnosticOnceSuppressionForTests();
    localStorage.clear();
  });

  afterEach(() => {
    resetSubscriptionReviewStorageFailureWarnings();
    resetRuntimeDiagnosticOnceSuppressionForTests();
    vi.restoreAllMocks();
  });

  it("returns an empty map when decisions are missing", () => {
    expect(readSubscriptionReviewDecisions().size).toBe(0);
  });

  it("round-trips decisions per account through storage", () => {
    writeSubscriptionReviewDecisions(
      new Map([
        ["acc-1", new Set(["feed-a", "feed-b"])],
        ["acc-2", new Set(["feed-c"])],
      ]),
    );

    const restored = readSubscriptionReviewDecisions();

    expect([...(restored.get("acc-1") ?? [])].sort()).toEqual(["feed-a", "feed-b"]);
    expect([...(restored.get("acc-2") ?? [])]).toEqual(["feed-c"]);
    expect(JSON.parse(storedRaw() ?? "{}")).toEqual({
      version: 1,
      accounts: {
        "acc-1": ["feed-a", "feed-b"],
        "acc-2": ["feed-c"],
      },
    });
  });

  it("drops accounts with no decisions when writing", () => {
    writeSubscriptionReviewDecisions(new Map([["acc-1", new Set<string>()]]));

    expect(JSON.parse(storedRaw() ?? "{}")).toEqual({ version: 1, accounts: {} });
    expect(readSubscriptionReviewDecisions().size).toBe(0);
  });

  it("returns an empty map and removes invalid stored data", () => {
    localStorage.setItem(STORAGE_KEYS.subscriptionReviewDecisions, "not-json");

    expect(readSubscriptionReviewDecisions().size).toBe(0);
    expect(storedRaw()).toBeNull();
  });

  it("returns an empty map and removes decisions stored under an unknown version", () => {
    localStorage.setItem(
      STORAGE_KEYS.subscriptionReviewDecisions,
      JSON.stringify({ version: 999, accounts: { "acc-1": ["feed-a"] } }),
    );

    expect(readSubscriptionReviewDecisions().size).toBe(0);
    expect(storedRaw()).toBeNull();
  });

  it("returns an empty map and removes oversized stored data", () => {
    localStorage.setItem(
      STORAGE_KEYS.subscriptionReviewDecisions,
      `"${"x".repeat(MAX_STORED_SUBSCRIPTION_REVIEW_STORAGE_LENGTH + 1)}"`,
    );

    expect(readSubscriptionReviewDecisions().size).toBe(0);
    expect(storedRaw()).toBeNull();
  });

  it("normalizes stored decisions on read and writes the normalized form back", () => {
    localStorage.setItem(
      STORAGE_KEYS.subscriptionReviewDecisions,
      JSON.stringify({ version: 1, accounts: { " acc-1 ": [" feed-a ", "feed-a", "", "feed-b"] } }),
    );

    const restored = readSubscriptionReviewDecisions();

    expect([...(restored.get("acc-1") ?? [])]).toEqual(["feed-a", "feed-b"]);
    expect(JSON.parse(storedRaw() ?? "{}")).toEqual({
      version: 1,
      accounts: { "acc-1": ["feed-a", "feed-b"] },
    });
  });

  it("does not throw when writing fails", () => {
    vi.spyOn(nodeTestStorage.localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    expect(() => writeSubscriptionReviewDecisions(new Map([["acc-1", new Set(["feed-a"])]]))).not.toThrow();
  });
});
