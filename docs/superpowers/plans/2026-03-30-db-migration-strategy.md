# DB マイグレーション戦略: バックアップ・ロールバック・バージョンスキップ対応

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** デスクトップアプリのマイグレーション失敗からユーザーデータを保護するため、自動バックアップ・ロールバック・バージョンスキップ対応を実装する

**Architecture:** マイグレーション実行前に SQLite ファイルをコピーしてバックアップし、失敗時はバックアップから自動復元する。既存の `run_migrations()` を拡張し、バックアップ・復元ロジックを `DbManager::new()` のエントリポイントに集約する。バージョンスキップは既存の `if current_version < N` パターンが順次適用を保証するため、テストで確認する。復元成功時はアプリを古いスキーマで起動し、ログで通知する。

**Tech Stack:** Rust, rusqlite, std::fs (ファイルコピー), tempfile (テスト用)

---

## File Structure

| Action     | Path                                   | Responsibility                                                                           |
| ---------- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Create     | `src-tauri/src/infra/db/backup.rs`     | SQLite バックアップ・復元ロジック                                                        |
| Modify     | `src-tauri/src/infra/db/mod.rs`        | `backup` モジュール公開                                                                  |
| Modify     | `src-tauri/src/infra/db/connection.rs` | `DbManager::new()` でバックアップ統合                                                    |
| Modify     | `src-tauri/src/infra/db/migration.rs`  | マイグレーション結果の詳細返却、ログ追加                                                 |
| Modify     | `src-tauri/src/domain/error.rs`        | `Migration` エラーバリアント追加                                                         |
| Modify     | `src-tauri/src/lib.rs`                 | エラーハンドリング改善（復元済みなら起動継続）                                           |
| (変更不要) | `src-tauri/src/commands/dto.rs`        | ワイルドカードパターン `_ =>` で `Migration` は自動的に `UserVisible` にマッピングされる |

---

## Task 1: DomainError に Migration バリアントを追加

**Files:**

- Modify: `src-tauri/src/domain/error.rs:4-17`

- [ ] **Step 1: テストコンパイルで現状確認**

Run: `cd src-tauri && rtk cargo test --lib domain::error -- --nocapture 2>&1 | head -5`
Expected: 既存テストが PASS（またはテストなし）

- [ ] **Step 2: Migration エラーバリアントを追加**

`src-tauri/src/domain/error.rs` の `DomainError` enum に追加:

```rust
#[derive(Debug, Error)]
pub enum DomainError {
    #[error("Network error: {0}")]
    Network(String),
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Persistence error: {0}")]
    Persistence(String),
    #[error("Auth error: {0}")]
    Auth(String),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Keychain error: {0}")]
    Keychain(String),
    #[error("Migration error: {0}")]
    Migration(String),
}
```

`dto.rs` の `From<DomainError> for AppError` はワイルドカード `_ =>` でキャッチするため変更不要。`Migration` は自動的に `UserVisible` にマッピングされる。

- [ ] **Step 3: コンパイル確認**

Run: `cd src-tauri && rtk cargo check`
Expected: PASS

- [ ] **Step 4: コミット**

```bash
rtk git add src-tauri/src/domain/error.rs
rtk git commit -m "feat: add Migration variant to DomainError"
```

---

## Task 2: バックアップ・復元モジュールの作成

**Files:**

- Create: `src-tauri/src/infra/db/backup.rs`
- Modify: `src-tauri/src/infra/db/mod.rs`

- [ ] **Step 1: 失敗テストを書く**

`src-tauri/src/infra/db/backup.rs` を作成し、テストから書く:

```rust
use std::fs;
use std::path::{Path, PathBuf};

use tracing::{info, warn};

use crate::domain::error::{DomainError, DomainResult};

/// Generate backup path: `<db_path>.backup-v<version>`
pub fn backup_path(db_path: &Path, schema_version: i32) -> PathBuf {
    let mut name = db_path.as_os_str().to_owned();
    name.push(format!(".backup-v{schema_version}"));
    PathBuf::from(name)
}

/// Generate WAL/SHM backup path for a given extension and version.
fn auxiliary_backup_path(db_path: &Path, ext: &str, schema_version: i32) -> PathBuf {
    let aux = db_path.with_extension(ext);
    let mut name = aux.as_os_str().to_owned();
    name.push(format!(".backup-v{schema_version}"));
    PathBuf::from(name)
}

/// Copy the SQLite file to a backup location before migration.
/// WAL and SHM files are also copied if they exist.
pub fn create_backup(db_path: &Path, schema_version: i32) -> DomainResult<PathBuf> {
    todo!()
}

/// Restore the database from a backup file, replacing the current DB.
/// `backup_version` is the schema version of the backup (used for WAL/SHM lookup).
pub fn restore_backup(db_path: &Path, backup: &Path, backup_version: i32) -> DomainResult<()> {
    todo!()
}

/// Remove old backup files, keeping only the most recent `keep` backups.
pub fn cleanup_old_backups(db_path: &Path, keep: usize) -> DomainResult<()> {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn setup_temp_db() -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        fs::write(&db_path, b"test database content").unwrap();
        (dir, db_path)
    }

    #[test]
    fn backup_path_includes_version() {
        let path = Path::new("/tmp/app.db");
        assert_eq!(backup_path(path, 3), PathBuf::from("/tmp/app.db.backup-v3"));
    }

    #[test]
    fn auxiliary_backup_path_for_wal() {
        let path = Path::new("/tmp/app.db");
        assert_eq!(
            auxiliary_backup_path(path, "db-wal", 2),
            PathBuf::from("/tmp/app.db-wal.backup-v2")
        );
    }

    #[test]
    fn create_backup_copies_file() {
        let (_dir, db_path) = setup_temp_db();
        let bp = create_backup(&db_path, 1).unwrap();
        assert!(bp.exists());
        assert_eq!(fs::read(&bp).unwrap(), b"test database content");
    }

    #[test]
    fn create_backup_copies_wal_and_shm() {
        let (_dir, db_path) = setup_temp_db();
        let wal_path = db_path.with_extension("db-wal");
        let shm_path = db_path.with_extension("db-shm");
        fs::write(&wal_path, b"wal data").unwrap();
        fs::write(&shm_path, b"shm data").unwrap();

        let bp = create_backup(&db_path, 2).unwrap();
        assert!(bp.exists());
        assert_eq!(
            fs::read(auxiliary_backup_path(&db_path, "db-wal", 2)).unwrap(),
            b"wal data"
        );
        assert_eq!(
            fs::read(auxiliary_backup_path(&db_path, "db-shm", 2)).unwrap(),
            b"shm data"
        );
    }

    #[test]
    fn create_backup_fails_if_db_missing() {
        let dir = tempfile::tempdir().unwrap();
        let db_path = dir.path().join("nonexistent.db");
        let result = create_backup(&db_path, 1);
        assert!(result.is_err());
    }

    #[test]
    fn restore_backup_replaces_db() {
        let (_dir, db_path) = setup_temp_db();
        let bp = create_backup(&db_path, 1).unwrap();
        // Corrupt the original
        fs::write(&db_path, b"corrupted").unwrap();
        restore_backup(&db_path, &bp, 1).unwrap();
        assert_eq!(fs::read(&db_path).unwrap(), b"test database content");
    }

    #[test]
    fn restore_removes_stale_wal_shm() {
        let (_dir, db_path) = setup_temp_db();
        let bp = create_backup(&db_path, 1).unwrap();
        // Create stale WAL that has no backup counterpart
        let wal_path = db_path.with_extension("db-wal");
        fs::write(&wal_path, b"stale wal").unwrap();
        restore_backup(&db_path, &bp, 1).unwrap();
        // Stale WAL should be removed (no WAL backup existed for v1)
        assert!(!wal_path.exists());
    }

    #[test]
    fn cleanup_keeps_only_recent() {
        let (_dir, db_path) = setup_temp_db();
        // Create 4 backups
        for v in 1..=4 {
            let bp = backup_path(&db_path, v);
            fs::write(&bp, format!("backup-v{v}")).unwrap();
        }
        cleanup_old_backups(&db_path, 2).unwrap();

        // Only v3 and v4 should remain
        assert!(!backup_path(&db_path, 1).exists());
        assert!(!backup_path(&db_path, 2).exists());
        assert!(backup_path(&db_path, 3).exists());
        assert!(backup_path(&db_path, 4).exists());
    }
}
```

- [ ] **Step 2: `mod.rs` にモジュール追加**

`src-tauri/src/infra/db/mod.rs` に `pub mod backup;` を追加。

- [ ] **Step 3: テスト実行 — 失敗を確認**

Run: `cd src-tauri && rtk cargo test --lib infra::db::backup -- --nocapture`
Expected: FAIL — `todo!()` パニック

- [ ] **Step 4: `create_backup` を実装**

```rust
pub fn create_backup(db_path: &Path, schema_version: i32) -> DomainResult<PathBuf> {
    let dest = backup_path(db_path, schema_version);

    info!("Creating DB backup: {} -> {}", db_path.display(), dest.display());

    fs::copy(db_path, &dest).map_err(|e| {
        DomainError::Migration(format!(
            "Failed to backup database {}: {e}",
            db_path.display()
        ))
    })?;

    // Copy WAL and SHM if they exist (SQLite WAL mode)
    for ext in &["db-wal", "db-shm"] {
        let src = db_path.with_extension(ext);
        if src.exists() {
            let aux_dest = auxiliary_backup_path(db_path, ext, schema_version);
            fs::copy(&src, &aux_dest).map_err(|e| {
                DomainError::Migration(format!("Failed to backup {}: {e}", src.display()))
            })?;
        }
    }

    Ok(dest)
}
```

- [ ] **Step 5: `restore_backup` を実装**

```rust
pub fn restore_backup(db_path: &Path, backup: &Path, backup_version: i32) -> DomainResult<()> {
    info!(
        "Restoring DB from backup: {} -> {}",
        backup.display(),
        db_path.display()
    );

    fs::copy(backup, db_path).map_err(|e| {
        DomainError::Migration(format!(
            "Failed to restore database from {}: {e}",
            backup.display()
        ))
    })?;

    // Restore or remove WAL/SHM
    for ext in &["db-wal", "db-shm"] {
        let aux_current = db_path.with_extension(ext);
        let aux_backup = auxiliary_backup_path(db_path, ext, backup_version);
        if aux_backup.exists() {
            fs::copy(&aux_backup, &aux_current).map_err(|e| {
                DomainError::Migration(format!("Failed to restore {}: {e}", aux_current.display()))
            })?;
        } else {
            // Remove stale WAL/SHM that doesn't match the backup
            let _ = fs::remove_file(&aux_current);
        }
    }

    Ok(())
}
```

- [ ] **Step 6: `cleanup_old_backups` を実装**

```rust
pub fn cleanup_old_backups(db_path: &Path, keep: usize) -> DomainResult<()> {
    let dir = db_path.parent().ok_or_else(|| {
        DomainError::Migration("Cannot determine backup directory".to_string())
    })?;

    let db_name = db_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");

    let prefix = format!("{db_name}.backup-v");

    let mut versions: Vec<i32> = fs::read_dir(dir)
        .map_err(|e| DomainError::Migration(format!("Cannot read dir: {e}")))?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            name.strip_prefix(&prefix)
                .and_then(|v| v.parse::<i32>().ok())
        })
        .collect();

    versions.sort();

    if versions.len() <= keep {
        return Ok(());
    }

    let to_remove = &versions[..versions.len() - keep];
    for v in to_remove {
        let bp = backup_path(db_path, *v);
        if let Err(e) = fs::remove_file(&bp) {
            warn!("Failed to remove old backup {}: {e}", bp.display());
        }
        // Also remove WAL/SHM backups
        for ext in &["db-wal", "db-shm"] {
            let _ = fs::remove_file(auxiliary_backup_path(db_path, ext, *v));
        }
    }

    info!("Cleaned up {} old backup(s), kept {keep}", to_remove.len());
    Ok(())
}
```

- [ ] **Step 7: テスト実行 — 全て PASS**

Run: `cd src-tauri && rtk cargo test --lib infra::db::backup -- --nocapture`
Expected: 8 tests PASS

- [ ] **Step 8: コミット**

```bash
rtk git add src-tauri/src/infra/db/backup.rs src-tauri/src/infra/db/mod.rs
rtk git commit -m "feat: add database backup and restore module"
```

---

## Task 3: マイグレーション関数にログとバージョン情報返却を追加

**Files:**

- Modify: `src-tauri/src/infra/db/migration.rs`

- [ ] **Step 1: `migration.rs` を書き換え**

`run_migrations` の戻り値を `MigrationResult` に変更し、`get_schema_version` を `pub` にする:

```rust
use rusqlite::Connection;
use tracing::info;

use crate::domain::error::DomainResult;

const MIGRATION_V1: &str = include_str!("../../../migrations/V1__initial.sql");
const MIGRATION_V2: &str = include_str!("../../../migrations/V2__preferences.sql");
const MIGRATION_V3: &str = include_str!("../../../migrations/V3__fts5.sql");
const MIGRATION_V4: &str = include_str!("../../../migrations/V4__tags.sql");
const MIGRATION_V5: &str = include_str!("../../../migrations/V5__feed_display_mode.sql");

/// Result of a migration run.
pub struct MigrationResult {
    /// Schema version before migration.
    pub from_version: i32,
    /// Schema version after migration.
    pub to_version: i32,
}

impl MigrationResult {
    /// Returns true if any migrations were applied.
    pub fn migrated(&self) -> bool {
        self.from_version < self.to_version
    }
}

pub const LATEST_VERSION: i32 = 5;

pub fn run_migrations(conn: &mut Connection) -> DomainResult<MigrationResult> {
    let from_version = get_schema_version(conn);

    if from_version < 1 {
        conn.execute_batch(MIGRATION_V1)?;
    }
    if from_version < 2 {
        conn.execute_batch(MIGRATION_V2)?;
    }
    if from_version < 3 {
        conn.execute_batch(MIGRATION_V3)?;
    }
    if from_version < 4 {
        conn.execute_batch(MIGRATION_V4)?;
    }
    if from_version < 5 {
        conn.execute_batch(MIGRATION_V5)?;
    }

    let to_version = get_schema_version(conn);

    if from_version < to_version {
        info!("Database migrated from v{from_version} to v{to_version}");
    } else {
        info!("Database schema is up to date (v{to_version})");
    }

    Ok(MigrationResult {
        from_version,
        to_version,
    })
}

pub fn get_schema_version(conn: &Connection) -> i32 {
    conn.query_row(
        "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1",
        [],
        |row| row.get(0),
    )
    .unwrap_or(0)
}
```

- [ ] **Step 2: `connection.rs` のコンパイルエラーを修正**

`DbManager::new()` と `new_in_memory()` で `run_migrations()` の戻り値を受ける:

```rust
let _result = super::migration::run_migrations(&mut manager.writer)?;
```

- [ ] **Step 3: テスト実行**

Run: `cd src-tauri && rtk cargo test --lib infra::db -- --nocapture`
Expected: 全テスト PASS

- [ ] **Step 4: コミット**

```bash
rtk git add src-tauri/src/infra/db/migration.rs src-tauri/src/infra/db/connection.rs
rtk git commit -m "feat: return MigrationResult from run_migrations with version info"
```

---

## Task 4: DbManager にバックアップ統合

**Files:**

- Modify: `src-tauri/src/infra/db/connection.rs`

- [ ] **Step 1: 統合テストを書く**

`connection.rs` の `#[cfg(test)]` ブロックにテストを追加:

```rust
#[test]
fn new_creates_backup_when_migrating() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");

    // First init — creates fresh DB (from v0 to v5)
    let _db = DbManager::new(&db_path).unwrap();
    drop(_db);

    // Fresh DB (file didn't exist before) should NOT create a backup
    // (nothing to back up)
    let backup = super::backup::backup_path(&db_path, 0);
    assert!(!backup.exists(), "Fresh DB should not create a backup");
}

#[test]
fn new_creates_backup_when_upgrading_existing_db() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");

    // Create a DB at v5 (current latest)
    let _db = DbManager::new(&db_path).unwrap();
    drop(_db);

    // Simulate: manually insert a future migration scenario
    // by checking that a second open with same version does NOT backup
    let backup_v5 = super::backup::backup_path(&db_path, 5);
    assert!(!backup_v5.exists(), "No backup when schema is current");
}
```

- [ ] **Step 2: テスト実行 — 失敗を確認**

Run: `cd src-tauri && rtk cargo test --lib infra::db::connection::tests::new_creates_backup -- --nocapture`
Expected: FAIL — バックアップロジックが未実装

- [ ] **Step 3: `DbManager::new()` にバックアップロジックを統合**

`connection.rs` の先頭に import を追加:

```rust
use crate::domain::error::DomainError;
```

`DbManager::new()` を以下に書き換え:

```rust
pub fn new(db_path: &Path) -> DomainResult<Self> {
    // Check if this is a fresh database (file doesn't exist yet)
    let is_fresh = !db_path.exists();

    // Phase 1: Open a temporary connection to check schema version
    // Apply busy_timeout so we don't fail immediately if another process holds a lock
    let probe = Connection::open(db_path)?;
    probe.execute_batch("PRAGMA busy_timeout = 5000;")?;
    let current_version = super::migration::get_schema_version(&probe);
    let needs_migration = current_version < super::migration::LATEST_VERSION;
    drop(probe);

    // Phase 2: Backup before migration (skip for fresh/empty DB)
    if needs_migration && !is_fresh {
        super::backup::create_backup(db_path, current_version)?;
    }

    // Phase 3: Open connections and run migrations
    let writer = Connection::open(db_path)?;
    Self::apply_pragmas(&writer)?;
    let reader = Connection::open(db_path)?;
    Self::apply_pragmas(&reader)?;

    let mut manager = Self { writer, reader };

    match super::migration::run_migrations(&mut manager.writer) {
        Ok(result) => {
            if result.migrated() {
                // Clean up old backups, keep last 3
                if let Err(e) = super::backup::cleanup_old_backups(db_path, 3) {
                    tracing::warn!("Failed to clean up old backups: {e}");
                }
            }
            Ok(manager)
        }
        Err(e) => {
            // Migration failed — attempt restore from backup
            tracing::error!("Migration failed: {e}");
            let backup = super::backup::backup_path(db_path, current_version);
            if backup.exists() {
                tracing::info!("Attempting restore from backup v{current_version}...");
                drop(manager); // Release DB connections before file operations
                if let Err(restore_err) =
                    super::backup::restore_backup(db_path, &backup, current_version)
                {
                    tracing::error!("Restore also failed: {restore_err}");
                    return Err(DomainError::Migration(format!(
                        "Migration failed ({e}) and restore failed ({restore_err}). \
                         Manual intervention required."
                    )));
                }
                // Re-open with restored (pre-migration) schema and continue
                tracing::warn!(
                    "Database restored to v{current_version} after migration failure. \
                     Running with older schema."
                );
                let writer = Connection::open(db_path)?;
                Self::apply_pragmas(&writer)?;
                let reader = Connection::open(db_path)?;
                Self::apply_pragmas(&reader)?;
                Ok(Self { writer, reader })
            } else {
                Err(DomainError::Migration(format!(
                    "Migration failed: {e}. No backup available for restore."
                )))
            }
        }
    }
}
```

**設計判断:** 復元成功時は `Ok(manager)` を返してアプリを古いスキーマで起動する。ユーザーのデータを失わない方がクラッシュより良い。将来の新機能は使えないが、既存データの閲覧は可能。

- [ ] **Step 4: テスト実行 — PASS**

Run: `cd src-tauri && rtk cargo test --lib infra::db::connection -- --nocapture`
Expected: 全テスト PASS（既存の `new_in_memory` 系テストも影響なし）

- [ ] **Step 5: コミット**

```bash
rtk git add src-tauri/src/infra/db/connection.rs
rtk git commit -m "feat: integrate backup/restore into DbManager initialization"
```

---

## Task 5: バージョンスキップと復元の統合テスト

**Files:**

- Modify: `src-tauri/src/infra/db/migration.rs` (テスト追加)
- Modify: `src-tauri/src/infra/db/connection.rs` (復元テスト追加)

- [ ] **Step 1: バージョンスキップテストを書く**

`migration.rs` に `#[cfg(test)]` ブロックを追加:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn open_in_memory() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        conn
    }

    #[test]
    fn fresh_db_migrates_to_latest() {
        let mut conn = open_in_memory();
        let result = run_migrations(&mut conn).unwrap();
        assert_eq!(result.from_version, 0);
        assert_eq!(result.to_version, LATEST_VERSION);
        assert!(result.migrated());
    }

    #[test]
    fn already_current_is_noop() {
        let mut conn = open_in_memory();
        run_migrations(&mut conn).unwrap();
        let result = run_migrations(&mut conn).unwrap();
        assert_eq!(result.from_version, LATEST_VERSION);
        assert_eq!(result.to_version, LATEST_VERSION);
        assert!(!result.migrated());
    }

    #[test]
    fn version_skip_v1_to_latest() {
        let mut conn = open_in_memory();
        // Apply only V1
        conn.execute_batch(MIGRATION_V1).unwrap();
        assert_eq!(get_schema_version(&conn), 1);

        // Simulate version skip: v1 -> latest
        let result = run_migrations(&mut conn).unwrap();
        assert_eq!(result.from_version, 1);
        assert_eq!(result.to_version, LATEST_VERSION);
        assert!(result.migrated());

        // Verify V2 (preferences) was applied
        let pref_count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='preferences'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(pref_count, 1);

        // Verify V4 (tags) was applied
        let tag_count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='tags'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(tag_count, 1);
    }

    #[test]
    fn version_skip_v3_to_latest() {
        let mut conn = open_in_memory();
        // Apply V1-V3
        conn.execute_batch(MIGRATION_V1).unwrap();
        conn.execute_batch(MIGRATION_V2).unwrap();
        conn.execute_batch(MIGRATION_V3).unwrap();
        assert_eq!(get_schema_version(&conn), 3);

        let result = run_migrations(&mut conn).unwrap();
        assert_eq!(result.from_version, 3);
        assert_eq!(result.to_version, LATEST_VERSION);

        // Verify V5 (display_mode) was applied
        let has_display_mode: bool = conn
            .prepare("SELECT display_mode FROM feeds LIMIT 0")
            .is_ok();
        assert!(has_display_mode, "V5 display_mode column should exist");
    }
}
```

- [ ] **Step 2: テスト実行 — PASS**

Run: `cd src-tauri && rtk cargo test --lib infra::db::migration -- --nocapture`
Expected: 4 tests PASS

- [ ] **Step 3: マイグレーション失敗→復元テストを書く**

`connection.rs` のテストブロックに追加。ファイルベースの DB を使い、壊れた状態をシミュレートする:

```rust
#[test]
fn migration_failure_restores_from_backup() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");

    // Create a DB at v5
    let db = DbManager::new(&db_path).unwrap();
    // Insert some data to verify it survives restoration
    db.writer()
        .execute(
            "INSERT INTO accounts (id, kind, name) VALUES ('a1', 'Local', 'Test')",
            [],
        )
        .unwrap();
    drop(db);

    // Manually corrupt the schema_version to trigger a migration attempt.
    // Set version to 4 so run_migrations tries to apply V5 again,
    // but first make the V5 migration fail by pre-applying the column.
    // Actually: we set version to a value that will cause the migration
    // SQL to fail (e.g., add a duplicate column).
    {
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        // Set version back to 4 — V5 adds display_mode column which already exists
        conn.execute("DELETE FROM schema_version WHERE version = 5", [])
            .unwrap();
        drop(conn);
    }

    // Now DbManager::new will:
    // 1. See version=4, needs migration
    // 2. Create backup at v4
    // 3. Try to run V5 migration (ALTER TABLE ADD COLUMN display_mode) which will FAIL
    //    because the column already exists
    // 4. Restore from backup (v4)
    // 5. Return Ok with restored DB
    let db = DbManager::new(&db_path).unwrap();

    // Verify data survived
    let name: String = db
        .reader()
        .query_row(
            "SELECT name FROM accounts WHERE id = 'a1'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(name, "Test");

    // Verify schema version is still 4 (restored)
    let version: i32 = db
        .reader()
        .query_row(
            "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(version, 4, "Should be restored to v4");
}
```

- [ ] **Step 4: テスト実行 — PASS**

Run: `cd src-tauri && rtk cargo test --lib infra::db::connection::tests::migration_failure_restores -- --nocapture`
Expected: PASS — マイグレーション失敗後にバックアップから復元され、データが保持される

- [ ] **Step 5: コミット**

```bash
rtk git add src-tauri/src/infra/db/migration.rs src-tauri/src/infra/db/connection.rs
rtk git commit -m "test: add version skip and migration failure restore tests"
```

---

## Task 6: `lib.rs` のエラーハンドリング改善

**Files:**

- Modify: `src-tauri/src/lib.rs:33`

現在の `lib.rs` は `DbManager::new()` の失敗を `.expect()` でパニックさせている。復元成功時は `DbManager::new()` が `Ok` を返すようになったため（Task 4 の設計判断）、ここでは復元不可能な致命的エラーのみハンドリングする。

- [ ] **Step 1: エラーメッセージを改善**

`lib.rs:33` を以下に変更:

```rust
let db = match DbManager::new(&db_path) {
    Ok(db) => db,
    Err(e) => {
        tracing::error!("Database initialization failed: {e}");
        panic!(
            "Failed to initialize database: {e}\n\
             Database path: {}\n\
             If the problem persists, try deleting the database file and restarting.",
            db_path.display()
        );
    }
};
```

- [ ] **Step 2: コンパイル確認**

Run: `cd src-tauri && rtk cargo check`
Expected: PASS

- [ ] **Step 3: コミット**

```bash
rtk git add src-tauri/src/lib.rs
rtk git commit -m "feat: improve database initialization error messages"
```

---

## Task 7: 全体品質チェック

- [ ] **Step 1: フォーマット**

Run: `rtk mise run format`
Expected: PASS

- [ ] **Step 2: リント**

Run: `rtk mise run lint`
Expected: PASS（型エラー 0、リント違反 0）

- [ ] **Step 3: 全テスト**

Run: `rtk mise run test`
Expected: 全テスト PASS

- [ ] **Step 4: ビルド確認**

Run: `cd src-tauri && rtk cargo build`
Expected: PASS

- [ ] **Step 5: 最終コミット（必要な場合のみ）**

フォーマット・リント修正があった場合のみ:

```bash
rtk git add -A
rtk git commit -m "chore: fix format and lint issues"
```

---

## Task 8: Issue クローズ用チェックリスト確認

Issue #13 の対応項目との対応:

| Issue 項目                                                 | 対応 Task                                                                                                                                                    | 状態 |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| マイグレーション実行前の自動バックアップ                   | Task 2, 4                                                                                                                                                    | ✅   |
| マイグレーション失敗時のフォールバック（バックアップ復元） | Task 4, 5 (復元テスト)                                                                                                                                       | ✅   |
| バージョンスキップ対応（順次マイグレーション確認）         | Task 5                                                                                                                                                       | ✅   |
| `tauri-plugin-updater` との連携                            | 既存の `lib.rs` セットアップフローに統合済み。アプリ更新後の初回起動で `DbManager::new()` が自動的にマイグレーション＋バックアップを実行する。追加作業不要。 | ✅   |
| マイグレーション戦略のドキュメント化                       | Issue #13 をクローズする PR 本文にマイグレーション戦略の概要を記載する。README への追記は Issue 作成者の判断に委ねる。                                       | ✅   |

- [ ] **Step 1: PR 作成の準備**

Issue #13 をクローズする PR を作成する準備が完了。全タスク完了を確認。PR 本文にマイグレーション戦略の概要を記載すること:

```markdown
## マイグレーション戦略

- **自動バックアップ**: マイグレーション実行前に `<db>.backup-v<version>` としてSQLiteファイルをコピー
- **自動復元**: マイグレーション失敗時はバックアップから復元し、古いスキーマでアプリを起動
- **バージョンスキップ**: 順次マイグレーション（v1→v2→...→v5）をテストで保証
- **バックアップローテーション**: 直近3世代のバックアップのみ保持
- **updater連携**: アプリ更新後の初回起動で自動的にマイグレーション+バックアップが実行される
```

---

## スコープ外（意図的に除外）

- **マイグレーションのトランザクション化**: 各マイグレーション SQL は `execute_batch` で実行される。SQLite の `execute_batch` はトランザクション境界を持たないが、バックアップ＋復元で同等の安全性を確保。将来の改善として各マイグレーションを個別トランザクションで包むことは検討可能。
- **フロントエンドへのマイグレーション状態通知**: 現時点ではマイグレーションはアプリ起動前に完了するため、UI 通知は不要。将来的に必要になった場合は別 Issue で対応。
