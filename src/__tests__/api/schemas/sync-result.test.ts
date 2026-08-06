import { safeParse } from "valibot";
import { describe, expect, it } from "vitest";
import { AccountSyncWarningSchema, SyncResultSchema } from "@/api/schemas/sync-result";

const retryScheduledWarning = {
  account_id: "acc-1",
  account_name: "FreshRSS",
  kind: "retry_scheduled",
  message: "Retry scheduled",
};

describe("AccountSyncWarningSchema", () => {
  it("accepts missing retry seconds and rejects fractional values", () => {
    expect(safeParse(AccountSyncWarningSchema, retryScheduledWarning).success).toBe(true);
    expect(
      safeParse(AccountSyncWarningSchema, {
        ...retryScheduledWarning,
        retry_in_seconds: 1.5,
      }).success,
    ).toBe(false);
  });

  it("accepts backend null retry metadata for generic warnings", () => {
    expect(
      safeParse(AccountSyncWarningSchema, {
        ...retryScheduledWarning,
        kind: "generic",
        retry_at: null,
        retry_in_seconds: null,
      }).success,
    ).toBe(true);
  });

  it("rejects negative or non-finite retry seconds", () => {
    expect(
      safeParse(AccountSyncWarningSchema, {
        ...retryScheduledWarning,
        retry_in_seconds: -1,
      }).success,
    ).toBe(false);
    expect(
      safeParse(AccountSyncWarningSchema, {
        ...retryScheduledWarning,
        retry_in_seconds: Number.POSITIVE_INFINITY,
      }).success,
    ).toBe(false);
  });
});

describe("SyncResultSchema", () => {
  const syncResult = {
    synced: false,
    total: 1,
    succeeded: 0,
    failed: [
      {
        account_id: "acc-1",
        account_name: "FreshRSS",
        message: "Network error",
      },
    ],
    warnings: [
      {
        account_id: "acc-2",
        account_name: "Local",
        message: "Retry scheduled",
      },
    ],
  };

  it.each([
    ["failed", "message", ""],
    ["failed", "message", "   "],
    ["warnings", "message", ""],
    ["warnings", "message", "   "],
  ] as const)("rejects blank %s account %s before display", (collection, field, value) => {
    expect(
      safeParse(SyncResultSchema, {
        ...syncResult,
        [collection]: [{ ...syncResult[collection][0], [field]: value }],
      }).success,
    ).toBe(false);
  });

  it.each([
    ["failed", ""],
    ["failed", "   "],
    ["warnings", ""],
    ["warnings", "   "],
  ] as const)("accepts blank %s account names so display can fall back to account id", (collection, value) => {
    const result = safeParse(SyncResultSchema, {
      ...syncResult,
      [collection]: [{ ...syncResult[collection][0], account_name: value }],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected blank account names to parse");
    }
    expect(result.output[collection][0]?.account_name).toBe("");
  });

  it("accepts account, feed, credential, and scheduler issue owners", () => {
    const result = safeParse(SyncResultSchema, {
      ...syncResult,
      total: 3,
      failed: [
        { ...syncResult.failed[0], action_owner: "account" },
        { ...syncResult.failed[0], action_owner: "feed" },
        { ...syncResult.failed[0], action_owner: "credential" },
      ],
      warnings: [
        { ...syncResult.warnings[0], action_owner: "scheduler" },
        { ...syncResult.warnings[0], action_owner: "feed" },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects unknown issue owners before feedback aggregation", () => {
    expect(
      safeParse(SyncResultSchema, {
        ...syncResult,
        failed: [{ ...syncResult.failed[0], action_owner: "article" }],
      }).success,
    ).toBe(false);
    expect(
      safeParse(SyncResultSchema, {
        ...syncResult,
        warnings: [{ ...syncResult.warnings[0], action_owner: "mutation" }],
      }).success,
    ).toBe(false);
  });

  it("requires total to match succeeded plus failed account count", () => {
    expect(
      safeParse(SyncResultSchema, {
        ...syncResult,
        total: 2,
        succeeded: 1,
      }).success,
    ).toBe(true);
    expect(
      safeParse(SyncResultSchema, {
        ...syncResult,
        total: 3,
        succeeded: 1,
      }).success,
    ).toBe(false);
    expect(
      safeParse(SyncResultSchema, {
        ...syncResult,
        total: 1,
        succeeded: 1,
      }).success,
    ).toBe(false);
  });
});
