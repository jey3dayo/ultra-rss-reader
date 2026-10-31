import { describe, expect, it } from "vitest";
import {
  compareStorybookAccessibilityViolations,
  getUnknownAccessibilityBaselineStoryIds,
  storybookAccessibilityBaseline,
} from "../../../e2e/storybook/accessibility-baseline";

const baseline = [
  { storyId: "reader--default", ruleId: "color-contrast", reason: "配色の設計を見直す。" },
  { storyId: "internal-debug--default", ruleId: "scrollable-region-focusable", reason: "内部表示の操作性を見直す。" },
];

describe("Storybook accessibility baseline", () => {
  it("accepts only the recorded rule for the audited story", () => {
    expect(compareStorybookAccessibilityViolations("reader--default", [{ id: "color-contrast" }], baseline)).toEqual({
      unexpectedRuleIds: [],
      staleRuleIds: [],
    });
  });

  it("reports new rules even when a story has a recorded violation", () => {
    expect(
      compareStorybookAccessibilityViolations("reader--default", [{ id: "color-contrast" }, { id: "label" }], baseline),
    ).toEqual({ unexpectedRuleIds: ["label"], staleRuleIds: [] });
  });

  it("does not allow a recorded rule in another story", () => {
    expect(compareStorybookAccessibilityViolations("new-story--default", [{ id: "color-contrast" }], baseline)).toEqual(
      {
        unexpectedRuleIds: ["color-contrast"],
        staleRuleIds: [],
      },
    );
  });

  it("reports resolved rules as stale entries that must be removed", () => {
    expect(compareStorybookAccessibilityViolations("reader--default", [], baseline)).toEqual({
      unexpectedRuleIds: [],
      staleRuleIds: ["color-contrast"],
    });
  });

  it("reports baseline entries for stories removed from the static index", () => {
    expect(getUnknownAccessibilityBaselineStoryIds(["reader--default"], baseline)).toEqual(["internal-debug--default"]);
    expect(
      getUnknownAccessibilityBaselineStoryIds(
        baseline.map((entry) => entry.storyId),
        baseline,
      ),
    ).toEqual([]);
  });

  it("accepts clean stories without a baseline", () => {
    expect(compareStorybookAccessibilityViolations("clean-story--default", [], baseline)).toEqual({
      unexpectedRuleIds: [],
      staleRuleIds: [],
    });
  });

  it("limits exceptions to design-dependent contrast and internal or reference stories with Japanese reasons", () => {
    const pairs = storybookAccessibilityBaseline.map((entry) => `${entry.storyId}/${entry.ruleId}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    for (const entry of storybookAccessibilityBaseline) {
      expect(entry.storyId).not.toBe("");
      expect(entry.ruleId).not.toBe("");
      expect(entry.reason).toMatch(/[ぁ-んァ-ン一-龯]/);
      expect(
        entry.ruleId === "color-contrast" ||
          entry.storyId.startsWith("internal-") ||
          entry.storyId.startsWith("ui-reference-"),
      ).toBe(true);
    }
  });
});
