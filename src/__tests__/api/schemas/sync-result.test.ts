import { safeParse } from "valibot";
import { describe, expect, it } from "vitest";
import { AccountSyncWarningDetailSchema, AccountSyncWarningSchema, SyncResultSchema } from "@/api/schemas/sync-result";

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

describe("AccountSyncWarningDetailSchema", () => {
  const validDetailsByType: Record<string, Record<string, unknown>> = {
    pending_mutation_retry: { type: "pending_mutation_retry", mutation: "mark_read" },
    dropped_pending_mutation: { type: "dropped_pending_mutation", mutation: "star" },
    deleted_greader_folders: { type: "deleted_greader_folders", count: 2 },
    feed_skipped_entries: { type: "feed_skipped_entries", feed_title: "Feed One", count: 1 },
    feed_articles_vanished: { type: "feed_articles_vanished", feed_title: "Feed One", count_before: 3 },
    account_skipped_entries: { type: "account_skipped_entries", account_name: "FreshRSS", count: 1 },
    local_feed_sync_failed: { type: "local_feed_sync_failed", feed_title: "Broken", message: "boom" },
    local_account_sync_operation_failed: {
      type: "local_account_sync_operation_failed",
      operation: "import",
      message: "boom",
    },
    local_import_result: {
      type: "local_import_result",
      conflicted: 1,
      rejected_files: 2,
      rejected_operations: 3,
    },
    startup_repair_marker_failed: { type: "startup_repair_marker_failed", message: "boom" },
    scheduler_load_failed: { type: "scheduler_load_failed", message: "boom" },
    backoff_persist_failed: { type: "backoff_persist_failed", account_name: "FreshRSS", message: "boom" },
    background_sync_retry_scheduled: { type: "background_sync_retry_scheduled", account_name: "FreshRSS" },
  };

  it.each(Object.entries(validDetailsByType))("accepts the %s variant shape", (_type, detail) => {
    const result = safeParse(AccountSyncWarningDetailSchema, detail);
    expect(result.success).toBe(true);
  });

  it("has exactly the 13 variants pinned by the Rust enum", () => {
    expect(Object.keys(validDetailsByType)).toHaveLength(13);
  });

  it("normalizes an unrecognized detail type to null on the warning field", () => {
    const result = safeParse(AccountSyncWarningSchema, {
      ...retryScheduledWarning,
      detail: { type: "some_future_variant_not_yet_known", extra: "value" },
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected unknown detail type to normalize instead of rejecting");
    }
    expect(result.output.detail).toBeNull();
  });

  it("normalizes a missing detail field (older backend) to null", () => {
    const result = safeParse(AccountSyncWarningSchema, retryScheduledWarning);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected missing detail to normalize instead of rejecting");
    }
    expect(result.output.detail).toBeNull();
  });

  it("parses a real detail value on the warning field", () => {
    const result = safeParse(AccountSyncWarningSchema, {
      ...retryScheduledWarning,
      detail: { type: "background_sync_retry_scheduled", account_name: "FreshRSS" },
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error("Expected a valid detail to parse");
    }
    expect(result.output.detail).toEqual({
      type: "background_sync_retry_scheduled",
      account_name: "FreshRSS",
    });
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
