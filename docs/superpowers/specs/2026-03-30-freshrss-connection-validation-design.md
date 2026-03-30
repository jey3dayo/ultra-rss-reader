# FreshRSS 接続検証設計

## 概要

FreshRSSアカウント追加時に、保存前に接続テスト（認証）を実行し、成功した場合のみアカウントを保存する。失敗時は段階的なエラーメッセージを表示してフォームに留まる。

## 背景と課題

- アカウント追加後、同期が走るまで設定の正誤を確認する手段がない
- FreshRSSのAPIパスワードとログインパスワードの違いがわかりにくい
- 接続失敗時のフィードバックがない

## 設計

### アプローチ

既存の `addAccount` Tauriコマンド内で、DB保存前に `authenticate()` を実行する。新規コマンドは追加しない。

### Rust バックエンド

**`add_account` を `pub fn` → `pub async fn` に変更する。** Tauri 2 は async command をサポートしており、`trigger_sync` 等で既にパターンが確立されている。

### `add_account` コマンドのフロー変更

```text
現在: parse kind → create Account → keyring保存 → DB保存 → return
新規: parse kind → FreshRss/Inoreaderなら authenticate() (.await) → 成功 → keyring保存 → DB保存 → return
                                                                  → 失敗 → エラー返却（保存しない）
```

- `ProviderKind::Local` はリモート接続なしなのでスキップ
- `authenticate()` は既存の `GReaderProvider` をそのまま利用
- `.await` 中に DB ロックを保持しない（`rust-async-mutex` ルール遵守）
- エラーは既存の `DomainError::Network` / `DomainError::Auth` → `AppError` 変換
- Inoreader の場合は `app_id`/`app_key` を preferences から取得して provider に設定する（`sync_greader_account` と同じパターン）

タイムアウト: 認証テスト用に `reqwest::Client` のタイムアウトを 15 秒に設定する。無応答サーバーに対してユーザーが無限に待つことを防止する。

### エラーメッセージの段階的分類

| エラー種別       | Rustのエラー           | 意味                              |
| ---------------- | ---------------------- | --------------------------------- |
| サーバー到達不可 | `DomainError::Network` | URLが不正、またはサーバーがダウン |
| 認証失敗         | `DomainError::Auth`    | ユーザー名/APIパスワードが不正    |

### フロントエンド

### フォームフロー

```text
handleSubmit → setLoading(true) → addAccount() → 成功 → 画面遷移
                                                → 失敗 → showToast(エラーメッセージ) → setLoading(false)
```

### UI変更

- 保存ボタン: loading状態でスピナー + 「接続を確認中...」テキスト + disabled
- ローディング中はフォーム全体のinputもdisabled（二重送信防止）
- エラー表示は既存の `showToast` を使用

### エラー表示の組み立て

Rust側でユーザー向けメッセージを組み立てて `AppError` の `message` に含めて返す。フロント側は `AppError.type` で分岐:

- `Retryable`（Network系）→ トーストに `message` を表示
- `UserVisible`（Auth系）→ トーストに `message` を表示

Rust側のメッセージ組み立て:

- Network → 「サーバーに接続できません。URLを確認してください」
- Auth + FreshRss → 「認証に失敗しました…」+ APIパスワードのヒント
- Auth + その他 → 「認証に失敗しました…」のみ

### i18n キー

| キー                       | ja                                                                  | en                                                                 |
| -------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `connection_testing`       | 接続を確認中...                                                     | Testing connection...                                              |
| `error_network`            | サーバーに接続できません。URLを確認してください                     | Cannot connect to server. Please check the URL                     |
| `error_auth`               | 認証に失敗しました。ユーザー名とAPIパスワードを確認してください     | Authentication failed. Please check your username and API password |
| `error_auth_hint_freshrss` | FreshRSSのプロフィール設定からAPIパスワードを設定する必要があります | You need to set an API password in FreshRSS Profile settings       |

## 変更ファイル

### 変更する

- `src-tauri/src/commands/account_commands.rs` — `add_account` に認証テスト追加
- `src/components/settings/add-account-form.tsx` — loading状態 + エラーハンドリング
- `src/locales/ja/common.json` — エラーメッセージ追加
- `src/locales/en/common.json` — エラーメッセージ追加

### 変更しない

- `FeedProvider` トレイト — 既存の `authenticate()` を利用
- `GReaderProvider` — 変更不要
- `ui-store` — 既存の `showToast` を使用
- `tauri-commands.ts` — シグネチャ変更なし

## テスト

- Rust: 認証失敗時にアカウントが保存されないことを確認するテスト追加を検討
- フロント: loading/エラー状態の表示テスト追加を検討
