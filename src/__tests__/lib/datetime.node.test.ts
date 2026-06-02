import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";
import {
  compareDateInputsAsc,
  createLocalDateTime,
  differenceInDays,
  formatHourMinute,
  formatLocalHourMinute,
  formatLongDate,
  formatMediumDate,
  formatMediumDateOrDash,
  formatShortDate,
  formatShortDateTime,
  getDateInputTimeMs,
  parseDateInput,
  parseDateInputResult,
  resolveDateTimeLocale,
} from "@/lib/datetime";

describe("datetime helpers", () => {
  it("returns typed parse results for valid and invalid date inputs", () => {
    const parsed = parseDateInputResult("2026-05-01T10:30:00Z");

    expect(Result.isSuccess(parsed)).toBe(true);
    expect(Result.unwrap(parsed)).toEqual(new Date("2026-05-01T10:30:00Z"));
    expect(Result.unwrapError(parseDateInputResult(undefined))).toBe("missing_value");
    expect(Result.unwrapError(parseDateInputResult("not-a-date"))).toBe("invalid_date");
  });

  it("returns null for missing and invalid date inputs", () => {
    expect(parseDateInput(undefined)).toBeNull();
    expect(parseDateInput("not-a-date")).toBeNull();
  });

  it("formats valid medium dates and preserves invalid fallback behavior", () => {
    expect(formatMediumDate("2026-05-01T10:30:00Z", "en-US")).toBeTruthy();
    expect(formatMediumDate("not-a-date", "en-US")).toBeNull();
    expect(formatMediumDateOrDash("not-a-date", "en-US")).toBe("—");
  });

  it("keeps invalid comparisons neutral", () => {
    expect(compareDateInputsAsc("2026-05-01T10:30:00Z", "not-a-date")).toBe(0);
    expect(compareDateInputsAsc("not-a-date", "2026-05-01T10:30:00Z")).toBe(0);
  });

  it("returns the timestamp for valid date inputs", () => {
    expect(getDateInputTimeMs("2026-05-01T10:30:00Z")).toBe(new Date("2026-05-01T10:30:00Z").getTime());
    expect(getDateInputTimeMs("not-a-date")).toBeNull();
  });

  it("creates a local date time from a base date", () => {
    const date = createLocalDateTime(new Date(2026, 4, 1, 23, 59), 8, 5);

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(4);
    expect(date.getDate()).toBe(1);
    expect(date.getHours()).toBe(8);
    expect(date.getMinutes()).toBe(5);
  });

  it("formats local hour and minute with leading zeroes", () => {
    expect(formatLocalHourMinute(new Date(2026, 4, 1, 8, 5))).toBe("08:05");
    expect(formatLocalHourMinute(new Date(2026, 4, 1, 0, 0))).toBe("00:00");
    expect(formatLocalHourMinute(new Date(2026, 4, 1, 12, 30))).toBe("12:30");
    expect(formatLocalHourMinute("not-a-date")).toBeNull();
  });

  it("keeps the fixed local hour-minute formatter off the date-fns format graph", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/datetime.ts"), "utf8");

    expect(source).not.toContain("format,");
    expect(source).not.toContain('format(date, "HH:mm")');
  });

  it("formats locale hour and minute with invalid fallbacks", () => {
    const value = "2026-05-01T08:05:00";

    expect(formatHourMinute(value, "en-US")).toBe(
      new Date(value).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    );
    expect(formatHourMinute("not-a-date", "en-US")).toBeNull();
  });

  it("formats short dates and date-times with invalid fallbacks", () => {
    const value = "2026-05-01T10:30:00Z";

    expect(formatShortDate(value, "en-US")).toBeTruthy();
    expect(formatShortDateTime(value, "en-US")).toBeTruthy();
    expect(formatShortDate("not-a-date", "en-US")).toBeNull();
    expect(formatShortDateTime("not-a-date", "en-US")).toBeNull();
  });

  it("formats long dates with invalid fallbacks", () => {
    expect(formatLongDate("2026-05-01T10:30:00Z", "en-US")).toContain("2026");
    expect(formatLongDate("not-a-date", "en-US")).toBeNull();
  });

  it("falls back to the default locale for malformed locale tags", () => {
    const value = "2026-05-01T10:30:00Z";
    const malformedLocale = "en_US";

    expect(formatHourMinute(value, malformedLocale)).toBe(formatHourMinute(value));
    expect(formatShortDate(value, malformedLocale)).toBe(formatShortDate(value));
    expect(formatShortDateTime(value, malformedLocale)).toBe(formatShortDateTime(value));
    expect(formatLongDate(value, malformedLocale)).toBe(formatLongDate(value));
    expect(formatMediumDate(value, malformedLocale)).toBe(formatMediumDate(value));
  });

  it("resolves supported locales and falls back when Intl locale support rejects the input", () => {
    expect(resolveDateTimeLocale("en-US", "ja")).toBe("en-US");
    expect(resolveDateTimeLocale("en_US", "ja")).toBe("ja");
  });

  it("counts local calendar day boundaries across daylight saving time changes", () => {
    const originalTimezone = process.env.TZ;
    process.env.TZ = "America/New_York";

    try {
      const earlier = new Date(2026, 2, 8);
      const later = new Date(2026, 2, 9);

      expect(differenceInDays(later, earlier)).toBe(1);
    } finally {
      process.env.TZ = originalTimezone;
    }
  });
});
