# Auto Updater Design

tauri-plugin-updater + GitHub Releases による自動アップデート機能。

Issue: #8

## Overview

アプリ起動時に GitHub Releases をチェックし、新バージョンがあればトースト通知でユーザーに伝える。メニューからの手動チェックも可能。

```text
起動 → GitHub Releases JSON fetch → 新バージョン検出 → トースト通知
  → 「今すぐ更新」→ ダウンロード（進捗表示）→ 署名検証 → 再起動確認 → 再起動
```

## Decisions

| 決定事項           | 選択                      | 理由                                                                    |
| ------------------ | ------------------------- | ----------------------------------------------------------------------- |
| チェックタイミング | 起動時 + メニュー手動     | 定期チェックはバッテリー/ネットワークの無駄。手動チェックで即時性を確保 |
| 通知スタイル       | トースト（右下）          | 記事閲覧を邪魔しない。モーダルは過剰                                    |
| 更新適用           | ダウンロード → 再起動確認 | 記事閲覧中の強制再起動を防ぐ                                            |
| 進捗表示           | トースト内プログレスバー  | 追加コンポーネント不要。トーストの中身を差し替えるだけ                  |
| アーキテクチャ     | Rust 主導型               | 既存パターン（Rust commands + safeInvoke + event emit）と一貫           |
| 署名鍵             | パスワード付き            | 秘密鍵漏洩時の防御多層化。コストゼロでリスク低減                        |

## Architecture

### Rust Backend

#### New file: `src-tauri/src/commands/updater.rs`

2 つの Tauri command:

- `check_for_update` — GitHub Releases をチェック。新バージョンがあれば `{ version: String, body: Option<String> }` を返す。なければ `null`。フロントエンドは戻り値を受け取り、`null` でなければトースト通知を表示する（Rust 側からの event emit は行わない）。
- `download_and_install_update` — ダウンロード開始。進捗を `update-download-progress` イベントで emit（`{ percent: u8 }`）。完了したら `update-ready` イベントを emit。二重実行防止: Rust 側で `AtomicBool` フラグを持ち、ダウンロード中の再呼び出しはエラーを返す。フラグはダウンロード完了時（成功・失敗とも）に必ずリセットする（`scopeguard` または手動 `store(false)` を全 return パスで実行）。

再起動は `app.restart()` (Tauri 2 API) を使用する。

#### `tauri.conf.json` changes

```json
"plugins": {
  "clipboard-manager": {},
  "updater": {
    "endpoints": [
      "https://github.com/jey3dayo/ultra-rss-reader/releases/latest/download/latest.json"
    ],
    "pubkey": "<generated public key>"
  }
}
```

#### Capabilities

`src-tauri/capabilities/default.json` に `"updater:default"` を追加。

#### Menu

`menu.rs` の App サブメニュー（Settings の下、separator の後）に:

```text
Check for Updates...  (id: "check-for-updates")
```

`handle_event` に `"check-for-updates" => "check-for-updates"` マッピングを追加。

### メニューイベントフロー（既存パターンと統一）

1. Rust `handle_event` → `menu-action` イベントで `"check-for-updates"` を emit
2. `use-menu-events.ts` が受信 → `executeAction("check-for-updates")` を呼び出し
3. `lib/actions.ts` の `AppAction` 型に `"check-for-updates"` を追加し、`executeAction` 内で updater の invoke を呼ぶ
4. `use-updater.ts` は起動時チェックと `update-download-progress` / `update-ready` イベントリスナーのみ担当

### GitHub Actions

#### `release.yml` changes

`tauri-action` の `env` に署名用変数を追加:

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
```

`tauri-action` は updater 有効プロジェクトで自動的に:

- バイナリに署名付与
- `latest.json` をリリースアーティファクトとして生成

#### Initial setup (manual)

1. `tauri signer generate -w ~/.tauri/ultra-rss-reader.key` で鍵ペア生成
2. 公開鍵を `tauri.conf.json` の `pubkey` に設定
3. 秘密鍵とパスワードを GitHub Secrets に登録
4. 鍵は 1Password に保存済み

### TypeScript Frontend

#### Toast extension (`ui-store.ts`)

既存の `showToast`（テキストのみ、5秒自動消去）を拡張。後方互換性を保つため、シグネチャは `showToast(message: string | ToastData)` とし、`string` を渡した場合は従来通りの動作を維持する:

```ts
type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastData = {
  message: string;
  persistent?: boolean; // true: no auto-dismiss
  progress?: number; // 0-100, download progress
  actions?: ToastAction[]; // e.g. "Update Now", "Later"
};
```

#### Toast state transitions

1. Notification: "v0.2.0 が利用可能です" + [今すぐ更新] [後で]
2. Downloading: "ダウンロード中... 45%" + progress bar (buttons hidden)
3. Ready: "更新の準備ができました" + [再起動] [後で]

#### New file: `src/hooks/use-updater.ts`

Tauri イベントの listen + invoke ロジック:

- アプリ起動時: `check_for_update` を invoke → 戻り値が非 null なら通知トースト表示
- `update-download-progress` イベント → 進捗トースト更新
- `update-ready` イベント → 再起動確認トースト表示
- 「後で」ボタン: トーストを消去するのみ。次回アプリ起動時に再チェックされる

注: メニューからの手動チェック（`check-for-updates`）は `lib/actions.ts` の `executeAction` が担当する。`use-updater.ts` は起動時チェックとイベントリスナーのみ。

#### Existing file changes

- `ui-store.ts` — toast type extension
- `app-shell.tsx` — add `useUpdater()` hook call
- Toast component — action buttons + progress bar support

## Error Handling

### Rust

| Error                          | Mapping                                             | Behavior                                                          |
| ------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------- |
| Network unreachable            | `DomainError::Network` → `AppError::Retryable`      | Startup: silent. Manual: toast "アップデートの確認に失敗しました" |
| Signature verification failure | `DomainError::Validation` → `AppError::UserVisible` | Toast "アップデートの検証に失敗しました". Do not apply.           |

### Frontend

- All calls via `safeInvoke` returning `Result` type (existing pattern)
- Startup check failure is silent (do not block RSS reader main function)
- Manual check failure shows toast (user initiated, expects feedback)

## Testing

### Rust

- Unit test for error mapping (`DomainError` → `AppError` conversion) in `commands/updater.rs`
- Actual update E2E verified manually on first release

### TypeScript

- `use-updater.ts`: mock Tauri event listen/invoke, verify toast flow
  - `check_for_update` returns non-null → correct notification toast with buttons
  - `update-download-progress` → progress updates
  - `update-ready` → restart confirmation toast
- `ui-store`: extended toast type behavior (`persistent`, `progress`, `actions`)

### Manual verification

- Test with a `v0.1.1` tag for first release
- 3 scenarios: no update available, network error, new version available

## Dependencies

### Rust

- `tauri-plugin-updater = "2"` in `Cargo.toml`

### Frontend

- 追加の npm パッケージ不要。Rust command を `@tauri-apps/api/core` の `invoke` で呼び、イベントは `@tauri-apps/api/event` の `listen` で受信する（既存パターン）。

## File Change Summary

| File                                  | Change                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src-tauri/Cargo.toml`                | Add `tauri-plugin-updater`                                                                                 |
| `src-tauri/tauri.conf.json`           | Add updater plugin config with endpoint + pubkey                                                           |
| `src-tauri/capabilities/default.json` | Add `updater:default` permission                                                                           |
| `src-tauri/src/commands/updater.rs`   | New — check_for_update, download_and_install_update commands                                               |
| `src-tauri/src/commands/mod.rs`       | Register updater module                                                                                    |
| `src-tauri/src/lib.rs`                | Register updater commands + plugin                                                                         |
| `src-tauri/src/menu.rs`               | Add "Check for Updates..." menu item + event handler                                                       |
| `.github/workflows/release.yml`       | Add signing env vars                                                                                       |
| `src/stores/ui-store.ts`              | Extend toast types                                                                                         |
| `src/hooks/use-updater.ts`            | New — updater event listener + invoke logic                                                                |
| `src/api/tauri-commands.ts`           | Add `checkForUpdate`, `downloadAndInstallUpdate` wrappers                                                  |
| `src/components/app-shell.tsx`        | Call `useUpdater()` + Toast inline component (action buttons + progress bar)                               |
| `src/lib/actions.ts`                  | Add `"check-for-updates"` to `AppAction` + `executeAction` (既存 `never` 網羅性チェックが case 漏れを防止) |
