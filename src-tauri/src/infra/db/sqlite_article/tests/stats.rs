use super::*;

/// Uses an injected `now` instead of the real clock so results are
/// deterministic regardless of when the suite runs.
#[test]
fn future_dated_article_is_excluded_from_latest_but_still_counted() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let now: DateTime<Utc> = "2026-09-25T00:00:00Z".parse().unwrap();
    let past: DateTime<Utc> = "2026-09-20T00:00:00Z".parse().unwrap();
    let future: DateTime<Utc> = "2026-10-01T00:00:00Z".parse().unwrap();

    let mut past_article = make_article(&feed_id, "Past Article");
    past_article.published_at = past;
    past_article.fetched_at = past;
    let mut future_article = make_article(&feed_id, "Future Article");
    future_article.published_at = future;
    future_article.fetched_at = future;
    repo.upsert(&[past_article, future_article]).unwrap();

    let stats = repo
        .feed_article_stats_by_account(&account_id, now)
        .unwrap();
    let feed_stats = stats.get(&feed_id).expect("feed should have stats");
    assert_eq!(
        feed_stats.article_count, 2,
        "article_count must still include the future-dated row"
    );
    assert_eq!(
        feed_stats.latest_published_at,
        Some(past),
        "the future-dated article must not become latest_published_at"
    );

    let recent_dates = repo
        .latest_published_ats_by_feed(&feed_id, 20, now)
        .unwrap();
    assert_eq!(
        recent_dates,
        vec![past],
        "latest_published_ats_by_feed must exclude the future-dated row entirely"
    );
}
