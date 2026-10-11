use super::*;

#[tokio::test]
async fn sync_local_feed_initial_fetch_saves_articles_and_validators() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .match_header("if-none-match", Matcher::Missing)
        .match_header("if-modified-since", Matcher::Missing)
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_header("etag", LOCAL_ETAG_NEW)
        .with_header("last-modified", LOCAL_LAST_MODIFIED_NEW)
        .with_body(LOCAL_RSS_INITIAL)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();

    sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .unwrap();

    mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let articles = article_repo
        .find_by_feed(&feed.id, &Pagination::default())
        .unwrap();
    let state = sync_state_repo
        .get(&account.id, &local_feed_scope_key(&feed.url))
        .unwrap()
        .unwrap();

    assert_eq!(articles.len(), 1);
    assert_eq!(articles[0].title, "Local Article");
    assert_eq!(state.etag.as_deref(), Some(LOCAL_ETAG_NEW));
    assert_eq!(
        state.last_modified.as_deref(),
        Some(LOCAL_LAST_MODIFIED_NEW)
    );
    assert_eq!(state.continuation, None);
    assert_eq!(state.timestamp_usec, None);
    assert_eq!(state.error_count, 0);
    assert!(state.last_success_at.is_some());
}

#[tokio::test]
async fn sync_local_feed_saves_validators_under_requested_and_redirect_final_scope_keys() {
    let mut server = mockito::Server::new_async().await;
    let requested_feed_url = format!("{}/old-feed.xml?z=last&a=first", server.url());
    let redirect = server
        .mock("GET", "/old-feed.xml")
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("z".into(), "last".into()),
            mockito::Matcher::UrlEncoded("a".into(), "first".into()),
        ]))
        .with_status(308)
        .with_header("location", "/feed.xml?b=2&a=1")
        .create_async()
        .await;
    let final_feed = server
        .mock("GET", "/feed.xml")
        .match_query(mockito::Matcher::AllOf(vec![
            mockito::Matcher::UrlEncoded("b".into(), "2".into()),
            mockito::Matcher::UrlEncoded("a".into(), "1".into()),
        ]))
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_header("etag", LOCAL_ETAG_NEW)
        .with_header("last-modified", LOCAL_LAST_MODIFIED_NEW)
        .with_body(LOCAL_RSS_INITIAL)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &requested_feed_url);
    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();

    sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .unwrap();

    redirect.assert_async().await;
    final_feed.assert_async().await;

    let db_guard = db.lock().unwrap();
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let saved_feed = feed_repo.find_by_id(&feed.id).unwrap().unwrap();
    let requested_state = sync_state_repo
        .get(&account.id, local_feed_scope_key(&requested_feed_url))
        .unwrap()
        .unwrap();
    let final_state = sync_state_repo
        .get(
            &account.id,
            local_feed_scope_key(&format!("{}/feed.xml?a=1&b=2", server.url())),
        )
        .unwrap()
        .unwrap();

    assert_eq!(requested_state.etag.as_deref(), Some(LOCAL_ETAG_NEW));
    assert_eq!(final_state.etag.as_deref(), Some(LOCAL_ETAG_NEW));
    assert_eq!(
        requested_state.last_modified.as_deref(),
        Some(LOCAL_LAST_MODIFIED_NEW)
    );
    assert_eq!(
        final_state.last_modified.as_deref(),
        Some(LOCAL_LAST_MODIFIED_NEW)
    );
    assert_eq!(saved_feed.url, requested_feed_url);
}

#[tokio::test]
async fn sync_local_feed_keeps_http_validators_in_sync_state_not_feed_http_cache() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_header("etag", LOCAL_ETAG_NEW)
        .with_header("last-modified", LOCAL_LAST_MODIFIED_NEW)
        .with_body(LOCAL_RSS_INITIAL)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();

    sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .unwrap();

    mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let state = sync_state_repo
        .get(&account.id, &local_feed_scope_key(&feed.url))
        .unwrap()
        .unwrap();
    let feed_http_cache_count: i64 = db_guard
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM feed_http_cache WHERE feed_id = ?1",
            rusqlite::params![feed.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(state.etag.as_deref(), Some(LOCAL_ETAG_NEW));
    assert_eq!(
        state.last_modified.as_deref(),
        Some(LOCAL_LAST_MODIFIED_NEW)
    );
    assert_eq!(feed_http_cache_count, 0);
}

#[tokio::test]
async fn sync_local_feed_returns_post_write_integrity_error() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_body(LOCAL_RSS_INITIAL)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    {
        let db_guard = db.lock().unwrap();
        db_guard
            .writer()
            .execute("DROP TABLE preferences", [])
            .unwrap();
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    let error = sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .expect_err("post-write integrity failures should be returned");

    mock.assert_async().await;
    let db_guard = db.lock().unwrap();
    let article_count: i64 = db_guard
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE feed_id = ?1",
            rusqlite::params![feed.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    let sync_state_count: i64 = db_guard
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM sync_state WHERE account_id = ?1 AND scope_key = ?2",
            rusqlite::params![
                account.id.as_ref(),
                local_feed_scope_key(&feed.url).as_string()
            ],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(article_count, 0);
    assert_eq!(sync_state_count, 1);
    let state = SqliteSyncStateRepository::new(db_guard.reader())
        .get(&account.id, local_feed_scope_key(&feed.url))
        .expect("commit failure state should load")
        .expect("commit failure state should persist");
    let record: serde_json::Value = serde_json::from_str(
        state
            .last_error
            .as_deref()
            .expect("commit failure state should include diagnostics"),
    )
    .expect("commit failure diagnostics should be safe JSON");
    assert_eq!(record["error_kind"], "persistence");
    assert!(uuid::Uuid::parse_str(
        record["diagnostic_id"]
            .as_str()
            .expect("commit failure should include a diagnostic ID")
    )
    .is_ok());
    match error {
        AppError::UserVisible { message } => {
            assert!(message.contains("no such table: preferences"));
        }
        AppError::Retryable { message } | AppError::RetryableWithMetadata { message, .. } => {
            panic!("post-write DB failures should not be retryable: {message}");
        }
    }
}

#[tokio::test]
async fn sync_local_feed_rolls_back_articles_when_sync_state_save_fails() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_header("etag", LOCAL_ETAG_NEW)
        .with_body(LOCAL_RSS_INITIAL)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    {
        let db_guard = db.lock().unwrap();
        db_guard
            .writer()
            .execute_batch(
                "CREATE TEMP TRIGGER fail_local_feed_sync_state_save
                     BEFORE INSERT ON sync_state
                     WHEN NEW.scope_key LIKE 'local_feed:%'
                     BEGIN
                       SELECT RAISE(ABORT, 'forced sync_state failure');
                     END;",
            )
            .unwrap();
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    let error = sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .expect_err("sync_state failure should roll back article writes");

    mock.assert_async().await;
    let db_guard = db.lock().unwrap();
    let article_count: i64 = db_guard
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE feed_id = ?1",
            rusqlite::params![feed.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    let sync_state_count: i64 = db_guard
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM sync_state WHERE account_id = ?1 AND scope_key = ?2",
            rusqlite::params![
                account.id.as_ref(),
                local_feed_scope_key(&feed.url).as_string()
            ],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(article_count, 0);
    assert_eq!(sync_state_count, 0);
    match error {
        AppError::UserVisible { message } => {
            assert!(message.contains("forced sync_state failure"));
        }
        AppError::Retryable { message } | AppError::RetryableWithMetadata { message, .. } => {
            panic!("sync_state DB failures should not be retryable: {message}");
        }
    }
}

#[tokio::test]
async fn sync_local_feed_updates_validators_and_article_on_200_response() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .match_header("if-none-match", LOCAL_ETAG_OLD)
        .match_header("if-modified-since", LOCAL_LAST_MODIFIED_OLD)
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_header("etag", LOCAL_ETAG_NEW)
        .with_header("last-modified", LOCAL_LAST_MODIFIED_NEW)
        .with_body(LOCAL_RSS_UPDATED)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    let existing_article = Article {
        id: generate_entry_id(
            account.id.as_ref(),
            Some("local-guid-1"),
            &feed.url,
            Some("https://example.com/1"),
            Some("Local Article"),
        ),
        feed_id: feed.id.clone(),
        remote_id: Some("local-guid-1".to_string()),
        title: "Local Article".to_string(),
        content_raw: "old".to_string(),
        content_sanitized: "old".to_string(),
        sanitizer_version: sanitizer::SANITIZER_VERSION,
        summary: None,
        url: Some("https://example.com/1".to_string()),
        author: None,
        published_at: chrono::Utc::now(),
        thumbnail: None,
        is_read: false,
        is_starred: false,
        fetched_at: chrono::Utc::now(),
    };
    {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        article_repo.upsert(&[existing_article]).unwrap();
        sync_state_repo
            .save(&SyncState {
                account_id: account.id.clone(),
                scope_key: local_feed_scope_key(&feed.url).as_string(),
                timestamp_usec: None,
                continuation: None,
                etag: Some(LOCAL_ETAG_OLD.to_string()),
                last_modified: Some(LOCAL_LAST_MODIFIED_OLD.to_string()),
                last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
                last_error: Some(r#"{"error_kind":"network","attempted_at":"2025-01-01T00:30:00Z","diagnostic_id":"8cb8465f-9d0c-429e-83f8-a7d511597be6"}"#.to_string()),
                error_count: 2,
                next_retry_at: Some("2025-01-01T01:00:00Z".to_string()),
            })
            .unwrap();
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .unwrap();

    mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let articles = article_repo
        .find_by_feed(&feed.id, &Pagination::default())
        .unwrap();
    let state = sync_state_repo
        .get(&account.id, &local_feed_scope_key(&feed.url))
        .unwrap()
        .unwrap();

    assert_eq!(articles.len(), 1);
    assert_eq!(articles[0].title, "Local Article Updated");
    assert_eq!(state.etag.as_deref(), Some(LOCAL_ETAG_NEW));
    assert_eq!(
        state.last_modified.as_deref(),
        Some(LOCAL_LAST_MODIFIED_NEW)
    );
    assert_eq!(state.error_count, 0);
    assert_eq!(state.last_error, None);
    assert_eq!(state.next_retry_at, None);
    assert!(state.last_success_at.is_some());
    assert_eq!(
        local_feed_sync_status(&feed.id, Some(state.clone())).last_attempt_at,
        state.last_success_at
    );
}

#[tokio::test]
async fn sync_local_feed_preserves_weak_etag_and_drops_invalid_last_modified() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_header("etag", "W/\"weak-etag\"")
        .with_header("last-modified", "not-a-date")
        .with_body(LOCAL_RSS_INITIAL)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();

    sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .unwrap();

    mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let state = sync_state_repo
        .get(&account.id, &local_feed_scope_key(&feed.url))
        .unwrap()
        .unwrap();

    assert_eq!(state.etag.as_deref(), Some("W/\"weak-etag\""));
    assert_eq!(state.last_modified, None);
}

#[tokio::test]
async fn sync_local_feed_drops_invalid_saved_validators_before_request() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_header("etag", LOCAL_ETAG_NEW)
        .with_header("last-modified", LOCAL_LAST_MODIFIED_NEW)
        .with_body(LOCAL_RSS_INITIAL)
        .expect(1)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    {
        let db_guard = db.lock().unwrap();
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        sync_state_repo
            .save(&SyncState {
                account_id: account.id.clone(),
                scope_key: local_feed_scope_key(&feed.url).as_string(),
                timestamp_usec: None,
                continuation: None,
                etag: Some("unquoted-etag".to_string()),
                last_modified: Some("invalid-date".to_string()),
                last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
                last_error: None,
                error_count: 0,
                next_retry_at: None,
            })
            .unwrap();
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .unwrap();

    mock.assert_async().await;
}

#[tokio::test]
async fn sync_local_feed_persists_safe_failure_status_and_preserves_last_success_state() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml?token=feed-secret", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .match_query(mockito::Matcher::UrlEncoded(
            "token".to_string(),
            "feed-secret".to_string(),
        ))
        .with_status(500)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    {
        let db_guard = db.lock().unwrap();
        SqliteSyncStateRepository::new(db_guard.writer())
            .save(&SyncState {
                account_id: account.id.clone(),
                scope_key: local_feed_scope_key(&feed.url).as_string(),
                timestamp_usec: Some(123),
                continuation: Some("cursor-secret".to_string()),
                etag: Some(LOCAL_ETAG_OLD.to_string()),
                last_modified: Some(LOCAL_LAST_MODIFIED_OLD.to_string()),
                last_success_at: Some("2026-10-10T23:00:00Z".to_string()),
                last_error: Some("old raw error with https://secret.test".to_string()),
                error_count: 4,
                next_retry_at: Some("2026-10-11T01:00:00Z".to_string()),
            })
            .expect("prior sync state should save");
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    let error = sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .expect_err("HTTP failure should be returned after its status is saved");
    mock.assert_async().await;
    assert_eq!(error.diagnostic_kind(), "retryable");

    let db_guard = db.lock().unwrap();
    let state = SqliteSyncStateRepository::new(db_guard.reader())
        .get(&account.id, local_feed_scope_key(&feed.url))
        .expect("saved status should reload after restart")
        .expect("failure status should remain persisted");
    let raw_error = state
        .last_error
        .as_deref()
        .expect("failure should be recorded");
    assert!(!raw_error.contains("feed-secret"));
    assert!(!raw_error.contains("secret.test"));
    assert!(!raw_error.contains("old raw error"));
    let record: serde_json::Value =
        serde_json::from_str(raw_error).expect("failure record should be safe JSON");
    assert_eq!(record["error_kind"], "network");
    assert!(record["attempted_at"]
        .as_str()
        .and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok())
        .is_some());
    let diagnostic_id = record["diagnostic_id"]
        .as_str()
        .expect("failure record should contain a diagnostic ID");
    assert!(uuid::Uuid::parse_str(diagnostic_id).is_ok());
    assert_eq!(state.error_count, 5);
    assert_eq!(state.timestamp_usec, Some(123));
    assert_eq!(state.continuation.as_deref(), Some("cursor-secret"));
    assert_eq!(state.etag.as_deref(), Some(LOCAL_ETAG_OLD));
    assert_eq!(
        state.last_modified.as_deref(),
        Some(LOCAL_LAST_MODIFIED_OLD)
    );
    assert_eq!(
        state.last_success_at.as_deref(),
        Some("2026-10-10T23:00:00Z")
    );
    assert_eq!(state.next_retry_at.as_deref(), Some("2026-10-11T01:00:00Z"));

    let status = local_feed_sync_status(&feed.id, Some(state));
    assert_eq!(
        status.error_kind,
        Some(crate::commands::dto::LocalFeedSyncErrorKind::Network)
    );
    assert_eq!(status.diagnostic_id.as_deref(), Some(diagnostic_id));
    assert_eq!(
        status.last_attempt_at.as_deref(),
        record["attempted_at"].as_str()
    );
    assert_eq!(
        status.last_success_at.as_deref(),
        Some("2026-10-10T23:00:00Z")
    );
}

#[tokio::test]
async fn sync_local_feed_returns_persistence_error_when_failure_status_cannot_be_saved() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .with_status(500)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    {
        let db_guard = db.lock().unwrap();
        db_guard
            .writer()
            .execute_batch(
                "CREATE TEMP TRIGGER fail_local_feed_failure_status
                     BEFORE INSERT ON sync_state
                     WHEN NEW.scope_key LIKE 'local_feed:%'
                     BEGIN
                       SELECT RAISE(ABORT, 'forced failure status write error');
                     END;",
            )
            .expect("status persistence trigger should install");
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    let error = sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .expect_err("status persistence errors should propagate");
    mock.assert_async().await;
    assert_eq!(error.diagnostic_kind(), "persistence");
    assert!(error
        .to_string()
        .contains("forced failure status write error"));

    let db_guard = db.lock().unwrap();
    let state_count: i64 = db_guard
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM sync_state WHERE account_id = ?1 AND scope_key = ?2",
            rusqlite::params![
                account.id.as_ref(),
                local_feed_scope_key(&feed.url).as_string()
            ],
            |row| row.get(0),
        )
        .expect("sync state count should be readable");
    assert_eq!(state_count, 0);
}

#[tokio::test]
async fn sync_local_feed_records_article_commit_failure_without_replacing_saved_validators() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml?token=commit-secret", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .match_query(mockito::Matcher::UrlEncoded(
            "token".to_string(),
            "commit-secret".to_string(),
        ))
        .match_header("if-none-match", LOCAL_ETAG_OLD)
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_header("etag", LOCAL_ETAG_NEW)
        .with_header("last-modified", LOCAL_LAST_MODIFIED_NEW)
        .with_body(LOCAL_RSS_INITIAL)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    {
        let db_guard = db.lock().unwrap();
        SqliteSyncStateRepository::new(db_guard.writer())
            .save(&SyncState {
                account_id: account.id.clone(),
                scope_key: local_feed_scope_key(&feed.url).as_string(),
                timestamp_usec: Some(456),
                continuation: Some("saved-cursor-secret".to_string()),
                etag: Some(LOCAL_ETAG_OLD.to_string()),
                last_modified: Some(LOCAL_LAST_MODIFIED_OLD.to_string()),
                last_success_at: Some("2026-10-10T23:00:00Z".to_string()),
                last_error: None,
                error_count: 2,
                next_retry_at: Some("2026-10-11T01:00:00Z".to_string()),
            })
            .expect("prior sync state should save");
        db_guard
            .writer()
            .execute_batch(
                "CREATE TEMP TRIGGER fail_local_article_commit
                     BEFORE INSERT ON articles
                     BEGIN
                       SELECT RAISE(ABORT, 'forced article commit error');
                     END;",
            )
            .expect("article commit failure trigger should install");
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    let error = sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .expect_err("article commit failure should be returned after recording diagnostics");
    mock.assert_async().await;
    assert_eq!(error.diagnostic_kind(), "persistence");
    assert!(error.to_string().contains("forced article commit error"));

    let db_guard = db.lock().unwrap();
    let state = SqliteSyncStateRepository::new(db_guard.reader())
        .get(&account.id, local_feed_scope_key(&feed.url))
        .expect("failure state should reload")
        .expect("failure state should be saved");
    assert_eq!(state.timestamp_usec, Some(456));
    assert_eq!(state.continuation.as_deref(), Some("saved-cursor-secret"));
    assert_eq!(state.etag.as_deref(), Some(LOCAL_ETAG_OLD));
    assert_eq!(
        state.last_modified.as_deref(),
        Some(LOCAL_LAST_MODIFIED_OLD)
    );
    assert_eq!(
        state.last_success_at.as_deref(),
        Some("2026-10-10T23:00:00Z")
    );
    assert_eq!(state.error_count, 3);
    assert_eq!(state.next_retry_at.as_deref(), Some("2026-10-11T01:00:00Z"));
    let raw_error = state
        .last_error
        .as_deref()
        .expect("commit failure should be persisted");
    assert!(!raw_error.contains("commit-secret"));
    let record: serde_json::Value =
        serde_json::from_str(raw_error).expect("commit failure record should be safe JSON");
    assert_eq!(record["error_kind"], "persistence");
    assert!(record["attempted_at"]
        .as_str()
        .and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok())
        .is_some());
    assert!(uuid::Uuid::parse_str(
        record["diagnostic_id"]
            .as_str()
            .expect("commit failure record should contain a diagnostic ID")
    )
    .is_ok());
    assert_eq!(
        local_feed_sync_status(&feed.id, Some(state)).error_kind,
        Some(crate::commands::dto::LocalFeedSyncErrorKind::Persistence)
    );
}

#[tokio::test]
async fn sync_local_feed_commit_failure_logs_safely_when_status_save_also_fails() {
    use crate::infra::log_capture_test_support::{child_scenario, run_in_isolated_process};

    const ACCOUNT_ID_SENTINEL: &str = "account-id-secret-sentinel";
    const FEED_ID_SENTINEL: &str = "feed-id-secret-sentinel";

    if child_scenario().is_some() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml?token=commit-url-sentinel", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .match_query(mockito::Matcher::UrlEncoded(
                "token".to_string(),
                "commit-url-sentinel".to_string(),
            ))
            .with_status(200)
            .with_header("content-type", "application/rss+xml")
            .with_body(LOCAL_RSS_INITIAL)
            .create_async()
            .await;

        let db = test_db();
        let mut account = test_local_account();
        account.id = AccountId(ACCOUNT_ID_SENTINEL.to_string());
        let mut feed = test_local_feed(&account.id, &feed_url);
        feed.id = FeedId(FEED_ID_SENTINEL.to_string());
        {
            let db_guard = db.lock().unwrap();
            SqliteAccountRepository::new(db_guard.writer())
                .save(&account)
                .expect("local account should save");
            SqliteFeedRepository::new(db_guard.writer())
                .save(&feed)
                .expect("local feed should save");
            db_guard
                .writer()
                .execute_batch(
                    "CREATE TEMP TRIGGER fail_local_article_commit
                         BEFORE INSERT ON articles
                         BEGIN
                           SELECT RAISE(ABORT, 'forced article commit error');
                         END;
                     CREATE TEMP TRIGGER fail_local_feed_failure_status
                         BEFORE INSERT ON sync_state
                         WHEN NEW.scope_key LIKE 'local_feed:%'
                         BEGIN
                           SELECT RAISE(ABORT, 'forced failure status write error');
                         END;",
                )
                .expect("commit and status failure triggers should install");
        }

        let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
        let error = sync_local_feed(&db, &provider, &account.id, &feed)
            .await
            .expect_err("both commit and status persistence failures should propagate");
        mock.assert_async().await;
        assert_eq!(error.diagnostic_kind(), "persistence");
        let db_guard = db.lock().unwrap();
        let status_count: i64 = db_guard
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM sync_state WHERE account_id = ?1 AND scope_key = ?2",
                rusqlite::params![
                    account.id.as_ref(),
                    local_feed_scope_key(&feed.url).as_string()
                ],
                |row| row.get(0),
            )
            .expect("status row count should be readable");
        assert_eq!(status_count, 0);
        return;
    }

    let lines = run_in_isolated_process(
        module_path!(),
        "sync_local_feed_commit_failure_logs_safely_when_status_save_also_fails",
        "emit",
    );
    let failure_logs = lines
        .iter()
        .filter(|line| line.starts_with("event=feed-fetch-failed"))
        .collect::<Vec<_>>();
    let status_failure_logs = lines
        .iter()
        .filter(|line| line.starts_with("event=feed-fetch-status-persist-failed"))
        .collect::<Vec<_>>();
    assert_eq!(failure_logs.len(), 1);
    assert_eq!(status_failure_logs.len(), 1);
    let failure_log = failure_logs[0];
    let status_failure_log = status_failure_logs[0];
    let diagnostic_id = failure_log
        .split_once("diagnostic_id=")
        .and_then(|(_, fields)| fields.split_whitespace().next())
        .filter(|value| !value.is_empty())
        .expect("failure log should contain a diagnostic ID");
    assert!(failure_log.contains("error_kind=persistence reason=persistence"));
    assert!(status_failure_log.contains("fetch_error_kind=persistence"));
    assert!(status_failure_log.contains(&format!("diagnostic_id={diagnostic_id}")));
    assert!(lines.iter().all(|line| {
        !line.contains("commit-url-sentinel")
            && !line.contains(ACCOUNT_ID_SENTINEL)
            && !line.contains(FEED_ID_SENTINEL)
            && !line.contains("forced article commit error")
            && !line.contains("forced failure status write error")
    }));
}

#[tokio::test]
async fn sync_local_feed_failure_log_correlates_safe_reason_with_persisted_diagnostic() {
    use crate::infra::log_capture_test_support::{child_scenario, run_in_isolated_process};

    if child_scenario().is_some() {
        let mut server = mockito::Server::new_async().await;
        let feed_url = format!("{}/feed.xml?secret=feed-url-sentinel", server.url());
        let mock = server
            .mock("GET", "/feed.xml")
            .match_query(mockito::Matcher::UrlEncoded(
                "secret".to_string(),
                "feed-url-sentinel".to_string(),
            ))
            .with_status(500)
            .create_async()
            .await;
        let db = test_db();
        let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
        let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
        sync_local_feed(&db, &provider, &account.id, &feed)
            .await
            .expect_err("failed fetch should produce a persisted status");
        mock.assert_async().await;

        let db_guard = db.lock().unwrap();
        let state = SqliteSyncStateRepository::new(db_guard.reader())
            .get(&account.id, local_feed_scope_key(&feed.url))
            .expect("failed fetch status should be readable")
            .expect("failed fetch status should be saved");
        let record: serde_json::Value = serde_json::from_str(
            state
                .last_error
                .as_deref()
                .expect("failed fetch status should contain a record"),
        )
        .expect("failure record should be valid JSON");
        let diagnostic_id = record["diagnostic_id"]
            .as_str()
            .expect("failure record should contain a diagnostic ID");
        println!("LOGLINE status_diagnostic_id={diagnostic_id}");
        return;
    }

    let lines = run_in_isolated_process(
        module_path!(),
        "sync_local_feed_failure_log_correlates_safe_reason_with_persisted_diagnostic",
        "emit",
    );
    let failure_log = lines
        .iter()
        .find(|line| line.starts_with("event=feed-fetch-failed"))
        .expect("provider failure should emit its safe diagnostic line");
    let status_log = lines
        .iter()
        .find(|line| line.starts_with("status_diagnostic_id="))
        .expect("persisted status should emit its diagnostic ID for comparison");
    let diagnostic_id = status_log.trim_start_matches("status_diagnostic_id=");
    assert!(failure_log.contains("reason=network"));
    assert!(failure_log.contains(&format!("diagnostic_id={diagnostic_id}")));
    assert!(lines.iter().all(|line| {
        !line.contains("feed-url-sentinel")
            && !line.contains("account_id")
            && !line.contains("feed_id")
    }));
}

#[tokio::test]
async fn sync_local_feed_skips_upsert_when_server_returns_not_modified() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .match_header("if-none-match", LOCAL_ETAG_OLD)
        .match_header("if-modified-since", LOCAL_LAST_MODIFIED_OLD)
        .with_status(304)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    let existing_fetched_at = chrono::Utc::now() - chrono::Duration::days(1);
    let existing_article = Article {
        id: generate_entry_id(
            account.id.as_ref(),
            Some("local-guid-1"),
            &feed.url,
            Some("https://example.com/1"),
            Some("Local Article"),
        ),
        feed_id: feed.id.clone(),
        remote_id: Some("local-guid-1".to_string()),
        title: "Local Article".to_string(),
        content_raw: "old".to_string(),
        content_sanitized: "old".to_string(),
        sanitizer_version: sanitizer::SANITIZER_VERSION,
        summary: None,
        url: Some("https://example.com/1".to_string()),
        author: None,
        published_at: chrono::Utc::now() - chrono::Duration::days(2),
        thumbnail: None,
        is_read: false,
        is_starred: false,
        fetched_at: existing_fetched_at,
    };
    {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        article_repo.upsert(&[existing_article]).unwrap();
        sync_state_repo
            .save(&SyncState {
                account_id: account.id.clone(),
                scope_key: local_feed_scope_key(&feed.url).as_string(),
                timestamp_usec: None,
                continuation: None,
                etag: Some(LOCAL_ETAG_OLD.to_string()),
                last_modified: Some(LOCAL_LAST_MODIFIED_OLD.to_string()),
                last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
                last_error: Some("old error".to_string()),
                error_count: 3,
                next_retry_at: Some("2025-01-01T01:00:00Z".to_string()),
            })
            .unwrap();
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .unwrap();

    mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let articles = article_repo
        .find_by_feed(&feed.id, &Pagination::default())
        .unwrap();
    let state = sync_state_repo
        .get(&account.id, &local_feed_scope_key(&feed.url))
        .unwrap()
        .unwrap();

    assert_eq!(articles.len(), 1);
    assert_eq!(articles[0].title, "Local Article");
    assert_eq!(articles[0].fetched_at, existing_fetched_at);
    assert_eq!(state.etag.as_deref(), Some(LOCAL_ETAG_OLD));
    assert_eq!(
        state.last_modified.as_deref(),
        Some(LOCAL_LAST_MODIFIED_OLD)
    );
    assert_eq!(state.error_count, 0);
    assert_eq!(state.last_error, None);
    assert_eq!(state.next_retry_at, None);
    assert!(state.last_success_at.is_some());
}

#[tokio::test]
async fn sync_local_feed_repairs_mute_and_unread_count_on_not_modified() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .match_header("if-none-match", LOCAL_ETAG_OLD)
        .match_header("if-modified-since", LOCAL_LAST_MODIFIED_OLD)
        .with_status(304)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    let sibling_feed = test_local_feed(&account.id, &format!("{}/sibling.xml", server.url()));
    let mut existing_article = Article {
        id: ArticleId("local-muted-article".to_string()),
        feed_id: feed.id.clone(),
        remote_id: Some("local-guid-muted".to_string()),
        title: "Kindle Unlimited local".to_string(),
        content_raw: "old".to_string(),
        content_sanitized: "old".to_string(),
        sanitizer_version: sanitizer::SANITIZER_VERSION,
        summary: None,
        url: Some("https://example.com/muted".to_string()),
        author: None,
        published_at: chrono::Utc::now(),
        thumbnail: None,
        is_read: false,
        is_starred: false,
        fetched_at: chrono::Utc::now(),
    };
    existing_article.id = generate_entry_id(
        account.id.as_ref(),
        existing_article.remote_id.as_deref(),
        &feed.url,
        existing_article.url.as_deref(),
        Some(&existing_article.title),
    );
    let mut sibling_article = Article {
        id: ArticleId("local-muted-sibling-article".to_string()),
        feed_id: sibling_feed.id.clone(),
        remote_id: Some("local-guid-muted-sibling".to_string()),
        title: "Kindle Unlimited sibling local".to_string(),
        content_raw: "old".to_string(),
        content_sanitized: "old".to_string(),
        sanitizer_version: sanitizer::SANITIZER_VERSION,
        summary: None,
        url: Some("https://example.com/sibling-muted".to_string()),
        author: None,
        published_at: chrono::Utc::now(),
        thumbnail: None,
        is_read: false,
        is_starred: false,
        fetched_at: chrono::Utc::now(),
    };
    sibling_article.id = generate_entry_id(
        account.id.as_ref(),
        sibling_article.remote_id.as_deref(),
        &sibling_feed.url,
        sibling_article.url.as_deref(),
        Some(&sibling_article.title),
    );
    {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        feed_repo.save(&sibling_feed).unwrap();
        article_repo
            .upsert(&[existing_article.clone(), sibling_article.clone()])
            .unwrap();
        feed_repo.update_unread_count(&feed.id, 99).unwrap();
        feed_repo.update_unread_count(&sibling_feed.id, 77).unwrap();
        db_guard
            .writer()
            .execute(
                "INSERT INTO preferences (key, value) VALUES ('mute_auto_mark_read', 'true')",
                [],
            )
            .unwrap();
        db_guard
            .writer()
            .execute(
                "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?4)",
                rusqlite::params![
                    uuid::Uuid::new_v4().to_string(),
                    "kindle unlimited",
                    "title",
                    chrono::Utc::now().to_rfc3339()
                ],
            )
            .unwrap();
        sync_state_repo
            .save(&SyncState {
                account_id: account.id.clone(),
                scope_key: local_feed_scope_key(&feed.url).as_string(),
                timestamp_usec: None,
                continuation: None,
                etag: Some(LOCAL_ETAG_OLD.to_string()),
                last_modified: Some(LOCAL_LAST_MODIFIED_OLD.to_string()),
                last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
                last_error: None,
                error_count: 0,
                next_retry_at: None,
            })
            .unwrap();
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .unwrap();

    mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let article_is_read: bool = db_guard
        .reader()
        .query_row(
            "SELECT is_read FROM articles WHERE id = ?1",
            rusqlite::params![existing_article.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    let unread_count: i64 = db_guard
        .reader()
        .query_row(
            "SELECT unread_count FROM feeds WHERE id = ?1",
            rusqlite::params![feed.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    let sibling_article_is_read: bool = db_guard
        .reader()
        .query_row(
            "SELECT is_read FROM articles WHERE id = ?1",
            rusqlite::params![sibling_article.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();
    let sibling_unread_count: i64 = db_guard
        .reader()
        .query_row(
            "SELECT unread_count FROM feeds WHERE id = ?1",
            rusqlite::params![sibling_feed.id.as_ref()],
            |row| row.get(0),
        )
        .unwrap();

    assert!(article_is_read);
    assert_eq!(unread_count, 0);
    assert!(!sibling_article_is_read);
    assert_eq!(sibling_unread_count, 77);
}

#[tokio::test]
async fn sync_local_feed_clears_validators_when_server_does_not_support_them() {
    let mut server = mockito::Server::new_async().await;
    let feed_url = format!("{}/feed.xml", server.url());
    let mock = server
        .mock("GET", "/feed.xml")
        .match_header("if-none-match", LOCAL_ETAG_OLD)
        .match_header("if-modified-since", LOCAL_LAST_MODIFIED_OLD)
        .with_status(200)
        .with_header("content-type", "application/rss+xml")
        .with_body(LOCAL_RSS_UPDATED)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_local_account_and_feed(&db, &feed_url);
    {
        let db_guard = db.lock().unwrap();
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        sync_state_repo
            .save(&SyncState {
                account_id: account.id.clone(),
                scope_key: local_feed_scope_key(&feed.url).as_string(),
                timestamp_usec: None,
                continuation: None,
                etag: Some(LOCAL_ETAG_OLD.to_string()),
                last_modified: Some(LOCAL_LAST_MODIFIED_OLD.to_string()),
                last_success_at: Some("2025-01-01T00:00:00Z".to_string()),
                last_error: None,
                error_count: 0,
                next_retry_at: None,
            })
            .unwrap();
    }

    let provider = LocalProvider::new_allowing_private_feed_urls_for_tests();
    sync_local_feed(&db, &provider, &account.id, &feed)
        .await
        .unwrap();

    mock.assert_async().await;

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let sync_state_repo = SqliteSyncStateRepository::new(db_guard.reader());
    let articles = article_repo
        .find_by_feed(&feed.id, &Pagination::default())
        .unwrap();
    let state = sync_state_repo
        .get(&account.id, &local_feed_scope_key(&feed.url))
        .unwrap()
        .unwrap();

    assert_eq!(articles.len(), 1);
    assert_eq!(articles[0].title, "Local Article Updated");
    assert_eq!(state.etag, None);
    assert_eq!(state.last_modified, None);
    assert_eq!(state.error_count, 0);
    assert!(state.last_success_at.is_some());
}
