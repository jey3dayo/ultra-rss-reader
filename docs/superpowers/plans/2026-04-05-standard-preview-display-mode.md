# Standard/Preview Display Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: Replace the current three visible reader/preview presets with two user-facing modes, `standard` and `preview`, while keeping storage compatibility.

Architecture: Collapse preset resolution to a two-mode UI model in `article-display.ts`, keep the existing persisted `reader_mode` and `web_preview_mode` axes, and treat legacy preview-only persisted values as the same UI-facing `preview` mode. Update UI copy, controls, and tests together so the app no longer exposes duplicate preview variants.

Tech Stack: React 19, TypeScript, i18next, Vitest

---

## Task 1: Add failing tests for the two-mode preset model

### Files:

- Modify: `src/__tests__/lib/article-display.test.ts`
- Modify: `src/__tests__/components/settings-surface-views.test.tsx`

- [ ] Add tests that expect `standard` and `preview` as the only user-facing presets
- [ ] Verify legacy `reader=false`, `preview=true` still resolves to `preview`
- [ ] Run focused tests and confirm they fail for the expected old preset names

## Task 2: Implement the collapsed preset logic

### Files:

- Modify: `src/lib/article-display.ts`
- Modify: `src/components/reader/article-view.tsx`

- [ ] Replace the public preset union with `standard | preview`
- [ ] Map `preview` to `readerMode=true`, `webPreviewMode=true` for new selections
- [ ] Keep legacy persisted preview-only combinations resolving to the `preview` label

## Task 3: Update labels and option lists

### Files:

- Modify: `src/components/reader/display-mode-toggle-group.tsx`
- Modify: `src/components/reader/article-list.tsx`
- Modify: `src/components/reader/feed-context-menu.tsx`
- Modify: `src/components/reader/rename-feed-dialog.tsx`
- Modify: `src/components/settings/reading-settings.tsx`
- Modify: `src/locales/en/reader.json`
- Modify: `src/locales/ja/reader.json`
- Modify: `src/locales/en/settings.json`
- Modify: `src/locales/ja/settings.json`

- [ ] Update visible labels to `Standard` / `Preview` and `標準` / `プレビュー`
- [ ] Remove the extra user-facing preset option from every surface
- [ ] Keep `default` / inherit flows intact where they already exist

## Task 4: Update stories and tests, then verify

### Files:

- Modify: affected story/test files under `src/components/**` and `src/__tests__/**`

- [ ] Update Storybook and unit tests that still reference `reader_only`, `reader_and_preview`, or `preview_only`
- [ ] Run focused Vitest coverage for display-mode logic and UI surfaces
- [ ] Run a broader relevant test slice if focused tests are green
