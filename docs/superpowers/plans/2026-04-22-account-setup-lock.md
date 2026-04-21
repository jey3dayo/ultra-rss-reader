# Account Setup Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: Lock the user into a setup-specific account-detail flow immediately after account registration, keep them there until the first sync finishes, auto-close settings on success, and allow only retry or credential editing on failure.

Architecture: Add a focused `accountSetupSession` state to the UI store, start it from the add-account success path, and make the settings modal plus account detail render a setup mode when the selected account matches the active session. Keep the existing general sync infrastructure intact, but treat the registration-triggered first sync as a distinct UI workflow with explicit success/failure handling and an automatic landing on the new account's `unread` smart view.

Tech Stack: React 19, TypeScript, Zustand, React Query, Vitest, Tauri sync commands

---

## File Map

- Modify: `src/stores/ui-store.ts`
  - Add `accountSetupSession` state and actions.
- Modify: `src/components/settings/account-config-form.tsx`
  - Start the setup session and trigger the first sync after successful account creation.
- Modify: `src/components/settings/account-detail.types.ts`
  - Extend props/types for setup-mode UI and actions.
- Modify: `src/components/settings/use-account-detail-controller.ts`
  - Thread setup-mode behavior into the account detail controller.
- Modify: `src/components/settings/use-account-detail-sync-controls.ts`
  - Add setup-specific first-sync trigger/retry handling and success/failure callbacks.
- Modify: `src/components/settings/use-account-detail-view-props.tsx`
  - Build setup headings, descriptions, and action visibility.
- Modify: `src/components/settings/account-detail-view.tsx`
  - Render setup-mode banner/shell content.
- Modify: `src/components/settings/account-sync-section-view.tsx`
  - Replace normal sync controls with setup progress or retry/edit controls when needed.
- Modify: `src/components/settings/settings-modal.tsx`
  - Resolve whether the current screen is under a locked setup session.
- Modify: `src/components/settings/use-settings-modal-view-props.tsx`
  - Disable close/nav/account actions during setup mode.
- Modify: `src/components/settings/settings-modal-view.tsx`
  - Render disabled close button and setup lock messaging.
- Modify: `src/locales/en/settings.json`
  - Add setup-mode copy.
- Modify: `src/locales/ja/settings.json`
  - Add setup-mode copy.
- Modify: `src/__tests__/components/add-account-form.test.tsx`
  - Cover setup-session start from account registration.
- Modify: `src/__tests__/components/account-detail.test.tsx`
  - Cover setup sync success/failure flows and auto-close/unread landing.
- Modify: `src/__tests__/components/account-detail-view.test.tsx`
  - Cover setup-mode rendering states.
- Modify: `src/__tests__/components/account-sync-section-view.test.tsx`
  - Cover setup-specific sync UI.
- Modify: `src/__tests__/components/settings-modal-view.test.tsx`
  - Cover close-button disabled rendering and setup messaging.
- Modify: `src/__tests__/components/use-settings-modal-view-props.test.tsx`
  - Cover nav/account action disabling during setup mode.

## Task 1: Add failing tests for the new setup-session state and lock behavior

## Task 1 Files

- Modify: `src/__tests__/components/add-account-form.test.tsx`
- Modify: `src/__tests__/components/settings-modal-view.test.tsx`
- Modify: `src/__tests__/components/use-settings-modal-view-props.test.tsx`

- [ ] **Step 1: Extend the add-account form test to require setup-session start after successful registration**
  - Mock the relevant `useUiStore` actions.
  - Assert the success path still selects the new account and also starts the setup session.

- [ ] **Step 2: Add failing settings-modal-view coverage for locked close UI**
  - Render the modal in setup mode.
  - Assert the close button is disabled and the blocking message is visible.

- [ ] **Step 3: Add failing settings-modal view-props coverage for locked nav/account actions**
  - Assert category switching and account switching callbacks are disabled or ignored in setup mode.
  - Assert add-account navigation is also disabled in setup mode.

- [ ] **Step 4: Run the focused tests and confirm they fail**
  - Run:

    ```bash
    pnpm vitest run src/__tests__/components/add-account-form.test.tsx src/__tests__/components/settings-modal-view.test.tsx src/__tests__/components/use-settings-modal-view-props.test.tsx
    ```

  - Expected: FAIL because setup-session state and lock behavior do not exist yet.

- [ ] **Step 5: Commit the red tests**
  - Run:

    ```bash
    git add src/__tests__/components/add-account-form.test.tsx src/__tests__/components/settings-modal-view.test.tsx src/__tests__/components/use-settings-modal-view-props.test.tsx
    git commit -m "test: cover account setup lock entry points"
    ```

## Task 2: Add `accountSetupSession` state to the UI store

## Task 2 Files

- Modify: `src/stores/ui-store.ts`

- [ ] **Step 1: Add the new setup-session state shape**
  - Include `accountId`, `state`, and optional error summary.
  - Keep the type narrowly focused on the registration setup flow.

- [ ] **Step 2: Add UI-store actions for start, fail, succeed, and clear**
  - `startAccountSetup(accountId)`
  - `markAccountSetupFailed(accountId, errorMessage?)`
  - `markAccountSetupSucceeded(accountId)`
  - `clearAccountSetup()`

- [ ] **Step 3: Preserve existing sync-progress behavior**
  - Do not overload `syncProgress` with setup-specific semantics.
  - Keep the new store path additive and isolated.

- [ ] **Step 4: Add or update store-level assertions if needed**
  - If there is no direct store test coverage, keep the state behavior covered through component tests.

- [ ] **Step 5: Commit the store changes**
  - Run:

    ```bash
    git add src/stores/ui-store.ts
    git commit -m "feat: add account setup session state"
    ```

## Task 3: Start the setup flow from account registration and wire retryable first sync

## Task 3 Files

- Modify: `src/components/settings/account-config-form.tsx`
- Modify: `src/components/settings/use-account-detail-controller.ts`
- Modify: `src/components/settings/use-account-detail-sync-controls.ts`
- Modify: `src/components/settings/account-detail.types.ts`

- [ ] **Step 1: Start the setup session from the add-account success path**
  - Keep the existing `selectAccount` and settings-account selection behavior.
  - Immediately mark the new account as `syncing`.

- [ ] **Step 2: Add a setup-aware first-sync trigger path**
  - Reuse `syncAccount(account.id)` rather than inventing a new backend command.
  - Distinguish this path in the UI/controller layer as the registration-triggered first sync.

- [ ] **Step 3: Add success and failure callbacks into the account-detail sync controls**
  - Success should mark the setup session succeeded.
  - Failure should mark the setup session failed and keep the modal locked.

- [ ] **Step 4: Add a retry action for failed setup state**
  - Retrying should reuse the same setup-sync path and clear stale error messaging before re-entry.

- [ ] **Step 5: Run focused tests for registration and controller flow**
  - Run:

    ```bash
    pnpm vitest run src/__tests__/components/add-account-form.test.tsx src/__tests__/components/account-detail.test.tsx
    ```

  - Expected: PASS for the newly introduced wiring after implementation.

- [ ] **Step 6: Commit the registration/setup-sync wiring**
  - Run:

    ```bash
    git add src/components/settings/account-config-form.tsx src/components/settings/use-account-detail-controller.ts src/components/settings/use-account-detail-sync-controls.ts src/components/settings/account-detail.types.ts src/__tests__/components/add-account-form.test.tsx src/__tests__/components/account-detail.test.tsx
    git commit -m "feat: start account setup sync after registration"
    ```

## Task 4: Render setup mode in the account detail UI

## Task 4 Files

- Modify: `src/components/settings/use-account-detail-view-props.tsx`
- Modify: `src/components/settings/account-detail-view.tsx`
- Modify: `src/components/settings/account-sync-section-view.tsx`
- Modify: `src/locales/en/settings.json`
- Modify: `src/locales/ja/settings.json`
- Modify: `src/__tests__/components/account-detail-view.test.tsx`
- Modify: `src/__tests__/components/account-sync-section-view.test.tsx`

- [ ] **Step 1: Add failing render tests for setup-mode headings and actions**
  - Cover `syncing` state with setup heading, setup description, and loading/progress UI.
  - Cover `failed` state with retry plus credentials-edit affordances.

- [ ] **Step 2: Add the setup copy to translations**
  - Include syncing heading/description, failed heading/description, retry label, and success toast copy.

- [ ] **Step 3: Extend account-detail view props to compute setup mode**
  - Swap normal sync labels/actions for setup-state labels/actions when the viewed account matches the setup session.

- [ ] **Step 4: Update the sync section view**
  - In `syncing`, render loading/progress treatment instead of the normal `sync now` action.
  - In `failed`, expose only `再試行` and `認証情報を修正`.

- [ ] **Step 5: Update the account-detail shell if extra banner/chrome is needed**
  - Keep the layout within the existing settings content structure.
  - Avoid introducing a second modal or unrelated page shell.

- [ ] **Step 6: Run the focused setup-view tests**
  - Run:

    ```bash
    pnpm vitest run src/__tests__/components/account-detail-view.test.tsx src/__tests__/components/account-sync-section-view.test.tsx src/__tests__/components/account-detail.test.tsx
    ```

  - Expected: PASS

- [ ] **Step 7: Commit the setup-mode UI**
  - Run:

    ```bash
    git add src/components/settings/use-account-detail-view-props.tsx src/components/settings/account-detail-view.tsx src/components/settings/account-sync-section-view.tsx src/components/settings/account-detail.types.ts src/locales/en/settings.json src/locales/ja/settings.json src/__tests__/components/account-detail-view.test.tsx src/__tests__/components/account-sync-section-view.test.tsx src/__tests__/components/account-detail.test.tsx
    git commit -m "feat: show account setup mode in settings"
    ```

## Task 5: Lock the settings modal until setup succeeds

## Task 5 Files

- Modify: `src/components/settings/settings-modal.tsx`
- Modify: `src/components/settings/use-settings-modal-view-props.tsx`
- Modify: `src/components/settings/settings-modal-view.tsx`
- Modify: `src/__tests__/components/settings-modal-view.test.tsx`
- Modify: `src/__tests__/components/use-settings-modal-view-props.test.tsx`

- [ ] **Step 1: Resolve the active setup lock state in `SettingsModal`**
  - Determine whether the displayed account matches the active setup session.
  - Only lock for `syncing` and `failed`, not `succeeded`.

- [ ] **Step 2: Disable modal close behavior in setup mode**
  - Disable the close button visually.
  - Ignore `onOpenChange(false)` during setup mode.

- [ ] **Step 3: Disable settings category and account navigation in setup mode**
  - Prevent `openSettingsAccount`, `openSettingsAddAccount`, and category changes from firing.

- [ ] **Step 4: Keep the lock reason visible**
  - Render a stable message explaining that the first sync must finish before closing the screen.

- [ ] **Step 5: Run the focused modal tests**
  - Run:

    ```bash
    pnpm vitest run src/__tests__/components/settings-modal-view.test.tsx src/__tests__/components/use-settings-modal-view-props.test.tsx
    ```

  - Expected: PASS

- [ ] **Step 6: Commit the modal-lock behavior**
  - Run:

    ```bash
    git add src/components/settings/settings-modal.tsx src/components/settings/use-settings-modal-view-props.tsx src/components/settings/settings-modal-view.tsx src/__tests__/components/settings-modal-view.test.tsx src/__tests__/components/use-settings-modal-view-props.test.tsx
    git commit -m "feat: lock settings during account setup"
    ```

## Task 6: Auto-close settings and land on `unread` after successful setup

## Task 6 Files

- Modify: `src/components/settings/settings-modal.tsx`
- Modify: `src/components/settings/use-account-detail-controller.ts`
- Modify: `src/components/settings/use-account-detail-sync-controls.ts`
- Modify: `src/__tests__/components/account-detail.test.tsx`

- [ ] **Step 1: Add failing success-flow tests**
  - Assert that successful first sync closes settings and selects the `unread` smart view for the new account.

- [ ] **Step 2: Implement the success transition**
  - Keep the selected account on the newly created account.
  - Switch the reader selection to `unread`.
  - Show the short success toast.
  - Close settings and clear the setup session.

- [ ] **Step 3: Keep failure behavior non-escaping**
  - Confirm that failed setup does not close the modal or clear the setup session.

- [ ] **Step 4: Run the focused completion tests**
  - Run:

    ```bash
    pnpm vitest run src/__tests__/components/account-detail.test.tsx
    ```

  - Expected: PASS

- [ ] **Step 5: Commit the completion flow**
  - Run:

    ```bash
    git add src/components/settings/settings-modal.tsx src/components/settings/use-account-detail-controller.ts src/components/settings/use-account-detail-sync-controls.ts src/__tests__/components/account-detail.test.tsx
    git commit -m "feat: finish account setup on first sync success"
    ```

## Task 7: Verify the whole flow and guard against regressions

## Task 7 Files

- Modify: `src/__tests__/components/add-account-form.test.tsx`
- Modify: `src/__tests__/components/account-detail.test.tsx`
- Modify: `src/__tests__/components/account-detail-view.test.tsx`
- Modify: `src/__tests__/components/account-sync-section-view.test.tsx`
- Modify: `src/__tests__/components/settings-modal-view.test.tsx`
- Modify: `src/__tests__/components/use-settings-modal-view-props.test.tsx`

- [ ] **Step 1: Run the focused feature suite**
  - Run:

    ```bash
    pnpm vitest run src/__tests__/components/add-account-form.test.tsx src/__tests__/components/account-detail.test.tsx src/__tests__/components/account-detail-view.test.tsx src/__tests__/components/account-sync-section-view.test.tsx src/__tests__/components/settings-modal-view.test.tsx src/__tests__/components/use-settings-modal-view-props.test.tsx
    ```

  - Expected: PASS

- [ ] **Step 2: Run the repository gate**
  - Run: `mise run check`
  - Expected: PASS

- [ ] **Step 3: Manually verify the desktop flow**
  - Run: `mise run app:dev`
  - Confirm:
    - Registering an account immediately enters setup mode.
    - Close button, settings nav, and account switching are locked during setup.
    - Successful first sync auto-closes settings and lands on the new account's unread view.
    - Failed first sync keeps the modal locked and exposes only retry plus credential editing.
    - An account with zero feeds still exits setup successfully and can then show the normal no-feeds state.

- [ ] **Step 4: Commit any final polish or test adjustments**
  - Run:

    ```bash
    git add src/stores/ui-store.ts src/components/settings/account-config-form.tsx src/components/settings/account-detail.types.ts src/components/settings/use-account-detail-controller.ts src/components/settings/use-account-detail-sync-controls.ts src/components/settings/use-account-detail-view-props.tsx src/components/settings/account-detail-view.tsx src/components/settings/account-sync-section-view.tsx src/components/settings/settings-modal.tsx src/components/settings/use-settings-modal-view-props.tsx src/components/settings/settings-modal-view.tsx src/locales/en/settings.json src/locales/ja/settings.json src/__tests__/components/add-account-form.test.tsx src/__tests__/components/account-detail.test.tsx src/__tests__/components/account-detail-view.test.tsx src/__tests__/components/account-sync-section-view.test.tsx src/__tests__/components/settings-modal-view.test.tsx src/__tests__/components/use-settings-modal-view-props.test.tsx
    git commit -m "test: verify account setup lock flow"
    ```
