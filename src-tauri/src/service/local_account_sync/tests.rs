use chrono::{DateTime, Utc};

use crate::domain::local_account_sync::{
    LocalAccountSyncOperation, LocalSyncAccountId, LocalSyncAction, LocalSyncArticleKey,
    LocalSyncDeviceId, LocalSyncEntityKey, LocalSyncOperationId,
};
use crate::domain::types::AccountId;
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_local_account_sync_settings::SqliteLocalAccountSyncSettingsRepository;
use crate::infra::local_account_sync_files::write_local_sync_operation_file;
use crate::repository::local_account_sync_settings::{
    LocalAccountSyncSettings, LocalAccountSyncSettingsRepository,
};
use crate::service::local_account_sync::{
    build_current_state_operations, compute_local_account_sync_digest,
    export_local_account_sync_folder, export_local_account_sync_folder_if_changed,
    import_local_account_sync_folder, LocalAccountSyncImportReport,
};

fn ts(seconds: i64) -> DateTime<Utc> {
    DateTime::from_timestamp(seconds, 0).expect("test timestamp should be valid")
}

fn operation_with(
    sync_account_id: &str,
    id: &str,
    entity_key: LocalSyncEntityKey,
    action: LocalSyncAction,
) -> LocalAccountSyncOperation {
    LocalAccountSyncOperation {
        sync_account_id: LocalSyncAccountId(sync_account_id.to_string()),
        operation_id: LocalSyncOperationId(id.to_string()),
        device_id: LocalSyncDeviceId("device-a".to_string()),
        occurred_at: ts(10),
        entity_key,
        action,
    }
}

fn operation(id: &str) -> LocalAccountSyncOperation {
    operation_with(
        "sync-account-a",
        id,
        LocalSyncEntityKey::Article {
            article_key: LocalSyncArticleKey("missing".to_string()),
        },
        LocalSyncAction::SetRead { is_read: true },
    )
}

/// Seeds one folder, one feed, and one article (read + starred) for
/// `account_id`, matching the shape exercised by the export tests below.
fn seed_export_fixture(db: &DbManager, account_id: &AccountId) {
    db.writer()
        .execute(
            "INSERT INTO accounts (id, kind, name) VALUES (?1, 'Local', 'Local')",
            [&account_id.0],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order)
             VALUES ('folder-1', ?1, 'Tech', 1)",
            [&account_id.0],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO feeds (id, account_id, folder_id, title, url, site_url, icon_url, reader_mode, web_preview_mode)
             VALUES ('feed-1', ?1, 'folder-1', 'Feed', 'https://example.com/feed.xml', 'https://example.com', 'https://example.com/icon.png', 'inherit', 'inherit')",
            [&account_id.0],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO articles (
                id, feed_id, remote_id, title, url, published_at, fetched_at, is_read, is_starred
             )
             VALUES ('article-1', 'feed-1', 'guid-1', 'Article', 'https://example.com/a', ?1, ?1, 1, 1)",
            [ts(1).to_rfc3339()],
        )
        .unwrap();
}

#[test]
fn import_reports_rejected_files_without_applying_operations() {
    let db = DbManager::new_in_memory().unwrap();
    let account_id = AccountId("account-1".to_string());
    db.writer()
        .execute(
            "INSERT INTO accounts (id, kind, name) VALUES (?1, 'Local', 'Local')",
            [&account_id.0],
        )
        .unwrap();
    let dir = tempfile::tempdir().unwrap();
    write_local_sync_operation_file(dir.path(), &operation("read-missing"), 1).unwrap();
    let op_dir = dir.path().join("ops").join("device-a");
    std::fs::write(op_dir.join("00000002.json"), "{not-json").unwrap();

    let report = import_local_account_sync_folder(
        &db,
        &account_id,
        &LocalSyncAccountId("sync-account-a".to_string()),
        dir.path(),
    )
    .unwrap();

    assert_eq!(report.loaded_operations, 1);
    assert_eq!(report.foreign_operations_skipped, 0);
    assert_eq!(report.rejected_files, 1);
    assert_eq!(report.apply_report.article_states_applied, 0);
    assert_eq!(report.apply_report.unmatched_article_keys, 0);
    assert!(!report.applied);
}

#[test]
fn import_applies_only_operations_for_requested_sync_account() {
    let db = DbManager::new_in_memory().unwrap();
    let account_id = AccountId("account-1".to_string());
    db.writer()
        .execute(
            "INSERT INTO accounts (id, kind, name) VALUES (?1, 'Local', 'Local')",
            [&account_id.0],
        )
        .unwrap();
    let dir = tempfile::tempdir().unwrap();
    let operations = [
        operation_with(
            "sync-account-a",
            "own-folder",
            LocalSyncEntityKey::Folder {
                normalized_name: "own-folder".to_string(),
            },
            LocalSyncAction::UpsertFolder {
                display_name: "Own Folder".to_string(),
                sort_order: 1,
            },
        ),
        operation_with(
            "sync-account-a",
            "own-feed",
            LocalSyncEntityKey::Feed {
                normalized_feed_url: "https://example.com/own.xml".to_string(),
            },
            LocalSyncAction::UpsertFeed {
                title: "Own Feed".to_string(),
                site_url: "https://example.com".to_string(),
                icon_url: None,
                folder_name: Some("Own Folder".to_string()),
            },
        ),
        operation_with(
            "sync-account-a",
            "own-tag",
            LocalSyncEntityKey::Tag {
                normalized_name: "own-tag".to_string(),
            },
            LocalSyncAction::AddTag {
                display_name: "Own Tag".to_string(),
            },
        ),
        operation_with(
            "sync-account-a",
            "own-mute",
            LocalSyncEntityKey::MuteKeyword {
                normalized_keyword: "own-keyword".to_string(),
                scope: "title".to_string(),
            },
            LocalSyncAction::UpsertMuteKeyword,
        ),
        operation_with(
            "sync-account-b",
            "foreign-folder",
            LocalSyncEntityKey::Folder {
                normalized_name: "foreign-folder".to_string(),
            },
            LocalSyncAction::UpsertFolder {
                display_name: "Foreign Folder".to_string(),
                sort_order: 2,
            },
        ),
        operation_with(
            "sync-account-b",
            "foreign-feed",
            LocalSyncEntityKey::Feed {
                normalized_feed_url: "https://example.com/foreign.xml".to_string(),
            },
            LocalSyncAction::UpsertFeed {
                title: "Foreign Feed".to_string(),
                site_url: "https://example.com".to_string(),
                icon_url: None,
                folder_name: Some("Foreign Folder".to_string()),
            },
        ),
        operation_with(
            "sync-account-b",
            "foreign-tag",
            LocalSyncEntityKey::Tag {
                normalized_name: "foreign-tag".to_string(),
            },
            LocalSyncAction::AddTag {
                display_name: "Foreign Tag".to_string(),
            },
        ),
        operation_with(
            "sync-account-b",
            "foreign-mute",
            LocalSyncEntityKey::MuteKeyword {
                normalized_keyword: "foreign-keyword".to_string(),
                scope: "title".to_string(),
            },
            LocalSyncAction::UpsertMuteKeyword,
        ),
    ];
    for (sequence, operation) in operations.iter().enumerate() {
        write_local_sync_operation_file(dir.path(), operation, (sequence + 1) as u64).unwrap();
    }

    let report = import_local_account_sync_folder(
        &db,
        &account_id,
        &LocalSyncAccountId("sync-account-a".to_string()),
        dir.path(),
    )
    .unwrap();

    assert_eq!(report.loaded_operations, 8);
    assert_eq!(report.foreign_operations_skipped, 4);
    assert_eq!(report.applied_operations, 4);
    assert_eq!(report.rejected_operations, 0);
    assert!(report.applied);
    assert_eq!(report.apply_report.folders_upserted, 1);
    assert_eq!(report.apply_report.feeds_upserted, 1);
    assert_eq!(report.apply_report.tags_upserted, 1);
    assert_eq!(report.apply_report.mute_keywords_upserted, 1);

    let conn = db.reader();
    assert_eq!(
        conn.query_row(
            "SELECT COUNT(*) FROM folders WHERE account_id = ?1 AND name = ?2",
            [account_id.0.as_str(), "Own Folder"],
            |row| row.get::<_, i64>(0),
        )
        .unwrap(),
        1
    );
    assert_eq!(
        conn.query_row(
            "SELECT COUNT(*) FROM folders WHERE account_id = ?1 AND name = ?2",
            [account_id.0.as_str(), "Foreign Folder"],
            |row| row.get::<_, i64>(0),
        )
        .unwrap(),
        0
    );
    assert_eq!(
        conn.query_row(
            "SELECT COUNT(*) FROM feeds WHERE account_id = ?1 AND url = ?2",
            [account_id.0.as_str(), "https://example.com/own.xml"],
            |row| row.get::<_, i64>(0),
        )
        .unwrap(),
        1
    );
    assert_eq!(
        conn.query_row(
            "SELECT COUNT(*) FROM feeds WHERE account_id = ?1 AND url = ?2",
            [account_id.0.as_str(), "https://example.com/foreign.xml"],
            |row| row.get::<_, i64>(0),
        )
        .unwrap(),
        0
    );
    assert_eq!(
        conn.query_row(
            "SELECT COUNT(*) FROM tags WHERE name = ?1",
            ["Own Tag"],
            |row| row.get::<_, i64>(0),
        )
        .unwrap(),
        1
    );
    assert_eq!(
        conn.query_row(
            "SELECT COUNT(*) FROM tags WHERE name = ?1",
            ["Foreign Tag"],
            |row| row.get::<_, i64>(0),
        )
        .unwrap(),
        0
    );
    assert_eq!(
        conn.query_row(
            "SELECT COUNT(*) FROM mute_keywords WHERE keyword = ?1 AND scope = ?2",
            ["own-keyword", "title"],
            |row| row.get::<_, i64>(0),
        )
        .unwrap(),
        1
    );
    assert_eq!(
        conn.query_row(
            "SELECT COUNT(*) FROM mute_keywords WHERE keyword = ?1 AND scope = ?2",
            ["foreign-keyword", "title"],
            |row| row.get::<_, i64>(0),
        )
        .unwrap(),
        0
    );
}

#[test]
fn export_writes_current_local_account_state_as_operation_files() {
    let db = DbManager::new_in_memory().unwrap();
    let account_id = AccountId("account-1".to_string());
    db.writer()
        .execute(
            "INSERT INTO accounts (id, kind, name) VALUES (?1, 'Local', 'Local')",
            [&account_id.0],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order)
             VALUES ('folder-1', ?1, 'Tech', 1)",
            [&account_id.0],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO feeds (id, account_id, folder_id, title, url, site_url, icon_url, reader_mode, web_preview_mode)
             VALUES ('feed-1', ?1, 'folder-1', 'Feed', 'https://example.com/feed.xml', 'https://example.com', 'https://example.com/icon.png', 'inherit', 'inherit')",
            [&account_id.0],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO articles (
                id, feed_id, remote_id, title, url, published_at, fetched_at, is_read, is_starred
             )
             VALUES ('article-1', 'feed-1', 'guid-1', 'Article', 'https://example.com/a', ?1, ?1, 1, 1)",
            [ts(1).to_rfc3339()],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO tags (id, name) VALUES ('tag-1', 'Read Later')",
            [],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO article_tags (article_id, tag_id) VALUES ('article-1', 'tag-1')",
            [],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at)
             VALUES ('mute-1', 'Spoiler', 'title', ?1, ?1)",
            [ts(1).to_rfc3339()],
        )
        .unwrap();
    let dir = tempfile::tempdir().unwrap();

    let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db.writer());
    let settings = seeded_settings(&dir.path().to_string_lossy(), &account_id);
    settings_repo.save(&settings).unwrap();

    let report = export_local_account_sync_folder(&db, &account_id, &settings).unwrap();

    assert_eq!(report.operations_written, 7);
    let load_report =
        crate::infra::local_account_sync_files::load_local_sync_operation_dir(dir.path()).unwrap();
    assert_eq!(load_report.operations.len(), 7);
    let exported_icon_url =
        load_report
            .operations
            .iter()
            .find_map(|operation| match &operation.action {
                LocalSyncAction::UpsertFeed { icon_url, .. } => Some(icon_url.as_deref()),
                _ => None,
            });
    assert_eq!(
        exported_icon_url,
        Some(Some("https://example.com/icon.png"))
    );
    assert!(load_report
        .operations
        .iter()
        .any(|operation| matches!(operation.action, LocalSyncAction::SetRead { is_read: true })));
    assert!(load_report.operations.iter().any(|operation| matches!(
        operation.action,
        LocalSyncAction::SetStarred { is_starred: true }
    )));
    assert!(load_report
        .operations
        .iter()
        .any(|operation| matches!(operation.action, LocalSyncAction::AddArticleTag)));

    let settings_after_first = settings_repo
        .find_by_account_id(&account_id)
        .unwrap()
        .expect("settings should exist after export");
    let second_report =
        export_local_account_sync_folder(&db, &account_id, &settings_after_first).unwrap();
    let second_load_report =
        crate::infra::local_account_sync_files::load_local_sync_operation_dir(dir.path()).unwrap();

    assert_eq!(second_report.operations_written, 7);
    assert_eq!(second_load_report.operations.len(), 14);
}

#[test]
fn compute_digest_is_stable_across_differing_operation_ids_and_timestamps() {
    let operation_a = operation_with(
        "sync-account-a",
        "op-1",
        LocalSyncEntityKey::Tag {
            normalized_name: "rust".to_string(),
        },
        LocalSyncAction::RemoveTag,
    );
    let operation_b = LocalAccountSyncOperation {
        operation_id: LocalSyncOperationId("op-2".to_string()),
        occurred_at: ts(999),
        ..operation_a.clone()
    };

    assert_eq!(
        compute_local_account_sync_digest(&[operation_a]),
        compute_local_account_sync_digest(&[operation_b])
    );
}

#[test]
fn compute_digest_changes_when_an_article_state_change_time_changes() {
    let operation_a = operation("op-1");
    let operation_b = LocalAccountSyncOperation {
        operation_id: LocalSyncOperationId("op-2".to_string()),
        occurred_at: ts(999),
        ..operation_a.clone()
    };

    assert_ne!(
        compute_local_account_sync_digest(&[operation_a]),
        compute_local_account_sync_digest(&[operation_b])
    );
}

#[test]
fn compute_digest_changes_when_an_entity_change_time_changes() {
    let cases = [
        (
            LocalSyncEntityKey::Folder {
                normalized_name: "tech".to_string(),
            },
            LocalSyncAction::UpsertFolder {
                display_name: "Tech".to_string(),
                sort_order: 0,
            },
        ),
        (
            LocalSyncEntityKey::Tag {
                normalized_name: "rust".to_string(),
            },
            LocalSyncAction::AddTag {
                display_name: "rust".to_string(),
            },
        ),
        (
            LocalSyncEntityKey::MuteKeyword {
                normalized_keyword: "spam".to_string(),
                scope: "title".to_string(),
            },
            LocalSyncAction::UpsertMuteKeyword,
        ),
    ];

    for (entity_key, action) in cases {
        let before = operation_with("sync-account-a", "op-1", entity_key, action);
        let after = LocalAccountSyncOperation {
            occurred_at: ts(999),
            ..before.clone()
        };

        assert_ne!(
            compute_local_account_sync_digest(&[before.clone()]),
            compute_local_account_sync_digest(&[after]),
            "a restored value must re-export once its recorded change time moves: {:?}",
            before.action
        );
    }
}

#[test]
fn compute_digest_changes_when_action_changes() {
    let unread = operation("op-1");
    let read = LocalAccountSyncOperation {
        action: LocalSyncAction::SetRead { is_read: false },
        ..unread.clone()
    };

    assert_ne!(
        compute_local_account_sync_digest(&[unread]),
        compute_local_account_sync_digest(&[read])
    );
}

#[test]
fn compute_digest_changes_when_a_feed_is_added() {
    let db = DbManager::new_in_memory().unwrap();
    let account_id = AccountId("account-1".to_string());
    seed_export_fixture(&db, &account_id);

    let before = compute_local_account_sync_digest(
        &build_current_state_operations(
            &db,
            &account_id,
            &LocalSyncAccountId("sync-account-a".to_string()),
            &LocalSyncDeviceId("device-a".to_string()),
        )
        .unwrap(),
    );

    db.writer()
        .execute(
            "INSERT INTO feeds (id, account_id, folder_id, title, url, site_url, reader_mode, web_preview_mode)
             VALUES ('feed-2', ?1, NULL, 'Feed Two', 'https://example.com/feed2.xml', 'https://example.com', 'inherit', 'inherit')",
            [&account_id.0],
        )
        .unwrap();

    let after = compute_local_account_sync_digest(
        &build_current_state_operations(
            &db,
            &account_id,
            &LocalSyncAccountId("sync-account-a".to_string()),
            &LocalSyncDeviceId("device-a".to_string()),
        )
        .unwrap(),
    );

    assert_ne!(before, after);
}

#[test]
fn manual_export_with_empty_operations_writes_zero_files() {
    let db = DbManager::new_in_memory().unwrap();
    let account_id = AccountId("account-1".to_string());
    db.writer()
        .execute(
            "INSERT INTO accounts (id, kind, name) VALUES (?1, 'Local', 'Local')",
            [&account_id.0],
        )
        .unwrap();
    let dir = tempfile::tempdir().unwrap();

    let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db.writer());
    let settings = seeded_settings(&dir.path().to_string_lossy(), &account_id);
    settings_repo.save(&settings).unwrap();

    let report = export_local_account_sync_folder(&db, &account_id, &settings).unwrap();

    assert_eq!(report.operations_written, 0);
    let load_report =
        crate::infra::local_account_sync_files::load_local_sync_operation_dir(dir.path()).unwrap();
    assert_eq!(load_report.operations.len(), 0);
    let settings_after_export = settings_repo
        .find_by_account_id(&account_id)
        .unwrap()
        .expect("settings should exist after an empty export");
    assert_eq!(
        export_local_account_sync_folder_if_changed(&db, &account_id, &settings_after_export)
            .unwrap(),
        None,
    );
}

#[test]
fn manual_export_makes_next_auto_export_a_no_op() {
    let db = DbManager::new_in_memory().unwrap();
    let account_id = AccountId("account-1".to_string());
    seed_export_fixture(&db, &account_id);
    let dir = tempfile::tempdir().unwrap();

    let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db.writer());
    let settings = seeded_settings(&dir.path().to_string_lossy(), &account_id);
    settings_repo.save(&settings).unwrap();

    let manual_report = export_local_account_sync_folder(&db, &account_id, &settings).unwrap();
    assert_eq!(manual_report.operations_written, 4);

    let settings_after_manual_export = settings_repo
        .find_by_account_id(&account_id)
        .unwrap()
        .expect("settings should exist after manual export");
    let written_snapshot =
        crate::infra::local_account_sync_files::load_local_sync_operation_dir(dir.path()).unwrap();
    assert_eq!(
        settings_after_manual_export.last_export_digest,
        Some(compute_local_account_sync_digest(
            &written_snapshot.operations
        )),
    );

    // The very next auto-export call should be a no-op: the digest
    // already matches the current (unchanged) state.
    let auto_export_result = export_local_account_sync_folder_if_changed(
        &db,
        &account_id,
        &settings_after_manual_export,
    )
    .unwrap();
    assert_eq!(
        auto_export_result, None,
        "auto-export should skip redundantly rewriting the snapshot the manual export just wrote"
    );

    let load_report_after_auto_export =
        crate::infra::local_account_sync_files::load_local_sync_operation_dir(dir.path()).unwrap();
    assert_eq!(
        load_report_after_auto_export.operations.len(),
        4,
        "auto-export should not have written a second, redundant snapshot"
    );
}

#[test]
fn manual_export_write_failure_preserves_previous_digest() {
    let db = DbManager::new_in_memory().unwrap();
    let account_id = AccountId("account-1".to_string());
    seed_export_fixture(&db, &account_id);
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("ops"), "blocks the operations directory").unwrap();

    let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db.writer());
    let mut settings = seeded_settings(&dir.path().to_string_lossy(), &account_id);
    settings.last_export_digest = Some("previous-digest".to_string());
    settings_repo.save(&settings).unwrap();

    let error = export_local_account_sync_folder(&db, &account_id, &settings)
        .expect_err("a file write failure should fail the export");
    assert!(matches!(
        error,
        crate::domain::error::DomainError::Persistence(_)
    ));
    let settings_after_failure = settings_repo
        .find_by_account_id(&account_id)
        .unwrap()
        .expect("settings should survive the failed export");
    assert_eq!(
        settings_after_failure.last_export_digest,
        settings.last_export_digest
    );
}

#[test]
fn manual_export_digest_failure_allows_auto_export_to_retry_written_snapshot() {
    let db = DbManager::new_in_memory().unwrap();
    let account_id = AccountId("account-1".to_string());
    seed_export_fixture(&db, &account_id);
    let dir = tempfile::tempdir().unwrap();

    let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db.writer());
    let mut settings = seeded_settings(&dir.path().to_string_lossy(), &account_id);
    settings.last_export_digest = Some("previous-digest".to_string());
    settings_repo.save(&settings).unwrap();
    db.writer()
        .execute_batch(
            "CREATE TRIGGER reject_export_digest BEFORE UPDATE OF last_export_digest
             ON local_account_sync_settings
             BEGIN SELECT RAISE(ABORT, 'forced digest failure'); END;",
        )
        .unwrap();

    let error = export_local_account_sync_folder(&db, &account_id, &settings)
        .expect_err("a digest save failure should fail the export after writing files");
    assert!(error.to_string().contains("forced digest failure"));
    let load_report =
        crate::infra::local_account_sync_files::load_local_sync_operation_dir(dir.path()).unwrap();
    assert_eq!(load_report.operations.len(), 4);
    let settings_after_failure = settings_repo
        .find_by_account_id(&account_id)
        .unwrap()
        .expect("settings should survive the failed digest save");
    assert_eq!(
        settings_after_failure.last_export_digest,
        settings.last_export_digest
    );

    db.writer()
        .execute_batch("DROP TRIGGER reject_export_digest;")
        .unwrap();
    let retry =
        export_local_account_sync_folder_if_changed(&db, &account_id, &settings_after_failure)
            .unwrap()
            .expect("auto-export should retry the snapshot whose digest was not saved");
    assert_eq!(retry.operations_written, 4);
    let load_report =
        crate::infra::local_account_sync_files::load_local_sync_operation_dir(dir.path()).unwrap();
    assert_eq!(load_report.operations.len(), 8);
    let settings_after_retry = settings_repo
        .find_by_account_id(&account_id)
        .unwrap()
        .expect("settings should exist after a successful retry");
    assert_eq!(
        export_local_account_sync_folder_if_changed(&db, &account_id, &settings_after_retry)
            .unwrap(),
        None,
    );
}

fn seeded_settings(sync_folder_path: &str, account_id: &AccountId) -> LocalAccountSyncSettings {
    LocalAccountSyncSettings {
        account_id: account_id.clone(),
        sync_folder_path: sync_folder_path.to_string(),
        sync_account_id: LocalSyncAccountId("sync-account-a".to_string()),
        device_id: LocalSyncDeviceId("device-a".to_string()),
        enabled: true,
        last_export_digest: None,
    }
}

#[test]
fn export_if_changed_writes_once_then_skips_when_state_is_unchanged() {
    let db = DbManager::new_in_memory().unwrap();
    let account_id = AccountId("account-1".to_string());
    seed_export_fixture(&db, &account_id);
    let dir = tempfile::tempdir().unwrap();

    let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db.writer());
    let settings = seeded_settings(&dir.path().to_string_lossy(), &account_id);
    settings_repo.save(&settings).unwrap();

    let first_report = export_local_account_sync_folder_if_changed(&db, &account_id, &settings)
        .unwrap()
        .expect("first export should write files because there is no prior digest");
    assert_eq!(first_report.operations_written, 4);
    let load_report =
        crate::infra::local_account_sync_files::load_local_sync_operation_dir(dir.path()).unwrap();
    assert_eq!(load_report.operations.len(), 4);

    let settings_after_first = settings_repo
        .find_by_account_id(&account_id)
        .unwrap()
        .expect("settings should exist after first export");
    assert!(settings_after_first.last_export_digest.is_some());

    let second_result =
        export_local_account_sync_folder_if_changed(&db, &account_id, &settings_after_first)
            .unwrap();
    assert_eq!(second_result, None);

    let load_report_after_second =
        crate::infra::local_account_sync_files::load_local_sync_operation_dir(dir.path()).unwrap();
    assert_eq!(load_report_after_second.operations.len(), 4);
}

#[test]
fn export_if_changed_writes_again_and_updates_digest_after_state_changes() {
    let db = DbManager::new_in_memory().unwrap();
    let account_id = AccountId("account-1".to_string());
    seed_export_fixture(&db, &account_id);
    let dir = tempfile::tempdir().unwrap();

    let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db.writer());
    let settings = seeded_settings(&dir.path().to_string_lossy(), &account_id);
    settings_repo.save(&settings).unwrap();

    export_local_account_sync_folder_if_changed(&db, &account_id, &settings)
        .unwrap()
        .expect("first export should write files because there is no prior digest");
    let settings_after_first = settings_repo
        .find_by_account_id(&account_id)
        .unwrap()
        .expect("settings should exist after first export");

    db.writer()
        .execute("UPDATE articles SET is_read = 0 WHERE id = 'article-1'", [])
        .unwrap();

    let second_report =
        export_local_account_sync_folder_if_changed(&db, &account_id, &settings_after_first)
            .unwrap()
            .expect("changed state should trigger another export");
    assert_eq!(second_report.operations_written, 4);

    let load_report =
        crate::infra::local_account_sync_files::load_local_sync_operation_dir(dir.path()).unwrap();
    assert_eq!(load_report.operations.len(), 8);

    let settings_after_second = settings_repo
        .find_by_account_id(&account_id)
        .unwrap()
        .expect("settings should exist after second export");
    assert_ne!(
        settings_after_second.last_export_digest,
        settings_after_first.last_export_digest
    );
}

fn seed_two_unread_articles(db: &DbManager, account_id: &AccountId) {
    db.writer()
        .execute(
            "INSERT INTO accounts (id, kind, name) VALUES (?1, 'Local', 'Local')",
            [&account_id.0],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO feeds (id, account_id, title, url, site_url, reader_mode, web_preview_mode)
             VALUES ('feed-1', ?1, 'Feed', 'https://example.com/feed.xml', 'https://example.com', 'inherit', 'inherit')",
            [&account_id.0],
        )
        .unwrap();
    for (id, guid) in [("article-x", "guid-x"), ("article-y", "guid-y")] {
        db.writer()
            .execute(
                "INSERT INTO articles (
                    id, feed_id, remote_id, title, published_at, fetched_at, is_read, is_starred
                 )
                 VALUES (?1, 'feed-1', ?2, ?1, ?3, ?3, 0, 0)",
                rusqlite::params![id, guid, ts(1).to_rfc3339()],
            )
            .unwrap();
    }
}

fn article_flag(db: &DbManager, article_id: &str, column: &str) -> bool {
    db.reader()
        .query_row(
            &format!("SELECT {column} FROM articles WHERE id = ?1"),
            [article_id],
            |row| row.get(0),
        )
        .unwrap()
}

fn article_change_time(db: &DbManager, article_id: &str, column: &str) -> Option<String> {
    db.reader()
        .query_row(
            &format!("SELECT {column} FROM articles WHERE id = ?1"),
            [article_id],
            |row| row.get(0),
        )
        .unwrap()
}

fn export_then_import_between_devices(
    column: &str,
    importer_edit: &str,
    exporter_edit: &str,
) -> (DbManager, DbManager) {
    let account_id = AccountId("account-1".to_string());
    let exporter = DbManager::new_in_memory().unwrap();
    let importer = DbManager::new_in_memory().unwrap();
    seed_two_unread_articles(&exporter, &account_id);
    seed_two_unread_articles(&importer, &account_id);
    let dir = tempfile::tempdir().unwrap();
    let settings = LocalAccountSyncSettings {
        device_id: LocalSyncDeviceId("device-b".to_string()),
        ..seeded_settings(&dir.path().to_string_lossy(), &account_id)
    };

    SqliteLocalAccountSyncSettingsRepository::new(exporter.writer())
        .save(&settings)
        .unwrap();
    exporter
        .writer()
        .execute(
            &format!("UPDATE articles SET {column} = 1 WHERE id = ?1"),
            [exporter_edit],
        )
        .unwrap();
    export_local_account_sync_folder(&exporter, &account_id, &settings).unwrap();

    importer
        .writer()
        .execute(
            &format!("UPDATE articles SET {column} = 1 WHERE id = ?1"),
            [importer_edit],
        )
        .unwrap();
    import_local_account_sync_folder(
        &importer,
        &account_id,
        &settings.sync_account_id,
        dir.path(),
    )
    .unwrap();
    (exporter, importer)
}

#[test]
fn import_keeps_unexported_local_read_change_and_applies_newer_remote_one() {
    let (_exporter, importer) =
        export_then_import_between_devices("is_read", "article-y", "article-x");

    assert!(
        article_flag(&importer, "article-x", "is_read"),
        "the other device's newer read change should be applied"
    );
    assert!(
        article_flag(&importer, "article-y", "is_read"),
        "a local read change that was never exported must survive the import"
    );
}

#[test]
fn import_keeps_unexported_local_star_change_and_applies_newer_remote_one() {
    let (_exporter, importer) =
        export_then_import_between_devices("is_starred", "article-y", "article-x");

    assert!(
        article_flag(&importer, "article-x", "is_starred"),
        "the other device's newer star change should be applied"
    );
    assert!(
        article_flag(&importer, "article-y", "is_starred"),
        "a local star change that was never exported must survive the import"
    );
}

fn article_state_operation_times(
    db: &DbManager,
    account_id: &AccountId,
    article_title: &str,
) -> (DateTime<Utc>, DateTime<Utc>) {
    let operations = build_current_state_operations(
        db,
        account_id,
        &LocalSyncAccountId("sync-account-a".to_string()),
        &LocalSyncDeviceId("device-a".to_string()),
    )
    .unwrap();
    let key = crate::domain::local_account_sync::generate_local_sync_article_key(
        &LocalSyncAccountId("sync-account-a".to_string()),
        "https://example.com/feed.xml",
        crate::domain::local_account_sync::LocalSyncEntryIdentity {
            guid: Some(article_title.replace("article-", "guid-")),
            url: None,
            title: Some(article_title.to_string()),
        },
    )
    .unwrap()
    .key;
    let time_of = |wanted_read: bool| {
        operations
            .iter()
            .find(|operation| {
                matches!(&operation.entity_key, LocalSyncEntityKey::Article { article_key } if *article_key == key)
                    && matches!(
                        (&operation.action, wanted_read),
                        (LocalSyncAction::SetRead { .. }, true)
                            | (LocalSyncAction::SetStarred { .. }, false)
                    )
            })
            .expect("article operation should be exported")
            .occurred_at
    };
    (time_of(true), time_of(false))
}

#[test]
fn export_uses_article_change_times_and_epoch_for_untouched_articles() {
    let db = DbManager::new_in_memory().unwrap();
    let account_id = AccountId("account-1".to_string());
    seed_two_unread_articles(&db, &account_id);
    db.writer()
        .execute(
            "UPDATE articles
             SET is_read = 1, read_changed_at = '2026-01-02T03:04:05.678Z'
             WHERE id = 'article-x'",
            [],
        )
        .unwrap();

    let (x_read, x_starred) = article_state_operation_times(&db, &account_id, "article-x");
    let (y_read, y_starred) = article_state_operation_times(&db, &account_id, "article-y");

    assert_eq!(
        x_read,
        DateTime::parse_from_rfc3339("2026-01-02T03:04:05.678Z").unwrap()
    );
    assert_eq!(x_starred, DateTime::UNIX_EPOCH);
    assert_eq!(y_read, DateTime::UNIX_EPOCH);
    assert_eq!(y_starred, DateTime::UNIX_EPOCH);
}

#[test]
fn import_stores_remote_change_time_and_reexport_keeps_it() {
    let db = DbManager::new_in_memory().unwrap();
    let account_id = AccountId("account-1".to_string());
    let sync_account_id = LocalSyncAccountId("sync-account-a".to_string());
    seed_two_unread_articles(&db, &account_id);
    let dir = tempfile::tempdir().unwrap();
    let remote_time = DateTime::parse_from_rfc3339("2026-01-02T03:04:05.678Z")
        .unwrap()
        .with_timezone(&Utc);
    let key = crate::domain::local_account_sync::generate_local_sync_article_key(
        &sync_account_id,
        "https://example.com/feed.xml",
        crate::domain::local_account_sync::LocalSyncEntryIdentity {
            guid: Some("guid-x".to_string()),
            url: None,
            title: Some("article-x".to_string()),
        },
    )
    .unwrap()
    .key;
    let remote_operation = LocalAccountSyncOperation {
        occurred_at: remote_time,
        ..operation_with(
            "sync-account-a",
            "remote-read",
            LocalSyncEntityKey::Article { article_key: key },
            LocalSyncAction::SetRead { is_read: true },
        )
    };
    write_local_sync_operation_file(dir.path(), &remote_operation, 1).unwrap();

    import_local_account_sync_folder(&db, &account_id, &sync_account_id, dir.path()).unwrap();

    assert!(article_flag(&db, "article-x", "is_read"));
    assert_eq!(
        article_change_time(&db, "article-x", "read_changed_at").as_deref(),
        Some("2026-01-02T03:04:05.678Z")
    );
    assert_eq!(
        article_change_time(&db, "article-x", "starred_changed_at"),
        None
    );
    let (x_read, _) = article_state_operation_times(&db, &account_id, "article-x");
    assert_eq!(x_read, remote_time);
}

#[test]
fn export_if_changed_writes_when_a_restored_article_state_has_a_newer_change_time() {
    let db = DbManager::new_in_memory().unwrap();
    let account_id = AccountId("account-1".to_string());
    seed_two_unread_articles(&db, &account_id);
    let dir = tempfile::tempdir().unwrap();
    let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db.writer());
    settings_repo
        .save(&seeded_settings(&dir.path().to_string_lossy(), &account_id))
        .unwrap();
    let settings = settings_repo
        .find_by_account_id(&account_id)
        .unwrap()
        .expect("settings should exist");
    export_local_account_sync_folder_if_changed(&db, &account_id, &settings)
        .unwrap()
        .expect("first export should write");
    let exported = settings_repo
        .find_by_account_id(&account_id)
        .unwrap()
        .expect("settings should keep the exported digest");

    for is_read in [1, 0] {
        db.writer()
            .execute(
                "UPDATE articles SET is_read = ?1 WHERE id = 'article-x'",
                [is_read],
            )
            .unwrap();
    }

    assert!(
        export_local_account_sync_folder_if_changed(&db, &account_id, &exported)
            .unwrap()
            .is_some(),
        "an article change that restores the exported value carries a newer change time and must be exported"
    );
}

fn seed_entity_fixture(db: &DbManager, account_id: &AccountId) {
    seed_two_unread_articles(db, account_id);
    db.writer()
        .execute_batch(
            "INSERT INTO folders (id, account_id, name, sort_order) VALUES
               ('folder-tech', 'account-1', 'Tech', 0),
               ('folder-news', 'account-1', 'News', 1),
               ('folder-misc', 'account-1', 'Misc', 2);
             UPDATE feeds SET folder_id = 'folder-tech' WHERE id = 'feed-1';
             INSERT INTO feeds (id, account_id, folder_id, title, url, site_url, reader_mode, web_preview_mode)
             VALUES ('feed-2', 'account-1', 'folder-news', 'Feed 2', 'https://example.com/feed2.xml', 'https://example.com', 'inherit', 'inherit');
             INSERT INTO tags (id, name) VALUES ('tag-rust', 'rust'), ('tag-swift', 'swift');
             INSERT INTO article_tags (article_id, tag_id) VALUES
               ('article-x', 'tag-rust'), ('article-y', 'tag-swift');
             INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at)
             VALUES ('mute-spam', 'spam', 'title', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');",
        )
        .unwrap();
}

/// Both devices start from the same state; the exporter edits and exports, then the importer
/// makes its own never-exported edit and imports the exporter's files.
fn import_after_divergent_edits(exporter_sql: &str, importer_sql: &str) -> DbManager {
    let account_id = AccountId("account-1".to_string());
    let exporter = DbManager::new_in_memory().unwrap();
    let importer = DbManager::new_in_memory().unwrap();
    seed_entity_fixture(&exporter, &account_id);
    seed_entity_fixture(&importer, &account_id);
    let dir = tempfile::tempdir().unwrap();
    let settings = LocalAccountSyncSettings {
        device_id: LocalSyncDeviceId("device-b".to_string()),
        ..seeded_settings(&dir.path().to_string_lossy(), &account_id)
    };

    SqliteLocalAccountSyncSettingsRepository::new(exporter.writer())
        .save(&settings)
        .unwrap();
    exporter.writer().execute_batch(exporter_sql).unwrap();
    export_local_account_sync_folder(&exporter, &account_id, &settings).unwrap();

    importer.writer().execute_batch(importer_sql).unwrap();
    import_local_account_sync_folder(
        &importer,
        &account_id,
        &settings.sync_account_id,
        dir.path(),
    )
    .unwrap();
    importer
}

fn query_strings(db: &DbManager, sql: &str) -> Vec<String> {
    let conn = db.reader();
    let mut stmt = conn.prepare(sql).unwrap();
    let values = stmt
        .query_map([], |row| row.get(0))
        .unwrap()
        .collect::<Result<Vec<String>, _>>()
        .unwrap();
    values
}

fn folder_names_in_order(db: &DbManager) -> Vec<String> {
    query_strings(db, "SELECT name FROM folders ORDER BY sort_order")
}

fn feed_folder_name(db: &DbManager, feed_id: &str) -> Option<String> {
    db.reader()
        .query_row(
            "SELECT folders.name FROM feeds LEFT JOIN folders ON folders.id = feeds.folder_id
             WHERE feeds.id = ?1",
            [feed_id],
            |row| row.get(0),
        )
        .unwrap()
}

fn article_tag_pairs(db: &DbManager) -> Vec<String> {
    query_strings(
        db,
        "SELECT at.article_id || ':' || t.name FROM article_tags at
         JOIN tags t ON t.id = at.tag_id ORDER BY 1",
    )
}

fn mute_keywords(db: &DbManager) -> Vec<String> {
    query_strings(db, "SELECT keyword FROM mute_keywords ORDER BY keyword")
}

#[test]
fn import_keeps_unexported_local_folder_rename_and_applies_remote_folder_rename() {
    let importer = import_after_divergent_edits(
        "UPDATE folders SET name = 'Daily' WHERE id = 'folder-news'",
        "UPDATE folders SET name = 'Dev' WHERE id = 'folder-tech'",
    );

    let names = folder_names_in_order(&importer);
    assert!(
        names.contains(&"Daily".to_string()),
        "the other device's renamed folder should be applied: {names:?}"
    );
    assert!(
        !names.contains(&"Tech".to_string()),
        "a local folder rename that was never exported must not be undone by re-creating the old name: {names:?}"
    );
    assert_eq!(
        feed_folder_name(&importer, "feed-1").as_deref(),
        Some("Dev"),
        "the feed must stay in the locally renamed folder"
    );
}

#[test]
fn import_keeps_unexported_local_folder_order_and_applies_remote_new_folder() {
    let importer = import_after_divergent_edits(
        "INSERT INTO folders (id, account_id, name, sort_order)
         VALUES ('folder-daily', 'account-1', 'Daily', 3)",
        "UPDATE folders SET sort_order = sort_order + 10;
         UPDATE folders SET sort_order = CASE id
           WHEN 'folder-misc' THEN 0 WHEN 'folder-tech' THEN 1 ELSE 2 END",
    );

    let order = folder_names_in_order(&importer);
    assert!(
        order.contains(&"Daily".to_string()),
        "the other device's new folder should be applied: {order:?}"
    );
    assert_eq!(
        &order[..3],
        ["Misc", "Tech", "News"],
        "a local folder reorder that was never exported must survive the import: {order:?}"
    );
}

#[test]
fn import_keeps_unexported_local_feed_folder_move_and_applies_remote_feed_move() {
    let importer = import_after_divergent_edits(
        "UPDATE feeds SET folder_id = 'folder-tech' WHERE id = 'feed-2'",
        "UPDATE feeds SET folder_id = 'folder-news' WHERE id = 'feed-1'",
    );

    assert_eq!(
        feed_folder_name(&importer, "feed-2").as_deref(),
        Some("Tech"),
        "the other device's feed move should be applied"
    );
    assert_eq!(
        feed_folder_name(&importer, "feed-1").as_deref(),
        Some("News"),
        "a local feed move that was never exported must survive the import"
    );
}

const REMOTE_TAG_SQL: &str = "INSERT INTO tags (id, name) VALUES ('tag-remote', 'remote-new');
     INSERT INTO article_tags (article_id, tag_id) VALUES ('article-y', 'tag-remote')";

#[test]
fn import_keeps_unexported_local_tag_addition_and_applies_remote_tag() {
    let importer = import_after_divergent_edits(
        REMOTE_TAG_SQL,
        "INSERT INTO tags (id, name) VALUES ('tag-local', 'local-only');
         INSERT INTO article_tags (article_id, tag_id) VALUES ('article-x', 'tag-local')",
    );

    let pairs = article_tag_pairs(&importer);
    assert!(
        pairs.contains(&"article-y:remote-new".to_string()),
        "the other device's new tag and its article link should be applied: {pairs:?}"
    );
    assert!(
        pairs.contains(&"article-x:local-only".to_string()),
        "a local tag and article link that were never exported must survive the import: {pairs:?}"
    );
}

#[test]
fn import_keeps_unexported_local_tag_deletion_and_applies_remote_tag() {
    let importer = import_after_divergent_edits(
        REMOTE_TAG_SQL,
        "DELETE FROM article_tags WHERE tag_id = 'tag-rust';
         DELETE FROM tags WHERE id = 'tag-rust'",
    );

    let pairs = article_tag_pairs(&importer);
    let tags = query_strings(&importer, "SELECT name FROM tags ORDER BY name");
    assert!(
        pairs.contains(&"article-y:remote-new".to_string()),
        "the other device's new tag and its article link should be applied: {pairs:?}"
    );
    assert!(
        !tags.contains(&"rust".to_string()) && !pairs.contains(&"article-x:rust".to_string()),
        "a local tag deletion that was never exported must not be undone: tags={tags:?} links={pairs:?}"
    );
}

#[test]
fn import_keeps_unexported_local_article_tag_removal_and_applies_remote_tag() {
    let importer = import_after_divergent_edits(
        REMOTE_TAG_SQL,
        "DELETE FROM article_tags WHERE article_id = 'article-y' AND tag_id = 'tag-swift'",
    );

    let pairs = article_tag_pairs(&importer);
    assert!(
        pairs.contains(&"article-y:remote-new".to_string()),
        "the other device's new article link should be applied: {pairs:?}"
    );
    assert!(
        !pairs.contains(&"article-y:swift".to_string()),
        "a local article-tag removal that was never exported must not be undone: {pairs:?}"
    );
}

const REMOTE_MUTE_SQL: &str =
    "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at)
     VALUES ('mute-remote', 'remote-kw', 'title', '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z')";

#[test]
fn import_keeps_unexported_local_mute_keyword_addition_and_applies_remote_one() {
    let importer = import_after_divergent_edits(
        REMOTE_MUTE_SQL,
        "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at)
         VALUES ('mute-local', 'local-kw', 'title', '2026-01-03T00:00:00Z', '2026-01-03T00:00:00Z')",
    );

    let keywords = mute_keywords(&importer);
    assert!(
        keywords.contains(&"remote-kw".to_string()),
        "the other device's new mute keyword should be applied: {keywords:?}"
    );
    assert!(
        keywords.contains(&"local-kw".to_string()),
        "a local mute keyword that was never exported must survive the import: {keywords:?}"
    );
}

#[test]
fn import_keeps_unexported_local_mute_keyword_deletion_and_applies_remote_one() {
    let importer = import_after_divergent_edits(
        REMOTE_MUTE_SQL,
        "DELETE FROM mute_keywords WHERE id = 'mute-spam'",
    );

    let keywords = mute_keywords(&importer);
    assert!(
        keywords.contains(&"remote-kw".to_string()),
        "the other device's new mute keyword should be applied: {keywords:?}"
    );
    assert!(
        !keywords.contains(&"spam".to_string()),
        "a local mute keyword deletion that was never exported must not be undone: {keywords:?}"
    );
}

#[test]
fn import_keeps_unexported_local_tag_rename_and_applies_remote_tag() {
    let importer = import_after_divergent_edits(
        REMOTE_TAG_SQL,
        "UPDATE tags SET name = 'rustlang' WHERE id = 'tag-rust'",
    );

    let tags = query_strings(&importer, "SELECT name FROM tags ORDER BY name");
    assert!(
        tags.contains(&"remote-new".to_string()),
        "the other device's new tag should be applied: {tags:?}"
    );
    assert!(
        tags.contains(&"rustlang".to_string()) && !tags.contains(&"rust".to_string()),
        "a local tag rename that was never exported must not be undone by re-creating the old name: {tags:?}"
    );
}

#[test]
fn import_keeps_unexported_local_mute_keyword_scope_change_and_applies_remote_one() {
    let importer = import_after_divergent_edits(
        REMOTE_MUTE_SQL,
        "UPDATE mute_keywords SET scope = 'body', updated_at = '2026-01-04T00:00:00Z'
         WHERE id = 'mute-spam'",
    );

    let keywords = mute_keywords(&importer);
    let spam_scopes = query_strings(
        &importer,
        "SELECT scope FROM mute_keywords WHERE keyword = 'spam' ORDER BY scope",
    );
    assert!(
        keywords.contains(&"remote-kw".to_string()),
        "the other device's new mute keyword should be applied: {keywords:?}"
    );
    assert_eq!(
        spam_scopes,
        ["body"],
        "a local scope change that was never exported must not re-create the old scope"
    );
}

#[test]
fn import_keeps_unexported_local_new_feed_over_an_older_remote_snapshot() {
    let importer = import_after_divergent_edits(
        "UPDATE feeds SET title = 'Remote title' WHERE id = 'feed-2'",
        "DELETE FROM feeds WHERE id = 'feed-2';
         INSERT INTO feeds (id, account_id, folder_id, title, url, site_url, reader_mode, web_preview_mode)
         VALUES ('feed-2b', 'account-1', 'folder-tech', 'Local title', 'https://example.com/feed2.xml', 'https://example.com', 'inherit', 'inherit')",
    );

    let titles = query_strings(
        &importer,
        "SELECT title FROM feeds WHERE url = 'https://example.com/feed2.xml'",
    );
    assert_eq!(
        titles,
        ["Local title"],
        "a feed subscribed locally and never exported must not be overwritten by an older snapshot"
    );
    assert_eq!(
        feed_folder_name(&importer, "feed-2b").as_deref(),
        Some("Tech")
    );
}

#[test]
fn import_keeps_unexported_local_feed_unsubscribe_and_applies_remote_feed() {
    let importer = import_after_divergent_edits(
        "INSERT INTO feeds (id, account_id, folder_id, title, url, site_url, reader_mode, web_preview_mode)
         VALUES ('feed-3', 'account-1', NULL, 'Feed 3', 'https://example.com/feed3.xml', 'https://example.com', 'inherit', 'inherit')",
        "DELETE FROM feeds WHERE id = 'feed-2'",
    );

    let urls = query_strings(&importer, "SELECT url FROM feeds ORDER BY url");
    assert!(
        urls.contains(&"https://example.com/feed3.xml".to_string()),
        "the other device's new feed should be applied: {urls:?}"
    );
    assert!(
        !urls.contains(&"https://example.com/feed2.xml".to_string()),
        "a local unsubscribe that was never exported must not be undone: {urls:?}"
    );
}

const REMOTE_FEED_4_SQL: &str =
    "INSERT INTO feeds (id, account_id, folder_id, title, url, site_url, reader_mode, web_preview_mode)
     VALUES ('feed-4', 'account-1', NULL, 'Remote Feed 4', 'https://example.com/feed4.xml', 'https://example.com', 'inherit', 'inherit')";

#[test]
fn import_keeps_unexported_local_unsubscribe_of_a_feed_stored_with_a_fragment() {
    let importer = import_after_divergent_edits(
        REMOTE_FEED_4_SQL,
        "INSERT INTO feeds (id, account_id, folder_id, title, url, site_url, reader_mode, web_preview_mode)
         VALUES ('feed-4', 'account-1', NULL, 'Feed 4', 'https://example.com/feed4.xml#section', 'https://example.com', 'inherit', 'inherit');
         DELETE FROM feeds WHERE id = 'feed-4'",
    );

    let urls = query_strings(&importer, "SELECT url FROM feeds ORDER BY url");
    assert!(
        !urls.iter().any(|url| url.starts_with("https://example.com/feed4.xml")),
        "the sync identity drops the fragment, so the unexported unsubscribe must still hold: {urls:?}"
    );
}

#[test]
fn import_updates_a_local_feed_stored_with_a_fragment_instead_of_duplicating_it() {
    let importer = import_after_divergent_edits(
        REMOTE_FEED_4_SQL,
        "INSERT INTO feeds (id, account_id, folder_id, title, url, site_url, reader_mode, web_preview_mode, changed_at)
         VALUES ('feed-4', 'account-1', NULL, 'Feed 4', 'https://example.com/feed4.xml#section', 'https://example.com', 'inherit', 'inherit', '1970-01-01T00:00:00.000Z')",
    );

    let rows = query_strings(
        &importer,
        "SELECT url || ' ' || title FROM feeds WHERE url LIKE 'https://example.com/feed4.xml%'",
    );
    assert_eq!(
        rows,
        vec!["https://example.com/feed4.xml#section Remote Feed 4".to_string()],
        "the feed with the same sync identity must be updated in place, not inserted again"
    );
}

#[test]
fn import_keeps_unexported_local_feed_url_change() {
    let importer = import_after_divergent_edits(
        "UPDATE feeds SET title = 'Remote title' WHERE id = 'feed-2'",
        "UPDATE feeds SET url = 'https://example.com/feed2-moved.xml' WHERE id = 'feed-2'",
    );

    let urls = query_strings(&importer, "SELECT url FROM feeds ORDER BY url");
    assert!(
        urls.contains(&"https://example.com/feed2-moved.xml".to_string())
            && !urls.contains(&"https://example.com/feed2.xml".to_string()),
        "a local URL change that was never exported must not be undone by re-creating the old URL: {urls:?}"
    );
}

#[test]
fn import_keeps_article_tag_removal_made_before_the_tag_was_renamed() {
    let importer = import_after_divergent_edits(
        "UPDATE tags SET name = 'rustlang' WHERE id = 'tag-rust'",
        "DELETE FROM article_tags WHERE article_id = 'article-x' AND tag_id = 'tag-rust';
         UPDATE tags SET name = 'rustlang' WHERE id = 'tag-rust'",
    );

    let pairs = article_tag_pairs(&importer);
    assert!(
        !pairs.contains(&"article-x:rustlang".to_string()),
        "a removal made under the old tag name must still hold under the renamed tag: {pairs:?}"
    );
}

#[test]
fn import_shows_a_remote_link_added_between_the_removal_and_the_tag_rename() {
    let importer = import_after_divergent_edits(
        "UPDATE tags SET name = 'rustlang' WHERE id = 'tag-rust';
         UPDATE article_tags SET changed_at = '2025-01-01T00:00:00.000Z'
         WHERE article_id = 'article-x' AND tag_id = 'tag-rust'",
        "DELETE FROM article_tags WHERE article_id = 'article-x' AND tag_id = 'tag-rust';
         UPDATE local_sync_tombstones SET removed_at = '2020-01-01T00:00:00.000Z';
         UPDATE tags SET name = 'rustlang' WHERE id = 'tag-rust'",
    );

    let pairs = article_tag_pairs(&importer);
    assert!(
        pairs.contains(&"article-x:rustlang".to_string()),
        "known gap: the tombstone keeps its original time under the new name, so a remote link added after the removal is shown: {pairs:?}"
    );
}

#[test]
fn import_applies_a_remote_link_when_a_recreated_tag_is_renamed_to_the_remote_name() {
    let importer = import_after_divergent_edits(
        "INSERT INTO tags (id, name) VALUES ('tag-b', 'b');
         INSERT INTO article_tags (article_id, tag_id, changed_at)
         VALUES ('article-x', 'tag-b', '2025-01-01T00:00:00.000Z')",
        "DELETE FROM tags WHERE id = 'tag-rust';
         INSERT INTO tags (id, name) VALUES ('tag-rust-2', 'rust');
         UPDATE local_sync_tombstones SET removed_at = '2020-01-01T00:00:00.000Z';
         UPDATE tags SET name = 'b' WHERE id = 'tag-rust-2'",
    );

    let pairs = article_tag_pairs(&importer);
    assert!(
        pairs.contains(&"article-x:b".to_string()),
        "the old generation's removal must not suppress an independent remote link: {pairs:?}"
    );
}

#[test]
fn import_does_not_restore_links_of_a_tag_deleted_and_created_again() {
    let importer = import_after_divergent_edits(
        REMOTE_TAG_SQL,
        "DELETE FROM tags WHERE id = 'tag-rust';
         INSERT INTO tags (id, name) VALUES ('tag-rust-again', 'rust')",
    );

    let pairs = article_tag_pairs(&importer);
    assert!(
        !pairs.contains(&"article-x:rust".to_string()),
        "deleting a tag removes its links, and creating the same name again must not bring them back: {pairs:?}"
    );
}

#[test]
fn import_keeps_the_folder_of_a_feed_when_the_folder_was_renamed_after_the_remote_move() {
    let importer = import_after_divergent_edits(
        "UPDATE feeds SET folder_id = NULL WHERE id = 'feed-2'",
        "UPDATE folders SET name = 'Headlines' WHERE id = 'folder-news'",
    );

    assert_eq!(
        feed_folder_name(&importer, "feed-2").as_deref(),
        Some("Headlines"),
        "renaming a folder changes the folder name its feeds export, so it must outrank an older remote move"
    );
}

#[test]
fn import_keeps_article_read_state_when_the_feed_url_changed_after_the_remote_change() {
    let importer = import_after_divergent_edits(
        "UPDATE feeds SET url = 'https://example.com/feed-new.xml' WHERE id = 'feed-1';
         UPDATE articles SET is_read = 1 WHERE id = 'article-x'",
        "UPDATE articles SET read_changed_at = '2020-01-01T00:00:00.000Z' WHERE id = 'article-x';
         UPDATE feeds SET url = 'https://example.com/feed-new.xml' WHERE id = 'feed-1'",
    );

    assert!(
        !article_flag(&importer, "article-x", "is_read"),
        "a URL change changes every article sync key, so the local state kept under the new URL must outrank an older remote change"
    );
}

/// A file removing the `rust` tag at `ts(10)` is imported into a device whose tag and link
/// times were pinned by `local_times_sql`.
fn import_rust_tag_removal(local_times_sql: &str) -> (DbManager, LocalAccountSyncImportReport) {
    let account_id = AccountId("account-1".to_string());
    let importer = DbManager::new_in_memory().unwrap();
    seed_entity_fixture(&importer, &account_id);
    importer.writer().execute_batch(local_times_sql).unwrap();
    let dir = tempfile::tempdir().unwrap();
    let removal = operation_with(
        "sync-account-a",
        "remove-rust",
        LocalSyncEntityKey::Tag {
            normalized_name: "rust".to_string(),
        },
        LocalSyncAction::RemoveTag,
    );
    write_local_sync_operation_file(dir.path(), &removal, 1).unwrap();
    let report = import_local_account_sync_folder(
        &importer,
        &account_id,
        &LocalSyncAccountId("sync-account-a".to_string()),
        dir.path(),
    )
    .unwrap();
    (importer, report)
}

#[test]
fn import_removes_a_tag_and_its_article_links_when_the_removal_is_newer_than_local_changes() {
    let (importer, report) = import_rust_tag_removal(
        "UPDATE tags SET changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 5, 'unixepoch') WHERE id = 'tag-rust';
         UPDATE article_tags SET changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 5, 'unixepoch')
         WHERE tag_id = 'tag-rust'",
    );

    let tags = query_strings(&importer, "SELECT name FROM tags ORDER BY name");
    assert_eq!(tags, ["swift"], "only the removed tag should be deleted");
    assert_eq!(article_tag_pairs(&importer), ["article-y:swift"]);
    assert_eq!(report.apply_report.tags_removed, 1);
    assert_eq!(report.apply_report.skipped_removed_tags, 0);
}

#[test]
fn import_keeps_a_tag_changed_locally_after_the_removal() {
    let (importer, report) = import_rust_tag_removal(
        "UPDATE tags SET changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 20, 'unixepoch') WHERE id = 'tag-rust';
         UPDATE article_tags SET changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 5, 'unixepoch')
         WHERE tag_id = 'tag-rust'",
    );

    let tags = query_strings(&importer, "SELECT name FROM tags ORDER BY name");
    assert_eq!(tags, ["rust", "swift"]);
    assert_eq!(
        article_tag_pairs(&importer),
        ["article-x:rust", "article-y:swift"]
    );
    assert_eq!(report.apply_report.tags_removed, 0);
    assert_eq!(report.apply_report.skipped_removed_tags, 1);
}

#[test]
fn import_keeps_a_tag_and_its_link_when_an_article_was_tagged_locally_after_the_removal() {
    let (importer, report) = import_rust_tag_removal(
        "UPDATE tags SET changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 5, 'unixepoch') WHERE id = 'tag-rust';
         UPDATE article_tags SET changed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 20, 'unixepoch')
         WHERE tag_id = 'tag-rust'",
    );

    let tags = query_strings(&importer, "SELECT name FROM tags ORDER BY name");
    assert_eq!(tags, ["rust", "swift"]);
    assert_eq!(
        article_tag_pairs(&importer),
        ["article-x:rust", "article-y:swift"]
    );
    assert_eq!(report.apply_report.tags_removed, 0);
    assert_eq!(report.apply_report.skipped_removed_tags, 1);
}
