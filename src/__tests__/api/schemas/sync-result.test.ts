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
    expect(AccountSyncWarningSchema.safeParse(retryScheduledWarning).success).toBe(true);
    expect(AccountSyncWarningSchema.safeParse({ ...retryScheduledWarning, retry_in_seconds: 1.5 }).success).toBe(false);
  });

  it("rejects negative or non-finite retry seconds", () => {
    expect(AccountSyncWarningSchema.safeParse({ ...retryScheduledWarning, retry_in_seconds: -1 }).success).toBe(false);
    expect(
      AccountSyncWarningSchema.safeParse({ ...retryScheduledWarning, retry_in_seconds: Number.POSITIVE_INFINITY })
        .success,
    ).toBe(false);
  });
});

describe("SyncResultSchema", () => {
  const syncResult = {
    synced: false,
    total: 2,
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
    ["failed", "account_name", ""],
    ["failed", "account_name", "   "],
    ["warnings", "account_name", ""],
    ["warnings", "account_name", "   "],
  ] as const)("rejects blank %s account %s before display", (collection, field, value) => {
    expect(
      SyncResultSchema.safeParse({
        ...syncResult,
        [collection]: [{ ...syncResult[collection][0], [field]: value }],
      }).success,
    ).toBe(false);
  });
});
