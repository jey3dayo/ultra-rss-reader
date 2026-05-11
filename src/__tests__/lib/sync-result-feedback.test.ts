import { describe, expect, it } from "vitest";
import {
  getSyncIssueDiagnosticsDetails,
  getSyncWarningAccountNames,
  resolveSyncFeedbackMessage,
  type SyncFeedbackPublicCopy,
  summarizeSyncResult,
  summarizeSyncWarnings,
} from "@/lib/sync/sync-result-feedback";

const jaPublicCopy = {
  unknownAccountLabel: "不明なアカウント",
  actionOwnerLabels: {
    credential: "認証情報",
    feed: "フィード",
    scheduler: "スケジューラー",
  },
} satisfies SyncFeedbackPublicCopy;

describe("sync-result-feedback", () => {
  it("summarizes an already-running sync", () => {
    expect(
      summarizeSyncResult({
        synced: false,
        total: 0,
        succeeded: 0,
        failed: [],
        warnings: [],
      }),
    ).toEqual({ kind: "already-in-progress" });
  });

  it("prefers partial failure over warnings and deduplicates account names", () => {
    expect(
      summarizeSyncResult({
        synced: true,
        total: 3,
        succeeded: 1,
        failed: [
          { account_id: "acc-1", account_name: "FreshRSS", message: "boom" },
          {
            account_id: "acc-2",
            account_name: "FreshRSS",
            message: "boom again",
          },
        ],
        warnings: [{ account_id: "acc-3", account_name: "Local", message: "warn" }],
      }),
    ).toEqual({ kind: "partial-failure", accounts: "FreshRSS" });
  });

  it("shows duplicate failed account names once", () => {
    expect(
      summarizeSyncResult({
        synced: true,
        total: 4,
        succeeded: 1,
        failed: [
          { account_id: "acc-1", account_name: "FreshRSS", message: "boom" },
          {
            account_id: "acc-2",
            account_name: "FreshRSS",
            message: "boom again",
          },
          { account_id: "acc-3", account_name: "Local", message: "local boom" },
          {
            account_id: "acc-4",
            account_name: "Local",
            message: "local boom again",
          },
        ],
        warnings: [],
      }),
    ).toEqual({ kind: "partial-failure", accounts: "FreshRSS, Local" });
  });

  it("uses public fallback copy for blank failed account names while preserving duplicate name dedupe", () => {
    expect(
      summarizeSyncResult({
        synced: true,
        total: 4,
        succeeded: 0,
        failed: [
          { account_id: "acc-1", account_name: "FreshRSS", message: "boom" },
          { account_id: "acc-2", account_name: "", message: "missing name" },
          { account_id: "acc-3", account_name: "   ", message: "blank name" },
          {
            account_id: "acc-4",
            account_name: "FreshRSS",
            message: "boom again",
          },
        ],
        warnings: [],
      }),
    ).toEqual({
      kind: "partial-failure",
      accounts: "FreshRSS, Unknown account",
    });
  });

  it("trims failed account names before projecting them to feedback text", () => {
    expect(
      summarizeSyncResult({
        synced: true,
        total: 3,
        succeeded: 0,
        failed: [
          {
            account_id: "acc-1",
            account_name: "  FreshRSS  ",
            message: "boom",
          },
          {
            account_id: "acc-2",
            account_name: "FreshRSS",
            message: "boom again",
          },
          {
            account_id: "acc-3",
            account_name: "  Local",
            message: "local boom",
          },
        ],
        warnings: [],
      }),
    ).toEqual({ kind: "partial-failure", accounts: "FreshRSS, Local" });
  });

  it("summarizes warning-only sync results", () => {
    expect(
      summarizeSyncResult({
        synced: true,
        total: 2,
        succeeded: 2,
        failed: [],
        warnings: [
          { account_id: "acc-1", account_name: "FreshRSS", message: "warn 1" },
          { account_id: "acc-2", account_name: "Local", message: "warn 2" },
        ],
      }),
    ).toEqual({ kind: "warnings", accounts: "FreshRSS, Local" });
  });

  it("deduplicates account names for warning-only sync results", () => {
    expect(
      summarizeSyncResult({
        synced: true,
        total: 2,
        succeeded: 2,
        failed: [],
        warnings: [
          { account_id: "acc-1", account_name: "FreshRSS", message: "warn 1" },
          { account_id: "acc-2", account_name: "FreshRSS", message: "warn 2" },
        ],
      }),
    ).toEqual({ kind: "warnings", accounts: "FreshRSS" });
  });

  it("keeps warning aggregation distinct by account and action owner", () => {
    expect(
      summarizeSyncResult({
        synced: true,
        total: 4,
        succeeded: 4,
        failed: [],
        warnings: [
          {
            account_id: "acc-1",
            account_name: "FreshRSS",
            action_owner: "feed",
            message: "Feed skipped",
          },
          {
            account_id: "acc-1",
            account_name: "FreshRSS",
            action_owner: "feed",
            message: "Feed skipped",
          },
          {
            account_id: "acc-1",
            account_name: "FreshRSS",
            action_owner: "credential",
            message: "Credential refresh failed",
          },
          {
            account_id: "scheduler",
            account_name: "Scheduler",
            action_owner: "scheduler",
            message: "Background scheduler skipped",
          },
        ],
      }),
    ).toEqual({
      kind: "warnings",
      accounts: "FreshRSS (feed), FreshRSS (credentials), Scheduler (scheduler)",
    });
  });

  it("keeps failed aggregation distinct for feed-level and credential errors", () => {
    expect(
      summarizeSyncResult({
        synced: true,
        total: 3,
        succeeded: 1,
        failed: [
          {
            account_id: "acc-1",
            account_name: "FreshRSS",
            action_owner: "feed",
            message: "Feed failed",
          },
          {
            account_id: "acc-1",
            account_name: "FreshRSS",
            action_owner: "credential",
            message: "Credential failed",
          },
          {
            account_id: "acc-1",
            account_name: "FreshRSS",
            action_owner: "feed",
            message: "Another feed failed",
          },
        ],
        warnings: [],
      }),
    ).toEqual({
      kind: "partial-failure",
      accounts: "FreshRSS (feed), FreshRSS (credentials)",
    });
  });

  it("truncates long warning account lists after grouping by action owner", () => {
    expect(
      summarizeSyncWarnings([
        { account_id: "acc-1", account_name: "Account 1", message: "warn 1" },
        {
          account_id: "acc-2",
          account_name: "Account 2",
          action_owner: "feed",
          message: "warn 2",
        },
        { account_id: "acc-3", account_name: "Account 3", message: "warn 3" },
        {
          account_id: "acc-4",
          account_name: "Account 4",
          action_owner: "credential",
          message: "warn 4",
        },
        { account_id: "acc-5", account_name: "Account 5", message: "warn 5" },
      ]),
    ).toEqual({
      kind: "warnings",
      accounts: "Account 1, Account 2 (feed), Account 3, Account 4 (credentials) +1 more",
    });
  });

  it("keeps many-account failure order stable and caps visible labels", () => {
    expect(
      summarizeSyncResult({
        synced: true,
        total: 6,
        succeeded: 0,
        failed: [
          {
            account_id: "acc-1",
            account_name: "Auth Account",
            action_owner: "credential",
            message: "auth",
          },
          {
            account_id: "acc-2",
            account_name: "Parse Feed",
            action_owner: "feed",
            message: "parse",
          },
          {
            account_id: "acc-3",
            account_name: "Account 3",
            message: "account",
          },
          {
            account_id: "acc-2",
            account_name: "Parse Feed",
            action_owner: "feed",
            message: "parse again",
          },
          {
            account_id: "acc-4",
            account_name: "Account 4",
            message: "account 4",
          },
          {
            account_id: "acc-5",
            account_name: "Account 5",
            message: "account 5",
          },
        ],
        warnings: [
          {
            account_id: "acc-warning",
            account_name: "Warning",
            message: "warn",
          },
        ],
      }),
    ).toEqual({
      kind: "partial-failure",
      accounts: "Auth Account (credentials), Parse Feed (feed), Account 3, Account 4 +1 more",
    });
  });

  it("prefers retry-pending when warnings include a queued retry", () => {
    expect(
      summarizeSyncResult({
        synced: true,
        total: 1,
        succeeded: 1,
        failed: [],
        warnings: [
          {
            account_id: "acc-1",
            account_name: "FreshRSS",
            message: "Retry later",
            kind: "retry_pending",
          },
        ],
      }),
    ).toEqual({ kind: "retry-pending", accounts: "FreshRSS" });
  });

  it("extracts distinct warning account names", () => {
    expect(
      getSyncWarningAccountNames([
        { account_id: "acc-1", account_name: "FreshRSS", message: "warn 1" },
        { account_id: "acc-2", account_name: "FreshRSS", message: "warn 2" },
        { account_id: "acc-3", account_name: "Local", message: "warn 3" },
      ]),
    ).toBe("FreshRSS, Local");
  });

  it("uses public fallback copy for blank warning account names", () => {
    expect(
      getSyncWarningAccountNames([
        { account_id: "acc-1", account_name: "", message: "warn 1" },
        { account_id: "acc-2", account_name: "  ", message: "warn 2" },
        { account_id: "acc-3", account_name: "Local", message: "warn 3" },
      ]),
    ).toBe("Unknown account, Local");
  });

  it("keeps blank account ids out of public feedback while retaining diagnostics details", () => {
    const warnings = [
      {
        account_id: "acc-deleted-1",
        account_name: "",
        message: "Deleted account cannot be synced",
      },
      {
        account_id: "scheduler",
        account_name: "   ",
        action_owner: "scheduler",
        message: "Scheduler skipped",
      },
    ] as const;

    expect(getSyncWarningAccountNames([...warnings])).toBe("Unknown account, Unknown account (scheduler)");
    expect(getSyncIssueDiagnosticsDetails([...warnings])).toEqual([
      {
        accountId: "acc-deleted-1",
        accountName: null,
        actionOwner: "account",
      },
      {
        accountId: "scheduler",
        accountName: null,
        actionOwner: "scheduler",
      },
    ]);
  });

  it("keeps provider remote entry ids out of public warning copy", () => {
    expect(
      summarizeSyncWarnings([
        {
          account_id: "acc-1",
          account_name: "FreshRSS",
          action_owner: "feed",
          kind: "retry_pending",
          message: "Pending mutation for remote_entry_id=https://reader.example.test/token/secret-entry-id",
        },
      ]),
    ).toEqual({
      kind: "retry-pending",
      accounts: "FreshRSS (feed)",
    });
  });

  it("uses supplied public copy for unknown accounts and action owner labels", () => {
    expect(
      summarizeSyncWarnings(
        [
          {
            account_id: "acc-1",
            account_name: "",
            action_owner: "credential",
            message: "Credential refresh failed",
          },
          {
            account_id: "acc-2",
            account_name: "FreshRSS",
            action_owner: "feed",
            message: "Feed skipped",
          },
          {
            account_id: "scheduler",
            account_name: "Scheduler",
            action_owner: "scheduler",
            message: "Background scheduler skipped",
          },
        ],
        jaPublicCopy,
      ),
    ).toEqual({
      kind: "warnings",
      accounts: "不明なアカウント (認証情報), FreshRSS (フィード), Scheduler (スケジューラー)",
    });
  });

  it("summarizes warning payloads for event-driven retry notifications", () => {
    expect(
      summarizeSyncWarnings([
        {
          account_id: "acc-1",
          account_name: "FreshRSS",
          message: "Retry later",
          kind: "retry_pending",
        },
        { account_id: "acc-2", account_name: "Local", message: "warn 2" },
      ]),
    ).toEqual({ kind: "retry-pending", accounts: "FreshRSS, Local" });
  });

  it("keeps empty warning output copy unchanged", () => {
    expect(summarizeSyncWarnings([])).toEqual({
      kind: "warnings",
      accounts: "",
    });
  });

  it("prefers scheduled retries over other warning kinds", () => {
    expect(
      summarizeSyncWarnings([
        {
          account_id: "acc-1",
          account_name: "FreshRSS",
          message: "Retry scheduled",
          kind: "retry_scheduled",
          retry_at: "2026-04-13T03:15:00Z",
          retry_in_seconds: 120,
        },
        {
          account_id: "acc-2",
          account_name: "Local",
          message: "Retry later",
          kind: "retry_pending",
        },
      ]),
    ).toEqual({
      kind: "retry-scheduled",
      accounts: "FreshRSS, Local",
      retryAt: "2026-04-13T03:15:00Z",
      retryInSeconds: 120,
    });
  });

  it("chooses the earliest scheduled retry warning", () => {
    expect(
      summarizeSyncWarnings([
        {
          account_id: "acc-1",
          account_name: "FreshRSS",
          message: "Retry later",
          kind: "retry_scheduled",
          retry_at: "2026-04-13T03:20:00Z",
          retry_in_seconds: 300,
        },
        {
          account_id: "acc-2",
          account_name: "Local",
          message: "Retry sooner",
          kind: "retry_scheduled",
          retry_at: "2026-04-13T03:16:00Z",
          retry_in_seconds: 60,
        },
      ]),
    ).toEqual({
      kind: "retry-scheduled",
      accounts: "FreshRSS, Local",
      retryAt: "2026-04-13T03:16:00Z",
      retryInSeconds: 60,
    });
  });

  it("keeps scheduled retry output copy unchanged across multiple timestamps", () => {
    const feedback = summarizeSyncWarnings([
      {
        account_id: "acc-1",
        account_name: "FreshRSS",
        message: "Retry later",
        kind: "retry_scheduled",
        retry_at: "2026-04-13T03:20:00Z",
        retry_in_seconds: 300,
      },
      {
        account_id: "acc-2",
        account_name: "Local",
        message: "Retry sooner",
        kind: "retry_scheduled",
        retry_at: "2026-04-13T03:16:00Z",
        retry_in_seconds: 60,
      },
    ]);

    expect(
      resolveSyncFeedbackMessage(feedback, {
        alreadyInProgress: "already running",
        partialFailure: (accounts) => `partial:${accounts}`,
        retryScheduled: (accounts, retryAt, retryInSeconds) => `scheduled:${accounts}:${retryAt}:${retryInSeconds}`,
        retryPending: (accounts) => `pending:${accounts}`,
        warnings: (accounts) => `warnings:${accounts}`,
        success: "done",
      }),
    ).toBe("scheduled:FreshRSS, Local:2026-04-13T03:16:00Z:60");
  });

  it("keeps first scheduled retry output copy when retry seconds are equal", () => {
    const feedback = summarizeSyncWarnings([
      {
        account_id: "acc-1",
        account_name: "FreshRSS",
        message: "Retry first",
        kind: "retry_scheduled",
        retry_at: "2026-04-13T03:16:00Z",
        retry_in_seconds: 60,
      },
      {
        account_id: "acc-2",
        account_name: "Local",
        message: "Retry same time",
        kind: "retry_scheduled",
        retry_at: "2026-04-13T03:17:00Z",
        retry_in_seconds: 60,
      },
    ]);

    expect(
      resolveSyncFeedbackMessage(feedback, {
        alreadyInProgress: "already running",
        partialFailure: (accounts) => `partial:${accounts}`,
        retryScheduled: (accounts, retryAt, retryInSeconds) => `scheduled:${accounts}:${retryAt}:${retryInSeconds}`,
        retryPending: (accounts) => `pending:${accounts}`,
        warnings: (accounts) => `warnings:${accounts}`,
        success: "done",
      }),
    ).toBe("scheduled:FreshRSS, Local:2026-04-13T03:16:00Z:60");
  });

  it("uses scheduled retry warnings with missing retry seconds after timed warnings", () => {
    expect(
      summarizeSyncWarnings([
        {
          account_id: "acc-1",
          account_name: "FreshRSS",
          message: "Retry scheduled",
          kind: "retry_scheduled",
          retry_at: "2026-04-13T03:20:00Z",
        },
        {
          account_id: "acc-2",
          account_name: "Local",
          message: "Retry sooner",
          kind: "retry_scheduled",
          retry_at: "2026-04-13T03:17:00Z",
          retry_in_seconds: 90,
        },
      ]),
    ).toEqual({
      kind: "retry-scheduled",
      accounts: "FreshRSS, Local",
      retryAt: "2026-04-13T03:17:00Z",
      retryInSeconds: 90,
    });
  });

  it("uses scheduled retry warnings with missing retry seconds last", () => {
    expect(
      summarizeSyncWarnings([
        {
          account_id: "acc-1",
          account_name: "FreshRSS",
          message: "Retry sooner",
          kind: "retry_scheduled",
          retry_at: "2026-04-13T03:18:00Z",
          retry_in_seconds: 120,
        },
        {
          account_id: "acc-2",
          account_name: "Local",
          message: "Retry scheduled",
          kind: "retry_scheduled",
          retry_at: "2026-04-13T03:17:00Z",
        },
        {
          account_id: "acc-3",
          account_name: "Other",
          message: "Retry earliest",
          kind: "retry_scheduled",
          retry_at: "2026-04-13T03:16:00Z",
          retry_in_seconds: 60,
        },
      ]),
    ).toEqual({
      kind: "retry-scheduled",
      accounts: "FreshRSS, Local, Other",
      retryAt: "2026-04-13T03:16:00Z",
      retryInSeconds: 60,
    });
  });

  it("resolves retry-scheduled messages with retry metadata", () => {
    expect(
      resolveSyncFeedbackMessage(
        {
          kind: "retry-scheduled",
          accounts: "FreshRSS, Local",
          retryAt: "2026-04-13T03:15:00Z",
          retryInSeconds: 120,
        },
        {
          alreadyInProgress: "already running",
          partialFailure: (accounts) => `partial:${accounts}`,
          retryScheduled: (accounts, retryAt, retryInSeconds) => `scheduled:${accounts}:${retryAt}:${retryInSeconds}`,
          retryPending: (accounts) => `pending:${accounts}`,
          warnings: (accounts) => `warnings:${accounts}`,
          success: "done",
        },
      ),
    ).toBe("scheduled:FreshRSS, Local:2026-04-13T03:15:00Z:120");
  });

  it("resolves success messages without account interpolation", () => {
    expect(
      resolveSyncFeedbackMessage(
        { kind: "success" },
        {
          alreadyInProgress: "already running",
          partialFailure: (accounts) => `partial:${accounts}`,
          retryScheduled: (accounts, retryAt, retryInSeconds) => `scheduled:${accounts}:${retryAt}:${retryInSeconds}`,
          retryPending: (accounts) => `pending:${accounts}`,
          warnings: (accounts) => `warnings:${accounts}`,
          success: "done",
        },
      ),
    ).toBe("done");
  });

  it("resolves partial failure messages with failed account names", () => {
    expect(
      resolveSyncFeedbackMessage(
        { kind: "partial-failure", accounts: "FreshRSS, Local" },
        {
          alreadyInProgress: "already running",
          partialFailure: (accounts) => `partial:${accounts}`,
          retryScheduled: (accounts, retryAt, retryInSeconds) => `scheduled:${accounts}:${retryAt}:${retryInSeconds}`,
          retryPending: (accounts) => `pending:${accounts}`,
          warnings: (accounts) => `warnings:${accounts}`,
          success: "done",
        },
      ),
    ).toBe("partial:FreshRSS, Local");
  });
});
