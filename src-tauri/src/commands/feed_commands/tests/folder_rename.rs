use super::fixtures::*;
use super::*;
use crate::commands::feed_commands::{
    rename_folder_in_db, rename_folder_with_remote_sync_boundary,
};

#[test]
fn rename_folder_preserves_identity_order_and_feed_assignment() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Local");
    let folder = create_folder_in_db(&db, account_id.0.clone(), "Old".into()).unwrap();
    let feed = insert_test_feed(&db, &account_id);
    update_feed_folder_in_db(&db, feed.0.clone(), Some(folder.id.clone())).unwrap();

    rename_folder_in_db(&db, &folder.id, "  日本語 & News  ").unwrap();

    let saved = SqliteFolderRepository::new(db.reader())
        .find_by_id(&FolderId(folder.id.clone()))
        .unwrap()
        .unwrap();
    assert_eq!(
        (saved.id.0, saved.name, saved.sort_order, saved.remote_id),
        (
            folder.id.clone(),
            "日本語 & News".into(),
            folder.sort_order,
            None
        )
    );
    let saved_feed = SqliteFeedRepository::new(db.reader())
        .find_by_id(&feed)
        .unwrap()
        .unwrap();
    assert_eq!(saved_feed.folder_id.map(|id| id.0), Some(folder.id));
}

#[test]
fn rename_folder_rejects_invalid_names_missing_id_and_duplicate_without_changes() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Local");
    let folder = create_folder_in_db(&db, account_id.0.clone(), "Old".into()).unwrap();
    create_folder_in_db(&db, account_id.0, "Other".into()).unwrap();
    for name in [" ".to_string(), "a".repeat(101), " oThEr ".to_string()] {
        let error = rename_folder_in_db(&db, &folder.id, &name)
            .expect_err("invalid rename should fail before saving");
        assert!(matches!(error, AppError::UserVisible { .. }));
    }
    assert!(
        matches!(rename_folder_in_db(&db, "missing", "News"), Err(AppError::UserVisible { message }) if message == "Folder not found")
    );
    let saved = SqliteFolderRepository::new(db.reader())
        .find_by_id(&FolderId(folder.id))
        .unwrap()
        .unwrap();
    assert_eq!(saved.name, "Old");
}

#[test]
fn rename_folder_allows_case_only_and_same_name_in_another_account() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Local");
    let other_id = insert_test_account(&db, "Other");
    let folder = create_folder_in_db(&db, account_id.0, "Old".into()).unwrap();
    create_folder_in_db(&db, other_id.0, "OLD".into()).unwrap();
    rename_folder_in_db(&db, &folder.id, "OLD").unwrap();
    let saved = SqliteFolderRepository::new(db.reader())
        .find_by_id(&FolderId(folder.id))
        .unwrap()
        .unwrap();
    assert_eq!(saved.name, "OLD");
}

#[test]
fn rename_local_folder_allows_name_used_by_remote_folder_but_not_by_local_folder() {
    let db = test_db();
    let account_id = insert_test_account_with_kind(&db, "FreshRSS", "FreshRSS");
    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, remote_id, name, sort_order)
              VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                "remote-tech",
                account_id.0.clone(),
                "user/-/label/Tech",
                "Tech",
                0
            ],
        )
        .unwrap();
    let folder = create_folder_in_db(&db, account_id.0.clone(), "Old".into()).unwrap();
    create_folder_in_db(&db, account_id.0, "Other".into()).unwrap();

    rename_folder_in_db(&db, &folder.id, "tech").unwrap();
    assert!(matches!(
        rename_folder_in_db(&db, &folder.id, "other"),
        Err(AppError::UserVisible { .. })
    ));

    let saved = SqliteFolderRepository::new(db.reader())
        .find_by_id(&FolderId(folder.id))
        .unwrap()
        .unwrap();
    assert_eq!((saved.name.as_str(), saved.remote_id), ("tech", None));
}

#[tokio::test]
async fn rename_folder_rejects_busy_sync_boundary() {
    let syncing = AtomicBool::new(true);
    let error = rename_folder_with_remote_sync_boundary(
        &Mutex::new(test_db()),
        &syncing,
        "missing".into(),
        "Name".into(),
    )
    .await
    .expect_err("rename must not race with sync");
    assert!(matches!(error, AppError::UserVisible { .. }));
    assert!(syncing.load(Ordering::SeqCst));
}

#[tokio::test]
async fn rename_remote_folder_saves_new_remote_id_only_after_acknowledgement() {
    let mut server = mockito::Server::new_async().await;
    let db = test_db();
    let account_id = insert_freshrss_account(&db, &server.url());
    let _credentials = configure_dev_credentials(&account_id).await;
    let folder = create_folder_in_db(&db, account_id.0, "Old".into()).unwrap();
    db.writer()
        .execute(
            "UPDATE folders SET remote_id = 'user/-/label/Old' WHERE id = ?1",
            params![folder.id],
        )
        .unwrap();
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_body("Auth=tok\n")
        .create_async()
        .await;
    let db = Mutex::new(db);
    let syncing = AtomicBool::new(false);
    for (status, body, succeeds) in [
        (200, "NOT OK", false),
        (401, "OK", false),
        (500, "OK", false),
        (200, "OK", true),
    ] {
        let request = server
            .mock("POST", "/api/greader.php/reader/api/0/rename-tag")
            .match_header("Authorization", "GoogleLogin auth=tok")
            .match_body("s=user%2F-%2Flabel%2FOld&dest=user%2F-%2Flabel%2FNew")
            .with_header("Content-Type", "text/html; charset=UTF-8")
            .with_status(status)
            .with_body(body)
            .create_async()
            .await;
        let result = rename_folder_with_remote_sync_boundary(
            &db,
            &syncing,
            folder.id.clone(),
            " New ".into(),
        )
        .await;
        assert_eq!(result.is_ok(), succeeds, "{result:?}");
        request.assert_async().await;
        request.remove_async().await;
        let db = lock_db(&db).unwrap();
        let saved = SqliteFolderRepository::new(db.reader())
            .find_by_id(&FolderId(folder.id.clone()))
            .unwrap()
            .unwrap();
        assert_eq!(saved.name, if succeeds { "New" } else { "Old" });
        assert_eq!(
            saved.remote_id.as_deref(),
            Some(if succeeds {
                "user/-/label/New"
            } else {
                "user/-/label/Old"
            })
        );
        assert!(!syncing.load(Ordering::SeqCst));
    }
}

#[tokio::test]
async fn rename_local_folder_on_freshrss_does_not_authenticate() {
    let db = test_db();
    let account_id = insert_test_account_with_kind(&db, "FreshRSS without credentials", "FreshRSS");
    let folder = create_folder_in_db(&db, account_id.0, "Old".into()).unwrap();
    let db = Mutex::new(db);
    rename_folder_with_remote_sync_boundary(
        &db,
        &AtomicBool::new(false),
        folder.id.clone(),
        "New".into(),
    )
    .await
    .unwrap();
    let db = lock_db(&db).unwrap();
    let saved = SqliteFolderRepository::new(db.reader())
        .find_by_id(&FolderId(folder.id))
        .unwrap()
        .unwrap();
    assert_eq!((saved.name.as_str(), saved.remote_id), ("New", None));
}

#[tokio::test]
async fn rename_remote_folder_reports_reconciliation_when_local_save_fails() {
    let mut server = mockito::Server::new_async().await;
    let db = test_db();
    let account_id = insert_freshrss_account(&db, &server.url());
    let _credentials = configure_dev_credentials(&account_id).await;
    let folder = create_folder_in_db(&db, account_id.0, "Old".into()).unwrap();
    db.writer()
        .execute(
            "UPDATE folders SET remote_id = 'user/-/label/Old' WHERE id = ?1",
            params![folder.id],
        )
        .unwrap();
    db.writer().execute_batch("CREATE TRIGGER prevent_folder_rename BEFORE UPDATE OF name ON folders BEGIN SELECT RAISE(ABORT, 'save failed'); END;").unwrap();
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_body("Auth=tok\n")
        .create_async()
        .await;
    let request = server
        .mock("POST", "/api/greader.php/reader/api/0/rename-tag")
        .with_body("OK")
        .create_async()
        .await;
    let db = Mutex::new(db);
    let syncing = AtomicBool::new(false);
    let error =
        rename_folder_with_remote_sync_boundary(&db, &syncing, folder.id.clone(), "New".into())
            .await
            .expect_err("local failure after remote rename should require reconciliation");
    assert!(
        matches!(error, AppError::UserVisible { message } if message.contains("Sync the account before trying again"))
    );
    request.assert_async().await;
    let db = lock_db(&db).unwrap();
    let saved = SqliteFolderRepository::new(db.reader())
        .find_by_id(&FolderId(folder.id))
        .unwrap()
        .unwrap();
    assert_eq!(
        (saved.name.as_str(), saved.remote_id.as_deref()),
        ("Old", Some("user/-/label/Old"))
    );
    assert!(!syncing.load(Ordering::SeqCst));
}

#[tokio::test]
async fn rename_remote_folder_validates_and_skips_unchanged_before_credentials() {
    let db = test_db();
    let account_id = insert_test_account_with_kind(&db, "No credentials", "FreshRSS");
    let folder = create_folder_in_db(&db, account_id.0.clone(), "Old".into()).unwrap();
    create_folder_in_db(&db, account_id.0, "Other".into()).unwrap();
    db.writer()
        .execute("UPDATE folders SET remote_id = 'user/-/label/' || name", [])
        .unwrap();
    let db = Mutex::new(db);
    let syncing = AtomicBool::new(false);
    for (name, expected) in [
        ("oThEr", "already in use"),
        ("Bad/Name", "cannot contain /"),
    ] {
        let error =
            rename_folder_with_remote_sync_boundary(&db, &syncing, folder.id.clone(), name.into())
                .await
                .expect_err("invalid name must be rejected before credentials are read");
        assert!(matches!(error, AppError::UserVisible { message } if message.contains(expected)));
    }
    let result =
        rename_folder_with_remote_sync_boundary(&db, &syncing, folder.id, " Old ".into()).await;
    assert!(
        result.is_ok(),
        "unchanged name should not authenticate: {result:?}"
    );
    assert!(!syncing.load(Ordering::SeqCst));
}
