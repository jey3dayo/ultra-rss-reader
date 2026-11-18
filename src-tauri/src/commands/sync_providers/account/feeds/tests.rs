use super::*;
use crate::commands::sync_providers::tests::{
    authenticated_provider, insert_account_and_feed, test_db,
};
use crate::domain::article::Article;
use crate::domain::types::ArticleId;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::repository::feed::FeedRepository;

const PROBE_PATH: &str =
    "/api/greader.php/reader/api/0/stream/contents/feed%2Fhttps%3A%2F%2Fexample.com%2Frss";

fn mock_last_seen_probe(server: &mut mockito::ServerGuard) -> mockito::Mock {
    server
        .mock("GET", PROBE_PATH)
        .match_query(mockito::Matcher::UrlEncoded("n".into(), "1".into()))
}

fn last_seen_article_at(db: &Mutex<DbManager>, feed: &Feed) -> Option<String> {
    db.lock()
        .unwrap()
        .reader()
        .query_row(
            "SELECT last_seen_article_at FROM feeds WHERE id = ?1",
            [&feed.id.0],
            |row| row.get(0),
        )
        .unwrap()
}

async fn probe_provider(server: &mut mockito::ServerGuard) -> GReaderProvider {
    server
        .mock("POST", "/api/greader.php/accounts/ClientLogin")
        .with_status(200)
        .with_body("Auth=tok\n")
        .create_async()
        .await;
    authenticated_provider(&server.url()).await
}

#[tokio::test]
async fn last_seen_probe_success_without_publication_time_is_not_repeated() {
    for body in [
        r#"{"items": []}"#,
        r#"{"items": [{"id": "undated", "published": null, "updated": null}]}"#,
        r#"{"items": [{"id": "invalid-date", "published": 9223372036854775807}]}"#,
    ] {
        let mut server = mockito::Server::new_async().await;
        let provider = probe_provider(&mut server).await;
        let probe = mock_last_seen_probe(&mut server)
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(body)
            .expect(1)
            .create_async()
            .await;
        let db = test_db();
        let (account, feed) = insert_account_and_feed(&db, &server.url());

        backfill_missing_greader_last_seen(&db, &provider, &account, std::slice::from_ref(&feed))
            .await;
        assert_eq!(last_seen_article_at(&db, &feed), None);
        {
            let guard = db.lock().unwrap();
            SqliteFeedRepository::new(guard.writer())
                .save(&feed)
                .expect("subscription metadata update should preserve completed recovery");
        }
        backfill_missing_greader_last_seen(&db, &provider, &account, std::slice::from_ref(&feed))
            .await;

        probe.assert_async().await;
        assert!(load_feed_ids_missing_last_seen(&db, &account.id)
            .unwrap()
            .is_empty());
    }
}

#[tokio::test]
async fn last_seen_probe_failure_retries_until_a_successful_response() {
    let mut server = mockito::Server::new_async().await;
    let provider = probe_provider(&mut server).await;
    let failure = mock_last_seen_probe(&mut server)
        .with_status(500)
        .expect(1)
        .create_async()
        .await;
    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, &server.url());

    backfill_missing_greader_last_seen(&db, &provider, &account, std::slice::from_ref(&feed)).await;

    failure.assert_async().await;
    assert_eq!(
        load_feed_ids_missing_last_seen(&db, &account.id).unwrap(),
        vec![feed.id.clone()]
    );
    failure.remove_async().await;
    let recovery = mock_last_seen_probe(&mut server)
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(r#"{"items": []}"#)
        .expect(1)
        .create_async()
        .await;

    backfill_missing_greader_last_seen(&db, &provider, &account, std::slice::from_ref(&feed)).await;
    backfill_missing_greader_last_seen(&db, &provider, &account, std::slice::from_ref(&feed)).await;

    recovery.assert_async().await;
    assert_eq!(last_seen_article_at(&db, &feed), None);
    assert!(load_feed_ids_missing_last_seen(&db, &account.id)
        .unwrap()
        .is_empty());
}

#[tokio::test]
async fn last_seen_probe_completion_allows_regular_article_sync_to_record_activity() {
    let mut server = mockito::Server::new_async().await;
    let provider = probe_provider(&mut server).await;
    let probe = mock_last_seen_probe(&mut server)
        .with_status(200)
        .with_header("content-type", "application/json")
        .with_body(r#"{"items": []}"#)
        .expect(1)
        .create_async()
        .await;
    let db = test_db();
    let (account, feed) = insert_account_and_feed(&db, &server.url());
    backfill_missing_greader_last_seen(&db, &provider, &account, std::slice::from_ref(&feed)).await;
    probe.assert_async().await;
    assert!(load_feed_ids_missing_last_seen(&db, &account.id)
        .unwrap()
        .is_empty());
    let published_at = chrono::DateTime::parse_from_rfc3339("2026-11-18T00:00:00Z")
        .unwrap()
        .with_timezone(&chrono::Utc);
    let article = Article {
        id: ArticleId("new-article".to_string()),
        feed_id: feed.id.clone(),
        remote_id: Some("new-article".to_string()),
        title: "New article".to_string(),
        content_raw: String::new(),
        content_sanitized: String::new(),
        sanitizer_version: 0,
        summary: None,
        url: Some("https://example.com/new".to_string()),
        author: None,
        published_at,
        thumbnail: None,
        is_read: false,
        is_starred: false,
        fetched_at: published_at,
    };

    super::super::db::persist_pulled_feed_articles(&db, &account.id, &[article])
        .expect("regular article sync should persist activity after completed recovery");

    assert_eq!(
        last_seen_article_at(&db, &feed),
        Some(published_at.to_rfc3339())
    );
}
