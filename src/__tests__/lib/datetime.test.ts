import { describe, expect, it } from "vitest";
import {
  compareDateInputsAsc,
  createLocalDateTime,
  differenceInDays,
  formatLocalHourMinute,
  formatMediumDate,
  formatShortDate,
  formatShortDateTime,
  getDateInputTimeMs,
  parseDateInput,
} from "@/lib/datetime";

describe("datetime helpers", () => {
  it("returns null for missing and invalid date inputs", () => {
    expect(parseDateInput(undefined)).toBeNull();
    expect(parseDateInput("not-a-date")).toBeNull();
  });

  it("formats valid medium dates and preserves invalid fallback behavior", () => {
    expect(formatMediumDate("2026-05-01T10:30:00Z", "en-US")).toBeTruthy();
    expect(formatMediumDate("not-a-date", "en-US")).toBeNull();
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
    expect(formatLocalHourMinute("not-a-date")).toBeNull();
  });

  it("formats short dates and date-times with invalid fallbacks", () => {
    const value = "2026-05-01T10:30:00Z";

    expect(formatShortDate(value, "en-US")).toBeTruthy();
    expect(formatShortDateTime(value, "en-US")).toBeTruthy();
    expect(formatShortDate("not-a-date", "en-US")).toBeNull();
    expect(formatShortDateTime("not-a-date", "en-US")).toBeNull();
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
