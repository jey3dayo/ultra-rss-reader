use super::*;

#[tokio::test]
async fn account_parallel_sync_reports_local_feed_warnings_in_requested_account_order() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let syncing = AtomicBool::new(false);
    let first_account = test_sync_command_account("first-account", ProviderKind::Local, true);
    let second_account = test_sync_command_account("second-account", ProviderKind::Local, true);

    {
        let db_guard = db.lock().unwrap();
        for account in [&first_account, &second_account] {
            db_guard
                    .writer()
                    .execute(
                        "INSERT INTO accounts (id, kind, name, sync_interval_secs, sync_on_startup, sync_on_wake, keep_read_items_days) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        rusqlite::params![
                            account.id.as_ref(),
                            "Local",
                            account.name,
                            account.sync_interval_secs,
                            account.sync_on_startup,
                            account.sync_on_wake,
                            account.keep_read_items_days,
                        ],
                    )
                    .unwrap();
        }
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        feed_repo
            .save(&Feed {
                id: FeedId::new(),
                account_id: first_account.id.clone(),
                folder_id: None,
                remote_id: None,
                title: "First invalid feed".to_string(),
                url: "not-a-url".to_string(),
                site_url: "https://example.com".to_string(),
                icon: None,
                icon_url: None,
                unread_count: 0,
                reader_mode: "inherit".to_string(),
                web_preview_mode: "inherit".to_string(),
            })
            .unwrap();
        feed_repo
            .save(&Feed {
                id: FeedId::new(),
                account_id: second_account.id.clone(),
                folder_id: None,
                remote_id: None,
                title: "Second invalid feed".to_string(),
                url: "not-a-url".to_string(),
                site_url: "https://example.com".to_string(),
                icon: None,
                icon_url: None,
                unread_count: 0,
                reader_mode: "inherit".to_string(),
                web_preview_mode: "inherit".to_string(),
            })
            .unwrap();
    }

    let result = run_sync_for_accounts_with_progress(
        &db,
        &syncing,
        vec![second_account, first_account],
        None,
    )
    .await
    .unwrap();

    assert!(result.failed.is_empty());
    assert_eq!(result.succeeded, 2);
    assert_eq!(
        result
            .warnings
            .iter()
            .map(|warning| warning.account_id.as_str())
            .collect::<Vec<_>>(),
        vec!["second-account", "first-account"]
    );
    assert!(result
        .warnings
        .iter()
        .all(|warning| warning.message.contains("Local feed")));
}

#[tokio::test]
async fn local_account_sync_continues_after_one_feed_fails() {
    let mut server = Server::new_async().await;
    let good_feed_url = format!("{}/good.xml", server.url());
    let good_mock = server
        .mock("GET", "/good.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_body(
            r#"<?xml version="1.0" encoding="UTF-8"?>
                <rss version="2.0">
                  <channel>
                    <title>Good Feed</title>
                    <item>
                      <guid>good-1</guid>
                      <title>Good Article</title>
                      <link>https://example.com/good</link>
                    </item>
                  </channel>
                </rss>"#,
        )
        .create_async()
        .await;
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account = test_sync_command_account("local-account", ProviderKind::Local, true);
    let bad_feed = Feed {
        id: FeedId::new(),
        account_id: account.id.clone(),
        folder_id: None,
        remote_id: None,
        title: "Bad Feed".to_string(),
        url: "not-a-url".to_string(),
        site_url: "https://example.com".to_string(),
        icon: None,
        icon_url: None,
        unread_count: 0,
        reader_mode: "inherit".to_string(),
        web_preview_mode: "inherit".to_string(),
    };
    let good_feed = Feed {
        id: FeedId::new(),
        account_id: account.id.clone(),
        folder_id: None,
        remote_id: None,
        title: "Good Feed".to_string(),
        url: good_feed_url,
        site_url: "https://example.com".to_string(),
        icon: None,
        icon_url: None,
        unread_count: 0,
        reader_mode: "inherit".to_string(),
        web_preview_mode: "inherit".to_string(),
    };

    {
        let db_guard = db.lock().unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO accounts (id, kind, name, sync_interval_secs, sync_on_startup, sync_on_wake, keep_read_items_days) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    rusqlite::params![
                        account.id.as_ref(),
                        "Local",
                        account.name,
                        account.sync_interval_secs,
                        account.sync_on_startup,
                        account.sync_on_wake,
                        account.keep_read_items_days,
                    ],
                )
                .unwrap();
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        feed_repo.save(&bad_feed).unwrap();
        feed_repo.save(&good_feed).unwrap();
    }

    let outcome = sync_account(&db, &account).await.unwrap();

    good_mock.assert_async().await;
    assert_eq!(outcome.warnings.len(), 1);
    assert!(outcome.warnings[0].message.contains("Bad Feed"));
    let saved_article_count: i64 = db
        .lock()
        .unwrap()
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE feed_id = ?1",
            rusqlite::params![good_feed.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(saved_article_count, 1);
}

fn insert_local_account_row(db: &Mutex<DbManager>, account: &Account) {
    let db_guard = db.lock().unwrap();
    db_guard
            .writer()
            .execute(
                "INSERT INTO accounts (id, kind, name, sync_interval_secs, sync_on_startup, sync_on_wake, keep_read_items_days) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![
                    account.id.as_ref(),
                    "Local",
                    account.name,
                    account.sync_interval_secs,
                    account.sync_on_startup,
                    account.sync_on_wake,
                    account.keep_read_items_days,
                ],
            )
            .unwrap();
}

fn save_local_sync_settings(
    db: &Mutex<DbManager>,
    account_id: &AccountId,
    sync_folder_path: &str,
    enabled: bool,
) -> crate::repository::local_account_sync_settings::LocalAccountSyncSettings {
    use crate::domain::local_account_sync::{LocalSyncAccountId, LocalSyncDeviceId};
    use crate::repository::local_account_sync_settings::LocalAccountSyncSettings;

    let settings = LocalAccountSyncSettings {
        account_id: account_id.clone(),
        sync_folder_path: sync_folder_path.to_string(),
        sync_account_id: LocalSyncAccountId("sync-account-a".to_string()),
        device_id: LocalSyncDeviceId("this-device".to_string()),
        enabled,
        last_export_digest: None,
    };
    let db_guard = db.lock().unwrap();
    let settings_repo = SqliteLocalAccountSyncSettingsRepository::new(db_guard.writer());
    settings_repo.save(&settings).unwrap();
    settings
}

#[tokio::test]
async fn local_sync_account_imports_folder_op_from_another_device_and_exports_after_sync() {
    use crate::domain::local_account_sync::{
        normalize_tag_name, LocalAccountSyncOperation, LocalSyncAccountId, LocalSyncAction,
        LocalSyncDeviceId, LocalSyncEntityKey, LocalSyncOperationId,
    };
    use crate::infra::local_account_sync_files::{
        load_local_sync_operation_dir, write_local_sync_operation_file,
    };

    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account = test_sync_command_account("local-import-export", ProviderKind::Local, false);
    insert_local_account_row(&db, &account);

    let dir = tempfile::tempdir().unwrap();
    let other_device_op = LocalAccountSyncOperation {
        sync_account_id: LocalSyncAccountId("sync-account-a".to_string()),
        device_id: LocalSyncDeviceId("other-device".to_string()),
        operation_id: LocalSyncOperationId::new(),
        occurred_at: chrono::Utc::now(),
        entity_key: LocalSyncEntityKey::Folder {
            normalized_name: normalize_tag_name("Tech").unwrap(),
        },
        action: LocalSyncAction::UpsertFolder {
            display_name: "Tech".to_string(),
            sort_order: 1,
        },
    };
    write_local_sync_operation_file(dir.path(), &other_device_op, 1).unwrap();
    save_local_sync_settings(&db, &account.id, &dir.path().to_string_lossy(), true);

    let outcome = sync_account(&db, &account).await.unwrap();

    assert!(
        outcome.warnings.is_empty(),
        "unexpected warnings: {:?}",
        outcome.warnings
    );

    let folder_count: i64 = db
        .lock()
        .unwrap()
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM folders WHERE account_id = ?1 AND name = 'Tech'",
            rusqlite::params![account.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        folder_count, 1,
        "folder op written by another device should be imported"
    );

    let load_report = load_local_sync_operation_dir(dir.path()).unwrap();
    assert!(
        load_report
            .operations
            .iter()
            .any(|operation| operation.device_id == LocalSyncDeviceId("this-device".to_string())),
        "export should have written operation files for this device after sync"
    );
}

#[tokio::test]
async fn local_sync_account_with_missing_settings_leaves_sync_folder_untouched() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account = test_sync_command_account("local-no-settings", ProviderKind::Local, false);
    insert_local_account_row(&db, &account);

    let outcome = sync_account(&db, &account).await.unwrap();

    assert!(outcome.warnings.is_empty());
}

#[tokio::test]
async fn local_sync_account_with_disabled_settings_leaves_sync_folder_untouched() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account = test_sync_command_account("local-disabled", ProviderKind::Local, false);
    insert_local_account_row(&db, &account);
    let dir = tempfile::tempdir().unwrap();
    save_local_sync_settings(&db, &account.id, &dir.path().to_string_lossy(), false);

    let outcome = sync_account(&db, &account).await.unwrap();

    assert!(outcome.warnings.is_empty());
    assert!(
        !dir.path().join("ops").exists(),
        "disabled sync folder should not be touched"
    );
}

#[tokio::test]
async fn local_sync_account_returns_warning_when_sync_folder_path_is_unreachable() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account = test_sync_command_account("local-unreachable", ProviderKind::Local, false);
    insert_local_account_row(&db, &account);
    {
        let db_guard = db.lock().unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO folders (id, account_id, name, sort_order) VALUES ('folder-1', ?1, 'Tech', 1)",
                    rusqlite::params![account.id.as_ref()],
                )
                .unwrap();
    }

    let dir = tempfile::tempdir().unwrap();
    let blocking_file = dir.path().join("blocker");
    std::fs::write(&blocking_file, b"not a directory").unwrap();
    let unreachable_folder = blocking_file.join("account-root");
    save_local_sync_settings(
        &db,
        &account.id,
        &unreachable_folder.to_string_lossy(),
        true,
    );

    let outcome = sync_account(&db, &account).await.unwrap();

    assert!(
        outcome
            .warnings
            .iter()
            .any(|warning| warning.message.contains("Local sync folder export failed")),
        "unexpected warnings: {:?}",
        outcome.warnings
    );
    assert!(
        outcome.warnings.iter().any(|warning| matches!(
            &warning.detail,
            AccountSyncWarningDetail::LocalAccountSyncOperationFailed { operation, .. }
                if operation == "export"
        )),
        "unexpected warnings: {:?}",
        outcome.warnings
    );
}

/// Pins current behavior for the auto-import error branch: when reading
/// the local sync folder fails, `run_local_account_auto_import` surfaces
/// a warning instead of aborting the sync. The account's feed pull and
/// auto-export still run afterward.
///
/// The failure is induced in a platform-independent way: the configured
/// sync folder path points at a plain file instead of a directory, so
/// `load_local_sync_operation_dir` calls `fs::read_dir` on a non-directory
/// and fails with the same I/O error class (`NotADirectory` / equivalent)
/// on every OS, without relying on Unix permission bits.
#[tokio::test]
async fn local_sync_account_returns_warning_when_auto_import_read_fails() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account = test_sync_command_account("local-import-error", ProviderKind::Local, false);
    insert_local_account_row(&db, &account);

    let dir = tempfile::tempdir().unwrap();
    let sync_folder_path = dir.path().join("sync-root-is-actually-a-file");
    std::fs::write(&sync_folder_path, b"not a directory").unwrap();

    save_local_sync_settings(&db, &account.id, &sync_folder_path.to_string_lossy(), true);

    let outcome = sync_account(&db, &account).await.unwrap();

    assert!(
        outcome
            .warnings
            .iter()
            .any(|warning| warning.message.contains("Local sync folder import failed")),
        "unexpected warnings: {:?}",
        outcome.warnings
    );
    assert!(
        outcome.warnings.iter().any(|warning| matches!(
            &warning.detail,
            AccountSyncWarningDetail::LocalAccountSyncOperationFailed { operation, .. }
                if operation == "import"
        )),
        "unexpected warnings: {:?}",
        outcome.warnings
    );
}

/// Verifies that the auto-import rejected-only branch reports a warning:
/// when merge-level operation validation rejects one operation (mismatched
/// entity key/action), the merge still applies the remaining valid
/// operations and `run_local_account_auto_import` surfaces the rejected
/// operation count.
#[tokio::test]
async fn local_sync_account_returns_warning_for_merge_rejected_operations() {
    use crate::domain::local_account_sync::{
        normalize_tag_name, LocalAccountSyncOperation, LocalSyncAccountId, LocalSyncAction,
        LocalSyncDeviceId, LocalSyncEntityKey, LocalSyncOperationId,
    };
    use crate::infra::local_account_sync_files::write_local_sync_operation_file;

    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account = test_sync_command_account("local-import-rejected", ProviderKind::Local, false);
    insert_local_account_row(&db, &account);

    let dir = tempfile::tempdir().unwrap();

    let valid_op = LocalAccountSyncOperation {
        sync_account_id: LocalSyncAccountId("sync-account-a".to_string()),
        device_id: LocalSyncDeviceId("other-device".to_string()),
        operation_id: LocalSyncOperationId::new(),
        occurred_at: chrono::Utc::now(),
        entity_key: LocalSyncEntityKey::Folder {
            normalized_name: normalize_tag_name("Tech").unwrap(),
        },
        action: LocalSyncAction::UpsertFolder {
            display_name: "Tech".to_string(),
            sort_order: 1,
        },
    };
    // Mismatched entity key/action: `apply_operation` rejects this at the
    // merge layer (`Local sync operation action does not match entity
    // key`), which is a merge-level rejection, not a rejected *file*.
    let mismatched_op = LocalAccountSyncOperation {
        sync_account_id: LocalSyncAccountId("sync-account-a".to_string()),
        device_id: LocalSyncDeviceId("other-device".to_string()),
        operation_id: LocalSyncOperationId::new(),
        occurred_at: chrono::Utc::now(),
        entity_key: LocalSyncEntityKey::Folder {
            normalized_name: normalize_tag_name("Tech").unwrap(),
        },
        action: LocalSyncAction::SetRead { is_read: true },
    };
    write_local_sync_operation_file(dir.path(), &valid_op, 1).unwrap();
    write_local_sync_operation_file(dir.path(), &mismatched_op, 2).unwrap();

    save_local_sync_settings(&db, &account.id, &dir.path().to_string_lossy(), true);

    let outcome = sync_account(&db, &account).await.unwrap();

    assert_eq!(outcome.warnings.len(), 1);
    assert!(outcome.warnings[0]
        .message
        .contains("1 rejected operation(s)"));
    assert_eq!(
        outcome.warnings[0].detail,
        AccountSyncWarningDetail::LocalImportResult {
            conflicted: 0,
            rejected_files: 0,
            rejected_operations: 1,
        }
    );

    let folder_count: i64 = db
        .lock()
        .unwrap()
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM folders WHERE account_id = ?1 AND name = 'Tech'",
            rusqlite::params![account.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        folder_count, 1,
        "the valid operation should still be applied despite the rejected sibling"
    );
}

#[tokio::test]
async fn local_sync_account_returns_warning_and_skips_projection_when_conflicted_copy_present() {
    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account = test_sync_command_account("local-conflicted", ProviderKind::Local, false);
    insert_local_account_row(&db, &account);

    let dir = tempfile::tempdir().unwrap();
    let op_dir = dir.path().join("ops").join("other-device");
    std::fs::create_dir_all(&op_dir).unwrap();
    std::fs::write(op_dir.join("00000001 (conflicted copy).json"), "{not-json").unwrap();
    std::fs::write(
        op_dir.join("00000002.json"),
        serde_json::to_string(&crate::domain::local_account_sync::operation_file(
            crate::domain::local_account_sync::LocalAccountSyncOperation {
                sync_account_id: crate::domain::local_account_sync::LocalSyncAccountId(
                    "sync-account-a".to_string(),
                ),
                device_id: crate::domain::local_account_sync::LocalSyncDeviceId(
                    "other-device".to_string(),
                ),
                operation_id: crate::domain::local_account_sync::LocalSyncOperationId::new(),
                occurred_at: chrono::Utc::now(),
                entity_key: crate::domain::local_account_sync::LocalSyncEntityKey::Folder {
                    normalized_name: crate::domain::local_account_sync::normalize_tag_name("Tech")
                        .unwrap(),
                },
                action: crate::domain::local_account_sync::LocalSyncAction::UpsertFolder {
                    display_name: "Tech".to_string(),
                    sort_order: 1,
                },
            },
        ))
        .unwrap(),
    )
    .unwrap();
    save_local_sync_settings(&db, &account.id, &dir.path().to_string_lossy(), true);

    let outcome = sync_account(&db, &account).await.unwrap();

    assert!(
        outcome
            .warnings
            .iter()
            .any(|warning| warning.message.contains("conflicted")),
        "unexpected warnings: {:?}",
        outcome.warnings
    );

    let folder_count: i64 = db
        .lock()
        .unwrap()
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM folders WHERE account_id = ?1 AND name = 'Tech'",
            rusqlite::params![account.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        folder_count, 0,
        "projection should not be applied while a conflicted copy is present"
    );
}

#[tokio::test]
async fn trigger_startup_sync_import_supplement_covers_excluded_local_accounts_only() {
    use crate::domain::local_account_sync::{
        normalize_tag_name, LocalAccountSyncOperation, LocalSyncAccountId, LocalSyncAction,
        LocalSyncDeviceId, LocalSyncEntityKey, LocalSyncOperationId,
    };
    use crate::infra::local_account_sync_files::write_local_sync_operation_file;

    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let startup_account = test_sync_command_account("startup-local", ProviderKind::Local, true);
    let excluded_account = test_sync_command_account("excluded-local", ProviderKind::Local, false);
    insert_local_account_row(&db, &startup_account);
    insert_local_account_row(&db, &excluded_account);

    let excluded_dir = tempfile::tempdir().unwrap();
    let other_device_op = LocalAccountSyncOperation {
        sync_account_id: LocalSyncAccountId("sync-account-a".to_string()),
        device_id: LocalSyncDeviceId("other-device".to_string()),
        operation_id: LocalSyncOperationId::new(),
        occurred_at: chrono::Utc::now(),
        entity_key: LocalSyncEntityKey::Folder {
            normalized_name: normalize_tag_name("Tech").unwrap(),
        },
        action: LocalSyncAction::UpsertFolder {
            display_name: "Tech".to_string(),
            sort_order: 1,
        },
    };
    write_local_sync_operation_file(excluded_dir.path(), &other_device_op, 1).unwrap();
    save_local_sync_settings(
        &db,
        &excluded_account.id,
        &excluded_dir.path().to_string_lossy(),
        true,
    );

    let warnings = run_local_account_startup_import_supplement(
        &db,
        &[startup_account.clone(), excluded_account.clone()],
        &[startup_account],
    );

    assert!(
        warnings.is_empty(),
        "clean import should not produce warnings: {warnings:?}"
    );

    let folder_count: i64 = db
        .lock()
        .unwrap()
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM folders WHERE account_id = ?1 AND name = 'Tech'",
            rusqlite::params![excluded_account.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        folder_count, 1,
        "excluded local account should still be imported as a startup supplement"
    );
}

#[tokio::test]
async fn sync_feed_only_updates_the_selected_local_feed() {
    let mut server = Server::new_async().await;
    let selected_feed_url = format!("{}/selected.xml", server.url());
    let other_feed_url = format!("{}/other.xml", server.url());
    let selected_mock = server
        .mock("GET", "/selected.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_body(
            r#"<?xml version="1.0" encoding="UTF-8"?>
                <rss version="2.0">
                  <channel>
                    <title>Selected Feed</title>
                    <item>
                      <guid>selected-1</guid>
                      <title>Selected Article</title>
                      <link>https://example.com/selected</link>
                    </item>
                  </channel>
                </rss>"#,
        )
        .create_async()
        .await;

    let db = Mutex::new(DbManager::new_in_memory().unwrap());
    let account = Account {
        id: AccountId::new(),
        kind: ProviderKind::Local,
        name: "Local".to_string(),
        server_url: None,
        username: None,
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    };
    let selected_feed = Feed {
        id: FeedId::new(),
        account_id: account.id.clone(),
        folder_id: None,
        remote_id: None,
        title: "Selected".to_string(),
        url: selected_feed_url,
        site_url: "https://example.com".to_string(),
        icon: None,
        icon_url: None,
        unread_count: 0,
        reader_mode: "inherit".to_string(),
        web_preview_mode: "inherit".to_string(),
    };
    let other_feed = Feed {
        id: FeedId::new(),
        account_id: account.id.clone(),
        folder_id: None,
        remote_id: None,
        title: "Other".to_string(),
        url: other_feed_url,
        site_url: "https://example.com".to_string(),
        icon: None,
        icon_url: None,
        unread_count: 0,
        reader_mode: "inherit".to_string(),
        web_preview_mode: "inherit".to_string(),
    };

    {
        let db_guard = db.lock().unwrap();
        db_guard
                .writer()
                .execute(
                    "INSERT INTO accounts (id, kind, name, sync_interval_secs, sync_on_startup, sync_on_wake, keep_read_items_days) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    rusqlite::params![account.id.as_ref(), "Local", account.name, account.sync_interval_secs, account.sync_on_startup, account.sync_on_wake, account.keep_read_items_days],
                )
                .unwrap();
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        feed_repo.save(&selected_feed).unwrap();
        feed_repo.save(&other_feed).unwrap();
    }

    sync_feed(&db, &account, &selected_feed).await.unwrap();

    selected_mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let selected_count: i64 = db_guard
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE feed_id = ?1",
            rusqlite::params![selected_feed.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    let other_count: i64 = db_guard
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE feed_id = ?1",
            rusqlite::params![other_feed.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(selected_count, 1);
    assert_eq!(other_count, 0);
}
