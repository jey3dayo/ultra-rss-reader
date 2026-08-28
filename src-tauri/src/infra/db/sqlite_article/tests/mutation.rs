use super::*;

#[test]
fn upsert_persists_article_time_fields_as_utc_rfc3339() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut article = make_article(&feed_id, "Offset article");
    article.published_at = DateTime::parse_from_rfc3339("2026-05-10T23:30:00+09:00")
        .unwrap()
        .with_timezone(&Utc);
    article.fetched_at = DateTime::parse_from_rfc3339("2026-05-11T00:30:00+09:00")
        .unwrap()
        .with_timezone(&Utc);

    repo.upsert(&[article.clone()]).unwrap();

    let (published_at, fetched_at): (String, String) = db
        .reader()
        .query_row(
            "SELECT published_at, fetched_at FROM articles WHERE id = ?1",
            params![article.id.0],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();
    assert_eq!(published_at, "2026-05-10T14:30:00+00:00");
    assert_eq!(fetched_at, "2026-05-10T15:30:00+00:00");
    assert_utc_rfc3339(&published_at);
    assert_utc_rfc3339(&fetched_at);
}

#[test]
fn upsert_articles_with_conn_does_not_open_its_own_transaction() {
    // upsert_articles_with_conn is shared by SqliteArticleRepository::upsert
    // (own unchecked_transaction) and local sync (rides the caller's existing
    // transaction). Proving it neither commits nor starts a nested
    // transaction here is what makes both callers' transaction boundaries safe.
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);

    // (a) committing the caller's transaction makes the upsert visible.
    let committed_article = make_article(&feed_id, "Committed via caller tx");
    {
        let tx = db.writer().unchecked_transaction().unwrap();
        upsert_articles_with_conn(&tx, std::slice::from_ref(&committed_article)).unwrap();
        tx.commit().unwrap();
    }
    let committed_count: i64 = db
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE id = ?1",
            params![committed_article.id.0],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(committed_count, 1);

    // (b) rolling back the caller's transaction discards the upsert.
    let rolled_back_article = make_article(&feed_id, "Rolled back via caller tx");
    {
        let tx = db.writer().unchecked_transaction().unwrap();
        upsert_articles_with_conn(&tx, std::slice::from_ref(&rolled_back_article)).unwrap();
        tx.rollback().unwrap();
    }
    let rolled_back_count: i64 = db
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM articles WHERE id = ?1",
            params![rolled_back_article.id.0],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(rolled_back_count, 0);
}

#[test]
fn upsert_inserts_provided_published_at_on_first_insert() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut article = make_article(&feed_id, "First insert article");
    article.published_at = DateTime::parse_from_rfc3339("2026-01-01T00:00:00+00:00")
        .unwrap()
        .with_timezone(&Utc);

    repo.upsert(std::slice::from_ref(&article)).unwrap();

    let published_at: String = db
        .reader()
        .query_row(
            "SELECT published_at FROM articles WHERE id = ?1",
            params![article.id.0],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(published_at, "2026-01-01T00:00:00+00:00");
}

#[test]
fn upsert_preserves_older_published_at_on_update() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut article = make_article(&feed_id, "Preserve on re-sync");
    let t1 = DateTime::parse_from_rfc3339("2026-01-01T00:00:00+00:00")
        .unwrap()
        .with_timezone(&Utc);
    article.published_at = t1;
    repo.upsert(std::slice::from_ref(&article)).unwrap();

    // Re-sync synthesizes a newer published_at (e.g. now()) for the same id.
    let t2 = DateTime::parse_from_rfc3339("2026-06-01T00:00:00+00:00")
        .unwrap()
        .with_timezone(&Utc);
    article.published_at = t2;
    repo.upsert(std::slice::from_ref(&article)).unwrap();

    let published_at: String = db
        .reader()
        .query_row(
            "SELECT published_at FROM articles WHERE id = ?1",
            params![article.id.0],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        published_at, "2026-01-01T00:00:00+00:00",
        "existing older published_at should be preserved across re-sync"
    );
}

#[test]
fn upsert_accepts_older_real_published_at_on_update() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut article = make_article(&feed_id, "Accept real date");
    let t2 = DateTime::parse_from_rfc3339("2026-06-01T00:00:00+00:00")
        .unwrap()
        .with_timezone(&Utc);
    article.published_at = t2;
    repo.upsert(std::slice::from_ref(&article)).unwrap();

    // Later sync delivers the real (older) publish date once the feed provides one.
    let t1 = DateTime::parse_from_rfc3339("2026-01-01T00:00:00+00:00")
        .unwrap()
        .with_timezone(&Utc);
    article.published_at = t1;
    repo.upsert(std::slice::from_ref(&article)).unwrap();

    let published_at: String = db
        .reader()
        .query_row(
            "SELECT published_at FROM articles WHERE id = ?1",
            params![article.id.0],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(
        published_at, "2026-01-01T00:00:00+00:00",
        "an older real published_at delivered later should replace the synthesized value"
    );
}

#[test]
fn raw_insert_normalizes_article_account_id_from_feed() {
    let db = test_db();
    let target_account_id = insert_test_account(&db);
    let other_account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &target_account_id);

    db.writer()
        .execute(
            "INSERT INTO articles (
                    id, account_id, feed_id, title, published_at, fetched_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                "raw-account-mismatch",
                other_account_id.0,
                feed_id.0,
                "Raw mismatch",
                "2026-06-17T00:00:00Z",
                "2026-06-17T00:00:00Z"
            ],
        )
        .unwrap();

    let stored_account_id: String = db
        .reader()
        .query_row(
            "SELECT account_id FROM articles WHERE id = ?1",
            params!["raw-account-mismatch"],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(stored_account_id, target_account_id.0);

    let repo = SqliteArticleRepository::new(db.reader());
    assert!(repo
        .find_by_account(&other_account_id, &Pagination::default())
        .unwrap()
        .is_empty());
    assert_eq!(
        repo.find_by_account(&target_account_id, &Pagination::default())
            .unwrap()
            .len(),
        1
    );
}

#[test]
fn feed_account_update_syncs_denormalized_article_account_ids() {
    let db = test_db();
    let original_account_id = insert_test_account(&db);
    let next_account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &original_account_id);
    let repo = SqliteArticleRepository::new(db.writer());
    let article = make_article(&feed_id, "Moved feed article");
    repo.upsert(std::slice::from_ref(&article)).unwrap();

    db.writer()
        .execute(
            "UPDATE feeds SET account_id = ?1 WHERE id = ?2",
            params![next_account_id.0, feed_id.0],
        )
        .unwrap();

    let stored_account_id: String = db
        .reader()
        .query_row(
            "SELECT account_id FROM articles WHERE id = ?1",
            params![article.id.0],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(stored_account_id, next_account_id.0);
}

#[test]
fn upsert_inserts_new_article() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let article = make_article(&feed_id, "New Article");
    repo.upsert(std::slice::from_ref(&article)).unwrap();

    let found = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].title, "New Article");
}

#[test]
fn find_by_feed_returns_decode_error_for_malformed_published_at() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let article = make_article(&feed_id, "Malformed date article");
    repo.upsert(std::slice::from_ref(&article)).unwrap();
    db.writer()
        .execute(
            "UPDATE articles SET published_at = ?1 WHERE id = ?2",
            params!["not-a-date", article.id.0],
        )
        .unwrap();

    let result = repo.find_by_feed(&feed_id, &Pagination::default());

    assert!(result.is_err());
}

#[test]
fn find_by_feed_returns_decode_error_for_malformed_fetched_at() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let article = make_article(&feed_id, "Malformed fetched date article");
    repo.upsert(std::slice::from_ref(&article)).unwrap();
    db.writer()
        .execute(
            "UPDATE articles SET fetched_at = ?1 WHERE id = ?2",
            params!["not-a-date", article.id.0],
        )
        .unwrap();

    let result = repo.find_by_feed(&feed_id, &Pagination::default());

    assert!(result.is_err());
}

#[test]
fn upsert_preserves_is_read_and_is_starred() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut article = make_article(&feed_id, "Article");
    article.is_read = false;
    article.is_starred = false;
    repo.upsert(std::slice::from_ref(&article)).unwrap();

    // Mark as read and starred
    repo.mark_as_read(&article.id, true).unwrap();
    repo.mark_as_starred(&article.id, true).unwrap();

    // Upsert again with is_read=false, is_starred=false in the input
    article.title = "Updated Title".to_string();
    article.content_raw = "updated raw content".to_string();
    article.content_sanitized = "<p>Updated sanitized content</p>".to_string();
    article.is_read = false;
    article.is_starred = false;
    repo.upsert(std::slice::from_ref(&article)).unwrap();

    let found = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
    assert_eq!(found[0].title, "Updated Title");
    assert_eq!(found[0].content_raw, "updated raw content");
    assert_eq!(
        found[0].content_sanitized,
        "<p>Updated sanitized content</p>"
    );
    // is_read and is_starred should be preserved from the DB
    assert!(found[0].is_read);
    assert!(found[0].is_starred);
}

#[test]
fn mark_as_read_and_starred() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let article = make_article(&feed_id, "Article");
    repo.upsert(std::slice::from_ref(&article)).unwrap();

    repo.mark_as_read(&article.id, true).unwrap();
    let found = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
    assert!(found[0].is_read);

    repo.mark_as_starred(&article.id, true).unwrap();
    let found = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
    assert!(found[0].is_starred);

    repo.mark_as_starred(&article.id, false).unwrap();
    let found = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
    assert!(!found[0].is_starred);
}

#[test]
fn article_mutation_missing_id_contract_is_repository_error() {
    let db = test_db();
    let repo = SqliteArticleRepository::new(db.writer());
    let missing_id = ArticleId("missing-article".to_string());

    let read_error = repo
        .mark_as_read(&missing_id, true)
        .expect_err("missing article read mutation should be rejected");
    assert!(matches!(
        read_error,
        DomainError::Validation(message) if message == "Article not found: missing-article"
    ));

    repo.mark_many_as_read(&[missing_id.clone()])
        .expect("missing bulk article read mutation should be a no-op");

    let star_error = repo
        .mark_as_starred(&missing_id, true)
        .expect_err("missing article star mutation should be rejected");
    assert!(matches!(
        star_error,
        DomainError::Validation(message) if message == "Article not found: missing-article"
    ));

    let article_count: i64 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM articles", [], |row| row.get(0))
        .expect("article count should succeed");
    assert_eq!(article_count, 0);
}

#[test]
fn mark_many_as_read_with_empty_ids_is_repository_noop() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());
    let article = make_article(&feed_id, "Unread article");
    repo.upsert(std::slice::from_ref(&article))
        .expect("article insert should succeed");

    repo.mark_many_as_read(&[])
        .expect("empty bulk article read mutation should be a no-op");
    repo.mark_as_read(&article.id, true)
        .expect("subsequent article update should succeed");

    let found = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
    assert_eq!(found.len(), 1);
    assert!(found[0].is_read);
}
