import { describe, expect, it } from "vitest";
import {
  formatAccountLastSuccessLabel,
  formatAccountSyncRetryDateTime,
  formatAccountSyncRetryTime,
  getAccountSyncErrorTranslationKey,
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

  describe("getAccountSyncErrorTranslationKey", () => {
    it.each([
      ["Network error: timeout", "network", "timeout"],
      ["Rate limit error: HTTP 429", "rate_limit", "HTTP 429"],
      ["Parse error: invalid feed", "parse", "invalid feed"],
      ["Persistence error: database locked", "persistence", "database locked"],
      ["Auth error: unauthorized", "auth", "unauthorized"],
      ["Validation error: invalid URL", "validation", "invalid URL"],
      ["Keychain error: access denied", "keychain", "access denied"],
      ["Migration error: schema mismatch", "migration", "schema mismatch"],
    ])("maps %s to the %s translation key", (lastError, key, message) => {
      expect(getAccountSyncErrorTranslationKey(lastError)).toEqual({
        key,
        params: { message },
      });
    });

    it("trims persisted error text before classifying it", () => {
      expect(getAccountSyncErrorTranslationKey("  Auth error:  unauthorized  ")).toEqual({
        key: "auth",
        params: { message: "unauthorized" },
      });
    });

    it("does not repeat a known error prefix when the persisted detail is empty", () => {
      expect(getAccountSyncErrorTranslationKey("Network error:")).toEqual({
        key: "network",
        params: { message: "" },
      });
    });

    it("returns no translation key for legacy errors without a known prefix", () => {
      expect(getAccountSyncErrorTranslationKey("Connection failed")).toEqual({
        key: null,
        params: { message: "Connection failed" },
      });
    });
  });
});
