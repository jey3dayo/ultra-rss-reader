# Tauri タスクの mise 統一設計

## 概要

`pnpm tauri` 経由で実行していた Tauri 関連コマンドを mise タスクに `app:` プレフィックスで統一登録する。

## 背景

- `pnpm tauri dev` は `package.json` の `"tauri": "tauri"` パススルー経由で動くが、発見しにくい
- mise.toml にはすでに `build:app` / `build:app:debug` があるが、命名が不統一
- ブラウザ確認用の dev server コマンドが未登録

## 設計

### 命名規則

`app:` プレフィックスでアプリ関連タスクを統一する。ユーザー視点で「アプリの○○」として自然に想起できることを優先。

### タスク一覧

| タスク            | コマンド                                             | 説明                   |
| ----------------- | ---------------------------------------------------- | ---------------------- |
| `app:dev`         | `pnpm tauri dev`                                     | ネイティブアプリで開発 |
| `app:dev:browser` | `pnpm dev --host 127.0.0.1 --port 4173 --strictPort` | ブラウザ UI 確認       |
| `app:build`       | `pnpm tauri build`                                   | リリースビルド         |
| `app:build:debug` | `pnpm tauri build --debug`                           | デバッグビルド         |
| `app:icon`        | `pnpm tauri icon`                                    | アイコン生成           |

### 変更対象

- **mise.toml**: `build:app` → `app:build`, `build:app:debug` → `app:build:debug` にリネーム。`app:dev`, `app:dev:browser`, `app:icon` を新規追加
- **package.json**: `"tauri": "tauri"` パススルーは残す（mise 未登録のサブコマンド用）

### 変更しないもの

- `dev` (vite), `build` (tsc + vite build) — フロントエンド単体用として維持
- package.json のその他スクリプト
