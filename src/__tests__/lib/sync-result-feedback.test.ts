import { describe, expect, it } from "vitest";
import { getSyncWarningAccountNames, summarizeSyncResult, summarizeSyncWarnings } from "@/lib/sync-result-feedback";

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
          { account_id: "acc-2", account_name: "FreshRSS", message: "boom again" },
        ],
        warnings: [{ account_id: "acc-3", account_name: "Local", message: "warn" }],
      }),
    ).toEqual({ kind: "partial-failure", accounts: "FreshRSS" });
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

  it("prefers retry-pending when warnings include a queued retry", () => {
    expect(
      summarizeSyncResult({
        synced: true,
        total: 1,
        succeeded: 1,
        failed: [],
        warnings: [{ account_id: "acc-1", account_name: "FreshRSS", message: "Retry later", kind: "retry_pending" }],
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

  it("summarizes warning payloads for event-driven retry notifications", () => {
    expect(
      summarizeSyncWarnings([
        { account_id: "acc-1", account_name: "FreshRSS", message: "Retry later", kind: "retry_pending" },
        { account_id: "acc-2", account_name: "Local", message: "warn 2" },
      ]),
    ).toEqual({ kind: "retry-pending", accounts: "FreshRSS, Local" });
  });
});
