import { describe, expect, it } from "vitest";
import { compareDateInputsAsc, differenceInDays, formatMediumDate, parseDateInput } from "@/lib/datetime";

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
