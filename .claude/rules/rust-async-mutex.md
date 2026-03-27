---
paths:
  - "src-tauri/src/**/*.rs"
---

# std::sync::Mutex と async の安全な併用

## 制約

- `std::sync::MutexGuard` を `.await` ポイントをまたいで保持してはならない
- DB ロックは `{ }` ブロック内で取得し、同期処理のみ行い、ブロック末尾で即 drop する
- async な HTTP リクエスト中は DB ロックを保持しない

## 根拠

`std::sync::Mutex` のガードを `.await` またぎで保持すると Tokio ランタイムのスレッドをブロックし、デッドロックの原因になる。`AppState` は `std::sync::Mutex<DbManager>` を使用しているため、全ての Tauri command でこのパターンを守る必要がある。

## 例

### 正しい

```rust
// HTTP リクエスト（no lock held）
let entries = provider.pull_entries(scope, None).await?;

// DB 操作は { } ブロック内で完結
{
    let db = state.db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })?;
    let repo = SqliteArticleRepository::new(db.writer());
    repo.upsert(&articles)?;
} // lock dropped here, before next .await
```

### 不正

```rust
let db = state.db.lock().unwrap();
let repo = SqliteArticleRepository::new(db.writer());
let entries = provider.pull_entries(scope, None).await?; // DEADLOCK: lock held across .await
repo.upsert(&articles)?;
```

## 例外

- 同期関数（`fn` not `async fn`）内では `.await` が存在しないため、ロックスコープの制約はない

## 強制

- [x] 手動レビュー
- [ ] 自動 Linter

## 関連ルール

- `shadcn-ui.md`: フロントエンド側のルール
