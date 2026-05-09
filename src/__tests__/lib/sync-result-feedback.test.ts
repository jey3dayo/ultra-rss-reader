import { describe, expect, it } from "vitest";
import {
  getSyncWarningAccountNames,
  resolveSyncFeedbackMessage,
  summarizeSyncResult,
  summarizeSyncWarnings,
} from "@/lib/sync/sync-result-feedback";

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

  it("uses account ids for blank failed account names while preserving duplicate name dedupe", () => {
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
    ).toEqual({ kind: "partial-failure", accounts: "FreshRSS, acc-2, acc-3" });
  });

  it("trims failed account names before projecting them to feedback text", () => {
    expect(
      summarizeSyncResult({
        synced: true,
        total: 3,
        succeeded: 0,
        failed: [
          { account_id: "acc-1", account_name: "  FreshRSS  ", message: "boom" },
          { account_id: "acc-2", account_name: "FreshRSS", message: "boom again" },
          { account_id: "acc-3", account_name: "  Local", message: "local boom" },
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

  it("uses account ids for blank warning account names", () => {
    expect(
      getSyncWarningAccountNames([
        { account_id: "acc-1", account_name: "", message: "warn 1" },
        { account_id: "acc-2", account_name: "  ", message: "warn 2" },
        { account_id: "acc-3", account_name: "Local", message: "warn 3" },
      ]),
    ).toBe("acc-1, acc-2, Local");
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
