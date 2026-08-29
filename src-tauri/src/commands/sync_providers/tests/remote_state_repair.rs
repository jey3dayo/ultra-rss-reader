use super::*;

#[tokio::test]
async fn repair_greader_remote_state_applies_read_flags_and_recalculates_counts() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
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
        .with_status(200)
        .with_body(r#"{ "itemRefs": [{ "id": "1" }] }"#)
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
        .with_status(200)
        .with_body(r#"{ "itemRefs": [] }"#)
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
        .with_body(format!(
            r#"{{ "unreadcounts": [{{ "id": "{FEED_REMOTE_ID}", "count": 0 }}] }}"#
        ))
        .create_async()
        .await;
    server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/stream/contents/feed%2Fhttps%3A%2F%2Fexample.com%2Frss",
        )
        .match_query(Matcher::UrlEncoded(
            "xt".into(),
            "user/-/state/com.google/read".into(),
        ))
        .with_status(200)
        .with_body(r#"{ "items": [] }"#)
        .expect(2)
        .create_async()
        .await;

    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, &server.url());
    {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        let article = Article {
            id: generate_entry_id(
                account.id.as_ref(),
                Some("tag:google.com,2005:reader/item/0000000000000001"),
                &feed.url,
                Some("https://example.com/1"),
                Some("Example Article"),
            ),
            feed_id: feed.id.clone(),
            remote_id: Some("tag:google.com,2005:reader/item/0000000000000001".to_string()),
            title: "Example Article".to_string(),
            content_raw: "body".to_string(),
            content_sanitized: "body".to_string(),
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
        article_repo.upsert(&[article]).unwrap();
        feed_repo.update_unread_count(&feed.id, 1).unwrap();
    }

    let _credentials = configure_dev_credentials(&account.id).await;

    let session = authenticated_session(&server.url()).await;
    repair_greader_remote_state(&db, &account, &session)
        .await
        .unwrap();

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
    let articles = article_repo
        .find_by_feed(&feed.id, &Pagination::default())
        .unwrap();
    let repaired_feed = feed_repo.find_by_id(&feed.id).unwrap().unwrap();

    assert_eq!(articles.len(), 1);
    assert!(articles[0].is_read);
    assert_eq!(repaired_feed.unread_count, 0);
}

#[tokio::test]
async fn repair_greader_remote_state_keeps_article_marked_read_during_pull_state() {
    let mut server = mockito::Server::new_async().await;
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;

    let db = std::sync::Arc::new(test_db());
    let (account, feed) = insert_account_and_feed(&db, &server.url());
    let remote_entry_id = "tag:google.com,2005:reader/item/0000000000000002".to_string();
    let article_id = generate_entry_id(
        account.id.as_ref(),
        Some(&remote_entry_id),
        &feed.url,
        Some("https://example.com/2"),
        Some("Read During Pull"),
    );
    {
        let db_guard = db.lock().unwrap();
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let article = Article {
            id: article_id.clone(),
            feed_id: feed.id.clone(),
            remote_id: Some(remote_entry_id.clone()),
            title: "Read During Pull".to_string(),
            content_raw: "body".to_string(),
            content_sanitized: "body".to_string(),
            sanitizer_version: sanitizer::SANITIZER_VERSION,
            summary: None,
            url: Some("https://example.com/2".to_string()),
            author: None,
            published_at: chrono::Utc::now(),
            thumbnail: None,
            is_read: false,
            is_starred: false,
            fetched_at: chrono::Utc::now(),
        };
        article_repo.upsert(&[article]).unwrap();
    }

    // Remote still reports the article as unread. While the read-ids
    // stream response is being produced (mid pull_state), the user marks
    // the article read locally, queueing a pending mutation.
    let mark_read_db = std::sync::Arc::clone(&db);
    let mark_read_account_id = account.id.clone();
    let mark_read_article_id = article_id.clone();
    let mark_read_remote_entry_id = remote_entry_id.clone();
    server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/read".into()),
        ]))
        .with_status(200)
        .with_body_from_request(move |_| {
            let db_guard = mark_read_db.lock().unwrap();
            db_guard
                .writer()
                .execute(
                    "UPDATE articles SET is_read = 1 WHERE id = ?1",
                    rusqlite::params![mark_read_article_id.0],
                )
                .unwrap();
            let pending_repo = SqlitePendingMutationRepository::new(db_guard.writer());
            pending_repo
                .save(&PendingMutation {
                    id: None,
                    account_id: mark_read_account_id.clone(),
                    mutation_type: PendingMutationType::MarkRead,
                    remote_entry_id: mark_read_remote_entry_id.clone(),
                    created_at: chrono::Utc::now().to_rfc3339(),
                })
                .unwrap();
            br#"{ "itemRefs": [] }"#.to_vec()
        })
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/stream/items/ids")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("s".into(), "user/-/state/com.google/starred".into()),
        ]))
        .with_status(200)
        .with_body(r#"{ "itemRefs": [] }"#)
        .create_async()
        .await;

    server
        .mock("GET", "/api/greader.php/reader/api/0/unread-count")
        .match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("output".into(), "json".into()),
            Matcher::UrlEncoded("all".into(), "true".into()),
        ]))
        .with_status(200)
        .with_body(format!(
            r#"{{ "unreadcounts": [{{ "id": "{FEED_REMOTE_ID}", "count": 0 }}] }}"#
        ))
        .create_async()
        .await;
    server
        .mock(
            "GET",
            "/api/greader.php/reader/api/0/stream/contents/feed%2Fhttps%3A%2F%2Fexample.com%2Frss",
        )
        .match_query(Matcher::UrlEncoded(
            "xt".into(),
            "user/-/state/com.google/read".into(),
        ))
        .with_status(200)
        .with_body(r#"{ "items": [] }"#)
        .expect(2)
        .create_async()
        .await;

    let _credentials = configure_dev_credentials(&account.id).await;

    let session = authenticated_session(&server.url()).await;
    repair_greader_remote_state(&db, &account, &session)
        .await
        .unwrap();

    let db_guard = db.lock().unwrap();
    let article_repo = SqliteArticleRepository::new(db_guard.reader());
    let articles = article_repo
        .find_by_feed(&feed.id, &Pagination::default())
        .unwrap();
    assert_eq!(articles.len(), 1);
    assert!(
        articles[0].is_read,
        "a read marked during pull_state should stay read after apply_remote_state"
    );
}
