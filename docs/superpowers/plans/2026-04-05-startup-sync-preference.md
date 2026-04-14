# Startup Sync Preference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: Add a global "sync on startup" preference that defaults to enabled and triggers one full sync when the app starts.

Architecture: Store the new toggle in the existing preferences table and preferences store so it behaves like other global settings. Trigger startup sync from `App.tsx` only after preferences finish loading, and use the existing full-sync command so automatic-sync unlocking stays aligned with current backend behavior.

Tech Stack: React 19, TypeScript, Zustand, Vitest, Tauri commands

---

## Task 1: Add failing tests for the new preference

### Files:

- Modify: `src/__tests__/components/general-settings.test.tsx`
- Modify: `src/__tests__/app-root.test.tsx`

- [ ] **Step 1: Write the failing settings test**
- [ ] **Step 2: Run the settings test to verify it fails**
- [ ] **Step 3: Write the failing app startup sync tests**
- [ ] **Step 4: Run the app test to verify it fails**

## Task 2: Implement the preference and startup sync behavior

### Files:

- Modify: `src/stores/preferences-store.ts`
- Modify: `src/components/settings/general-settings.tsx`
- Modify: `src/App.tsx`
- Modify: `src/api/tauri-commands.ts`
- Modify: `src/locales/en/settings.json`
- Modify: `src/locales/ja/settings.json`

- [ ] **Step 1: Add the new persisted preference key with default `true`**
- [ ] **Step 2: Add the General settings toggle UI and translations**
- [ ] **Step 3: Trigger one startup full sync after preferences load when enabled**
- [ ] **Step 4: Keep existing wake-sync behavior unchanged**

## Task 3: Verify

### Files:

- Modify: `src/__tests__/components/general-settings.test.tsx`
- Modify: `src/__tests__/app-root.test.tsx`

- [ ] **Step 1: Run focused tests and make them pass**
- [ ] **Step 2: Run a broader check if the focused tests pass cleanly**
