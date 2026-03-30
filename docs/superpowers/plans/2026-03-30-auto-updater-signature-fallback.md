# Auto Updater Signature and Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** updater 公開鍵設定を自動チェックで固定し、更新失敗時に「現行版継続」と再確認導線を示す UX とテストを追加する。

**Architecture:** 既存の Tauri updater 実装はそのまま使い、フロントエンド側で失敗時トーストと手動再確認フローを統一する。設定整合性は Vitest から `tauri.conf.json` と `release.yml` を直接検査し、フォールバック挙動は hook テストで固定する。

**Tech Stack:** React 19, TypeScript, Vitest, Zustand, Tauri updater, GitHub Actions YAML

---

## File Structure

- Create: `tests/updater-config.test.ts`
  - `src-tauri/tauri.conf.json` の updater endpoint / `pubkey`
  - `.github/workflows/release.yml` の署名用 secrets
- Modify: `src/hooks/use-updater.ts`
  - 更新失敗トースト
  - 手動再確認 helper
  - 自動再試行なしの明示
- Modify: `src/lib/actions.ts`
  - メニューの `check-for-updates` から新しい手動再確認 helper を再利用
- Modify: `src/__tests__/hooks/use-updater.test.ts`
  - 失敗トーストと `もう一度確認` 導線のテスト
- Modify: `src/__tests__/lib/actions.test.ts`
  - メニューの `check-for-updates` が共通 helper を使うことのテスト
- Modify: `TODO.md`
  - 3 項目を完了済みに更新

`src-tauri/src/commands/updater_commands.rs` は今回の第一候補では編集対象にしない。`PendingUpdate.take()` により失敗後の handle 再利用はすでに避けられているため、独自レジュームや自動再試行を追加しない限り変更理由が薄い。

### Task 1: Add Updater Config Guard Tests

**Files:**

- Create: `tests/updater-config.test.ts`
- Inspect only: `src-tauri/tauri.conf.json`
- Inspect only: `.github/workflows/release.yml`
- Test: `tests/updater-config.test.ts`

- [ ] **Step 1: Write the failing config tests**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("updater config", () => {
  it("defines a non-empty updater endpoint and pubkey", () => {
    const raw = readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8");
    const config = JSON.parse(raw) as {
      plugins?: { updater?: { endpoints?: string[]; pubkey?: string } };
    };

    expect(config.plugins?.updater?.endpoints?.[0]).toMatch(/^https:\/\/github\.com\/jey3dayo\/ultra-rss-reader\//);
    expect(config.plugins?.updater?.pubkey?.trim()).toBeTruthy();
  });

  it("passes signing secrets to the release workflow", () => {
    const workflow = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
    expect(workflow).toContain("TAURI_SIGNING_PRIVATE_KEY");
    expect(workflow).toContain("TAURI_SIGNING_PRIVATE_KEY_PASSWORD");
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `pnpm vitest run tests/updater-config.test.ts --reporter=dot`

Expected: FAIL because `tests/updater-config.test.ts` does not exist yet.

- [ ] **Step 3: Create the test file and make the assertions pass**

Implementation notes:

- Keep the test as a pure file-read check; do not add app runtime dependencies.
- Use narrow assertions:
  - endpoint exists and points at the GitHub Releases `latest.json`
  - `pubkey` exists and is not empty
  - workflow contains both signing secret names

- [ ] **Step 4: Run the config test again**

Run: `pnpm vitest run tests/updater-config.test.ts --reporter=dot`

Expected: PASS with 2 tests.

- [ ] **Step 5: Commit**

```bash
git add tests/updater-config.test.ts
git commit -m "test: guard updater signing config"
```

### Task 2: Lock the Failure UX with Tests First

**Files:**

- Modify: `src/__tests__/hooks/use-updater.test.ts`
- Modify: `src/hooks/use-updater.ts`
- Modify: `src/__tests__/lib/actions.test.ts`
- Modify: `src/lib/actions.ts`
- Test: `src/__tests__/hooks/use-updater.test.ts`
- Test: `src/__tests__/lib/actions.test.ts`

- [ ] **Step 1: Extend the hook test with the failure-path expectations**

Add failing tests for:

```ts
it("shows a fallback toast that keeps the current version when download fails", async () => {
  mockDownloadAndInstallUpdate.mockResolvedValue(
    Result.fail({ type: "UserVisible", message: "network down" }),
  );

  const { showUpdateAvailableToast } = await import("@/hooks/use-updater");
  const { useUiStore } = await import("@/stores/ui-store");

  showUpdateAvailableToast("1.2.3");
  useUiStore.getState().toastMessage?.actions?.find((a) => a.label === "今すぐ更新")?.onClick();
  await Promise.resolve();

  expect(useUiStore.getState().toastMessage?.message).toContain("現在のバージョンを引き続き使用します");
  expect(useUiStore.getState().toastMessage?.actions?.some((a) => a.label === "もう一度確認")).toBe(true);
});

it("re-checks updates from the fallback toast instead of auto-retrying the download", async () => {
  mockCheckForUpdate.mockResolvedValue(Result.succeed({ version: "1.2.3", body: null }));
  // failure toast setup omitted
  expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Add a failing action test for the menu path**

Add a test in `src/__tests__/lib/actions.test.ts` that executes `executeAction("check-for-updates")` and verifies the shared manual-check helper is used instead of duplicating the branching logic inline.

- [ ] **Step 3: Run the targeted tests to verify they fail**

Run: `pnpm vitest run src/__tests__/hooks/use-updater.test.ts src/__tests__/lib/actions.test.ts --reporter=dot`

Expected: FAIL because the current implementation still shows `アップデートのダウンロードに失敗しました: ...` and has no `もう一度確認` action or shared helper.

- [ ] **Step 4: Implement the minimal hook and action changes**

Update `src/hooks/use-updater.ts`:

```ts
export async function runManualUpdateCheck(): Promise<void> {
  const store = useUiStore.getState();

  try {
    const info = await performUpdateCheck();
    if (info) {
      showUpdateAvailableToast(info.version);
      return;
    }
    store.showToast("最新バージョンです");
  } catch (error) {
    console.error("Manual update check failed:", error);
    store.showToast("アップデートの確認に失敗しました");
  }
}

function showUpdateFailureToast(message: string): void {
  const store = useUiStore.getState();
  store.showToast({
    message: `アップデートに失敗しました。現在のバージョンを引き続き使用します。`,
    persistent: true,
    actions: [
      { label: "もう一度確認", onClick: () => void runManualUpdateCheck() },
      { label: "閉じる", onClick: () => store.clearToast() },
    ],
  });
  console.error("Update download failed:", message);
}
```

Then update `src/lib/actions.ts`:

```ts
import { runManualUpdateCheck } from "@/hooks/use-updater";

case "check-for-updates":
  void runManualUpdateCheck();
  break;
```

Rules:

- Do not auto-retry the download.
- Do not call `downloadAndInstallUpdate` from the failure toast.
- Keep startup check failure silent.
- Keep existing `showUpdateAvailableToast` and progress toast behavior intact.

- [ ] **Step 5: Run the targeted tests again**

Run: `pnpm vitest run src/__tests__/hooks/use-updater.test.ts src/__tests__/lib/actions.test.ts --reporter=dot`

Expected: PASS. The hook test should assert the fallback toast and re-check action. The actions test should assert the menu path still works via the shared helper.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-updater.ts src/lib/actions.ts src/__tests__/hooks/use-updater.test.ts src/__tests__/lib/actions.test.ts
git commit -m "feat: add updater fallback recheck flow"
```

### Task 3: Final Verification and TODO Cleanup

**Files:**

- Modify: `TODO.md`
- Verify: `tests/updater-config.test.ts`
- Verify: `src/__tests__/hooks/use-updater.test.ts`
- Verify: `src/__tests__/lib/actions.test.ts`

- [ ] **Step 1: Run the focused updater checks**

Run:

```bash
pnpm vitest run tests/updater-config.test.ts src/__tests__/hooks/use-updater.test.ts src/__tests__/lib/actions.test.ts --reporter=dot
```

Expected: PASS.

- [ ] **Step 2: Run the project gate**

Run: `mise run check`

Expected: format, lint, and all tests pass.

- [ ] **Step 3: Manually verify the fallback scenarios**

Use a signed draft release and an installed older build.

Checklist:

1. Success path
   - Launch the installed app
   - Trigger `Check for Updates...`
   - Click `今すぐ更新`
   - Expect download progress and `更新の準備ができました`
2. Interrupted download path
   - Start the same download
   - Disable the network mid-download
   - Expect `アップデートに失敗しました。現在のバージョンを引き続き使用します。`
   - Click `もう一度確認` after re-enabling the network
   - Expect a fresh update check, not an immediate download retry
3. Signature mismatch path
   - In a throwaway local edit, replace one character in `src-tauri/tauri.conf.json` `plugins.updater.pubkey`
   - rebuild or reinstall the app from that throwaway edit only
   - trigger the update against the same signed release
   - expect update rejection and the same fallback toast
   - restore the original `pubkey` before any commit

- [ ] **Step 4: Mark the TODO items complete**

Update `TODO.md`:

```md
- [x] `tauri.conf.json` の updater 設定で公開鍵が正しく設定されていることを確認する
- [x] ダウンロード中断時のリトライ/レジューム戦略を検討する
- [x] アップデート失敗時のフォールバック動作をテストする
```

- [ ] **Step 5: Commit**

```bash
git add TODO.md
git commit -m "docs: close updater fallback todo"
```
