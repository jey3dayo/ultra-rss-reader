# Feed Selection Auto-Open Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: Add a reading setting that automatically opens the first article when a feed is selected.

Architecture: Persist a new reading preference, expose it in the Reading settings page, and route feed selection through the existing feed landing hook only when that preference is enabled. Keep folder/tag/smart-view selection unchanged.

Tech Stack: React 19, Zustand, React Query, Vitest, i18next

---

## Task 1: Add failing tests

### Files:

- Modify: `src/__tests__/components/settings-modal.test.tsx`
- Modify: `src/__tests__/components/sidebar.test.tsx`
- Modify: `src/__tests__/hooks/use-feed-landing.test.tsx`

- [ ] Write a failing settings test for the new reading switch
- [ ] Write a failing sidebar test proving feed selection should auto-open when the preference is enabled
- [ ] Write a failing feed-landing test for the enabled preference path

## Task 2: Add preference and settings UI

### Files:

- Modify: `src/stores/preferences-store.ts`
- Modify: `src/components/settings/use-reading-settings-view-props.ts`
- Modify: `src/locales/en/settings.json`
- Modify: `src/locales/ja/settings.json`

- [ ] Add a new boolean-string preference with default `false`
- [ ] Add the Reading settings switch wired to that preference
- [ ] Add localized labels for the new switch

## Task 3: Wire feed selection behavior

### Files:

- Modify: `src/components/reader/use-sidebar-feed-tree-props.ts`
- Modify: `src/components/reader/use-sidebar-feed-section-controller.ts`
- Modify: `src/components/reader/use-sidebar-visibility-fallback.ts`
- Modify: `src/components/reader/use-sidebar-feed-navigation.ts`
- Modify: `src/hooks/use-feed-landing.ts`

- [ ] Route manual feed selection through feed landing when the preference is enabled
- [ ] Keep navigation and fallback behavior on plain `selectFeed`
- [ ] Re-run focused tests after the minimal change

## Task 4: Verify

### Files:

- Modify: `src/__tests__/components/article-list.test.tsx` if the new behavior needs expectation updates

- [ ] Run targeted Vitest suites for settings, sidebar, and feed landing
- [ ] Run `mise run check`
- [ ] Review diff for scope drift
