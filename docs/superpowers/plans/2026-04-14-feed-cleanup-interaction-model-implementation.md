# Feed Cleanup Interaction Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: Implement the approved feed-cleanup interaction model so cleanup behaves like a dedicated decision workspace with explicit single/bulk actions and keyboard-driven selection.

Architecture: Extend `useFeedCleanupPageState()` to own cleanup-focused interaction state: selected rows, focused row, reversible keep/defer actions, and bulk delete confirmation. Thread that state through `FeedCleanupPage` into the queue and review surfaces so the queue owns navigation and bulk selection, while the review panel becomes a feed console with a decision rail. Reuse the existing toast system for undo and keep delete as the only confirm-gated action.

Tech Stack: React 19, TypeScript, Vitest, Testing Library, i18next, Zustand toast state, existing feed-cleanup components

---

## Task 1: Add failing tests for decision-rail and bulk-selection behavior

## Task 1 Files

- Modify: `src/__tests__/components/feed-cleanup-page.test.tsx`
- Modify: `src/__tests__/components/feed-cleanup-queue-panel.test.tsx`
- Modify: `src/__tests__/components/feed-cleanup-review-panel.test.tsx`

- [ ] **Step 1: Write a failing queue test for explicit row selection**

Add a queue-panel test that expects each cleanup row to render a checkbox affordance and a focused-row indicator hook (`data-*` or class) separate from selected styling.

- [ ] **Step 2: Run the focused queue-panel test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/components/feed-cleanup-queue-panel.test.tsx --reporter=verbose`
Expected: FAIL because the checkbox/focus affordances do not exist yet.

- [ ] **Step 3: Write a failing review-panel test for the decision rail**

Add a review-panel test that expects a current-status label and a segmented `Keep / Defer` rail plus isolated `Delete` action.

- [ ] **Step 4: Run the focused review-panel test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/components/feed-cleanup-review-panel.test.tsx --reporter=verbose`
Expected: FAIL because the console/rail structure does not exist yet.

- [ ] **Step 5: Write failing page integration tests for selection-first keyboard routing**

Add tests for:

- `Space` toggles the focused row selection
- when no rows are selected, `k` / `l` act on the focused row only
- when rows are selected, `k` / `l` act on the selected set
- `Enter` syncs the review panel target with the focused row

- [ ] **Step 6: Run the focused page tests to verify they fail correctly**

Run: `pnpm exec vitest run src/__tests__/components/feed-cleanup-page.test.tsx --reporter=verbose --testNamePattern="selection|keyboard|focused row|Enter"`
Expected: FAIL for missing interaction behavior, not for harness or i18n mistakes.

## Task 2: Implement cleanup interaction state and undo model

## Task 2 Files

- Modify: `src/components/feed-cleanup/use-feed-cleanup-page-state.ts`
- Modify: `src/components/feed-cleanup/feed-cleanup.types.ts`
- Modify: `src/components/feed-cleanup/feed-cleanup-page.tsx`

- [ ] **Step 1: Extend cleanup state with focus, explicit selection, and reversible action tracking**

Add state for:

- `focusedFeedId`
- `selectedFeedIds`
- `pendingBulkDeleteFeedIds`
- `lastDecisionAction` (or equivalent reversible payload for undo)

- [ ] **Step 2: Implement minimal reducer actions for selection, focus, keep, defer, and undo**

Use the existing kept/deferred sets as the source of truth. Add actions for:

- toggle selected row
- clear selection
- set focused row
- keep/defer one or many rows
- revert last keep/defer decision

- [ ] **Step 3: Wire toast-based undo in `FeedCleanupPage`**

Use `useUiStore.getState().showToast(...)` to show an undo action after keep/defer for both single and bulk flows.

- [ ] **Step 4: Add bulk delete target handling without changing the existing delete mutation**

Keep actual deletion in `FeedCleanupPage`, but allow either a single candidate or a selected set to drive the confirm surface.

- [ ] **Step 5: Run the focused page tests for state transitions**

Run: `pnpm exec vitest run src/__tests__/components/feed-cleanup-page.test.tsx --reporter=verbose --testNamePattern="selection|undo|bulk delete"`
Expected: PASS for reducer-driven interaction behavior.

## Task 3: Rebuild the queue as a selectable, keyboard-driven worklist

## Task 3 Files

- Modify: `src/components/feed-cleanup/feed-cleanup-queue-panel.tsx`
- Modify: `src/components/feed-cleanup/feed-cleanup-page-view.tsx`
- Modify: `src/components/feed-cleanup/feed-cleanup.types.ts`

- [ ] **Step 1: Add explicit checkbox and focus visuals to queue rows**

Render row selection separately from row focus. Keep the selected styling visible, but make focus readable even on selected rows.

- [ ] **Step 2: Add a conditional bulk bar above the queue**

Show the bar only when `selectedFeedIds.size > 0`. Display selected count and bulk actions there.

- [ ] **Step 3: Add keyboard handlers in the page-view layer**

Handle:

- `j` / `k` navigation between visible cleanup rows
- `Space` selection toggle
- `Enter` select for review/console
- `k` / `l` / `d` decision routing with selection-first semantics

- [ ] **Step 4: Keep integrity mode isolated**

Do not apply cleanup keyboard selection/bulk UI to the broken-references queue.

- [ ] **Step 5: Run queue and page tests**

Run: `pnpm exec vitest run src/__tests__/components/feed-cleanup-queue-panel.test.tsx src/__tests__/components/feed-cleanup-page.test.tsx --reporter=verbose`
Expected: PASS

## Task 4: Reframe the review panel as a feed console with a decision rail

## Task 4 Files

- Modify: `src/components/feed-cleanup/feed-cleanup-review-panel.tsx`
- Modify: `src/__tests__/components/feed-cleanup-review-panel.test.tsx`

- [ ] **Step 1: Replace the loose action buttons with a console-style decision rail**

Render:

- current status label
- feed metrics / reasons summary
- segmented `Keep / Defer`
- isolated `Delete`
- secondary `Edit`

- [ ] **Step 2: Make button labels and semantics selection-aware where helpful**

Use the same text for single action, but allow selected-aware labels in the bulk bar if needed.

- [ ] **Step 3: Preserve editing mode and integrity mode behavior**

Do not regress the existing inline editor or integrity review surfaces.

- [ ] **Step 4: Run the focused review-panel and page tests**

Run: `pnpm exec vitest run src/__tests__/components/feed-cleanup-review-panel.test.tsx src/__tests__/components/feed-cleanup-page.test.tsx --reporter=verbose --testNamePattern="decision rail|Edit Feed|Delete"`
Expected: PASS

## Task 5: Update locale copy and stories for the new model

## Task 5 Files

- Modify: `src/locales/en/cleanup.json`
- Modify: `src/locales/ja/cleanup.json`
- Modify: `src/components/feed-cleanup/feed-cleanup-overview-panel.stories.tsx`
- Modify: `src/components/feed-cleanup/feed-cleanup-queue-panel.stories.tsx`
- Modify: `src/components/feed-cleanup/feed-cleanup-review-panel.stories.tsx`

- [ ] **Step 1: Add the minimum new strings needed for console/bulk/keyboard copy**

Prefer reusing existing `keep`, `later`, `delete`, `deferred_badge`, and summary strings where possible.

- [ ] **Step 2: Refresh stories to show the new worklist + console state**

Expose:

- queue with explicit selection
- review panel with decision rail
- overview with the updated cleanup wording

- [ ] **Step 3: Run Storybook build**

Run: `pnpm run build-storybook`
Expected: PASS

## Task 6: Final verification

## Task 6 Files

- Verify only

- [ ] **Step 1: Run the full targeted feed-cleanup test set**

Run: `pnpm exec vitest run src/__tests__/components/feed-cleanup-page.test.tsx src/__tests__/components/feed-cleanup-queue-panel.test.tsx src/__tests__/components/feed-cleanup-review-panel.test.tsx --reporter=verbose`
Expected: PASS

- [ ] **Step 2: Run type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Run targeted Biome checks**

Run: `pnpm exec biome check src/components/feed-cleanup/feed-cleanup-page.tsx src/components/feed-cleanup/feed-cleanup-page-view.tsx src/components/feed-cleanup/feed-cleanup-queue-panel.tsx src/components/feed-cleanup/feed-cleanup-review-panel.tsx src/components/feed-cleanup/use-feed-cleanup-page-state.ts src/components/feed-cleanup/feed-cleanup.types.ts src/locales/en/cleanup.json src/locales/ja/cleanup.json src/__tests__/components/feed-cleanup-page.test.tsx src/__tests__/components/feed-cleanup-queue-panel.test.tsx src/__tests__/components/feed-cleanup-review-panel.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

Stage only the interaction-model implementation files and create a focused commit such as:

```bash
git add src/components/feed-cleanup src/locales/en/cleanup.json src/locales/ja/cleanup.json src/__tests__/components/feed-cleanup-page.test.tsx src/__tests__/components/feed-cleanup-queue-panel.test.tsx src/__tests__/components/feed-cleanup-review-panel.test.tsx docs/superpowers/specs/2026-04-14-feed-cleanup-interaction-model-design.md docs/superpowers/plans/2026-04-14-feed-cleanup-interaction-model-implementation.md
git commit -m "feat(feed-cleanup): add decision workspace interactions"
```
