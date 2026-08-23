use super::*;
use crate::domain::error::{DomainError, DomainResult};
use rusqlite::{Connection, OpenFlags, OptionalExtension};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum BackupEncryptionDecision {
    NotAppEncrypted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct BackupPrivacyContract {
    privacy_level: &'static str,
    encryption_decision: BackupEncryptionDecision,
    includes_database: bool,
    includes_sqlite_sidecars: bool,
    credential_storage: &'static str,
    user_copy: &'static str,
}

const DATABASE_BACKUP_PRIVACY_CONTRACT: BackupPrivacyContract = BackupPrivacyContract {
    privacy_level: "private-user-data",
    encryption_decision: BackupEncryptionDecision::NotAppEncrypted,
    includes_database: true,
    includes_sqlite_sidecars: true,
    credential_storage: "production credentials remain in the OS keyring",
    user_copy: "Database backups are private, unencrypted app data. Store them privately and delete them when recovery is complete.",
};

#[derive(Debug, Clone, PartialEq, Eq)]
struct BackupMetadata {
    metadata_format_version: i32,
    app_version: String,
    schema_version: i32,
    created_at: String,
    source_app_identifier: String,
    data_checksum_sha256: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct BackupContentSummary {
    account_count: i64,
    feed_count: i64,
    article_count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct BackupRestorePreview {
    metadata: BackupMetadata,
    current: BackupContentSummary,
    backup: BackupContentSummary,
    schema_compatible: bool,
}

fn read_backup_metadata(backup_path: &Path) -> DomainResult<BackupMetadata> {
    let conn = Connection::open_with_flags(backup_path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let metadata = conn
        .query_row(
            "SELECT
                metadata_format_version,
                app_version,
                schema_version,
                created_at,
                source_app_identifier,
                data_checksum_sha256
             FROM __ultra_rss_backup_metadata
             WHERE id = 1",
            [],
            |row| {
                Ok(BackupMetadata {
                    metadata_format_version: row.get(0)?,
                    app_version: row.get(1)?,
                    schema_version: row.get(2)?,
                    created_at: row.get(3)?,
                    source_app_identifier: row.get(4)?,
                    data_checksum_sha256: row.get(5)?,
                })
            },
        )
        .optional()
        .map_err(|e| {
            DomainError::Migration(format!(
                "Failed to parse backup metadata from {}: {e}",
                redacted_path_label(backup_path)
            ))
        })?;

    metadata.ok_or_else(|| {
        DomainError::Migration(format!(
            "Backup metadata is missing from {}",
            redacted_path_label(backup_path)
        ))
    })
}

fn count_table_rows(conn: &Connection, table: &str) -> DomainResult<i64> {
    let exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1)",
        [table],
        |row| row.get(0),
    )?;
    if !exists {
        return Ok(0);
    }

    let sql = format!("SELECT COUNT(*) FROM {table}");
    Ok(conn.query_row(&sql, [], |row| row.get(0))?)
}

fn backup_content_summary(conn: &Connection) -> DomainResult<BackupContentSummary> {
    Ok(BackupContentSummary {
        account_count: count_table_rows(conn, "accounts")?,
        feed_count: count_table_rows(conn, "feeds")?,
        article_count: count_table_rows(conn, "articles")?,
    })
}

fn preview_restore(
    current_db_path: &Path,
    backup_path: &Path,
    latest_schema_version: i32,
) -> DomainResult<BackupRestorePreview> {
    let current_conn =
        Connection::open_with_flags(current_db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let backup_conn = Connection::open_with_flags(backup_path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let metadata = read_backup_metadata(backup_path)?;
    let current = backup_content_summary(&current_conn)?;
    let backup = backup_content_summary(&backup_conn)?;

    Ok(BackupRestorePreview {
        schema_compatible: metadata.schema_version <= latest_schema_version,
        metadata,
        current,
        backup,
    })
}

fn setup_temp_db() -> (tempfile::TempDir, PathBuf) {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("test.db");
    let conn = Connection::open(&db_path).unwrap();
    conn.execute_batch(
        "CREATE TABLE probe (id INTEGER PRIMARY KEY, payload TEXT NOT NULL);
         INSERT INTO probe (id, payload) VALUES (1, 'test database content');",
    )
    .unwrap();
    drop(conn);
    (dir, db_path)
}

fn read_probe_payload(db_path: &Path) -> String {
    let conn = Connection::open(db_path).unwrap();
    conn.query_row("SELECT payload FROM probe WHERE id = 1", [], |row| {
        row.get(0)
    })
    .unwrap()
}

#[test]
fn backup_path_includes_version() {
    let path = Path::new("/tmp/app.db");
    let backup = backup_path(path, 3);

    assert_eq!(backup.parent(), Some(Path::new("/tmp/backups")));
    let file_name = backup.file_name().and_then(|name| name.to_str()).unwrap();
    assert!(file_name.starts_with("app_v3_"));
    assert!(file_name.ends_with(".db"));
}

#[test]
fn auxiliary_backup_path_for_wal() {
    let path = Path::new("/tmp/backups/app_v2_20260330T000000.db");
    assert_eq!(
        auxiliary_backup_path(path, "wal"),
        PathBuf::from("/tmp/backups/app_v2_20260330T000000.db-wal")
    );
}

#[test]
fn auxiliary_backup_path_works_for_non_db_extension() {
    let path = Path::new("/tmp/backups/app.sqlite");
    assert_eq!(
        auxiliary_backup_path(path, "wal"),
        PathBuf::from("/tmp/backups/app.sqlite-wal")
    );
}

#[test]
fn temp_backup_path_pairs_with_final_backup_name() {
    let path = Path::new("/tmp/backups/app_v2_20260330T000000.db");
    assert_eq!(
        temp_backup_path(path),
        PathBuf::from("/tmp/backups/app_v2_20260330T000000.db.tmp")
    );
}

#[test]
fn redacted_path_label_keeps_only_file_name_for_user_facing_diagnostics() {
    assert_eq!(
        redacted_path_label(Path::new("/Users/example/app/backups/app_v2.db")),
        "[redacted parent]/app_v2.db"
    );
}

#[test]
fn database_backup_privacy_contract_marks_backups_private_and_unencrypted() {
    assert_eq!(
        DATABASE_BACKUP_PRIVACY_CONTRACT.privacy_level,
        "private-user-data"
    );
    assert_eq!(
        DATABASE_BACKUP_PRIVACY_CONTRACT.encryption_decision,
        BackupEncryptionDecision::NotAppEncrypted
    );
    assert!(DATABASE_BACKUP_PRIVACY_CONTRACT.includes_database);
    assert!(DATABASE_BACKUP_PRIVACY_CONTRACT.includes_sqlite_sidecars);
    assert!(DATABASE_BACKUP_PRIVACY_CONTRACT
        .credential_storage
        .contains("OS keyring"));
    assert!(DATABASE_BACKUP_PRIVACY_CONTRACT
        .user_copy
        .contains("private, unencrypted app data"));
}

#[test]
fn create_backup_copies_file() {
    let (_dir, db_path) = setup_temp_db();
    let bp = create_backup(&db_path, 1).unwrap();
    assert!(bp.exists());
    assert_eq!(read_probe_payload(&bp), "test database content");
    assert!(!temp_backup_path(&bp).exists());
}

#[test]
fn create_backup_writes_metadata_into_backup_file() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("metadata.db");
    {
        let db = crate::infra::db::connection::DbManager::new(&db_path).unwrap();
        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES ('a1', 'Local', 'Test')",
                [],
            )
            .unwrap();
    }

    let backup = create_backup(&db_path, 18).unwrap();
    let metadata = read_backup_metadata(&backup).unwrap();

    assert_eq!(metadata.metadata_format_version, 1);
    assert_eq!(metadata.app_version, env!("CARGO_PKG_VERSION"));
    assert_eq!(metadata.schema_version, 18);
    assert_eq!(metadata.source_app_identifier, SOURCE_APP_IDENTIFIER);
    assert_eq!(metadata.data_checksum_sha256.len(), 64);
    assert!(metadata.created_at.contains('T'));
}

#[test]
fn read_backup_metadata_reports_parse_failures() {
    let dir = tempfile::tempdir().unwrap();
    let backup = dir.path().join("malformed.db");
    let conn = Connection::open(&backup).unwrap();
    conn.execute_batch(
        "CREATE TABLE __ultra_rss_backup_metadata (
            id INTEGER PRIMARY KEY,
            metadata_format_version TEXT NOT NULL,
            app_version TEXT NOT NULL,
            schema_version TEXT NOT NULL,
            created_at TEXT NOT NULL,
            source_app_identifier TEXT NOT NULL,
            data_checksum_sha256 TEXT NOT NULL
        );
        INSERT INTO __ultra_rss_backup_metadata (
            id,
            metadata_format_version,
            app_version,
            schema_version,
            created_at,
            source_app_identifier,
            data_checksum_sha256
        ) VALUES (1, 'not-integer', '0.1.0', 'not-integer', 'bad-date', 'app', 'checksum');",
    )
    .unwrap();
    drop(conn);

    let error = read_backup_metadata(&backup).unwrap_err().to_string();

    assert!(
        error.contains("Failed to parse backup metadata"),
        "metadata parse failure should be explicit: {error}"
    );
    assert!(
        error.contains("[redacted parent]/malformed.db"),
        "metadata parse failure should keep path redacted: {error}"
    );
}

#[test]
fn preview_restore_returns_metadata_counts_and_schema_compatibility() {
    let dir = tempfile::tempdir().unwrap();
    let current_db_path = dir.path().join("current.db");
    let backup_source_path = dir.path().join("backup-source.db");
    {
        let db = crate::infra::db::connection::DbManager::new(&current_db_path).unwrap();
        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES ('current-a1', 'Local', 'Current')",
                [],
            )
            .unwrap();
    }
    {
        let db = crate::infra::db::connection::DbManager::new(&backup_source_path).unwrap();
        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES ('backup-a1', 'Local', 'Backup')",
                [],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, title, url) VALUES ('backup-f1', 'backup-a1', 'Feed', 'https://example.com/feed.xml')",
                [],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, title, content_raw, content_sanitized, sanitizer_version, published_at, fetched_at) VALUES ('backup-art1', 'backup-f1', 'Article', '', '', 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
                [],
            )
            .unwrap();
    }

    let backup = create_backup(&backup_source_path, 18).unwrap();
    let preview = preview_restore(&current_db_path, &backup, 18).unwrap();

    assert_eq!(preview.metadata.schema_version, 18);
    assert!(preview.schema_compatible);
    assert_eq!(preview.current.account_count, 1);
    assert_eq!(preview.current.feed_count, 0);
    assert_eq!(preview.current.article_count, 0);
    assert_eq!(preview.backup.account_count, 1);
    assert_eq!(preview.backup.feed_count, 1);
    assert_eq!(preview.backup.article_count, 1);
}

#[test]
fn create_backup_checkpoints_wal_before_copying() {
    let (_dir, db_path) = setup_temp_db();
    let wal_path = PathBuf::from(format!("{}-wal", db_path.display()));
    let conn = Connection::open(&db_path).unwrap();
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         INSERT INTO probe (id, payload) VALUES (2, 'pending wal content');",
    )
    .unwrap();
    assert!(wal_path.exists(), "fixture should create a WAL sidecar");
    drop(conn);

    let bp = create_backup(&db_path, 2).unwrap();

    assert!(bp.exists());
    assert_eq!(read_probe_payload(&bp), "test database content");
    let row_count: i64 = Connection::open(&bp)
        .unwrap()
        .query_row("SELECT COUNT(*) FROM probe", [], |row| row.get(0))
        .unwrap();
    assert_eq!(row_count, 2);
    assert_eq!(
        fs::metadata(&wal_path)
            .map(|metadata| metadata.len())
            .unwrap_or(0),
        0
    );
    assert!(!temp_backup_path(&auxiliary_backup_path(&bp, "wal")).exists());
    assert!(!temp_backup_path(&auxiliary_backup_path(&bp, "shm")).exists());
}

#[test]
fn create_backup_uses_unique_name_when_timestamp_collides() {
    let (_dir, db_path) = setup_temp_db();
    let first = create_backup(&db_path, 1).unwrap();
    let conn = Connection::open(&db_path).unwrap();
    conn.execute(
        "UPDATE probe SET payload = 'second database content' WHERE id = 1",
        [],
    )
    .unwrap();
    drop(conn);

    let second = create_backup(&db_path, 1).unwrap();

    assert_ne!(first, second);
    assert!(first.exists());
    assert!(second.exists());
    assert_eq!(read_probe_payload(&first), "test database content");
    assert_eq!(read_probe_payload(&second), "second database content");
}

#[test]
fn create_backup_uses_unique_name_when_auxiliary_backup_collides() {
    let (_dir, db_path) = setup_temp_db();
    let base = backup_path(&db_path, 1);
    fs::create_dir_all(base.parent().unwrap()).unwrap();
    fs::write(auxiliary_backup_path(&base, "wal"), b"existing wal backup").unwrap();

    let backup = create_backup(&db_path, 1).unwrap();

    assert_ne!(backup, base);
    assert!(backup.exists());
    assert!(auxiliary_backup_path(&base, "wal").exists());
}

#[test]
fn create_backup_fails_if_db_missing() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("nonexistent.db");
    let result = create_backup(&db_path, 1);
    assert!(result.is_err());
}

#[test]
fn create_backup_rejects_corrupt_source_before_copying() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("corrupt.db");
    fs::write(&db_path, b"not sqlite").unwrap();

    let error = create_backup(&db_path, 1).unwrap_err().to_string();

    assert!(
        error.contains("SQLite integrity_check failed before backup")
            || error.contains("Failed to run SQLite integrity_check before backup")
            || error.contains("file is not a database"),
        "backup should fail before copying a corrupt DB: {error}"
    );
    assert!(
        error.contains("[redacted parent]/corrupt.db"),
        "backup error should keep path redacted: {error}"
    );
    let finalized_backup_count = fs::read_dir(backups_dir(&db_path).unwrap())
        .unwrap()
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry
                .file_name()
                .to_string_lossy()
                .starts_with("corrupt_v1_")
        })
        .count();
    assert_eq!(
        finalized_backup_count, 0,
        "backup should not leave a finalized corrupt backup"
    );
}

#[test]
fn restore_backup_replaces_db() {
    let (_dir, db_path) = setup_temp_db();
    let bp = create_backup(&db_path, 1).unwrap();
    // Corrupt the original
    let conn = Connection::open(&db_path).unwrap();
    conn.execute("UPDATE probe SET payload = 'corrupted' WHERE id = 1", [])
        .unwrap();
    drop(conn);
    restore_backup(&db_path, &bp).unwrap();
    assert_eq!(read_probe_payload(&db_path), "test database content");
}

#[test]
fn restore_backup_rejects_corrupt_backup_before_replacing_current_db() {
    let dir = tempfile::tempdir().unwrap();
    let db_path = dir.path().join("current.db");
    let backup_path = dir.path().join("corrupt-backup.db");
    {
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch(
            "CREATE TABLE probe (id INTEGER PRIMARY KEY, payload TEXT NOT NULL);
             INSERT INTO probe (id, payload) VALUES (1, 'current database content');",
        )
        .unwrap();
    }
    fs::write(&backup_path, b"not sqlite").unwrap();

    let error = restore_backup(&db_path, &backup_path)
        .expect_err("corrupt backup should fail before replacing current DB")
        .to_string();

    assert!(
        error.contains("SQLite integrity_check failed before restore")
            || error.contains("Failed to run SQLite integrity_check before restore")
            || error.contains("file is not a database"),
        "restore should report the preflight integrity failure: {error}"
    );
    assert_eq!(read_probe_payload(&db_path), "current database content");
    assert!(!temp_backup_path(&db_path).exists());
    assert!(!restore_old_path(&db_path).exists());
}

#[test]
fn restore_backup_replaces_db_wal_and_shm_as_one_set() {
    let (_dir, db_path) = setup_temp_db();
    let wal_path = PathBuf::from(format!("{}-wal", db_path.display()));
    let shm_path = PathBuf::from(format!("{}-shm", db_path.display()));
    fs::write(&wal_path, []).unwrap();
    fs::write(&shm_path, []).unwrap();

    let bp = create_backup(&db_path, 1).unwrap();

    let conn = Connection::open(&db_path).unwrap();
    conn.execute(
        "UPDATE probe SET payload = 'current database content' WHERE id = 1",
        [],
    )
    .unwrap();
    drop(conn);
    fs::write(&wal_path, b"current wal").unwrap();
    fs::write(&shm_path, b"current shm").unwrap();

    restore_backup(&db_path, &bp).unwrap();

    assert_eq!(fs::read(&wal_path).unwrap_or_default(), b"");
    assert_eq!(fs::read(&shm_path).unwrap_or_default(), b"");
    assert_eq!(read_probe_payload(&db_path), "test database content");
    assert!(!temp_backup_path(&db_path).exists());
    assert!(!restore_old_path(&db_path).exists());
    assert!(!temp_backup_path(&wal_path).exists());
    assert!(!restore_old_path(&wal_path).exists());
    assert!(!temp_backup_path(&shm_path).exists());
    assert!(!restore_old_path(&shm_path).exists());
}

#[test]
fn restore_removes_stale_wal_shm() {
    let (_dir, db_path) = setup_temp_db();
    let bp = create_backup(&db_path, 1).unwrap();
    // Create stale WAL/SHM files that have no backup counterparts.
    let mut wal_name = db_path.as_os_str().to_owned();
    wal_name.push("-wal");
    let wal_path = PathBuf::from(wal_name);
    let mut shm_name = db_path.as_os_str().to_owned();
    shm_name.push("-shm");
    let shm_path = PathBuf::from(shm_name);
    fs::write(&wal_path, b"stale wal").unwrap();
    fs::write(&shm_path, b"stale shm").unwrap();
    restore_backup(&db_path, &bp).unwrap();
    // Stale WAL/SHM should be removed (no aux backup existed for v1).
    assert!(!wal_path.exists());
    assert!(!shm_path.exists());
}

#[test]
fn cleanup_keeps_only_recent() {
    let (_dir, db_path) = setup_temp_db();
    let backup_dir = backups_dir(&db_path).unwrap();
    fs::create_dir_all(&backup_dir).unwrap();
    let backups = [
        "test_v1_20240101T000001.db",
        "test_v2_20240101T000002.db",
        "test_v3_20240101T000003.db",
        "test_v4_20240101T000004.db",
    ];
    for backup in backups {
        fs::write(backup_dir.join(backup), backup).unwrap();
    }
    cleanup_old_backups(&db_path, 2).unwrap();

    // Only v3 and v4 should remain
    assert!(!backup_dir.join("test_v1_20240101T000001.db").exists());
    assert!(!backup_dir.join("test_v2_20240101T000002.db").exists());
    assert!(backup_dir.join("test_v3_20240101T000003.db").exists());
    assert!(backup_dir.join("test_v4_20240101T000004.db").exists());
}

#[test]
fn cleanup_removes_wal_and_shm_with_their_main_backup_generation() {
    let (_dir, db_path) = setup_temp_db();
    let backup_dir = backups_dir(&db_path).unwrap();
    fs::create_dir_all(&backup_dir).unwrap();
    let backups = [
        "test_v1_20240101T000001.db",
        "test_v2_20240101T000002.db",
        "test_v3_20240101T000003.db",
    ];
    for backup in backups {
        let path = backup_dir.join(backup);
        fs::write(&path, backup).unwrap();
        fs::write(auxiliary_backup_path(&path, "wal"), format!("{backup}-wal")).unwrap();
        fs::write(auxiliary_backup_path(&path, "shm"), format!("{backup}-shm")).unwrap();
    }

    cleanup_old_backups(&db_path, 1).unwrap();

    for removed in &["test_v1_20240101T000001.db", "test_v2_20240101T000002.db"] {
        let path = backup_dir.join(removed);
        assert!(!path.exists());
        assert!(!auxiliary_backup_path(&path, "wal").exists());
        assert!(!auxiliary_backup_path(&path, "shm").exists());
    }

    let kept = backup_dir.join("test_v3_20240101T000003.db");
    assert!(kept.exists());
    assert!(auxiliary_backup_path(&kept, "wal").exists());
    assert!(auxiliary_backup_path(&kept, "shm").exists());
}

#[test]
fn cleanup_removes_orphan_auxiliary_backups_without_touching_kept_generation() {
    let (_dir, db_path) = setup_temp_db();
    let backup_dir = backups_dir(&db_path).unwrap();
    fs::create_dir_all(&backup_dir).unwrap();
    let kept = backup_dir.join("test_v3_20240101T000003.db");
    let orphan = backup_dir.join("test_v2_20240101T000002.db");
    fs::write(&kept, b"kept").unwrap();
    fs::write(auxiliary_backup_path(&kept, "wal"), b"kept wal").unwrap();
    fs::write(auxiliary_backup_path(&kept, "shm"), b"kept shm").unwrap();
    fs::write(auxiliary_backup_path(&orphan, "wal"), b"orphan wal").unwrap();
    fs::write(auxiliary_backup_path(&orphan, "shm"), b"orphan shm").unwrap();

    cleanup_old_backups(&db_path, 1).unwrap();

    assert!(kept.exists());
    assert!(auxiliary_backup_path(&kept, "wal").exists());
    assert!(auxiliary_backup_path(&kept, "shm").exists());
    assert!(!auxiliary_backup_path(&orphan, "wal").exists());
    assert!(!auxiliary_backup_path(&orphan, "shm").exists());
}

#[test]
fn cleanup_failure_message_redacts_backup_path() {
    let (dir, db_path) = setup_temp_db();
    let backup_dir = backups_dir(&db_path).unwrap();
    fs::create_dir_all(&backup_dir).unwrap();

    let blocked_backup = backup_dir.join("test_v1_20240101T000001.db");
    fs::create_dir(&blocked_backup).unwrap();
    fs::write(backup_dir.join("test_v2_20240101T000002.db"), b"newer").unwrap();

    let error = cleanup_old_backups(&db_path, 1).unwrap_err().to_string();

    assert!(
        error.contains("[redacted parent]/test_v1_20240101T000001.db"),
        "cleanup failure should identify the backup filename without leaking its directory: {error}"
    );
    assert!(
        !error.contains(dir.path().to_string_lossy().as_ref()),
        "cleanup failure should not include the temp directory path: {error}"
    );
}
