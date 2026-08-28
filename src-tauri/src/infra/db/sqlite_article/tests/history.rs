use super::*;

#[test]
fn article_view_history_is_account_scoped_deduplicated_and_limited() {
    let db = test_db();
    let account_a = insert_test_account(&db);
    let account_b = insert_test_account(&db);
    let feed_a = insert_test_feed(&db, &account_a);
    let feed_b = insert_test_feed(&db, &account_b);
    let repo = SqliteArticleRepository::new(db.writer());

    let articles_a = (0..(RECENT_ARTICLE_HISTORY_LIMIT + 2))
        .map(|index| make_article(&feed_a, &format!("Account A Article {index:02}")))
        .collect::<Vec<_>>();
    let article_b = make_article(&feed_b, "Account B Article");
    repo.upsert(&articles_a).unwrap();
    repo.upsert(std::slice::from_ref(&article_b)).unwrap();

    for article in &articles_a {
        repo.record_view(&account_a, &article.id).unwrap();
    }
    repo.record_view(&account_b, &article_b.id).unwrap();
    repo.record_view(&account_a, &articles_a[3].id).unwrap();

    let recent_a = repo
        .find_recently_viewed_by_account(
            &account_a,
            &Pagination {
                offset: 0,
                limit: RECENT_ARTICLE_HISTORY_LIMIT + 5,
            },
            ArticleListMode::All,
        )
        .unwrap();
    let recent_b = repo
        .find_recently_viewed_by_account(&account_b, &Pagination::default(), ArticleListMode::All)
        .unwrap();

    assert_eq!(recent_a.len(), RECENT_ARTICLE_HISTORY_LIMIT);
    assert_eq!(recent_a[0].article.id, articles_a[3].id);
    assert_eq!(
        recent_a
            .iter()
            .filter(|item| item.article.id == articles_a[3].id)
            .count(),
        1
    );
    assert!(recent_a.iter().all(|item| item.account_id == account_a));
    assert_eq!(recent_b.len(), 1);
    assert_eq!(recent_b[0].article.id, article_b.id);
}

#[test]
fn article_view_history_is_database_backed_between_repository_instances() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let article = make_article(&feed_id, "Persistent history article");
    SqliteArticleRepository::new(db.writer())
        .upsert(std::slice::from_ref(&article))
        .unwrap();

    SqliteArticleRepository::new(db.writer())
        .record_view(&account_id, &article.id)
        .unwrap();

    let recent = SqliteArticleRepository::new(db.reader())
        .find_recently_viewed_by_account(&account_id, &Pagination::default(), ArticleListMode::All)
        .unwrap();

    assert_eq!(recent.len(), 1);
    assert_eq!(recent[0].article.id, article.id);
}

#[test]
fn record_view_prunes_history_limit_for_target_account_only() {
    let db = test_db();
    let account_a = insert_test_account(&db);
    let account_b = insert_test_account(&db);
    let feed_a = insert_test_feed(&db, &account_a);
    let feed_b = insert_test_feed(&db, &account_b);
    let repo = SqliteArticleRepository::new(db.writer());

    let articles_a = (0..(RECENT_ARTICLE_HISTORY_LIMIT + 1))
        .map(|index| make_article(&feed_a, &format!("Account A Article {index:02}")))
        .collect::<Vec<_>>();
    let articles_b = (0..(RECENT_ARTICLE_HISTORY_LIMIT + 1))
        .map(|index| make_article(&feed_b, &format!("Account B Article {index:02}")))
        .collect::<Vec<_>>();
    repo.upsert(&articles_a).unwrap();
    repo.upsert(&articles_b).unwrap();

    for (index, article) in articles_b.iter().enumerate() {
        db.writer()
                .execute(
                    "INSERT INTO article_view_history (account_id, article_id, viewed_at) VALUES (?1, ?2, ?3)",
                    params![
                        account_b.0,
                        article.id.0,
                        format!("2026-04-20T10:{index:02}:00Z")
                    ],
                )
                .unwrap();
    }
    for article in &articles_a {
        repo.record_view(&account_a, &article.id).unwrap();
    }

    let count_a: i64 = db
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM article_view_history WHERE account_id = ?1",
            params![account_a.0],
            |row| row.get(0),
        )
        .unwrap();
    let count_b: i64 = db
        .reader()
        .query_row(
            "SELECT COUNT(*) FROM article_view_history WHERE account_id = ?1",
            params![account_b.0],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(count_a, RECENT_ARTICLE_HISTORY_LIMIT as i64);
    assert_eq!(count_b, (RECENT_ARTICLE_HISTORY_LIMIT + 1) as i64);
}

#[test]
fn record_view_with_cross_account_article_is_repository_noop() {
    let db = test_db();
    let account_a = insert_test_account(&db);
    let account_b = insert_test_account(&db);
    let feed_b = insert_test_feed(&db, &account_b);
    let repo = SqliteArticleRepository::new(db.writer());
    let article_b = make_article(&feed_b, "Account B Article");
    repo.upsert(std::slice::from_ref(&article_b)).unwrap();

    repo.record_view(&account_a, &article_b.id)
        .expect("cross-account view should be a no-op");

    let history_count: i64 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM article_view_history", [], |row| {
            row.get(0)
        })
        .expect("history count should succeed");
    assert_eq!(history_count, 0);
}

#[test]
fn record_view_with_missing_article_is_repository_noop() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let repo = SqliteArticleRepository::new(db.writer());

    repo.record_view(&account_id, &ArticleId("missing-article".to_string()))
        .expect("missing article view should be a no-op");

    let history_count: i64 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM article_view_history", [], |row| {
            row.get(0)
        })
        .expect("history count should succeed");
    assert_eq!(history_count, 0);
}

#[test]
fn record_view_with_deleted_article_is_repository_noop() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());
    let article = make_article(&feed_id, "Deleted article");
    repo.upsert(std::slice::from_ref(&article)).unwrap();
    repo.record_view(&account_id, &article.id).unwrap();

    db.writer()
        .execute("DELETE FROM articles WHERE id = ?1", params![article.id.0])
        .expect("article delete should succeed");
    repo.record_view(&account_id, &article.id)
        .expect("deleted article view should be a no-op");

    let history_count: i64 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM article_view_history", [], |row| {
            row.get(0)
        })
        .expect("history count should succeed");
    assert_eq!(history_count, 0);
}

#[test]
fn find_recently_viewed_by_account_filters_mode_before_pagination_and_keeps_view_order() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut newest_read = make_article(&feed_id, "Newest read");
    newest_read.is_read = true;
    let mut middle_unread = make_article(&feed_id, "Middle unread");
    middle_unread.is_read = false;
    let mut oldest_starred = make_article(&feed_id, "Oldest starred");
    oldest_starred.is_read = false;
    oldest_starred.is_starred = true;
    repo.upsert(&[
        newest_read.clone(),
        middle_unread.clone(),
        oldest_starred.clone(),
    ])
    .unwrap();

    for (article, viewed_at) in [
        (&oldest_starred, "2026-04-20T10:00:00Z"),
        (&middle_unread, "2026-04-20T11:00:00Z"),
        (&newest_read, "2026-04-20T12:00:00Z"),
    ] {
        db.writer()
                .execute(
                    "INSERT INTO article_view_history (account_id, article_id, viewed_at) VALUES (?1, ?2, ?3)",
                    params![account_id.0, article.id.0, viewed_at],
                )
                .unwrap();
    }

    let first_page = Pagination {
        offset: 0,
        limit: 1,
    };
    let all = repo
        .find_recently_viewed_by_account(&account_id, &first_page, ArticleListMode::All)
        .unwrap();
    let unread = repo
        .find_recently_viewed_by_account(&account_id, &first_page, ArticleListMode::Unread)
        .unwrap();
    let starred = repo
        .find_recently_viewed_by_account(&account_id, &first_page, ArticleListMode::Starred)
        .unwrap();

    assert_eq!(all[0].article.title, "Newest read");
    assert_eq!(unread[0].article.title, "Middle unread");
    assert_eq!(starred[0].article.title, "Oldest starred");
}

#[test]
fn find_recently_viewed_by_account_excludes_muted_articles_before_pagination() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let newest_muted = make_article(&feed_id, "Kindle Unlimited campaign");
    let middle_visible = make_article(&feed_id, "Middle visible");
    let oldest_visible = make_article(&feed_id, "Oldest visible");
    repo.upsert(&[
        newest_muted.clone(),
        middle_visible.clone(),
        oldest_visible.clone(),
    ])
    .unwrap();
    insert_mute_keyword(&db, "kindle unlimited", "title");

    for (article, viewed_at) in [
        (&oldest_visible, "2026-04-20T10:00:00Z"),
        (&middle_visible, "2026-04-20T11:00:00Z"),
        (&newest_muted, "2026-04-20T12:00:00Z"),
    ] {
        db.writer()
                .execute(
                    "INSERT INTO article_view_history (account_id, article_id, viewed_at) VALUES (?1, ?2, ?3)",
                    params![account_id.0, article.id.0, viewed_at],
                )
                .unwrap();
    }

    let first_page = repo
        .find_recently_viewed_by_account(
            &account_id,
            &Pagination {
                offset: 0,
                limit: 1,
            },
            ArticleListMode::All,
        )
        .unwrap();
    let second_page = repo
        .find_recently_viewed_by_account(
            &account_id,
            &Pagination {
                offset: 1,
                limit: 1,
            },
            ArticleListMode::All,
        )
        .unwrap();

    assert_eq!(first_page[0].article.title, "Middle visible");
    assert_eq!(second_page[0].article.title, "Oldest visible");
}

#[test]
fn clear_article_view_history_removes_only_that_accounts_history() {
    let db = test_db();
    let account_a = insert_test_account(&db);
    let account_b = insert_test_account(&db);
    let feed_a = insert_test_feed(&db, &account_a);
    let feed_b = insert_test_feed(&db, &account_b);
    let repo = SqliteArticleRepository::new(db.writer());
    let article_a = make_article(&feed_a, "Account A Article");
    let article_b = make_article(&feed_b, "Account B Article");
    repo.upsert(&[article_a.clone(), article_b.clone()])
        .unwrap();
    repo.record_view(&account_a, &article_a.id).unwrap();
    repo.record_view(&account_b, &article_b.id).unwrap();

    let removed = repo.clear_view_history(&account_a).unwrap();

    assert_eq!(removed, 1);
    assert!(repo
        .find_recently_viewed_by_account(&account_a, &Pagination::default(), ArticleListMode::All)
        .unwrap()
        .is_empty());
    assert_eq!(
        repo.find_recently_viewed_by_account(
            &account_b,
            &Pagination::default(),
            ArticleListMode::All
        )
        .unwrap()
        .len(),
        1
    );
}

#[test]
fn article_view_history_cascades_with_account_and_feed_deletes() {
    let db = test_db();
    let account_a = insert_test_account(&db);
    let account_b = insert_test_account(&db);
    let feed_a = insert_test_feed(&db, &account_a);
    let feed_b = insert_test_feed(&db, &account_b);
    let repo = SqliteArticleRepository::new(db.writer());
    let article_a = make_article(&feed_a, "Account A Article");
    let article_b = make_article(&feed_b, "Account B Article");
    repo.upsert(&[article_a.clone(), article_b.clone()])
        .unwrap();
    repo.record_view(&account_a, &article_a.id).unwrap();
    repo.record_view(&account_b, &article_b.id).unwrap();

    db.writer()
        .execute("DELETE FROM feeds WHERE id = ?1", params![feed_a.0])
        .unwrap();

    let count_after_feed_delete: i64 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM article_view_history", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(count_after_feed_delete, 1);

    db.writer()
        .execute("DELETE FROM accounts WHERE id = ?1", params![account_b.0])
        .unwrap();

    let count_after_account_delete: i64 = db
        .reader()
        .query_row("SELECT COUNT(*) FROM article_view_history", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(count_after_account_delete, 0);
}
