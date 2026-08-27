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
    import_local_account_sync_folder, save_current_state_export_digest,
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

    let report = export_local_account_sync_folder(
        &db,
        &account_id,
        &LocalSyncAccountId("sync-account-a".to_string()),
        &LocalSyncDeviceId("device-a".to_string()),
        dir.path(),
    )
    .unwrap();

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

    let second_report = export_local_account_sync_folder(
        &db,
        &account_id,
        &LocalSyncAccountId("sync-account-a".to_string()),
        &LocalSyncDeviceId("device-a".to_string()),
        dir.path(),
    )
    .unwrap();
    let second_load_report =
        crate::infra::local_account_sync_files::load_local_sync_operation_dir(dir.path()).unwrap();

    assert_eq!(second_report.operations_written, 7);
    assert_eq!(second_load_report.operations.len(), 14);
}

#[test]
fn compute_digest_is_stable_across_differing_operation_ids_and_timestamps() {
    let operation_a = operation("op-1");
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

/// Pins current behavior for a manual export with zero operations
/// (empty account, no folders/feeds/articles/tags/mute keywords): the
/// export still succeeds and writes zero operation files. This is
/// existing zero-operations semantics and is not changed by the
/// digest-save fix below.
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

    let report = export_local_account_sync_folder(
        &db,
        &account_id,
        &LocalSyncAccountId("sync-account-a".to_string()),
        &LocalSyncDeviceId("device-a".to_string()),
        dir.path(),
    )
    .unwrap();

    assert_eq!(report.operations_written, 0);
    let load_report =
        crate::infra::local_account_sync_files::load_local_sync_operation_dir(dir.path()).unwrap();
    assert_eq!(load_report.operations.len(), 0);
}

/// After a manual export, `save_current_state_export_digest` (called by
/// the manual export command right after a successful export) persists
/// a digest matching the current state, so the following auto-export
/// (`export_local_account_sync_folder_if_changed`) sees the state as
/// unchanged and skips rewriting the full snapshot.
#[test]
fn manual_export_followed_by_digest_save_makes_next_auto_export_a_no_op() {
    let db = DbManager::new_in_memory().unwrap();
    let account_id = AccountId("account-1".to_string());
    seed_export_fixture(&db, &account_id);
    let dir = tempfile::tempdir().unwrap();

    let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db.writer());
    let settings = seeded_settings(&dir.path().to_string_lossy(), &account_id);
    settings_repo.save(&settings).unwrap();

    // Mirrors the manual export command: write the full snapshot, then
    // save the digest for the state that was just written.
    let manual_report = export_local_account_sync_folder(
        &db,
        &account_id,
        &settings.sync_account_id,
        &settings.device_id,
        dir.path(),
    )
    .unwrap();
    assert_eq!(manual_report.operations_written, 4);
    save_current_state_export_digest(&db, &account_id, &settings).unwrap();

    let settings_after_manual_export = settings_repo
        .find_by_account_id(&account_id)
        .unwrap()
        .expect("settings should exist after manual export");
    assert!(settings_after_manual_export.last_export_digest.is_some());

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
