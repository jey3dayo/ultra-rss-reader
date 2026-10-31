export type StorybookAccessibilityBaselineEntry = {
  storyId: string;
  ruleId: string;
  nodeCount: number;
  reason: string;
};

export type StorybookAccessibilityRuleDrift = {
  storyId: string;
  ruleId: string;
  expected: number;
  actual: number;
};

export const storybookAccessibilityBaseline: readonly StorybookAccessibilityBaselineEntry[] = [
  {
    storyId: "internal-review-sidebarselectionreview--default",
    ruleId: "color-contrast",
    nodeCount: 16,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "reader-article-articlecontentview--worst-case-article-typography",
    ruleId: "color-contrast",
    nodeCount: 1,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "reader-article-articletoolbarview--mobile-preview-open",
    ruleId: "color-contrast",
    nodeCount: 1,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "reader-article-list-articlelistscreenview--dense-narrow-viewport",
    ruleId: "color-contrast",
    nodeCount: 6,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "reader-article-list-articlelistscreenview--selected-japanese-unread-with-scrollbar",
    ruleId: "color-contrast",
    nodeCount: 6,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "reader-article-list-articlelistscreenview--selected-japanese-unread-with-scrollbar-dark",
    ruleId: "color-contrast",
    nodeCount: 6,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "reader-article-list-articlelistscreenview--selected-japanese-unread-with-scrollbar-light",
    ruleId: "color-contrast",
    nodeCount: 6,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "reader-sidebar-accountswitcherview--collapsed",
    ruleId: "color-contrast",
    nodeCount: 1,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "reader-sidebar-accountswitcherview--expanded",
    ruleId: "color-contrast",
    nodeCount: 1,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "reader-sidebar-accountswitcherview--single-account",
    ruleId: "color-contrast",
    nodeCount: 1,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "reader-sidebar-feedtreeview--folder-reorder-insertion-line",
    ruleId: "color-contrast",
    nodeCount: 1,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "reader-sidebar-feedtreeview--folder-selection-review",
    ruleId: "color-contrast",
    nodeCount: 1,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "reader-sidebar-feedtreeview--selection-priority-review",
    ruleId: "color-contrast",
    nodeCount: 3,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "reader-sidebar-feedtreeview--worst-case-unread-counts",
    ruleId: "color-contrast",
    nodeCount: 1,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "reader-sidebar-taglistview--collapsed",
    ruleId: "color-contrast",
    nodeCount: 1,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "reader-sidebar-taglistview--default",
    ruleId: "color-contrast",
    nodeCount: 1,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "settings-nav-accountsnavview--long-account-labels",
    ruleId: "color-contrast",
    nodeCount: 1,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "settings-section-accountdangerzoneview--default",
    ruleId: "color-contrast",
    nodeCount: 1,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "settings-section-accountdangerzoneview--local-sync-help-open",
    ruleId: "color-contrast",
    nodeCount: 1,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "settings-section-accountdangerzoneview--narrow",
    ruleId: "color-contrast",
    nodeCount: 1,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "settings-shell-settingsmodalview--dense-narrow-viewport",
    ruleId: "color-contrast",
    nodeCount: 1,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "settings-shell-settingsmodalview--save-locked",
    ruleId: "color-contrast",
    nodeCount: 1,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "shared-controls-icontoolbarsurfacebutton--chrome-variant-comparison",
    ruleId: "color-contrast",
    nodeCount: 2,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "shared-feedback-apptoastview--single-action-informational",
    ruleId: "color-contrast",
    nodeCount: 1,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "shared-feedback-apptoastview--update-ready-decision",
    ruleId: "color-contrast",
    nodeCount: 1,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "ui-reference-button-controls-canvas--button-controls-canvas",
    ruleId: "color-contrast",
    nodeCount: 7,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "ui-reference-button-controls-canvas--default",
    ruleId: "color-contrast",
    nodeCount: 7,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "ui-reference-navigation-collections-canvas--default",
    ruleId: "color-contrast",
    nodeCount: 7,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "ui-reference-navigation-collections-canvas--navigation-collections-canvas",
    ruleId: "color-contrast",
    nodeCount: 7,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "ui-reference-settings-workspace-canvas--default",
    ruleId: "color-contrast",
    nodeCount: 2,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "ui-reference-settings-workspace-canvas--settings-workspace-canvas",
    ruleId: "color-contrast",
    nodeCount: 2,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "ui-reference-shell-overlay-canvas--default",
    ruleId: "color-contrast",
    nodeCount: 2,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
  {
    storyId: "ui-reference-shell-overlay-canvas--shell-overlay-canvas",
    ruleId: "color-contrast",
    nodeCount: 2,
    reason: "既存の配色トークンと状態表現の見直しにはデザイン判断が必要なため、現状のコントラスト違反を記録する。",
  },
];

export function getUnknownAccessibilityBaselineStoryIds(
  storyIds: readonly string[],
  baseline: readonly StorybookAccessibilityBaselineEntry[] = storybookAccessibilityBaseline,
): string[] {
  const knownStoryIds = new Set(storyIds);
  return [...new Set(baseline.map((entry) => entry.storyId))].filter((storyId) => !knownStoryIds.has(storyId));
}

export function compareStorybookAccessibilityViolations(
  storyId: string,
  violations: readonly { id: string; nodes: readonly unknown[] }[],
  baseline: readonly StorybookAccessibilityBaselineEntry[] = storybookAccessibilityBaseline,
): {
  unexpected: StorybookAccessibilityRuleDrift[];
  stale: StorybookAccessibilityRuleDrift[];
} {
  const expectedByRule = new Map(
    baseline.filter((entry) => entry.storyId === storyId).map((entry) => [entry.ruleId, entry.nodeCount]),
  );
  const actualByRule = new Map<string, number>();
  for (const violation of violations) {
    actualByRule.set(violation.id, (actualByRule.get(violation.id) ?? 0) + violation.nodes.length);
  }

  const drift: StorybookAccessibilityRuleDrift[] = [...new Set([...expectedByRule.keys(), ...actualByRule.keys()])]
    .sort()
    .flatMap((ruleId) => {
      const actual = actualByRule.get(ruleId) ?? 0;
      const expected = expectedByRule.get(ruleId) ?? 0;
      return expected === actual ? [] : [{ storyId, ruleId, expected, actual }];
    });
  return {
    unexpected: drift.filter((entry) => entry.actual > entry.expected),
    stale: drift.filter((entry) => entry.actual < entry.expected),
  };
}
