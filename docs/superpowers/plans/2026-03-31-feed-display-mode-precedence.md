# Feed Display Mode Precedence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: Make feed-specific display mode override the global reading default, with an explicit inherit state for feeds that should follow the global setting.

Architecture: Persist a three-state feed display mode and centralize effective-mode resolution in frontend logic. Migrate old stored `normal` values to `inherit` so existing feeds continue to behave like global-default followers unless they were explicitly widescreen.

Tech Stack: React 19, TypeScript, Zustand, Vitest, Tauri 2, Rust, SQLite

---

## Task 1: Add failing frontend regression tests

### Files:

- Modify: `src/__tests__/components/article-view.test.tsx`
- Modify: `src/__tests__/components/rename-feed-dialog-view.test.tsx`
- Modify: `src/__tests__/stores/preferences-store.test.ts`

- [ ] **Step 1: Write failing tests for inherited vs explicit feed display mode**
- [ ] **Step 2: Run targeted Vitest commands and confirm the new assertions fail for the expected reason**
- [ ] **Step 3: Implement the minimum code needed to support the new behavior**
- [ ] **Step 4: Re-run the same targeted tests and confirm they pass**

## Task 2: Implement inherit-aware display mode resolution

### Files:

- Modify: `src/lib/article-view.ts`
- Modify: `src/components/reader/article-view.tsx`
- Modify: `src/components/reader/article-list.tsx`
- Modify: `src/components/reader/rename-feed-dialog.tsx`
- Modify: `src/locales/en/reader.json`
- Modify: `src/locales/ja/reader.json`

- [ ] **Step 1: Add a helper that resolves effective display mode from feed + global settings**
- [ ] **Step 2: Update reader and list components to use the effective mode**
- [ ] **Step 3: Add the inherit option to the feed edit dialog**
- [ ] **Step 4: Keep toolbar toggles writing explicit `normal` / `widescreen` overrides**

## Task 3: Update backend defaults and persisted data

### Files:

- Add: `src-tauri/migrations/V7__feed_display_mode_inherit.sql`
- Modify: `src-tauri/src/infra/db/migration.rs`
- Modify: `src-tauri/src/commands/feed_commands.rs`
- Modify: `src-tauri/src/service/sync_flow.rs`
- Modify: `src-tauri/src/commands/opml_commands.rs`
- Modify: `src-tauri/src/commands/sync_providers.rs`

- [ ] **Step 1: Migrate stored feed `display_mode='normal'` values to `inherit`**
- [ ] **Step 2: Make newly created feeds default to `inherit`**
- [ ] **Step 3: Preserve explicit widescreen overrides during sync flows**
- [ ] **Step 4: Run targeted Rust and frontend tests for the touched paths**

## Task 4: Verify end-to-end behavior

### Files:

- Modify: `src/__tests__/components/article-view.test.tsx`
- Modify: `src/__tests__/components/settings-modal.test.tsx`

- [ ] **Step 1: Add a test showing global default affects inherited feeds**
- [ ] **Step 2: Add a test showing explicit per-feed mode wins over global default**
- [ ] **Step 3: Run the relevant Vitest suite**
- [ ] **Step 4: Run `mise run check` to satisfy the project quality gate**
