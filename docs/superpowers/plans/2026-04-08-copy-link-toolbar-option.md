# Copy Link Toolbar Option Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `コピーリンク` だけを toolbar 表示の設定対象にし、`外部ブラウザ` と `Share menu` は常設へ整理する。

**Architecture:** Actions 設定画面は `コピーリンク` 1 項目だけを表示し、article toolbar 側は `action_copy_link` だけを参照する。既存の `action_share` / `action_share_menu` は保存スキーマ、allowlist、テストからも削除して完全整理する。

**Tech Stack:** React 19, TypeScript, Zustand, Vitest, react-i18next

---

## Task 1: Red tests for the new actions settings shape

**Files:**

- Modify: `src/__tests__/components/actions-settings.test.tsx`
- Modify: `src/__tests__/components/settings-modal.test.tsx`

- [ ] Add a failing assertion that `ActionsSettings` only exposes `Copy Link`
- [ ] Run the targeted tests and confirm they fail
- [ ] Keep the assertions focused on visible settings rows / switch count

## Task 2: Red tests for toolbar/menu behavior

**Files:**

- Modify: `src/__tests__/components/article-view.test.tsx`

- [ ] Replace the old `action_share_menu=false` expectation with the new always-visible share menu expectation
- [ ] Add an assertion that `action_share=false` no longer hides the external-browser toolbar button
- [ ] Run the targeted article-view tests and confirm they fail

## Task 3: Minimal implementation

**Files:**

- Modify: `src/components/settings/actions-settings.tsx`
- Modify: `src/components/reader/article-view.tsx`

- [ ] Remove `Open in External Browser` / `Share Menu` from the actions settings list
- [ ] Keep `Copy Link` wired to `action_copy_link`
- [ ] Make article toolbar always show the external-browser button
- [ ] Make share menu always render

## Task 4: Verification

**Files:**

- Verify: `src/__tests__/components/actions-settings.test.tsx`
- Verify: `src/__tests__/components/settings-modal.test.tsx`
- Verify: `src/__tests__/components/article-view.test.tsx`

- [ ] Run: `pnpm vitest run src/__tests__/components/actions-settings.test.tsx src/__tests__/components/settings-modal.test.tsx src/__tests__/components/article-view.test.tsx`
- [ ] Confirm all touched tests pass
