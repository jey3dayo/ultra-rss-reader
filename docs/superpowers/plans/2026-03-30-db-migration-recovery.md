# DB Migration Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Goal: DB マイグレーションを単一トランザクションで安全に実行し、失敗時はバックアップ/WAL を踏まえて復旧したうえで、ユーザーに誤解のない起動エラーメッセージを表示する。

Architecture: `src-tauri/src/infra/db/migration.rs` で migration 全体を 1 transaction に包み、`src-tauri/src/infra/db/connection.rs` で backup -> migrate -> detach connections -> restore -> fail-fast の順序を管理する。ユーザー向け案内は migration recovery の詳細を `connection.rs` で組み立て、`src-tauri/src/lib.rs` の起動失敗メッセージで包んで表示する。

Tech Stack: Rust, rusqlite, SQLite WAL, tempfile, tracing, Tauri 2

Spec: `docs/superpowers/specs/2026-03-30-db-migration-recovery-design.md`

---

## File Structure

| Action | File | Responsibility |
| ------ | ---- | -------------- |
| Modify | `src-tauri/src/infra/db/migration.rs` | migration 全体の transaction 化、migration 由来エラーへの正規化、rollback テスト追加 |
| Modify | `src-tauri/src/infra/db/connection.rs` | restore 前の接続解放、バックアップ有無で分岐する recovery メッセージ、復旧フローの追加テスト |
| Modify | `src-tauri/src/lib.rs` | 起動失敗メッセージから「自動復旧済みかもしれない」という曖昧表現を外し、migration 詳細をそのまま表示する |

---

### Task 1: `migration.rs` を単一トランザクション化する

### Files

- Modify: `src-tauri/src/infra/db/migration.rs`

- [ ] **Step 1: rollback を証明する失敗テストを追加**

`src-tauri/src/infra/db/migration.rs` の `tests` に追加:

```rust
#[test]
fn failure_during_multi_step_migration_rolls_back_all_changes() {
    let mut conn = open_in_memory();
    conn.execute_batch(MIGRATION_V1).unwrap();
    conn.execute_batch(MIGRATION_V2).unwrap();
    conn.execute_batch(MIGRATION_V3).unwrap();
    assert_eq!(get_schema_version(&conn), 3);

    // V5 が duplicate column で失敗するように先に列だけ追加する
    conn.execute(
        "ALTER TABLE feeds ADD COLUMN display_mode TEXT NOT NULL DEFAULT 'split'",
        [],
    )
    .unwrap();

    let err = run_migrations(&mut conn).unwrap_err();
    assert!(matches!(err, crate::domain::error::DomainError::Migration(_)));

    let version = get_schema_version(&conn);
    assert_eq!(version, 3, "schema_version should roll back to v3");

    let tag_count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='tags'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(tag_count, 0, "V4 tables should be rolled back");
}
```

- [ ] **Step 2: 失敗を確認**

Run:

```bash
cd src-tauri && cargo test infra::db::migration::tests::failure_during_multi_step_migration_rolls_back_all_changes -- --nocapture
```

Expected: FAIL。現在の実装では `V4` の変更が残るか、`DomainError::Persistence` が返ってテスト期待とずれる。

- [ ] **Step 3: migration 全体を 1 transaction に包む**

`run_migrations` を次の形に変更:

```rust
use crate::domain::error::{DomainError, DomainResult};

pub fn run_migrations(conn: &mut Connection) -> DomainResult<MigrationResult> {
    let from_version = get_schema_version(conn);

    {
        let tx = conn
            .transaction()
            .map_err(|e| DomainError::Migration(format!("Failed to start migration transaction: {e}")))?;

        if from_version < 1 {
            tx.execute_batch(MIGRATION_V1)
                .map_err(|e| DomainError::Migration(format!("Migration to v1 failed: {e}")))?;
        }
        if from_version < 2 {
            tx.execute_batch(MIGRATION_V2)
                .map_err(|e| DomainError::Migration(format!("Migration to v2 failed: {e}")))?;
        }
        if from_version < 3 {
            tx.execute_batch(MIGRATION_V3)
                .map_err(|e| DomainError::Migration(format!("Migration to v3 failed: {e}")))?;
        }
        if from_version < 4 {
            tx.execute_batch(MIGRATION_V4)
                .map_err(|e| DomainError::Migration(format!("Migration to v4 failed: {e}")))?;
        }
        if from_version < 5 {
            tx.execute_batch(MIGRATION_V5)
                .map_err(|e| DomainError::Migration(format!("Migration to v5 failed: {e}")))?;
        }

        tx.commit()
            .map_err(|e| DomainError::Migration(format!("Failed to commit migrations: {e}")))?;
    }

    let to_version = get_schema_version(conn);
    Ok(MigrationResult {
        from_version,
        to_version,
    })
}
```

実装時の注意:

- `to_version` は `commit()` 後に読む
- `?` で `rusqlite::Error -> Persistence` に落とさず、migration 経路では必ず `DomainError::Migration` に寄せる
- 既存の `fresh_db_migrates_to_latest` / `already_current_is_noop` / `version_skip_*` テストはそのまま通す

- [ ] **Step 4: migration テストをまとめて実行**

Run:

```bash
cd src-tauri && cargo test infra::db::migration -- --nocapture
```

Expected: PASS。既存 4 テストに加え rollback テストも通る。

- [ ] **Step 5: フルゲートを実行**

Run:

```bash
mise run check
```

Expected: format/lint/test がすべて PASS。

- [ ] **Step 6: コミット**

```bash
git add src-tauri/src/infra/db/migration.rs
git commit -m "fix: wrap db migrations in a transaction"
```

---

### Task 2: restore 前に接続を解放する不変条件をコード化する

### Files

- Modify: `src-tauri/src/infra/db/connection.rs`

- [ ] **Step 1: 接続差し替え helper の失敗テストを追加**

`src-tauri/src/infra/db/connection.rs` の `tests` に追加:

```rust
#[test]
fn detach_connections_for_restore_replaces_file_backed_handles() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let mut manager = DbManager::new(&db_path).unwrap();

    super::DbManager::detach_connections_for_restore(&mut manager).unwrap();

    assert!(manager.writer().prepare("SELECT * FROM accounts").is_err());
    assert!(manager.reader().prepare("SELECT * FROM accounts").is_err());
}
```

狙い:

- restore 前に file-backed connection が `:memory:` に差し替わることをコード上の不変条件にする
- OS ロックを直接検証する代わりに、「restore 開始時点で manager が元 DB を握っていない」ことを証明する

- [ ] **Step 2: 失敗を確認**

Run:

```bash
cd src-tauri && cargo test infra::db::connection::tests::detach_connections_for_restore_replaces_file_backed_handles -- --nocapture
```

Expected: FAIL。helper がまだ存在しない。

- [ ] **Step 3: 接続解放 helper を追加して restore 前に必ず呼ぶ**

`DbManager` に private helper を追加:

```rust
fn detach_connections_for_restore(manager: &mut Self) -> DomainResult<()> {
    let writer = Connection::open(":memory:")?;
    Self::apply_pragmas(&writer)?;
    let reader = Connection::open(":memory:")?;
    Self::apply_pragmas(&reader)?;

    let old_writer = std::mem::replace(&mut manager.writer, writer);
    let old_reader = std::mem::replace(&mut manager.reader, reader);
    drop(old_writer);
    drop(old_reader);

    Ok(())
}
```

`run_migrations_with_restore` の error branch を次の順序に固定:

```rust
tracing::error!("Migration failed: {e}");
let backup = super::backup::backup_path(db_path, backup_version);

if backup.exists() {
    Self::detach_connections_for_restore(manager)?;
    super::backup::restore_backup(db_path, &backup, backup_version)?;
    // restore succeeded, but still return Migration error (fail-fast)
}
```

実装時の注意:

- `rollback` 自体は `run_migrations` の transaction drop/commit 失敗処理で完了するが、それだけでは file copy restore の前提条件として不十分
- restore 前に `writer` / `reader` / transaction ハンドルの全てが drop 済みである順序を崩さない
- `detach_connections_for_restore` 内でも `?` は `DomainError::Migration` ではなく `Persistence` に落ちるため、呼び出し側で `DomainError::Migration` に包み直すか、helper 内で明示的に `Migration` に変換する

- [ ] **Step 4: 追加した helper テストを実行**

Run:

```bash
cd src-tauri && cargo test infra::db::connection::tests::detach_connections_for_restore_replaces_file_backed_handles -- --nocapture
```

Expected: PASS。

- [ ] **Step 5: 既存の restore フロー回帰テストを実行**

Run:

```bash
cd src-tauri && cargo test infra::db::connection::tests::migration_failure_restores_from_backup -- --nocapture
```

Expected: PASS。既存の restore + fail-fast 挙動を壊していない。

- [ ] **Step 6: フルゲートを実行**

Run:

```bash
mise run check
```

Expected: PASS。

- [ ] **Step 7: コミット**

```bash
git add src-tauri/src/infra/db/connection.rs
git commit -m "fix: release sqlite connections before restore"
```

---

### Task 3: バックアップ有無で recovery メッセージを分岐させる

### Files

- Modify: `src-tauri/src/infra/db/connection.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: recovery メッセージの失敗テストを追加**

`src-tauri/src/infra/db/connection.rs` の `tests` に追加:

```rust
#[test]
fn migration_failure_message_with_backup_includes_backup_path_and_backup_set_restore_hint() {
    let backup = std::path::Path::new("/tmp/test.db.backup-v4");
    let message = super::format_migration_failure_message(
        super::RestoreStatus::Restored { backup_version: 4 },
        backup,
        "duplicate column name: display_mode",
    );

    assert!(message.contains("Backup path: /tmp/test.db.backup-v4"));
    assert!(message.contains("-wal / -shm"));
    assert!(message.contains("restored to v4"));
}

#[test]
fn migration_failure_message_without_backup_omits_backup_path() {
    let message = super::format_migration_failure_message(
        super::RestoreStatus::Unavailable,
        std::path::Path::new("/tmp/test.db.backup-v4"),
        "duplicate column name: display_mode",
    );

    assert!(!message.contains("Backup path:"));
    assert!(message.contains("no usable backup"));
}
```

`src-tauri/src/lib.rs` の `tests` に追加:

```rust
#[test]
fn migration_error_message_does_not_claim_automatic_restore_when_backup_is_unavailable() {
    let message = database_init_error_message(
        &DomainError::Migration(
            "Migration to v5 failed: duplicate column. Automatic restore: not available because no usable backup was created.".to_string(),
        ),
        Path::new("/tmp/ultra-rss-reader.db"),
    );

    assert!(!message.contains("may already have been restored automatically"));
    assert!(message.contains("Do not delete the database file"));
}
```

- [ ] **Step 2: 失敗を確認**

Run:

```bash
cd src-tauri && cargo test migration_failure_message -- --nocapture
cd src-tauri && cargo test database_init_error_message -- --nocapture
```

Expected: FAIL。formatter/helper がまだ存在しないか、現状文言が条件分岐を満たさない。

- [ ] **Step 3: `connection.rs` に recovery formatter を追加**

`src-tauri/src/infra/db/connection.rs` に最小限の local enum/helper を追加:

```rust
enum RestoreStatus {
    Restored { backup_version: i32 },
    RestoreFailed { restore_error: String },
    Unavailable,
}

fn format_migration_failure_message(
    restore_status: RestoreStatus,
    backup_path: &Path,
    cause: &str,
) -> String {
    match restore_status {
        RestoreStatus::Restored { backup_version } => format!(
            "Migration to v{} failed: {cause}\n\
             Backup path: {}\n\
             Automatic restore: succeeded and restored the database to v{backup_version}.\n\
             If you need to restore manually, close the app and restore the backup set for the database file, including any matching -wal / -shm files if they exist.",
            super::migration::LATEST_VERSION,
            backup_path.display(),
        ),
        RestoreStatus::RestoreFailed { restore_error } => format!(
            "Migration to v{} failed: {cause}\n\
             Backup path: {}\n\
             Automatic restore: failed: {restore_error}\n\
             Manual intervention required. If you restore manually, restore the backup set for the database file, including any matching -wal / -shm files if they exist.",
            super::migration::LATEST_VERSION,
            backup_path.display(),
        ),
        RestoreStatus::Unavailable => format!(
            "Migration to v{} failed: {cause}\n\
             Automatic restore: not available because no usable backup was created.",
            super::migration::LATEST_VERSION,
        ),
    }
}
```

`run_migrations_with_restore` の各 branch をこの helper に寄せる。

実装時の注意:

- `Backup path:` は `backup.exists()` の場合だけ表示する
- バックアップ未作成/未存在 branch では、存在しない path を案内しない
- manual restore 文言は「DB ファイルを backup で置き換える」ではなく、「backup set を戻す」と書く

- [ ] **Step 4: `lib.rs` の migration 失敗 wrapper を更新**

`database_init_error_message` の migration branch を次の方針に変更:

```rust
DomainError::Migration(_) => format!(
    "Failed to initialize database: {error}\n\
     Database path: {}\n\
     Do not delete the database file.\n\
     Please update the application or contact support.",
    db_path.display()
)
```

実装時の注意:

- 現在の `The database may already have been restored automatically.` は常に真ではないため削除する
- restore 成功/失敗/未実施の詳細は `DomainError::Migration` の本文をそのまま表示する
- 非 migration branch の削除案内は維持する

- [ ] **Step 5: 追加したメッセージテストを実行**

Run:

```bash
cd src-tauri && cargo test migration_failure_message -- --nocapture
cd src-tauri && cargo test database_init_error_message -- --nocapture
```

Expected: PASS。

- [ ] **Step 6: connection/lib の回帰テストを実行**

Run:

```bash
cd src-tauri && cargo test infra::db::connection -- --nocapture
cd src-tauri && cargo test lib -- --nocapture
```

Expected: PASS。既存の「削除を勧めない」テストと restore テストも維持される。

- [ ] **Step 7: フルゲートを実行**

Run:

```bash
mise run check
```

Expected: PASS。

- [ ] **Step 8: コミット**

```bash
git add src-tauri/src/infra/db/connection.rs src-tauri/src/lib.rs
git commit -m "fix: clarify db migration recovery messaging"
```

---

### Task 4: 最終確認と handoff

### Files

- Modify: `src-tauri/src/infra/db/migration.rs`
- Modify: `src-tauri/src/infra/db/connection.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 変更差分を確認**

Run:

```bash
git diff -- src-tauri/src/infra/db/migration.rs src-tauri/src/infra/db/connection.rs src-tauri/src/lib.rs
```

Expected: 変更が transaction 化、接続解放、条件付き recovery メッセージに限定されている。

- [ ] **Step 2: 重要テストを再実行**

Run:

```bash
cd src-tauri && cargo test infra::db::migration -- --nocapture
cd src-tauri && cargo test infra::db::connection -- --nocapture
cd src-tauri && cargo test lib -- --nocapture
```

Expected: PASS。

- [ ] **Step 3: 最終フルゲートを実行**

Run:

```bash
mise run check
```

Expected: PASS。型エラー 0、lint 違反 0、全テスト成功、formatter 適用済み。

- [ ] **Step 4: handoff 用メモを残す**

実装完了報告に含める内容:

```text
- migration は残り version 全体を 1 transaction で実行するようになった
- migration failure 時は restore 前に SQLite 接続を明示的に解放する
- recovery メッセージは backup の有無で分岐し、manual restore では backup set (-wal / -shm 含む) を案内する
- 実行した確認コマンド: mise run check
```
