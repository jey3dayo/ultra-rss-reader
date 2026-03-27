import { describe, expect, it } from "vitest";
import { applyBionicReading } from "@/lib/bionic-reading";

describe("applyBionicReading", () => {
  it("bolds the first part of each word", () => {
    const result = applyBionicReading("Hello world", 3);
    expect(result).toContain("<b>");
    expect(result).toContain("</b>");
  });

  it("preserves HTML tags", () => {
    const result = applyBionicReading("<p>Hello world</p>", 3);
    expect(result).toMatch(/^<p>.*<\/p>$/);
  });

  it("handles single character words", () => {
    const result = applyBionicReading("I am a test", 3);
    expect(result).toContain("<b>I</b>");
    expect(result).toContain("<b>a</b>");
  });

  it("higher fixation bolds more characters", () => {
    const word = "Reading";
    const low = applyBionicReading(word, 1);
    const high = applyBionicReading(word, 5);
    const lowBold = low.match(/<b>(.*?)<\/b>/)?.[1] ?? "";
    const highBold = high.match(/<b>(.*?)<\/b>/)?.[1] ?? "";
    expect(highBold.length).toBeGreaterThan(lowBold.length);
  });

  it("returns original text when empty", () => {
    expect(applyBionicReading("", 3)).toBe("");
  });

  it("handles accented characters", () => {
    const result = applyBionicReading("café über naïve", 3);
    const boldParts = result.match(/<b>.*?<\/b>/g) ?? [];
    expect(boldParts.length).toBe(3);
    // café (4 chars, 50% = 2) → <b>ca</b>fé
    expect(result).toContain("<b>ca</b>fé");
    // über (4 chars, 50% = 2) → <b>üb</b>er
    expect(result).toContain("<b>üb</b>er");
    // naïve (5 chars, 50% = 3) → <b>naï</b>ve
    expect(result).toContain("<b>naï</b>ve");
  });
});
