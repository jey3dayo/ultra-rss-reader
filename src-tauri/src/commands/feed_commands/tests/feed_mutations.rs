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
async fn delete_freshrss_feed_without_a_lease_requests_interactive_auth_before_unsubscribe() {
    let db = Mutex::new(test_db());
    let (account_id, feed_id) = {
        let guard = db.lock().expect("FreshRSS delete fixture should lock");
        let account_id = insert_freshrss_account(&guard, "https://example.com");
        let feed_id = insert_remote_test_feed(&guard, &account_id, "feed/http://example.com/rss");
        (account_id, feed_id)
    };
    keyring_store::session_cache::invalidate(account_id.as_ref())
        .expect("fixture should have no credential lease");
    let syncing = AtomicBool::new(false);

    let error = super::super::feed_mutations::delete_feed_with_session(
        &db,
        &syncing,
        feed_id.0.clone(),
        |account, mode| canceled_interactive_session_establishment(account, &account_id, mode),
    )
    .await
    .expect_err("canceling interactive authorization should reject the feed delete");

    assert!(matches!(
        error,
        AppError::CredentialStore { credential_failure, .. }
            if credential_failure.cause == crate::domain::error::CredentialFailureCause::Canceled
    ));
    assert!(!syncing.load(Ordering::SeqCst));
    let guard = db.lock().expect("saved feed should be readable");
    assert!(SqliteFeedRepository::new(guard.reader())
        .find_by_id(&feed_id)
        .expect("saved feed lookup should succeed")
        .is_some());
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
async fn rename_freshrss_feed_without_a_lease_requests_interactive_auth_before_remote_edit() {
    let db = Mutex::new(test_db());
    let (account_id, feed_id) = {
        let guard = db.lock().expect("FreshRSS rename fixture should lock");
        let account_id = insert_freshrss_account(&guard, "https://example.com");
        let feed_id = insert_remote_test_feed(&guard, &account_id, "feed/http://example.com/rss");
        (account_id, feed_id)
    };
    keyring_store::session_cache::invalidate(account_id.as_ref())
        .expect("fixture should have no credential lease");
    let syncing = AtomicBool::new(false);

    let error = super::super::feed_mutations::rename_feed_with_session(
        &db,
        &syncing,
        feed_id.0.clone(),
        "Renamed Feed".to_string(),
        |account, mode| canceled_interactive_session_establishment(account, &account_id, mode),
    )
    .await
    .expect_err("canceling interactive authorization should reject the feed rename");

    assert!(matches!(
        error,
        AppError::CredentialStore { credential_failure, .. }
            if credential_failure.cause == crate::domain::error::CredentialFailureCause::Canceled
    ));
    assert!(!syncing.load(Ordering::SeqCst));
    let guard = db.lock().expect("saved feed should be readable");
    let feed = SqliteFeedRepository::new(guard.reader())
        .find_by_id(&feed_id)
        .expect("saved feed lookup should succeed")
        .expect("the feed should remain after canceled authorization");
    assert_ne!(feed.title, "Renamed Feed");
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
async fn rename_feed_command_access_errors_fail_closed_before_http() {
    use crate::infra::keyring_store::cloudflare_access::{
        test_support::SyncAccessGuard, AccessStoreError, CloudflareAccess,
    };

    let mut server = mockito::Server::new_async().await;
    let auth_mock = server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .expect(0)
        .create_async()
        .await;
    let edit_mock = server
        .mock("POST", "/api/greader.php/reader/api/0/subscription/edit")
        .with_status(200)
        .expect(0)
        .create_async()
        .await;
    let db = Mutex::new(test_db());
    let (account_id, feed_id) = {
        let guard = db.lock().unwrap();
        let account_id = insert_freshrss_account(&guard, &server.url());
        let feed_id = insert_remote_test_feed(&guard, &account_id, "feed/http://example.com/rss");
        (account_id, feed_id)
    };
    let _credentials = configure_dev_credentials(&account_id).await;
    let syncing = AtomicBool::new(false);
    let access = CloudflareAccess::new("dummy-id", "cfast_dummy", "https://example.com")
        .expect("dummy Access fixture should have valid HTTPS credentials");

    for (result, expected_message) in [
        (
            Err(AccessStoreError::Unavailable),
            "Keychain error: Cloudflare Access OS keyring is unavailable. Allow keyring access and try again.",
        ),
        (
            Ok(Some(access)),
            "Validation error: Cloudflare Access requires an HTTPS server URL.",
        ),
    ] {
        let _access = SyncAccessGuard::new(account_id.as_ref(), result);
        let error = rename_feed_with_remote_sync_boundary(
            &db,
            &syncing,
            feed_id.0.clone(),
            "Renamed Feed".to_string(),
        )
        .await
        .expect_err("Access lookup or origin errors should reject rename before HTTP");

        let (AppError::UserVisible { message } | AppError::CredentialStore { message, .. }) = error
        else {
            panic!("Access lookup or origin errors should stay user-visible");
        };
        assert_eq!(message, expected_message);
        let guard = db.lock().unwrap();
        let feed = SqliteFeedRepository::new(guard.reader())
            .find_by_id(&feed_id)
            .unwrap()
            .expect("existing feed fixture should remain stored");
        assert_eq!(feed.title, "Feed");
        assert!(!syncing.load(Ordering::SeqCst));
    }

    auth_mock.assert_async().await;
    edit_mock.assert_async().await;
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
fn update_feed_url_command_updates_local_feed_url_and_remote_id() {
    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_test_account(&guard, "Primary")
    };
    let feed_id = {
        let guard = db.lock().unwrap();
        insert_test_feed_with_url(&guard, &account_id, "http://example.com/old.xml")
    };
    let syncing = AtomicBool::new(false);

    update_feed_url_with_boundary(
        &db,
        &syncing,
        feed_id.0.clone(),
        "https://example.com/new.xml".to_string(),
    )
    .expect("local feed URL update should succeed");

    let guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(guard.reader());
    let feed = feed_repo.find_by_id(&feed_id).unwrap().unwrap();
    assert_eq!(feed.url, "https://example.com/new.xml");
    assert_eq!(
        feed.remote_id.as_deref(),
        Some("https://example.com/new.xml")
    );
}

#[test]
fn update_feed_url_command_rekeys_articles_to_the_new_url() {
    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_test_account(&guard, "Primary")
    };
    let feed_id = {
        let guard = db.lock().unwrap();
        insert_test_feed_with_url(&guard, &account_id, "http://example.com/old.xml")
    };
    let old_article_id = crate::domain::article::generate_entry_id(
        &account_id.0,
        Some("entry-1"),
        "http://example.com/old.xml",
        Some("https://example.com/posts/1"),
        Some("First Post"),
    );
    {
        let guard = db.lock().unwrap();
        guard
            .writer()
            .execute(
                "INSERT INTO articles (id, feed_id, remote_id, title, url, published_at, fetched_at, is_read, is_starred)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, 1, 1)",
                params![
                    old_article_id.0,
                    feed_id.0,
                    "entry-1",
                    "First Post",
                    "https://example.com/posts/1",
                    "2026-01-01T00:00:00Z"
                ],
            )
            .unwrap();
    }
    let syncing = AtomicBool::new(false);

    update_feed_url_with_boundary(
        &db,
        &syncing,
        feed_id.0.clone(),
        "https://example.com/new.xml".to_string(),
    )
    .expect("local feed URL update should succeed");

    let expected_article_id = crate::domain::article::generate_entry_id(
        &account_id.0,
        Some("entry-1"),
        "https://example.com/new.xml",
        Some("https://example.com/posts/1"),
        Some("First Post"),
    );
    let guard = db.lock().unwrap();
    let (article_id, is_read, is_starred): (String, i64, i64) = guard
        .reader()
        .query_row(
            "SELECT id, is_read, is_starred FROM articles WHERE feed_id = ?1",
            params![feed_id.0],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .unwrap();
    assert_eq!(article_id, expected_article_id.0);
    assert_eq!(is_read, 1);
    assert_eq!(is_starred, 1);
}

#[test]
fn update_feed_url_command_rejects_freshrss_feed() {
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

    let error = update_feed_url_with_boundary(
        &db,
        &syncing,
        feed_id.0,
        "https://example.com/new.xml".to_string(),
    )
    .expect_err("provider feed URL update should be rejected");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Feed URL can only be changed for local feeds"
    ));
}

#[test]
fn update_feed_url_command_rejects_duplicate_url() {
    let db = Mutex::new(test_db());
    let account_id = {
        let guard = db.lock().unwrap();
        insert_test_account(&guard, "Primary")
    };
    let feed_id = {
        let guard = db.lock().unwrap();
        insert_test_feed_with_url(&guard, &account_id, "http://example.com/a.xml")
    };
    {
        let guard = db.lock().unwrap();
        insert_test_feed_with_url(&guard, &account_id, "http://example.com/b.xml");
    }
    let syncing = AtomicBool::new(false);

    let error = update_feed_url_with_boundary(
        &db,
        &syncing,
        feed_id.0,
        "http://example.com/b.xml".to_string(),
    )
    .expect_err("duplicate feed URL update should be rejected");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Feed URL is already subscribed"
    ));
}

#[test]
fn update_feed_url_command_rejects_invalid_url() {
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

    let error = update_feed_url_with_boundary(
        &db,
        &syncing,
        feed_id.0.clone(),
        "ftp://example.com/feed.xml".to_string(),
    )
    .expect_err("non-http feed URL update should be rejected");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message.contains("http:// and https://")
    ));
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
