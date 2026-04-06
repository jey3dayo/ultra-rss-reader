# Settings Sync Loading Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the noisy settings sync/loading bars with shared button-level loading states for connection testing and account sync, while keeping full-app loading feedback for full syncs.

**Architecture:** Add a focused `LoadingButton` shared component that wraps the existing UI button without changing the base `Button` API. Wire it into the account credentials and account sync sections, then narrow the global loading state so `manual_account` syncs stay local to the pressed button while `manual_all` and `automatic` syncs still drive the app-wide progress UI.

**Tech Stack:** React 19, TypeScript, Zustand, Lucide React, Vitest, Tauri sync events

---

## File Map

- Create: `src/components/shared/loading-button.tsx`
  - Shared wrapper around `Button` for inline loading spinner + loading label behavior.
- Create: `src/__tests__/components/account-credentials-section-view.test.tsx`
  - Focused render/interaction coverage for the connection-test loading button.
- Modify: `src/components/settings/account-credentials-section-view.tsx`
  - Swap the connection-test action from `Button` to `LoadingButton`.
- Modify: `src/components/settings/account-sync-section-view.tsx`
  - Swap the sync action from `Button` to `LoadingButton`.
- Modify: `src/components/settings/account-detail.tsx`
  - Remove `settingsLoading` usage from connection testing and account sync flows.
- Modify: `src/stores/ui-store.ts`
  - Keep `manual_account` sync progress local without setting `appLoading`.
- Modify: `src/components/reader/sidebar.tsx`
  - Only spin the sidebar sync icon for full-app sync kinds.
- Modify: `src/__tests__/components/account-sync-section-view.test.tsx`
  - Add loading-state assertions for the sync button.
- Modify: `src/__tests__/components/account-detail.test.tsx`
  - Keep the current connection-save-before-test guarantee and cover manual-account sync behavior.
- Modify: `src/__tests__/components/sidebar.test.tsx`
  - Split expectations between `manual_account` and `manual_all`.
- Modify: `src/__tests__/components/settings-modal-view.test.tsx`
  - Keep the modal-bar rendering behavior explicit.

## Task 1: Add failing UI tests for the new loading-button behavior

**Files:**

- Create: `src/__tests__/components/account-credentials-section-view.test.tsx`
- Modify: `src/__tests__/components/account-sync-section-view.test.tsx`

- [ ] **Step 1: Write the failing credentials-section loading test**
  - Render `AccountCredentialsSectionView` with `isTestingConnection={true}`.
  - Assert the button shows `testingConnectionLabel`, contains the spinner affordance, and is disabled.

- [ ] **Step 2: Run the new credentials-section test and confirm it fails**
  - Run: `pnpm vitest run src/__tests__/components/account-credentials-section-view.test.tsx`
  - Expected: FAIL because the section still renders a plain `Button` without spinner markup.

- [ ] **Step 3: Extend the sync-section test to require spinner + disabled behavior**
  - Add a case for `isSyncing={true}` that checks `syncingLabel`, spinner presence, and disabled state.

- [ ] **Step 4: Run the sync-section test and confirm it fails**
  - Run: `pnpm vitest run src/__tests__/components/account-sync-section-view.test.tsx`
  - Expected: FAIL because the section still renders a plain `Button` without spinner markup.

- [ ] **Step 5: Commit the red tests**
  - Run:

    ```bash
    git add src/__tests__/components/account-credentials-section-view.test.tsx src/__tests__/components/account-sync-section-view.test.tsx
    git commit -m "test: cover settings loading button states"
    ```

## Task 2: Implement the shared `LoadingButton` and wire it into both settings actions

**Files:**

- Create: `src/components/shared/loading-button.tsx`
- Modify: `src/components/settings/account-credentials-section-view.tsx`
- Modify: `src/components/settings/account-sync-section-view.tsx`

- [ ] **Step 1: Implement `LoadingButton` as a thin wrapper over `Button`**
  - Support `loading`, `loadingLabel`, and `disabledWhenLoading`.
  - Preserve existing `variant`, `size`, `className`, and pass-through button props.
  - Use a compact spinner that works in `size="sm"` buttons without shifting layout.

- [ ] **Step 2: Replace the credentials-section action with `LoadingButton`**
  - Keep the current label props and click handler names.
  - Preserve button sizing and spacing in the section layout.

- [ ] **Step 3: Replace the sync-section action with `LoadingButton`**
  - Preserve current section spacing and label fallback behavior.

- [ ] **Step 4: Run the two focused component tests and make them pass**
  - Run: `pnpm vitest run src/__tests__/components/account-credentials-section-view.test.tsx src/__tests__/components/account-sync-section-view.test.tsx`
  - Expected: PASS

- [ ] **Step 5: Commit the shared component + view wiring**
  - Run:

    ```bash
    git add src/components/shared/loading-button.tsx src/components/settings/account-credentials-section-view.tsx src/components/settings/account-sync-section-view.tsx src/__tests__/components/account-credentials-section-view.test.tsx src/__tests__/components/account-sync-section-view.test.tsx
    git commit -m "feat: add shared loading button for settings actions"
    ```

## Task 3: Localize account sync loading and keep full-sync loading global

**Files:**

- Modify: `src/components/settings/account-detail.tsx`
- Modify: `src/stores/ui-store.ts`
- Modify: `src/components/reader/sidebar.tsx`
- Modify: `src/__tests__/components/account-detail.test.tsx`
- Modify: `src/__tests__/components/sidebar.test.tsx`
- Modify: `src/__tests__/components/settings-modal-view.test.tsx`

- [ ] **Step 1: Add the failing account-detail expectations**
  - Keep the existing credential-save-before-test flow test.
  - Add or update assertions so connection testing and `manual_account` sync rely on local button loading instead of `settingsLoading`.

- [ ] **Step 2: Add the failing sidebar expectations**
  - Cover `manual_account` progress: no sidebar spinning, no `appLoading`.
  - Keep `manual_all` progress: spinner still active and `appLoading` still true.
  - Be careful to preserve the current unread-feed sidebar changes already present in the worktree.

- [ ] **Step 3: Run the account-detail/sidebar tests and confirm they fail**
  - Run: `pnpm vitest run src/__tests__/components/account-detail.test.tsx src/__tests__/components/sidebar.test.tsx`
  - Expected: FAIL because `settingsLoading` and `appLoading` still treat account sync as a global loading state.

- [ ] **Step 4: Remove `settingsLoading` from connection test + account sync handlers**
  - Update `AccountDetail` so `testingConnection` and `syncProgress` are the only loading sources for those two actions.

- [ ] **Step 5: Update sync-progress state handling**
  - In `ui-store.ts`, keep `syncProgress` bookkeeping for every kind.
  - Only set `appLoading` to true for `manual_all` and `automatic`.
  - Keep `finished` cleanup correct for every kind.

- [ ] **Step 6: Narrow the sidebar spinning condition**
  - Pass `isSyncing={syncProgress.active && syncProgress.kind !== "manual_account"}` or equivalent into `SidebarHeaderView`.
  - Preserve existing behavior for full syncs and automatic syncs.

- [ ] **Step 7: Refresh or add the relevant assertions in the settings-modal coverage**
  - Keep the modal top-bar behavior explicit so later regressions do not silently reintroduce the bar for button-local actions.

- [ ] **Step 8: Run the focused tests and make them pass**
  - Run: `pnpm vitest run src/__tests__/components/account-detail.test.tsx src/__tests__/components/sidebar.test.tsx src/__tests__/components/settings-modal-view.test.tsx`
  - Expected: PASS

- [ ] **Step 9: Commit the loading-state flow changes**
  - Run:

    ```bash
    git add src/components/settings/account-detail.tsx src/stores/ui-store.ts src/components/reader/sidebar.tsx src/__tests__/components/account-detail.test.tsx src/__tests__/components/sidebar.test.tsx src/__tests__/components/settings-modal-view.test.tsx
    git commit -m "feat: localize settings sync loading states"
    ```

## Task 4: Verify the full behavior and guard against regressions

**Files:**

- Modify: `src/__tests__/components/account-credentials-section-view.test.tsx`
- Modify: `src/__tests__/components/account-sync-section-view.test.tsx`
- Modify: `src/__tests__/components/account-detail.test.tsx`
- Modify: `src/__tests__/components/sidebar.test.tsx`
- Modify: `src/__tests__/components/settings-modal-view.test.tsx`

- [ ] **Step 1: Run the full focused suite for this feature**
  - Run:

    ```bash
    pnpm vitest run src/__tests__/components/account-credentials-section-view.test.tsx src/__tests__/components/account-sync-section-view.test.tsx src/__tests__/components/account-detail.test.tsx src/__tests__/components/sidebar.test.tsx src/__tests__/components/settings-modal-view.test.tsx
    ```

  - Expected: PASS

- [ ] **Step 2: Run the repository check if the focused suite passes cleanly**
  - Run: `mise run check`
  - Expected: PASS

- [ ] **Step 3: Manually verify the desktop interaction**
  - Run: `mise run app:dev`
  - Confirm:
    - `接続テスト` shows only button-local loading.
    - `今すぐ同期` shows only button-local loading.
    - The settings top bar does not appear for those two actions.
    - Full sync still drives the app/header loading affordances.

- [ ] **Step 4: Commit any final test or polish adjustments**
  - Run:

    ```bash
    git add src/components/shared/loading-button.tsx src/components/settings/account-credentials-section-view.tsx src/components/settings/account-sync-section-view.tsx src/components/settings/account-detail.tsx src/stores/ui-store.ts src/components/reader/sidebar.tsx src/__tests__/components/account-credentials-section-view.test.tsx src/__tests__/components/account-sync-section-view.test.tsx src/__tests__/components/account-detail.test.tsx src/__tests__/components/sidebar.test.tsx src/__tests__/components/settings-modal-view.test.tsx
    git commit -m "test: verify settings loading button behavior"
    ```
