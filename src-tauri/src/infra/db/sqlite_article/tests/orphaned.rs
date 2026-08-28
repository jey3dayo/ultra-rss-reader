use super::*;

#[test]
fn count_orphaned_articles_detects_missing_feed_references() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    repo.upsert(&[make_article(&feed_id, "Healthy Article")])
        .unwrap();

    db.writer()
        .execute_batch("PRAGMA foreign_keys = OFF;")
        .unwrap();
    db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, summary, url, author, published_at, thumbnail, is_read, is_starred, fetched_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                params![
                    "orphan-article",
                    "missing-feed",
                    Option::<String>::None,
                    "Broken Article",
                    "",
                    "",
                    1,
                    Option::<String>::None,
                    Option::<String>::None,
                    Option::<String>::None,
                    "2026-04-01T00:00:00Z",
                    Option::<String>::None,
                    false,
                    false,
                    "2026-04-01T00:00:00Z"
                ],
            )
            .unwrap();
    db.writer()
        .execute_batch("PRAGMA foreign_keys = ON;")
        .unwrap();

    assert_eq!(repo.count_orphaned_articles().unwrap(), 1);
}

#[test]
fn list_orphaned_feed_groups_returns_grouped_details() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    repo.upsert(&[make_article(&feed_id, "Healthy Article")])
        .unwrap();

    db.writer()
        .execute_batch("PRAGMA foreign_keys = OFF;")
        .unwrap();
    db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, summary, url, author, published_at, thumbnail, is_read, is_starred, fetched_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                params![
                    "orphan-article-1",
                    "missing-feed",
                    Option::<String>::None,
                    "Broken Latest",
                    "",
                    "",
                    1,
                    Option::<String>::None,
                    Option::<String>::None,
                    Option::<String>::None,
                    "2026-04-02T00:00:00Z",
                    Option::<String>::None,
                    false,
                    false,
                    "2026-04-02T00:00:00Z"
                ],
            )
            .unwrap();
    db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, summary, url, author, published_at, thumbnail, is_read, is_starred, fetched_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                params![
                    "orphan-article-2",
                    "missing-feed",
                    Option::<String>::None,
                    "Broken Older",
                    "",
                    "",
                    1,
                    Option::<String>::None,
                    Option::<String>::None,
                    Option::<String>::None,
                    "2026-04-01T00:00:00Z",
                    Option::<String>::None,
                    false,
                    false,
                    "2026-04-01T00:00:00Z"
                ],
            )
            .unwrap();
    db.writer()
        .execute_batch("PRAGMA foreign_keys = ON;")
        .unwrap();

    let groups = repo.list_orphaned_feed_groups().unwrap();

    assert_eq!(
        groups,
        vec![OrphanedFeedGroup {
            missing_feed_id: "missing-feed".to_string(),
            article_count: 2,
            latest_article_title: Some("Broken Latest".to_string()),
            latest_article_published_at: Some("2026-04-02T00:00:00Z".to_string()),
        }]
    );
}

#[test]
fn delete_orphaned_articles_removes_only_missing_feed_references() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    repo.upsert(&[make_article(&feed_id, "Healthy Article")])
        .unwrap();

    db.writer()
        .execute_batch("PRAGMA foreign_keys = OFF;")
        .unwrap();
    db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, summary, url, author, published_at, thumbnail, is_read, is_starred, fetched_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                params![
                    "orphan-article",
                    "missing-feed",
                    Option::<String>::None,
                    "Broken Article",
                    "",
                    "",
                    1,
                    Option::<String>::None,
                    Option::<String>::None,
                    Option::<String>::None,
                    "2026-04-01T00:00:00Z",
                    Option::<String>::None,
                    false,
                    false,
                    "2026-04-01T00:00:00Z"
                ],
            )
            .unwrap();
    db.writer()
        .execute_batch("PRAGMA foreign_keys = ON;")
        .unwrap();

    assert_eq!(repo.delete_orphaned_articles().unwrap(), 1);
    assert_eq!(repo.count_orphaned_articles().unwrap(), 0);
    assert_eq!(
        repo.find_by_feed(&feed_id, &Pagination::default())
            .unwrap()
            .len(),
        1
    );
}
