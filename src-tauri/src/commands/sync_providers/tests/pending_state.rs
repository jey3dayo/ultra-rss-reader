use super::*;

#[tokio::test]
async fn sync_greader_account_skips_pull_state_when_recent_remote_state_sync_exists() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/tag/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "tags": [] }"#)
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/subscription/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(
            r#"{
                    "subscriptions": [
                        {
                            "id": "feed/https://example.com/feed-1.xml",
                            "title": "Feed One",
                            "url": "https://example.com/feed-1.xml",
                            "htmlUrl": "https://example.com/one",
                            "categories": []
                        }
                    ]
                }"#,
        )
        .create_async()
        .await;

    server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/user%2F-%2Fstate%2Fcom.google%2Freading-list",
            )
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "200".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_status(200)
            .with_body(r#"{ "items": [] }"#)
            .create_async()
            .await;

    let pull_state_read_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("n".into(), "10000".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/read".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .expect(0)
        .create_async()
        .await;
    let pull_state_starred_mock = server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("n".into(), "10000".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/starred".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .expect(0)
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/unread-count")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("all".into(), "true".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_status(200)
        .with_body(r#"{ "unreadcounts": [] }"#)
        .create_async()
        .await;

    let db = test_db();
    let (account, _feeds) = insert_account_and_feeds(
        &db,
        &server.url(),
        &[(
            "feed/https://example.com/feed-1.xml",
            "Feed One",
            "https://example.com/feed-1.xml",
            "https://example.com/one",
        )],
    );
    {
        let db_guard = db.lock().unwrap();
        let sync_state_repo = SqliteSyncStateRepository::new(db_guard.writer());
        sync_state_repo
            .save(&SyncState {
                account_id: account.id.clone(),
                scope_key: SyncStateScopeKey::greader_remote_state_full().as_string(),
                timestamp_usec: Some(chrono::Utc::now().timestamp_micros()),
                continuation: None,
                etag: None,
                last_modified: None,
                last_success_at: Some(chrono::Utc::now().to_rfc3339()),
                last_error: None,
                error_count: 0,
                next_retry_at: None,
            })
            .unwrap();
    }
    let _credentials = configure_dev_credentials(&account.id).await;

    let session = authenticated_session(&server.url()).await;
    sync_greader_account(&db, &account, &session).await.unwrap();

    pull_state_read_mock.assert_async().await;
    pull_state_starred_mock.assert_async().await;
}

#[tokio::test]
async fn sync_greader_account_guards_pushed_and_retrying_pending_state() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_provider_response(ProviderHttpResponseFixture::auth_token())
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/tag/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::json(r#"{ "tags": [] }"#))
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/subscription/list")
        .match_query(Matcher::UrlEncoded("output".into(), "json".into()))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::json(
            r#"{
                    "subscriptions": [
                        {
                            "id": "feed/https://example.com/feed-1.xml",
                            "title": "Feed One",
                            "url": "https://example.com/feed-1.xml",
                            "htmlUrl": "https://example.com/one",
                            "categories": []
                        }
                    ]
                }"#,
        ))
        .create_async()
        .await;

    server
            .mock(
                "GET",
                "/api/greader.php/reader/api/0/stream/contents/user%2F-%2Fstate%2Fcom.google%2Freading-list",
            )
            .match_query(Matcher::AllOf(vec![
                Matcher::UrlEncoded("output".into(), "json".into()),
                Matcher::UrlEncoded("n".into(), "200".into()),
            ]))
            .match_header("Authorization", "GoogleLogin auth=tok")
            .with_provider_response(ProviderHttpResponseFixture::json(r#"{ "items": [] }"#))
            .create_async()
            .await;

    let pushed_mutation_mock = server
        .mock("POST", "/api/greader.php/reader/api/0/edit-tag")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .match_body("i=entry-pushed&a=user%2F-%2Fstate%2Fcom.google%2Fread")
        .with_status(200)
        .with_body("OK")
        .create_async()
        .await;
    let retry_mutation_mock = server
        .mock("POST", "/api/greader.php/reader/api/0/edit-tag")
        .match_header("Authorization", "GoogleLogin auth=tok")
        .match_body("i=entry-retry&a=user%2F-%2Fstate%2Fcom.google%2Fread")
        .with_status(500)
        .with_body("failed")
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("n".into(), "10000".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/read".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::empty_item_refs())
        .create_async()
        .await;
    server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("n".into(), "10000".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/starred".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::empty_item_refs())
        .create_async()
        .await;
    server
        .mock("GET", "/api/greader.php/reader/api/0/unread-count")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("all".into(), "true".into()),
        ]))
        .match_header("Authorization", "GoogleLogin auth=tok")
        .with_provider_response(ProviderHttpResponseFixture::json(
            r#"{ "unreadcounts": [{ "id": "feed/https://example.com/feed-1.xml", "count": 0 }] }"#,
        ))
        .create_async()
        .await;

    let db = test_db();
    let (account, feeds) = insert_account_and_feeds(
        &db,
        &server.url(),
        &[(
            "feed/https://example.com/feed-1.xml",
            "Feed One",
            "https://example.com/feed-1.xml",
            "https://example.com/one",
        )],
    );
    {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let pending_repo = SqlitePendingMutationRepository::new(db_guard.writer());
        let now = chrono::Utc::now();
        article_repo
            .upsert(&[
                Article {
                    id: ArticleId("article-pushed".to_string()),
                    feed_id: feeds[0].id.clone(),
                    remote_id: Some("entry-pushed".to_string()),
                    title: "Pushed".to_string(),
                    content_raw: "<p>Pushed</p>".to_string(),
                    content_sanitized: "<p>Pushed</p>".to_string(),
                    sanitizer_version: sanitizer::SANITIZER_VERSION,
                    summary: None,
                    url: Some("https://example.com/pushed".to_string()),
                    author: None,
                    published_at: now,
                    thumbnail: None,
                    is_read: true,
                    is_starred: false,
                    fetched_at: now,
                },
                Article {
                    id: ArticleId("article-retry".to_string()),
                    feed_id: feeds[0].id.clone(),
                    remote_id: Some("entry-retry".to_string()),
                    title: "Retry".to_string(),
                    content_raw: "<p>Retry</p>".to_string(),
                    content_sanitized: "<p>Retry</p>".to_string(),
                    sanitizer_version: sanitizer::SANITIZER_VERSION,
                    summary: None,
                    url: Some("https://example.com/retry".to_string()),
                    author: None,
                    published_at: now,
                    thumbnail: None,
                    is_read: true,
                    is_starred: false,
                    fetched_at: now,
                },
            ])
            .unwrap();
        pending_repo
            .save(&PendingMutation {
                id: None,
                account_id: account.id.clone(),
                mutation_type: PendingMutationType::MarkRead,
                remote_entry_id: "entry-pushed".to_string(),
                created_at: "2026-05-23T00:00:00Z".to_string(),
            })
            .unwrap();
        pending_repo
            .save(&PendingMutation {
                id: None,
                account_id: account.id.clone(),
                mutation_type: PendingMutationType::MarkRead,
                remote_entry_id: "entry-retry".to_string(),
                created_at: "2026-05-23T00:00:01Z".to_string(),
            })
            .unwrap();
    }
    let _credentials = configure_dev_credentials(&account.id).await;

    let session = authenticated_session(&server.url()).await;
    let outcome = sync_greader_account(&db, &account, &session).await.unwrap();

    pushed_mutation_mock.assert_async().await;
    retry_mutation_mock.assert_async().await;
    assert_eq!(outcome.warnings.len(), 1);
    assert_eq!(
        outcome.warnings[0].kind,
        AccountSyncWarningKind::RetryPending
    );

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let pending_repo = SqlitePendingMutationRepository::new(db_guard.reader());
    let saved_articles = article_repo
        .find_by_feed(
            &feeds[0].id,
            &Pagination {
                offset: 0,
                limit: 10,
            },
        )
        .unwrap();
    let read_by_remote_id = saved_articles
        .iter()
        .filter_map(|article| {
            article
                .remote_id
                .as_ref()
                .map(|remote_id| (remote_id.as_str(), article.is_read))
        })
        .collect::<HashMap<_, _>>();
    assert_eq!(read_by_remote_id.get("entry-pushed"), Some(&true));
    assert_eq!(read_by_remote_id.get("entry-retry"), Some(&true));

    let pending = pending_repo.find_by_account(&account.id).unwrap();
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].remote_entry_id, "entry-retry");
}
