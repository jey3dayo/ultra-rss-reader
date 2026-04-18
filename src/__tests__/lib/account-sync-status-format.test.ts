import { describe, expect, it } from "vitest";
import {
  formatAccountLastSuccessLabel,
  formatAccountSyncRetryDateTime,
  formatAccountSyncRetryTime,
} from "@/lib/account-sync-status-format";

describe("account-sync-status-format", () => {
  it("formats retry times with hour and minute precision", () => {
    const retryAt = "2026-04-13T03:15:00Z";

    expect(formatAccountSyncRetryTime(retryAt, "en")).toBe(
      new Date(retryAt).toLocaleTimeString("en", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    );
  });

  it("formats retry date-times for settings display", () => {
    const retryAt = "2026-04-13T03:15:00Z";

    expect(formatAccountSyncRetryDateTime(retryAt, "en")).toBe(
      new Date(retryAt).toLocaleString("en", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    );
  });

  it("returns null for missing or invalid timestamps", () => {
    expect(formatAccountSyncRetryTime(undefined, "en")).toBeNull();
    expect(formatAccountSyncRetryDateTime(undefined, "en")).toBeNull();
    expect(formatAccountLastSuccessLabel(undefined, "en")).toBeNull();
    expect(formatAccountSyncRetryTime("not-a-date", "en")).toBeNull();
    expect(formatAccountSyncRetryDateTime("not-a-date", "en")).toBeNull();
    expect(formatAccountLastSuccessLabel("not-a-date", "en")).toBeNull();
  });

  it("formats last-success labels with date, time, and today flag", () => {
    const localTimestamp = "2026-04-13T03:15:00";

    expect(formatAccountLastSuccessLabel(localTimestamp, "en")).toEqual({
      date: new Date(localTimestamp).toLocaleDateString("en", { month: "short", day: "numeric" }),
      time: new Date(localTimestamp).toLocaleTimeString("en", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      isToday: false,
    });
  });
});
