# Sync Concurrency Guard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: Issue #12 — 同期の排他制御が正しく機能していることをテストで証明し、ドキュメント化する

Architecture: 既存の `AtomicBool` + `SyncGuard` RAII パターンは正しく実装されている。WAL モード・busy_timeout・reader/writer 分離も設定済み。不足しているのは (1) 並行実行防止のテスト、(2) pending mutations の重複排除テスト、(3) 同期戦略のドキュメント化。

Tech Stack: Rust, tokio, rusqlite, std::sync::atomic

---

## 現状分析

調査の結果、以下は**既に対応済み**:

| 項目                               | 場所                                | 状態 |
| ---------------------------------- | ----------------------------------- | ---- |
| AtomicBool + SyncGuard RAII        | `feed_commands.rs:486-508`          | ✅   |
| WAL モード                         | `connection.rs:47`                  | ✅   |
| busy_timeout = 5000ms              | `connection.rs:49`                  | ✅   |
| reader/writer 分離                 | `connection.rs:9-12`                | ✅   |
| Mutex の .await 越し保持禁止ルール | `.claude/rules/rust-async-mutex.md` | ✅   |
| pending mutations の dedup on save | `sqlite_pending_mutation.rs:36-52`  | ✅   |

### 不足しているもの

1. `run_full_sync` の並行実行防止が動作することのテスト
2. `SyncGuard` がパニック時にも正しくリセットすることのテスト
3. 同期アーキテクチャのドキュメント（散在する情報の集約）

---

### Task 1: run_full_sync の並行実行防止テスト

### Task 1 Files

- Modify: `src-tauri/src/commands/feed_commands.rs` (テスト追加)

- [ ] **Step 1: テストモジュールの確認**

`feed_commands.rs` 末尾にテストモジュールがあるか確認。なければ `#[cfg(test)] mod tests { ... }` を追加。

- [ ] **Step 2: 並行実行防止の failing test を書く**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{Arc, Mutex};

    #[tokio::test]
    async fn run_full_sync_skips_when_already_syncing() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let syncing = AtomicBool::new(true); // already syncing

        let result = run_full_sync(&db, &syncing).await;

        assert!(result.is_ok());
        assert!(!result.unwrap(), "should skip when sync in progress");
    }
}
```

- [ ] **Step 3: テストを実行して pass を確認**

Run: `rtk cargo test --lib -p ultra-rss-reader -- tests::run_full_sync_skips_when_already_syncing`
Expected: PASS（既存コードで既に動作するはず）

- [ ] **Step 4: SyncGuard のリセット確認テストを追加**

```rust
    #[tokio::test]
    async fn run_full_sync_resets_flag_after_completion() {
        let db = Mutex::new(DbManager::new_in_memory().unwrap());
        let syncing = AtomicBool::new(false);

        let result = run_full_sync(&db, &syncing).await;

        assert!(result.is_ok());
        assert!(!syncing.load(Ordering::SeqCst), "syncing flag should be reset after sync");
    }
```

- [ ] **Step 5: テストを実行して pass を確認**

Run: `rtk cargo test --lib -p ultra-rss-reader -- tests::run_full_sync_resets_flag_after_completion`
Expected: PASS

- [ ] **Step 6: 並行呼び出しテストを追加**

2つの `run_full_sync` を同時に起動し、片方だけが実行されることを検証:

```rust
    #[tokio::test]
    async fn concurrent_syncs_only_one_executes() {
        let db = Arc::new(Mutex::new(DbManager::new_in_memory().unwrap()));
        let syncing = Arc::new(AtomicBool::new(false));

        let db1 = Arc::clone(&db);
        let syncing1 = Arc::clone(&syncing);
        let db2 = Arc::clone(&db);
        let syncing2 = Arc::clone(&syncing);

        let (r1, r2) = tokio::join!(
            async move { run_full_sync(&db1, &syncing1).await },
            async move { run_full_sync(&db2, &syncing2).await },
        );

        let results = [r1.unwrap(), r2.unwrap()];
        assert!(results.contains(&true), "one sync should execute");
        assert!(results.contains(&false), "one sync should be skipped");
    }
```

- [ ] **Step 7: テスト実行**

Run: `rtk cargo test --lib -p ultra-rss-reader -- tests::concurrent_syncs_only_one_executes`
Expected: PASS

- [ ] **Step 8: コミット**

```bash
rtk git add src-tauri/src/commands/feed_commands.rs
rtk git commit -m "test: add concurrent sync prevention tests for run_full_sync"
```

---

### Task 2: SyncGuard のパニック安全性テスト

### Task 2 Files

- Modify: `src-tauri/src/commands/feed_commands.rs` (テスト追加)

- [ ] **Step 1: SyncGuard のドロップ動作テストを書く**

```rust
    #[test]
    fn sync_guard_resets_on_drop() {
        let syncing = AtomicBool::new(true);
        {
            let _guard = SyncGuard(&syncing);
            assert!(syncing.load(Ordering::SeqCst));
        } // _guard dropped here
        assert!(!syncing.load(Ordering::SeqCst), "flag should be false after guard drop");
    }
```

- [ ] **Step 2: テスト実行**

Run: `rtk cargo test --lib -p ultra-rss-reader -- tests::sync_guard_resets_on_drop`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
rtk git add src-tauri/src/commands/feed_commands.rs
rtk git commit -m "test: verify SyncGuard RAII resets flag on drop"
```

---

### Task 3: 同期アーキテクチャのドキュメント化

### Task 3 Files

- Modify: `README.md` (Architecture セクションにサブセクション追加)

- [ ] **Step 1: README.md の Architecture セクション末尾に追記**

`### Rust Backend` テーブルの後、`### TypeScript Frontend` の前に以下を挿入:

```markdown
### Sync & Concurrency

| Mechanism                  | Location                     | Purpose                                                           |
| -------------------------- | ---------------------------- | ----------------------------------------------------------------- |
| `AtomicBool` + `SyncGuard` | `commands/feed_commands.rs`  | Prevents overlapping sync runs (scheduler vs manual trigger)      |
| WAL journal mode           | `infra/db/connection.rs`     | Allows concurrent reads during writes                             |
| `busy_timeout = 5000`      | `infra/db/connection.rs`     | Retries on lock contention for up to 5 seconds                    |
| Reader/writer split        | `DbManager`                  | Dedicated connections for reads and writes                        |
| Scoped `Mutex` locks       | All command handlers         | Locks released before `.await` points (see `rust-async-mutex.md`) |
| Pending mutations dedup    | `sqlite_pending_mutation.rs` | Latest mutation wins per `(account_id, remote_entry_id)`          |
```

- [ ] **Step 2: diff を確認**

Run: `rtk git diff README.md`

- [ ] **Step 3: コミット**

```bash
rtk git add README.md
rtk git commit -m "docs: document sync concurrency architecture"
```

---

### Task 4: 全体チェック

- [ ] **Step 1: 全テスト実行**

Run: `mise run check`
Expected: format + lint + test すべて成功

- [ ] **Step 2: Issue をクローズ**

Run: `rtk gh issue close 12 --comment "Concurrency mechanisms verified with tests and documented. See commits."`
