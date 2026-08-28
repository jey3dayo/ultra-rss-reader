use super::*;

#[test]
fn purge_old_read_keeps_unread_and_starred() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let cutoff = Utc::now();
    let old_time = cutoff - chrono::Duration::days(1);

    // Old read article (should be purged)
    let mut a1 = make_article(&feed_id, "Old Read");
    a1.is_read = true;
    a1.fetched_at = old_time;

    // Old unread article (should be kept)
    let mut a2 = make_article(&feed_id, "Old Unread");
    a2.is_read = false;
    a2.fetched_at = old_time;

    // Old starred read article (should be kept)
    let mut a3 = make_article(&feed_id, "Old Starred");
    a3.is_read = true;
    a3.is_starred = true;
    a3.fetched_at = old_time;

    // New read article (should be kept)
    let mut a4 = make_article(&feed_id, "New Read");
    a4.is_read = true;
    a4.fetched_at = cutoff + chrono::Duration::hours(1);

    repo.upsert(&[a1, a2, a3, a4]).unwrap();

    let deleted = repo.purge_old_read(&account_id, cutoff).unwrap();
    assert_eq!(deleted, 1);

    let remaining = repo
        .find_by_feed(
            &feed_id,
            &Pagination {
                offset: 0,
                limit: 100,
            },
        )
        .unwrap();
    assert_eq!(remaining.len(), 3);
}

#[test]
fn purge_old_read_keeps_latest_article_and_feed_summary_timestamp() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let cutoff = Utc::now();
    let old_time = cutoff - chrono::Duration::days(1);
    let latest_time = old_time + chrono::Duration::minutes(2);

    let mut older_read = make_article(&feed_id, "Older read");
    older_read.is_read = true;
    older_read.published_at = old_time;
    older_read.fetched_at = old_time;

    let mut latest_read = make_article(&feed_id, "Latest read");
    latest_read.is_read = true;
    latest_read.published_at = latest_time;
    latest_read.fetched_at = latest_time;

    repo.upsert(&[older_read, latest_read]).unwrap();

    let deleted = repo.purge_old_read(&account_id, cutoff).unwrap();

    assert_eq!(deleted, 1);
    let remaining = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
    assert_eq!(remaining.len(), 1);
    assert_eq!(remaining[0].title, "Latest read");

    let expected_latest_at = latest_time.to_rfc3339();
    let summary = repo
        .list_feed_article_summaries_by_account(&account_id)
        .unwrap()
        .into_iter()
        .find(|summary| summary.feed_id == feed_id)
        .expect("feed summary should remain after purging old articles");
    assert_eq!(
        summary.latest_article_at.as_deref(),
        Some(expected_latest_at.as_str())
    );
}

#[test]
fn purge_old_read_keeps_tagged_and_view_history_articles() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let cutoff = Utc::now();
    let old_time = cutoff - chrono::Duration::days(1);

    let mut plain_old_read = make_article(&feed_id, "Plain old read");
    plain_old_read.is_read = true;
    plain_old_read.published_at = old_time;
    plain_old_read.fetched_at = old_time;

    let mut tagged_old_read = make_article(&feed_id, "Tagged old read");
    tagged_old_read.is_read = true;
    tagged_old_read.published_at = old_time + chrono::Duration::minutes(1);
    tagged_old_read.fetched_at = old_time + chrono::Duration::minutes(1);

    let mut viewed_old_read = make_article(&feed_id, "Viewed old read");
    viewed_old_read.is_read = true;
    viewed_old_read.published_at = old_time + chrono::Duration::minutes(2);
    viewed_old_read.fetched_at = old_time + chrono::Duration::minutes(2);

    repo.upsert(&[
        plain_old_read.clone(),
        tagged_old_read.clone(),
        viewed_old_read.clone(),
    ])
    .unwrap();
    db.writer()
        .execute(
            "INSERT INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
            params!["tag-keep", "Keep", Option::<String>::None],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO article_tags (article_id, tag_id) VALUES (?1, ?2)",
            params![tagged_old_read.id.0, "tag-keep"],
        )
        .unwrap();
    repo.record_view(&account_id, &viewed_old_read.id).unwrap();

    let deleted = repo.purge_old_read(&account_id, cutoff).unwrap();

    assert_eq!(deleted, 1);
    let remaining_titles = repo
        .find_by_feed(
            &feed_id,
            &Pagination {
                offset: 0,
                limit: 10,
            },
        )
        .unwrap()
        .into_iter()
        .map(|article| article.title)
        .collect::<Vec<_>>();
    assert_eq!(remaining_titles, ["Viewed old read", "Tagged old read"]);
    assert_eq!(
        repo.find_recently_viewed_by_account(
            &account_id,
            &Pagination::default(),
            ArticleListMode::All
        )
        .unwrap()
        .len(),
        1
    );
}

#[test]
fn purge_old_read_is_scoped_to_account() {
    let db = test_db();
    let target_account_id = insert_test_account(&db);
    let other_account_id = insert_test_account(&db);
    let target_feed_id = insert_test_feed(&db, &target_account_id);
    let other_feed_id = insert_test_feed(&db, &other_account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let cutoff = Utc::now();
    let old_time = cutoff - chrono::Duration::days(1);

    let mut target_article = make_article(&target_feed_id, "Target Old Read");
    target_article.is_read = true;
    target_article.published_at = old_time;
    target_article.fetched_at = old_time;

    let mut target_latest_article = make_article(&target_feed_id, "Target Latest Read");
    target_latest_article.is_read = true;
    target_latest_article.published_at = old_time + chrono::Duration::minutes(1);
    target_latest_article.fetched_at = old_time + chrono::Duration::minutes(1);

    let mut other_article = make_article(&other_feed_id, "Other Old Read");
    other_article.is_read = true;
    other_article.fetched_at = old_time;

    repo.upsert(&[target_article, target_latest_article, other_article])
        .unwrap();

    let deleted = repo.purge_old_read(&target_account_id, cutoff).unwrap();
    assert_eq!(deleted, 1);

    let target_remaining = repo
        .find_by_feed(&target_feed_id, &Pagination::default())
        .unwrap();
    assert_eq!(target_remaining.len(), 1);
    assert_eq!(target_remaining[0].title, "Target Latest Read");

    let other_remaining = repo
        .find_by_feed(&other_feed_id, &Pagination::default())
        .unwrap();
    assert_eq!(other_remaining.len(), 1);
}

#[test]
fn update_sanitized_refreshes_search_text_and_version_for_old_article() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut a1 = make_article(&feed_id, "Article 1");
    a1.sanitizer_version = 1;
    let mut a2 = make_article(&feed_id, "Article 2");
    a2.sanitizer_version = 2;

    repo.upsert(&[a1.clone(), a2.clone()]).unwrap();

    let old = repo.find_by_sanitizer_version_below(2, 100).unwrap();
    assert_eq!(old.len(), 1);
    assert_eq!(old[0].id, a1.id);

    repo.update_sanitized(&a1.id, "<p>new <strong>sanitized</strong></p>", 2)
        .unwrap();

    let old = repo.find_by_sanitizer_version_below(2, 100).unwrap();
    assert_eq!(old.len(), 0);

    let (content_text, sanitizer_version): (String, u32) = db
        .writer()
        .query_row(
            "SELECT content_text, sanitizer_version FROM articles WHERE id = ?1",
            params![a1.id.0],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();

    assert_eq!(content_text, "new sanitized");
    assert_eq!(sanitizer_version, 2);

    let visible_text_results = repo
        .search(&account_id, "new", &Pagination::default())
        .unwrap();
    let html_tag_results = repo
        .search(&account_id, "strong", &Pagination::default())
        .unwrap();

    assert_eq!(visible_text_results.len(), 1);
    assert_eq!(visible_text_results[0].id, a1.id);
    assert!(
        html_tag_results.is_empty(),
        "sanitizer repair should refresh FTS from content_text, not sanitized HTML tags"
    );
}

#[test]
fn find_by_sanitizer_version_below_uses_deterministic_policy_then_oldest_batches() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());
    let base_time = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);

    let mut old_later = make_article(&feed_id, "Old later");
    old_later.id = ArticleId("old-later".to_string());
    old_later.sanitizer_version = 1;
    old_later.fetched_at = base_time + chrono::Duration::seconds(20);
    let mut older_same_time_b = make_article(&feed_id, "Older same time B");
    older_same_time_b.id = ArticleId("older-same-time-b".to_string());
    older_same_time_b.sanitizer_version = 0;
    older_same_time_b.fetched_at = base_time;
    let mut older_same_time_a = make_article(&feed_id, "Older same time A");
    older_same_time_a.id = ArticleId("older-same-time-a".to_string());
    older_same_time_a.sanitizer_version = 0;
    older_same_time_a.fetched_at = base_time;
    let mut current = make_article(&feed_id, "Current");
    current.id = ArticleId("current".to_string());
    current.sanitizer_version = 2;
    current.fetched_at = base_time - chrono::Duration::seconds(20);

    repo.upsert(&[
        old_later.clone(),
        older_same_time_b.clone(),
        current,
        older_same_time_a.clone(),
    ])
    .unwrap();

    let batch = repo.find_by_sanitizer_version_below(2, 2).unwrap();

    assert_eq!(
        batch
            .iter()
            .map(|article| article.id.0.as_str())
            .collect::<Vec<_>>(),
        vec!["older-same-time-a", "older-same-time-b"]
    );
}

#[test]
fn upsert_uses_summary_fallback_when_sanitized_html_is_empty() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut article = make_article(&feed_id, "Article 1");
    article.content_sanitized = "   ".to_string();
    article.summary = Some("Summary fallback body".to_string());

    repo.upsert(&[article.clone()]).unwrap();

    let content_text: String = db
        .writer()
        .query_row(
            "SELECT content_text FROM articles WHERE id = ?1",
            params![article.id.0],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(content_text, "Summary fallback body");
}

#[test]
fn upsert_extracts_search_text_from_sanitized_html_for_new_articles() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut article = make_article(&feed_id, "Article 1");
    article.content_sanitized = "<article><p>Lead <strong>body</article>Trailing".to_string();
    article.summary = Some("Summary fallback body".to_string());

    repo.upsert(&[article.clone()]).unwrap();

    let content_text: String = db
        .writer()
        .query_row(
            "SELECT content_text FROM articles WHERE id = ?1",
            params![article.id.0],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(content_text, "Lead body Trailing");
}

#[test]
fn update_sanitized_preserves_summary_fallback_when_sanitized_html_is_empty() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut article = make_article(&feed_id, "Article 1");
    article.summary = Some("Existing summary body".to_string());
    repo.upsert(&[article.clone()]).unwrap();

    repo.update_sanitized(&article.id, "", 2).unwrap();

    let content_text: String = db
        .writer()
        .query_row(
            "SELECT content_text FROM articles WHERE id = ?1",
            params![article.id.0],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(content_text, "Existing summary body");
}
