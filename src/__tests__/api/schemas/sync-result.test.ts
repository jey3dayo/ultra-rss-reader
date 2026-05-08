import { describe, expect, it } from "vitest";
import { AccountSyncWarningSchema } from "@/api/schemas/sync-result";

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
