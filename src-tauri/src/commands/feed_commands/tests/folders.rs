use super::fixtures::*;
use super::*;

#[test]
fn update_feed_folder_command_rejects_folder_from_another_account() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    let other_account_id = insert_test_account(&db, "Other");
    let feed_id = insert_test_feed(&db, &account_id);
    let other_folder_id = FolderId::new();

    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![other_folder_id.0, other_account_id.0, "Other", 0],
        )
        .unwrap();

    let error = update_feed_folder_in_db(&db, feed_id.0.clone(), Some(other_folder_id.0))
        .expect_err("folder from another account should be returned as command error");

    let saved_folder_id: Option<String> = db
        .reader()
        .query_row(
            "SELECT folder_id FROM feeds WHERE id = ?1",
            params![feed_id.0],
            |row| row.get(0),
        )
        .unwrap();

    assert!(saved_folder_id.is_none());
    assert!(matches!(
        error,
        AppError::UserVisible { message }
            if message == "Folder belongs to another account"
    ));
}

#[test]
fn update_feed_folder_command_rejects_missing_feed() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    let folder_id = FolderId::new();
    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![folder_id.0, account_id.0, "Folder", 0],
        )
        .unwrap();

    let error = update_feed_folder_in_db(&db, "missing-feed".to_string(), Some(folder_id.0))
        .expect_err("missing feed folder mutation should be returned as command error");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Feed not found"
    ));
}

#[tokio::test]
async fn update_feed_folder_command_rejects_while_sync_boundary_is_busy() {
    let db = Mutex::new(test_db());
    let syncing = AtomicBool::new(true);

    let error = update_feed_folder_with_remote_sync_boundary(
        &db,
        &syncing,
        "missing-feed".to_string(),
        None,
    )
    .await
    .expect_err("feed folder move should not run while sync boundary is busy");

    assert!(matches!(error, AppError::UserVisible { .. }));
    assert!(syncing.load(Ordering::SeqCst));
}

#[test]
fn update_feed_folder_command_rejects_missing_folder() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    let feed_id = insert_test_feed(&db, &account_id);

    let error = update_feed_folder_in_db(&db, feed_id.0, Some("missing-folder".to_string()))
        .expect_err("missing folder mutation should be returned as command error");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Folder not found"
    ));
}

#[test]
fn update_feed_folder_command_classifies_concurrent_folder_delete() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    let feed_id = insert_test_feed(&db, &account_id);
    let folder_id = FolderId::new();
    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![folder_id.0, account_id.0, "Folder", 0],
        )
        .unwrap();
    db.writer()
        .execute("DELETE FROM folders WHERE id = ?1", params![folder_id.0])
        .unwrap();

    let error = classify_update_feed_folder_error(
        db.writer(),
        &feed_id.0,
        Some(&folder_id.0),
        DomainError::Validation(UPDATE_FEED_FOLDER_TARGET_VALIDATION_MESSAGE.to_string()),
    );

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Folder not found"
    ));
}

#[test]
fn update_feed_folder_command_rejects_folder_account_mismatch() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    let other_account_id = insert_test_account(&db, "Other");
    let feed_id = insert_test_feed(&db, &account_id);
    let other_folder_id = FolderId::new();
    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![other_folder_id.0, other_account_id.0, "Other", 0],
        )
        .unwrap();

    let error = update_feed_folder_in_db(&db, feed_id.0, Some(other_folder_id.0))
        .expect_err("folder account mismatch should be returned as command error");

    assert!(matches!(
        error,
        AppError::UserVisible { message }
            if message == "Folder belongs to another account"
    ));
}

#[tokio::test]
async fn update_feed_folder_command_pushes_folder_move_to_freshrss_before_local_write() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;
    let edit_mock = server
        .mock("POST", "/api/greader.php/reader/api/0/subscription/edit")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .match_body(mockito::Matcher::AllOf(vec![
            mockito::Matcher::Regex("(^|&)ac=edit(&|$)".to_string()),
            mockito::Matcher::Regex(
                "(^|&)s=feed%2Fhttp%3A%2F%2Fexample.com%2Frss(&|$)".to_string(),
            ),
            mockito::Matcher::Regex("(^|&)a=user%2F-%2Flabel%2FNew(&|$)".to_string()),
            mockito::Matcher::Regex("(^|&)r=user%2F-%2Flabel%2FOld(&|$)".to_string()),
        ]))
        .with_status(200)
        .create_async()
        .await;

    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_freshrss_account(&guard, &server.url())
    };
    let feed_id = {
        let guard = db.lock().unwrap();
        insert_remote_test_feed(&guard, &account_id, "feed/http://example.com/rss")
    };
    let old_folder_id = FolderId::new();
    let new_folder_id = FolderId::new();
    {
        let guard = db.lock().unwrap();
        guard
            .writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params![old_folder_id.0, account_id.0, "Old", 0],
            )
            .unwrap();
        guard
            .writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params![new_folder_id.0, account_id.0, "New", 1],
            )
            .unwrap();
        guard
            .writer()
            .execute(
                "UPDATE feeds SET folder_id = ?1 WHERE id = ?2",
                params![old_folder_id.0, feed_id.0],
            )
            .unwrap();
    }
    let _credentials = configure_dev_credentials(&account_id).await;
    let syncing = AtomicBool::new(false);

    update_feed_folder_with_remote_sync_boundary(
        &db,
        &syncing,
        feed_id.0.clone(),
        Some(new_folder_id.0.clone()),
    )
    .await
    .expect("FreshRSS folder move should push the label change before the local write");

    edit_mock.assert_async().await;
    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    let feed = feed_repo.find_by_id(&feed_id).unwrap().unwrap();
    assert_eq!(feed.folder_id, Some(new_folder_id));
}

#[tokio::test]
async fn update_feed_folder_command_keeps_local_folder_when_remote_push_fails() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;
    server
        .mock("POST", "/api/greader.php/reader/api/0/subscription/edit")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(500)
        .create_async()
        .await;

    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_freshrss_account(&guard, &server.url())
    };
    let feed_id = {
        let guard = db.lock().unwrap();
        insert_remote_test_feed(&guard, &account_id, "feed/http://example.com/rss")
    };
    let new_folder_id = FolderId::new();
    {
        let guard = db.lock().unwrap();
        guard
            .writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params![new_folder_id.0, account_id.0, "New", 0],
            )
            .unwrap();
    }
    let _credentials = configure_dev_credentials(&account_id).await;
    let syncing = AtomicBool::new(false);

    update_feed_folder_with_remote_sync_boundary(
        &db,
        &syncing,
        feed_id.0.clone(),
        Some(new_folder_id.0.clone()),
    )
    .await
    .expect_err("a failed remote push should not update the local folder assignment");

    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    let feed = feed_repo.find_by_id(&feed_id).unwrap().unwrap();
    assert_eq!(feed.folder_id, None);
}

#[tokio::test]
async fn update_feed_folder_command_skips_remote_push_for_local_account() {
    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_test_account(&guard, "Primary")
    };
    let feed_id = {
        let guard = db.lock().unwrap();
        insert_test_feed(&guard, &account_id)
    };
    let folder_id = FolderId::new();
    {
        let guard = db.lock().unwrap();
        guard
            .writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params![folder_id.0, account_id.0, "Folder", 0],
            )
            .unwrap();
    }

    let syncing = AtomicBool::new(false);
    update_feed_folder_with_remote_sync_boundary(
        &db,
        &syncing,
        feed_id.0.clone(),
        Some(folder_id.0.clone()),
    )
    .await
    .expect("local account folder move should not require a remote provider");

    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    let feed = feed_repo.find_by_id(&feed_id).unwrap().unwrap();
    assert_eq!(feed.folder_id, Some(folder_id));
}

#[test]
fn create_folder_rejects_missing_account_before_saving() {
    let db = test_db();

    let error = create_folder_in_db(&db, "missing".to_string(), "Inbox".to_string())
        .expect_err("missing account should be rejected before folder save");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Account not found"
    ));

    let folder_count: i64 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM folders", [], |row| row.get(0))
        .unwrap();
    assert_eq!(folder_count, 0);
}

#[test]
fn create_folder_compacts_existing_order_before_allocating_next_order() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");

    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params!["existing-low", account_id.0, "Low", 0],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params!["existing-high", account_id.0, "High", 7],
        )
        .unwrap();

    let first = create_folder_in_db(&db, account_id.0.clone(), "First".to_string()).unwrap();
    let second = create_folder_in_db(&db, account_id.0.clone(), "Second".to_string()).unwrap();

    assert_eq!(first.sort_order, 2);
    assert_eq!(second.sort_order, 3);

    let orders = db
        .reader()
        .prepare(
            "SELECT sort_order
              FROM folders
              WHERE account_id = ?1
              ORDER BY sort_order",
        )
        .unwrap()
        .query_map(params![account_id.0.clone()], |row| row.get::<_, i32>(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    assert_eq!(orders, vec![0, 1, 2, 3]);

    let duplicate_order_count: i64 = db
        .reader()
        .query_row(
            "SELECT COUNT(*)
              FROM (
                SELECT sort_order
                FROM folders
                WHERE account_id = ?1
                GROUP BY sort_order
                HAVING COUNT(*) > 1
              )",
            params![account_id.0],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(duplicate_order_count, 0);
}

#[test]
fn create_folder_allows_local_only_name_when_remote_folder_has_same_name() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
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

    let created = create_folder_in_db(&db, account_id.0.clone(), "Tech".to_string())
        .expect("local-only folder should coexist with remote folder of same name");

    assert_eq!(created.name, "Tech");
    assert_eq!(created.sort_order, 1);
    let folders = SqliteFolderRepository::new(db.reader())
        .find_by_account(&account_id)
        .unwrap();
    assert_eq!(folders.len(), 2);
    assert!(folders
        .iter()
        .any(|folder| folder.remote_id.as_deref() == Some("user/-/label/Tech")));
    let local_folder = folders
        .iter()
        .find(|folder| folder.id.0 == created.id)
        .expect("created local-only folder should be present");
    assert!(local_folder.remote_id.is_none());
}

#[test]
fn create_folder_command_db_lock_serializes_sort_order_allocation() {
    let db = Arc::new(Mutex::new(test_db()));
    let account_id = {
        let db = lock_db(&db).unwrap();
        insert_test_account(&db, "Primary")
    };
    let start = Arc::new(Barrier::new(2));
    let handles = ["First", "Second"].map(|name| {
        let db = Arc::clone(&db);
        let account_id = account_id.0.clone();
        let start = Arc::clone(&start);

        thread::spawn(move || {
            start.wait();
            let db = lock_db(&db).unwrap();
            create_folder_in_db(&db, account_id, name.to_string()).unwrap()
        })
    });

    let mut created = handles
        .into_iter()
        .map(|handle| handle.join().unwrap())
        .collect::<Vec<_>>();
    created.sort_by_key(|folder| folder.sort_order);

    assert_eq!(
        created
            .iter()
            .map(|folder| folder.sort_order)
            .collect::<Vec<_>>(),
        vec![0, 1]
    );

    let db = lock_db(&db).unwrap();
    let duplicate_order_count: i64 = db
        .reader()
        .query_row(
            "SELECT COUNT(*)
              FROM (
                SELECT sort_order
                FROM folders
                WHERE account_id = ?1
                GROUP BY sort_order
                HAVING COUNT(*) > 1
              )",
            params![account_id.0],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(duplicate_order_count, 0);
}

#[test]
fn create_folder_classifies_concurrent_duplicate_name_constraint() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    db.writer()
        .execute_batch(
            "CREATE TRIGGER simulate_folder_name_race
              BEFORE INSERT ON folders
              WHEN NEW.name = 'Raced'
              BEGIN
                INSERT INTO folders (id, account_id, name, sort_order)
                VALUES ('raced-folder', NEW.account_id, 'raced', NEW.sort_order + 1);
              END;",
        )
        .unwrap();

    let error = create_folder_in_db(&db, account_id.0.clone(), "Raced".to_string())
        .expect_err("concurrent same-name insert should be returned as command error");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Folder name \"Raced\" is already in use"
    ));

    let folder_count: i64 = db
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM folders WHERE account_id = ?1",
            params![account_id.0],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(folder_count, 0);
}

#[test]
fn create_folder_classifies_concurrent_sort_order_constraint() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    db.writer()
        .execute_batch(
            "CREATE TRIGGER simulate_folder_sort_order_race
              BEFORE INSERT ON folders
              WHEN NEW.name = 'Raced'
              BEGIN
                INSERT INTO folders (id, account_id, name, sort_order)
                VALUES ('raced-folder', NEW.account_id, 'Other', NEW.sort_order);
              END;",
        )
        .unwrap();

    let error = create_folder_in_db(&db, account_id.0.clone(), "Raced".to_string())
        .expect_err("concurrent same-order insert should be returned as command error");

    assert!(matches!(
        error,
        AppError::UserVisible { message }
            if message == "Folder order changed while creating the folder. Please retry."
    ));

    let folder_count: i64 = db
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM folders WHERE account_id = ?1",
            params![account_id.0],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(folder_count, 0);
}
