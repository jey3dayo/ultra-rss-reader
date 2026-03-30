---
paths:
  - "src-tauri/src/**/*.rs"
---

# OS Keyring による認証情報管理

## 制約

- パスワード・トークンなどの認証情報は SQLite に保存せず、OS keyring (`infra/keyring_store.rs`) を使う
- keyring 操作は `keyring_store::set_password` / `get_password` / `delete_password` を経由する
- keyring 保存は DB 保存より先に行う（fail fast: keyring が使えない環境で不整合を防ぐ）
- アカウント削除時は keyring エントリも削除する（`delete_password` は NotFound を無視する）
- keyring エラーは `DomainError::Keychain` にマッピングする

## Dev モード（Keychain バイパス）

環境変数 `ULTRA_RSS_DEV_CREDENTIALS=1`（`.env` で dotenvx 管理）がセットされている場合、OS Keychain の代わりに `~/.local/share/ultra-rss-reader/dev-credentials.json` にファイルベースで保存する。

- `mise run app:dev` は `dotenvx run --` 経由で起動するため自動的に有効
- `mise run app:dev:signed` や `mise run app:build` では無効（本番同等の Keychain を使用）
- dev credentials ファイルはリポジトリ外に保存されるため `.gitignore` 不要

## 根拠

認証情報を SQLite に平文保存すると、DB ファイルのコピーで漏洩する。OS keyring は macOS Keychain / Windows Credential Manager / Linux Secret Service を使い、OS レベルの暗号化で保護される。
dev モードでは `cargo tauri dev` が毎回バイナリを再ビルドするため、macOS が未署名の新しいアプリとして扱い Keychain アクセスのたびに許可ダイアログが表示される。ファイルベースストアでこれを回避する。

## 例

### 正しい

```rust
// アカウント作成: keyring を先に保存
if account.kind == ProviderKind::FreshRss {
    if let Some(ref pw) = password {
        keyring_store::set_password(account.id.as_ref(), pw)?;
    }
}
// その後 DB に保存
repo.save(&account)?;

// アカウント削除: keyring をクリーンアップ
if let Err(e) = keyring_store::delete_password(&account_id) {
    warn!("Failed to clean up keyring for account {account_id}: {e}");
}
repo.delete(&AccountId(account_id))?;
```

### 不正

```rust
// DB にパスワードを保存
repo.save_with_password(&account, &password)?;

// keyring エラーを完全に無視
let _ = keyring_store::delete_password(&account_id);
```

## 強制

- [x] 手動レビュー

## 関連ルール

- `rust-async-mutex.md`: keyring 操作は同期関数なので Mutex 制約とは独立
