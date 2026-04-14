# Last Selected Account Default Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: 設定画面とサイドバーのアカウント初期選択を、最後に使ったアカウント優先で統一する

Architecture: `accounts` と `savedAccountId` から初期選択候補を決める小さな helper を追加し、設定モーダルとサイドバーの両方で再利用する。見た目順や永続化方式は変えず、既存の `selected_account_id` をそのまま使う。

Tech Stack: React 19, TypeScript, Zustand, Vitest, Testing Library

---

## Task 1: 初期選択 helper をテスト駆動で追加する

### Files

- Create: `src/components/accounts/get-preferred-account-id.ts`
- Test: `src/__tests__/components/get-preferred-account-id.test.ts`

- [ ] **Step 1: Write the failing test**

`savedAccountId` が有効なときはその ID、無効なら先頭 ID、0 件なら `null` を返すテストを書く。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/__tests__/components/get-preferred-account-id.test.ts`
Expected: FAIL because helper does not exist yet.

- [ ] **Step 3: Write minimal implementation**

`accounts` 配列と `savedAccountId` を受け取り、必要最小限の条件分岐だけを実装する。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/__tests__/components/get-preferred-account-id.test.ts`
Expected: PASS

## Task 2: 設定モーダルの初期選択を helper に寄せる

### Files

- Modify: `src/components/settings/settings-modal.tsx`
- Modify: `src/__tests__/components/settings-modal.test.tsx`

- [ ] **Step 1: Write the failing test**

Accounts セクションを開いたとき、`selected_account_id` が有効ならそのアカウントを開くテストを書く。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/__tests__/components/settings-modal.test.tsx`
Expected: FAIL because current implementation always `accounts[0]` を選ぶ。

- [ ] **Step 3: Write minimal implementation**

`settings-modal.tsx` の自動選択で helper を使い、`savedAccountId` を優先する。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/__tests__/components/settings-modal.test.tsx`
Expected: PASS

## Task 3: サイドバー選択ロジックを helper に寄せて回帰を防ぐ

### Files

- Modify: `src/components/reader/use-sidebar-account-selection.ts`
- Modify: `src/__tests__/components/sidebar-account-selection.test.tsx` or existing related test file

- [ ] **Step 1: Write the failing/coverage test**

保存済み ID が有効なときの復元と、無効なときの先頭フォールバックが helper ベースでも維持されるテストを追加する。

- [ ] **Step 2: Run test to verify current gap**

Run: `pnpm vitest run <target sidebar test file>`
Expected: current coverage missing or implementation not yet helper-based.

- [ ] **Step 3: Write minimal implementation**

`use-sidebar-account-selection.ts` の復元判定を helper 利用へ置き換える。

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run <target sidebar test file>`
Expected: PASS

## Task 4: 仕上げの確認

### Files

- Modify: touched files only if final cleanup is needed

- [ ] **Step 1: Run focused tests**

Run:
`pnpm vitest run src/__tests__/components/get-preferred-account-id.test.ts src/__tests__/components/settings-modal.test.tsx <target sidebar test file>`

- [ ] **Step 2: Run repository checks**

Run: `mise run check`
Expected: format, lint, test all pass.
