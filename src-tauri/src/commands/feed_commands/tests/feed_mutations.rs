use super::fixtures::*;
use super::*;

#[test]
fn delete_feed_command_rejects_missing_feed() {
    let db = test_db();

    let error = delete_feed_in_db(&db, "missing-feed".to_string())
        .expect_err("missing feed delete should be returned as command error");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Validation error: feed not found"
    ));
}

#[test]
fn delete_feed_command_rejects_while_sync_boundary_is_busy() {
    let db = Mutex::new(test_db());
    let syncing = AtomicBool::new(true);

    let error = delete_feed_with_sync_boundary(&db, &syncing, "missing-feed".to_string())
        .expect_err("feed delete should not run while sync boundary is busy");

    assert!(matches!(error, AppError::UserVisible { .. }));
    assert!(syncing.load(Ordering::SeqCst));
}

#[test]
fn delete_feed_command_releases_sync_boundary_after_delete() {
    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_test_account(&guard, "Primary")
    };
    let feed_id = {
        let guard = db.lock().unwrap();
        insert_test_feed(&guard, &account_id)
    };
    let syncing = AtomicBool::new(false);

    delete_feed_with_sync_boundary(&db, &syncing, feed_id.0).expect("feed delete should succeed");

    assert!(!syncing.load(Ordering::SeqCst));
}

#[tokio::test]
async fn delete_feed_command_unsubscribes_remote_feed_before_local_delete() {
    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_test_account_with_kind(&guard, "Primary", "FreshRss")
    };
    let feed_id = {
        let guard = db.lock().unwrap();
        insert_remote_test_feed(&guard, &account_id, "feed/http://example.com/rss")
    };
    let syncing = AtomicBool::new(false);
    let provider = RecordingDeleteProvider {
        deleted_ids: Mutex::new(Vec::new()),
        subscriptions: Vec::new(),
    };

    delete_feed_with_provider_sync_boundary(&db, &syncing, feed_id.0.clone(), &provider)
        .await
        .expect("remote feed delete should succeed");

    let deleted_ids = provider.deleted_ids.lock().unwrap();
    assert_eq!(deleted_ids.len(), 1);
    assert!(matches!(
        &deleted_ids[0],
        FeedIdentifier::Remote { remote_id }
            if remote_id == "feed/http://example.com/rss"
    ));
    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    assert!(feed_repo.find_by_id(&feed_id).unwrap().is_none());
}

#[tokio::test]
async fn delete_feed_command_resolves_missing_remote_id_before_local_delete() {
    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_test_account_with_kind(&guard, "Primary", "FreshRss")
    };
    let feed_id = {
        let guard = db.lock().unwrap();
        insert_test_feed(&guard, &account_id)
    };
    let syncing = AtomicBool::new(false);
    let provider = RecordingDeleteProvider {
        deleted_ids: Mutex::new(Vec::new()),
        subscriptions: vec![RemoteSubscription {
            remote_id: "feed/http://example.com/rss".to_string(),
            title: "Feed".to_string(),
            url: "http://example.com/rss".to_string(),
            site_url: "http://example.com".to_string(),
            folder_remote_id: None,
            icon_url: None,
        }],
    };

    delete_feed_with_provider_sync_boundary(&db, &syncing, feed_id.0.clone(), &provider)
        .await
        .expect("remote id should be resolved before delete");

    let deleted_ids = provider.deleted_ids.lock().unwrap();
    assert_eq!(deleted_ids.len(), 1);
    assert!(matches!(
        &deleted_ids[0],
        FeedIdentifier::Remote { remote_id }
            if remote_id == "feed/http://example.com/rss"
    ));
    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    assert!(feed_repo.find_by_id(&feed_id).unwrap().is_none());
}

#[tokio::test]
async fn delete_feed_command_resolves_missing_remote_id_in_freshrss_path() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;
    server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/subscription/list?output=json",
        )
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                 "subscriptions": [
                     {
                         "id": "feed/http://example.com/rss",
                         "title": "Feed",
                         "url": "http://example.com/rss",
                         "htmlUrl": "http://example.com"
                     }
                 ]
             }"#,
        )
        .create_async()
        .await;
    let unsubscribe_mock = server
        .mock("POST", "/api/greader.php/reader/api/0/subscription/edit")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .match_body(Matcher::AllOf(vec![
            Matcher::Regex("(^|&)ac=unsubscribe(&|$)".to_string()),
            Matcher::Regex("(^|&)s=feed%2Fhttp%3A%2F%2Fexample.com%2Frss(&|$)".to_string()),
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
        insert_test_feed(&guard, &account_id)
    };
    let _credentials = configure_dev_credentials(&account_id).await;
    let syncing = AtomicBool::new(false);

    delete_feed_with_remote_sync_boundary(&db, &syncing, feed_id.0.clone())
        .await
        .expect("FreshRSS delete should resolve missing remote id before local delete");

    unsubscribe_mock.assert_async().await;
    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    assert!(feed_repo.find_by_id(&feed_id).unwrap().is_none());
}

#[test]
fn rename_feed_command_rejects_missing_feed() {
    let db = test_db();

    let error = rename_feed_in_db(&db, "missing-feed".to_string(), "Renamed Feed".to_string())
        .expect_err("missing feed rename should be returned as command error");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Validation error: feed not found"
    ));
}

#[tokio::test]
async fn rename_feed_command_rejects_while_sync_boundary_is_busy() {
    let db = Mutex::new(test_db());
    let syncing = AtomicBool::new(true);

    let error = rename_feed_with_remote_sync_boundary(
        &db,
        &syncing,
        "missing-feed".to_string(),
        "Renamed Feed".to_string(),
    )
    .await
    .expect_err("feed rename should not run while sync boundary is busy");

    assert!(matches!(error, AppError::UserVisible { .. }));
    assert!(syncing.load(Ordering::SeqCst));
}

#[tokio::test]
async fn rename_feed_command_pushes_title_to_freshrss_before_local_write() {
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
            mockito::Matcher::Regex("(^|&)t=Renamed%20Feed(&|$)".to_string()),
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
    let _credentials = configure_dev_credentials(&account_id).await;
    let syncing = AtomicBool::new(false);

    rename_feed_with_remote_sync_boundary(
        &db,
        &syncing,
        feed_id.0.clone(),
        "Renamed Feed".to_string(),
    )
    .await
    .expect("FreshRSS rename should push the new title before the local write");

    edit_mock.assert_async().await;
    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    let feed = feed_repo.find_by_id(&feed_id).unwrap().unwrap();
    assert_eq!(feed.title, "Renamed Feed");
}

#[tokio::test]
async fn rename_feed_command_keeps_local_title_when_remote_push_fails() {
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
    let _credentials = configure_dev_credentials(&account_id).await;
    let syncing = AtomicBool::new(false);

    let error = rename_feed_with_remote_sync_boundary(
        &db,
        &syncing,
        feed_id.0.clone(),
        "Renamed Feed".to_string(),
    )
    .await
    .expect_err("a failed remote push should not update the local title");

    assert!(!matches!(error, AppError::UserVisible { message } if message == "Renamed Feed"));
    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    let feed = feed_repo.find_by_id(&feed_id).unwrap().unwrap();
    assert_eq!(feed.title, "Feed");
}

#[tokio::test]
async fn rename_feed_command_skips_remote_push_for_local_account() {
    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_test_account(&guard, "Primary")
    };
    let feed_id = {
        let guard = db.lock().unwrap();
        insert_test_feed(&guard, &account_id)
    };

    let syncing = AtomicBool::new(false);
    rename_feed_with_remote_sync_boundary(
        &db,
        &syncing,
        feed_id.0.clone(),
        "Renamed Feed".to_string(),
    )
    .await
    .expect("local account rename should not require a remote provider");

    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    let feed = feed_repo.find_by_id(&feed_id).unwrap().unwrap();
    assert_eq!(feed.title, "Renamed Feed");
}

#[test]
fn update_feed_display_settings_command_rejects_missing_feed() {
    let db = test_db();

    let error = update_feed_display_settings_in_db(
        &db,
        "missing-feed".to_string(),
        "on".to_string(),
        "off".to_string(),
    )
    .expect_err("missing feed display settings mutation should be returned as command error");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Validation error: feed not found"
    ));
}

#[test]
fn update_feed_display_settings_command_persists_inherit_on_and_off_values() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    let feed_id = insert_test_feed(&db, &account_id);

    for (reader_mode, web_preview_mode) in [("inherit", "inherit"), ("on", "off"), ("off", "on")] {
        update_feed_display_settings_in_db(
            &db,
            feed_id.0.clone(),
            reader_mode.to_string(),
            web_preview_mode.to_string(),
        )
        .unwrap();

        let (saved_reader_mode, saved_web_preview_mode): (String, String) = db
            .reader()
            .query_row(
                "SELECT reader_mode, web_preview_mode FROM feeds WHERE id = ?1",
                params![feed_id.0],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();

        assert_eq!(saved_reader_mode, reader_mode);
        assert_eq!(saved_web_preview_mode, web_preview_mode);
    }
}

#[test]
fn update_feed_display_settings_command_rejects_unknown_reader_mode() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    let feed_id = insert_test_feed(&db, &account_id);

    let error = update_feed_display_settings_in_db(
        &db,
        feed_id.0,
        "enabled".to_string(),
        "inherit".to_string(),
    )
    .expect_err("unknown reader mode should be rejected");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Unknown reader mode: enabled"
    ));
}

#[test]
fn update_feed_display_settings_command_rejects_unknown_web_preview_mode() {
    let db = test_db();
    let account_id = insert_test_account(&db, "Primary");
    let feed_id = insert_test_feed(&db, &account_id);

    let error = update_feed_display_settings_in_db(
        &db,
        feed_id.0,
        "inherit".to_string(),
        "enabled".to_string(),
    )
    .expect_err("unknown web preview mode should be rejected");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Unknown web preview mode: enabled"
    ));
}
