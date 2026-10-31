import { describe, expect, it } from "vitest";
import {
  compareStorybookAccessibilityViolations,
  getUnknownAccessibilityBaselineStoryIds,
  storybookAccessibilityBaseline,
} from "../../../e2e/storybook/accessibility-baseline";

const baseline = [
  {
    storyId: "reader--default",
    ruleId: "color-contrast",
    nodeCount: 2,
    reason: "配色の設計を見直す。",
  },
  {
    storyId: "internal-debug--default",
    ruleId: "scrollable-region-focusable",
    nodeCount: 1,
    reason: "内部表示の操作性を見直す。",
  },
];

function violation(id: string, nodeCount: number) {
  return { id, nodes: Array.from({ length: nodeCount }) };
}

describe("Storybook accessibility baseline", () => {
  it("accepts the recorded number of nodes for the audited story and rule", () => {
    expect(
      compareStorybookAccessibilityViolations("reader--default", [violation("color-contrast", 2)], baseline),
    ).toEqual({ unexpected: [], stale: [] });
  });

  it("reports additional nodes with story, rule, expected, and actual counts", () => {
    expect(
      compareStorybookAccessibilityViolations("reader--default", [violation("color-contrast", 3)], baseline),
    ).toEqual({
      unexpected: [
        {
          storyId: "reader--default",
          ruleId: "color-contrast",
          expected: 2,
          actual: 3,
        },
      ],
      stale: [],
    });
  });

  it("reports fewer nodes as a stale baseline count", () => {
    expect(
      compareStorybookAccessibilityViolations("reader--default", [violation("color-contrast", 1)], baseline),
    ).toEqual({
      unexpected: [],
      stale: [
        {
          storyId: "reader--default",
          ruleId: "color-contrast",
          expected: 2,
          actual: 1,
        },
      ],
    });
  });

  it("reports a missing recorded rule with an actual count of zero", () => {
    expect(compareStorybookAccessibilityViolations("reader--default", [], baseline)).toEqual({
      unexpected: [],
      stale: [
        {
          storyId: "reader--default",
          ruleId: "color-contrast",
          expected: 2,
          actual: 0,
        },
      ],
    });
  });

  it("reports new rules against an expected count of zero", () => {
    expect(
      compareStorybookAccessibilityViolations(
        "reader--default",
        [violation("color-contrast", 2), violation("label", 1)],
        baseline,
      ),
    ).toEqual({
      unexpected: [{ storyId: "reader--default", ruleId: "label", expected: 0, actual: 1 }],
      stale: [],
    });
  });

  it("does not allow a recorded rule in another story", () => {
    expect(
      compareStorybookAccessibilityViolations("new-story--default", [violation("color-contrast", 1)], baseline),
    ).toEqual({
      unexpected: [
        {
          storyId: "new-story--default",
          ruleId: "color-contrast",
          expected: 0,
          actual: 1,
        },
      ],
      stale: [],
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
      unexpected: [],
      stale: [],
    });
  });

  it("limits exceptions to design-dependent contrast and internal or reference stories with Japanese reasons", () => {
    const pairs = storybookAccessibilityBaseline.map((entry) => `${entry.storyId}/${entry.ruleId}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    for (const entry of storybookAccessibilityBaseline) {
      expect(entry.storyId).not.toBe("");
      expect(entry.ruleId).not.toBe("");
      expect(Number.isSafeInteger(entry.nodeCount) && entry.nodeCount > 0).toBe(true);
      expect(entry.reason).toMatch(/[ぁ-んァ-ン一-龯]/);
      expect(
        entry.ruleId === "color-contrast" ||
          entry.storyId.startsWith("internal-") ||
          entry.storyId.startsWith("ui-reference-"),
      ).toBe(true);
    }
  });
});
