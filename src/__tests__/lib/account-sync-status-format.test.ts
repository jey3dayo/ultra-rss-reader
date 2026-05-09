import { describe, expect, it } from "vitest";
import {
  formatAccountLastSuccessLabel,
  formatAccountSyncRetryDateTime,
  formatAccountSyncRetryTime,
} from "@/lib/account/account-sync-status-format";

describe("account-sync-status-format", () => {
  const formatExpectedLastSuccessLabel = (date: Date, isToday: boolean) => ({
    date: date.toLocaleDateString("en", { month: "short", day: "numeric" }),
    time: date.toLocaleTimeString("en", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    isToday,
  });

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

  it("returns null for missing timestamps", () => {
    expect(formatAccountSyncRetryTime(undefined, "en")).toBeNull();
    expect(formatAccountSyncRetryDateTime(undefined, "en")).toBeNull();
    expect(formatAccountLastSuccessLabel(undefined, "en")).toBeNull();
  });

  it("returns null for invalid timestamps with an injected clock", () => {
    const now = new Date(2026, 3, 13, 12, 0);

    expect(formatAccountSyncRetryTime("not-a-date", "en")).toBeNull();
    expect(formatAccountSyncRetryDateTime("not-a-date", "en")).toBeNull();
    expect(formatAccountLastSuccessLabel("not-a-date", "en", now)).toBeNull();
  });

  it("formats same-day last-success labels with an injected clock", () => {
    const lastSuccessAt = new Date(2026, 3, 13, 3, 15);
    const now = new Date(2026, 3, 13, 12, 0);

    expect(formatAccountLastSuccessLabel(lastSuccessAt.toISOString(), "en", now)).toEqual(
      formatExpectedLastSuccessLabel(lastSuccessAt, true),
    );
  });

  it("formats previous-day last-success labels with an injected clock", () => {
    const lastSuccessAt = new Date(2026, 3, 12, 23, 15);
    const now = new Date(2026, 3, 13, 0, 30);

    expect(formatAccountLastSuccessLabel(lastSuccessAt.toISOString(), "en", now)).toEqual(
      formatExpectedLastSuccessLabel(lastSuccessAt, false),
    );
  });
});
