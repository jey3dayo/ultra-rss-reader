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

## 根拠

認証情報を SQLite に平文保存すると、DB ファイルのコピーで漏洩する。OS keyring は macOS Keychain / Windows Credential Manager / Linux Secret Service を使い、OS レベルの暗号化で保護される。

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
