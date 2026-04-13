# Feed Cleanup Bulk Actions And Priority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bulk actions for the currently visible feed-cleanup candidates and strengthen priority guidance without changing candidate scoring.

**Architecture:** Extend `useFeedCleanupPageState()` with visible-queue bulk actions, thread those actions into `FeedCleanupPage` and `FeedCleanupOverviewPanel`, and keep priority semantics on the existing `summarizeCleanupCandidate()` model. Update component tests first, then make the smallest UI/state/locales changes needed, and finish with Storybook and TODO updates.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Storybook, i18next, Zustand-style local state

---

## Task 1: Add failing integration tests for bulk actions

**Files:**

- Modify: `src/__tests__/components/feed-cleanup-page.test.tsx`

- [ ] **Step 1: Write the failing test for keeping all visible candidates**

Add a test that opens `FeedCleanupPage`, clicks the overview bulk action for visible candidates, and expects the visible queue to become empty.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/components/feed-cleanup-page.test.tsx --reporter=verbose --testNamePattern="keep all visible"`
Expected: FAIL because the bulk action button or behavior does not exist yet.

- [ ] **Step 3: Write the failing test for deferring all visible candidates**

Add a test that defers all visible candidates, verifies they disappear from the queue, then shows deferred items and confirms they return.

- [ ] **Step 4: Run the focused test to verify it fails**

Run: `pnpm exec vitest run src/__tests__/components/feed-cleanup-page.test.tsx --reporter=verbose --testNamePattern="defer all visible"`
Expected: FAIL because the bulk action button or behavior does not exist yet.

- [ ] **Step 5: Add failing scope and empty-state tests**

Add tests for:

- integrity mode hides the bulk action row
- 0 visible candidates disables both bulk actions
- a filter-scoped bulk action affects only currently visible candidates

- [ ] **Step 6: Run the focused test subset to verify all new cases fail correctly**

Run: `pnpm exec vitest run src/__tests__/components/feed-cleanup-page.test.tsx --reporter=verbose --testNamePattern="visible|integrity mode|filtered candidates|no visible candidates"`
Expected: FAIL for missing UI/state behavior, not for test setup mistakes.

## Task 2: Implement bulk action state and overview wiring

**Files:**

- Modify: `src/components/feed-cleanup/use-feed-cleanup-page-state.ts`
- Modify: `src/components/feed-cleanup/feed-cleanup-page.tsx`
- Modify: `src/components/feed-cleanup/feed-cleanup-page-view.tsx`
- Modify: `src/components/feed-cleanup/feed-cleanup-overview-panel.tsx`
- Modify: `src/locales/ja/cleanup.json`
- Modify: `src/locales/en/cleanup.json`

- [ ] **Step 1: Add minimal bulk-action state helpers**

Implement `markVisibleCandidatesKept` and `markVisibleCandidatesDeferred` as single bulk reducer actions that fold `visibleCandidates` into the existing kept/deferred sets without changing queue heuristics.

- [ ] **Step 2: Thread labels and handlers into the page**

Read new locale strings in `FeedCleanupPage`, pass them through `FeedCleanupPageView`, and then into `FeedCleanupOverviewPanel`.

- [ ] **Step 3: Render the overview bulk action row**

Add a small non-destructive action row under filters in cleanup mode only, showing actions for the current visible set.

- [ ] **Step 4: Decide stale-state handling for editing / delete confirm**

Either disable bulk actions while inline edit or delete confirm is active, or add explicit state cleanup so those surfaces collapse safely after a bulk action.

- [ ] **Step 5: Run the focused integration tests**

Run: `pnpm exec vitest run src/__tests__/components/feed-cleanup-page.test.tsx --reporter=verbose --testNamePattern="visible"`
Expected: PASS for the new bulk action cases.

## Task 3: Tighten priority guidance copy

**Files:**

- Modify: `src/locales/ja/cleanup.json`
- Modify: `src/locales/en/cleanup.json`
- Modify: `src/components/feed-cleanup/feed-cleanup-page.tsx`
- Modify: `src/__tests__/components/feed-cleanup-page.test.tsx`

- [ ] **Step 1: Adjust copy only where priority intent is unclear**

Prefer the existing `priority_*` and `summary_headline_*` model; do not add a numeric score or new enum.

- [ ] **Step 2: Update or add assertions for the refined copy**

Keep the test surface focused on user-visible priority guidance in queue/review, without rewriting unrelated cleanup coverage.

- [ ] **Step 3: Run the full feed-cleanup page test file**

Run: `pnpm exec vitest run src/__tests__/components/feed-cleanup-page.test.tsx --reporter=verbose --testTimeout=30000`
Expected: PASS

## Task 4: Refresh Storybook states and task tracking

**Files:**

- Modify: `src/components/feed-cleanup/feed-cleanup-overview-panel.stories.tsx`
- Modify: `src/components/feed-cleanup/feed-cleanup-queue-panel.stories.tsx`
- Modify: `src/components/feed-cleanup/feed-cleanup-review-panel.stories.tsx`
- Modify: `TODO.md`

- [ ] **Step 1: Update stories for overview bulk actions**

Reflect the new bulk action row and any priority copy changes in the existing feed-cleanup stories.

- [ ] **Step 2: Mark the feed-cleanup TODO items complete**

Update `TODO.md` so the bulk action and priority-display items move to done once verification passes.

- [ ] **Step 3: Run Storybook build**

Run: `pnpm run build-storybook`
Expected: PASS

## Task 5: Final verification

**Files:**

- Verify only

- [ ] **Step 1: Run type-check**

Run: `pnpm exec tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run targeted Biome checks**

Run: `pnpm exec biome check src/components/feed-cleanup/feed-cleanup-page.tsx src/components/feed-cleanup/feed-cleanup-overview-panel.tsx src/components/feed-cleanup/use-feed-cleanup-page-state.ts src/components/feed-cleanup/feed-cleanup-overview-panel.stories.tsx src/components/feed-cleanup/feed-cleanup-queue-panel.stories.tsx src/components/feed-cleanup/feed-cleanup-review-panel.stories.tsx src/__tests__/components/feed-cleanup-page.test.tsx src/locales/ja/cleanup.json src/locales/en/cleanup.json TODO.md`
Expected: PASS

- [ ] **Step 3: Run React Doctor**

Run: `pnpm dlx react-doctor@latest . --verbose *> tmp/react-doctor-feed-cleanup-bulk-priority-pass.txt`
Expected: PASS with no new feed-cleanup regressions.

- [ ] **Step 4: Commit in a focused unit**

Stage only the feed-cleanup, locale, story, test, and TODO files changed for this task, then create a `refactor(feed-cleanup): ...` or `feat(feed-cleanup): ...` commit matching the repo’s recent style.
