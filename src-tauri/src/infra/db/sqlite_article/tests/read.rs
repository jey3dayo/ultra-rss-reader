use super::*;

#[test]
fn find_by_feed_with_pagination() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut articles = Vec::new();
    for i in 0..5 {
        let mut a = make_article(&feed_id, &format!("Article {i}"));
        a.published_at = Utc::now() + chrono::Duration::seconds(i);
        articles.push(a);
    }
    repo.upsert(&articles).unwrap();

    let page1 = repo
        .find_by_feed(
            &feed_id,
            &Pagination {
                offset: 0,
                limit: 2,
            },
        )
        .unwrap();
    assert_eq!(page1.len(), 2);

    let page2 = repo
        .find_by_feed(
            &feed_id,
            &Pagination {
                offset: 2,
                limit: 2,
            },
        )
        .unwrap();
    assert_eq!(page2.len(), 2);

    let page3 = repo
        .find_by_feed(
            &feed_id,
            &Pagination {
                offset: 4,
                limit: 2,
            },
        )
        .unwrap();
    assert_eq!(page3.len(), 1);

    let beyond_end = repo
        .find_by_feed(
            &feed_id,
            &Pagination {
                offset: 10_000,
                limit: 2,
            },
        )
        .unwrap();
    assert!(beyond_end.is_empty());
}

#[test]
fn find_by_feed_uses_stable_tie_breakers_for_same_published_at() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let published_at = DateTime::parse_from_rfc3339("2026-04-14T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    let mut older_fetch = make_article(&feed_id, "Older fetch");
    older_fetch.id = ArticleId("article-b".to_string());
    older_fetch.published_at = published_at;
    older_fetch.fetched_at = DateTime::parse_from_rfc3339("2026-04-14T00:01:00Z")
        .unwrap()
        .with_timezone(&Utc);
    let mut newer_fetch_low_id = make_article(&feed_id, "Newer fetch low id");
    newer_fetch_low_id.id = ArticleId("article-a".to_string());
    newer_fetch_low_id.published_at = published_at;
    newer_fetch_low_id.fetched_at = DateTime::parse_from_rfc3339("2026-04-14T00:02:00Z")
        .unwrap()
        .with_timezone(&Utc);
    let mut newer_fetch_high_id = make_article(&feed_id, "Newer fetch high id");
    newer_fetch_high_id.id = ArticleId("article-c".to_string());
    newer_fetch_high_id.published_at = published_at;
    newer_fetch_high_id.fetched_at = newer_fetch_low_id.fetched_at;
    repo.upsert(&[older_fetch, newer_fetch_low_id, newer_fetch_high_id])
        .unwrap();

    let page1 = repo
        .find_by_feed(
            &feed_id,
            &Pagination {
                offset: 0,
                limit: 2,
            },
        )
        .unwrap();
    let page2 = repo
        .find_by_feed(
            &feed_id,
            &Pagination {
                offset: 2,
                limit: 2,
            },
        )
        .unwrap();
    let ids = page1
        .into_iter()
        .chain(page2)
        .map(|article| article.id.0)
        .collect::<Vec<_>>();

    assert_eq!(ids, vec!["article-c", "article-a", "article-b"]);
}

#[test]
fn find_by_feed_filters_mute_keywords_before_pagination() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut newest_muted = make_article(&feed_id, "Kindle Unlimited campaign");
    newest_muted.published_at = Utc::now() + chrono::Duration::seconds(3);
    let mut second_muted = make_article(&feed_id, "kindle unlimited roundup");
    second_muted.published_at = Utc::now() + chrono::Duration::seconds(2);
    let mut visible = make_article(&feed_id, "Visible article");
    visible.published_at = Utc::now() + chrono::Duration::seconds(1);
    repo.upsert(&[newest_muted, second_muted, visible]).unwrap();

    insert_mute_keyword(&db, "Kindle Unlimited", "title");

    let page = repo
        .find_by_feed(
            &feed_id,
            &Pagination {
                offset: 0,
                limit: 1,
            },
        )
        .unwrap();

    assert_eq!(page.len(), 1);
    assert_eq!(page[0].title, "Visible article");
}

#[test]
fn find_by_folder_filters_mute_keywords_before_pagination() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let folder_id = FolderId::new();
    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![folder_id.0, account_id.0, "Folder", 0],
        )
        .unwrap();
    db.writer()
        .execute(
            "UPDATE feeds SET folder_id = ?1 WHERE id = ?2",
            params![folder_id.0, feed_id.0],
        )
        .unwrap();
    let repo = SqliteArticleRepository::new(db.writer());

    let mut newest_muted = make_article(&feed_id, "Kindle Unlimited campaign");
    newest_muted.published_at = Utc::now() + chrono::Duration::seconds(2);
    let mut visible = make_article(&feed_id, "Visible article");
    visible.published_at = Utc::now() + chrono::Duration::seconds(1);
    repo.upsert(&[newest_muted, visible]).unwrap();

    let without_mute = repo
        .find_by_folder(
            &folder_id,
            &Pagination {
                offset: 0,
                limit: 1,
            },
        )
        .unwrap();
    assert_eq!(without_mute[0].title, "Kindle Unlimited campaign");

    insert_mute_keyword(&db, "Kindle Unlimited", "title");
    let with_mute = repo
        .find_by_folder(
            &folder_id,
            &Pagination {
                offset: 0,
                limit: 1,
            },
        )
        .unwrap();

    assert_eq!(with_mute.len(), 1);
    assert_eq!(with_mute[0].title, "Visible article");
}

#[test]
fn find_folder_filtered_modes_exclude_muted_articles_before_pagination() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let folder_id = FolderId::new();
    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![folder_id.0, account_id.0, "Folder", 0],
        )
        .unwrap();
    db.writer()
        .execute(
            "UPDATE feeds SET folder_id = ?1 WHERE id = ?2",
            params![folder_id.0, feed_id.0],
        )
        .unwrap();
    let repo = SqliteArticleRepository::new(db.writer());

    let mut newest_muted_unread = make_article(&feed_id, "Kindle Unlimited unread");
    newest_muted_unread.is_read = false;
    newest_muted_unread.published_at = Utc::now() + chrono::Duration::seconds(4);
    let mut visible_unread = make_article(&feed_id, "Visible unread");
    visible_unread.is_read = false;
    visible_unread.published_at = Utc::now() + chrono::Duration::seconds(3);
    let mut newest_muted_starred = make_article(&feed_id, "Kindle Unlimited starred");
    newest_muted_starred.is_starred = true;
    newest_muted_starred.published_at = Utc::now() + chrono::Duration::seconds(2);
    let mut visible_starred = make_article(&feed_id, "Visible starred");
    visible_starred.is_starred = true;
    visible_starred.published_at = Utc::now() + chrono::Duration::seconds(1);
    repo.upsert(&[
        newest_muted_unread,
        visible_unread,
        newest_muted_starred,
        visible_starred,
    ])
    .unwrap();
    insert_mute_keyword(&db, "Kindle Unlimited", "title");

    let first_unread_page = repo
        .find_unread_by_folder(
            &folder_id,
            &Pagination {
                offset: 0,
                limit: 1,
            },
        )
        .unwrap();
    let first_starred_page = repo
        .find_starred_by_folder(
            &folder_id,
            &Pagination {
                offset: 0,
                limit: 1,
            },
        )
        .unwrap();

    assert_eq!(first_unread_page.len(), 1);
    assert_eq!(first_unread_page[0].title, "Visible unread");
    assert_eq!(first_starred_page.len(), 1);
    assert_eq!(first_starred_page[0].title, "Visible starred");
}

#[test]
fn find_by_account_returns_articles_across_feeds() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed1 = insert_test_feed(&db, &account_id);
    let feed2 = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut article1 = make_article(&feed1, "Article 1");
    article1.published_at = Utc::now();
    let mut article2 = make_article(&feed2, "Article 2");
    article2.published_at = Utc::now() + chrono::Duration::seconds(1);
    repo.upsert(&[article1.clone(), article2.clone()]).unwrap();

    let found = repo
        .find_by_account(&account_id, &Pagination::default())
        .unwrap();

    assert_eq!(found.len(), 2);
    assert_eq!(found[0].title, "Article 2");
    assert_eq!(found[1].title, "Article 1");
}

#[test]
fn find_by_account_filters_body_scope_with_summary_fallback() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut muted = make_article(&feed_id, "Article 1");
    muted.content_sanitized = "".to_string();
    muted.summary = Some("Contains Kindle Unlimited mention".to_string());
    muted.published_at = Utc::now() + chrono::Duration::seconds(2);

    let mut visible = make_article(&feed_id, "Article 2");
    visible.summary = Some("Visible summary".to_string());
    visible.published_at = Utc::now() + chrono::Duration::seconds(1);

    repo.upsert(&[muted, visible.clone()]).unwrap();
    insert_mute_keyword(&db, "kindle unlimited", "body");

    let found = repo
        .find_by_account(&account_id, &Pagination::default())
        .unwrap();

    assert_eq!(found.len(), 1);
    assert_eq!(found[0].title, visible.title);
}

#[test]
fn find_by_account_body_scope_ignores_html_attributes() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut visible = make_article(&feed_id, "Visible article");
    visible.content_sanitized =
        r#"<p><a href="https://example.com/kindle">Visible text only</a></p>"#.to_string();
    visible.published_at = Utc::now() + chrono::Duration::seconds(1);

    repo.upsert(&[visible.clone()]).unwrap();
    insert_mute_keyword(&db, "kindle", "body");

    let found = repo
        .find_by_account(&account_id, &Pagination::default())
        .unwrap();

    assert_eq!(found.len(), 1);
    assert_eq!(found[0].title, visible.title);
}

#[test]
fn find_by_account_body_scope_matches_visible_text_across_inline_markup() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut muted = make_article(&feed_id, "Muted article");
    muted.content_sanitized = "<p>Kindle <strong>Unlimited</strong></p>".to_string();
    muted.published_at = Utc::now() + chrono::Duration::seconds(2);

    let mut visible = make_article(&feed_id, "Visible article");
    visible.content_sanitized = "<p>Different body</p>".to_string();
    visible.published_at = Utc::now() + chrono::Duration::seconds(1);

    repo.upsert(&[muted, visible.clone()]).unwrap();
    insert_mute_keyword(&db, "kindle unlimited", "body");

    let found = repo
        .find_by_account(&account_id, &Pagination::default())
        .unwrap();

    assert_eq!(found.len(), 1);
    assert_eq!(found[0].title, visible.title);
}

#[test]
fn count_unread_by_account_counts_only_unread_in_selected_account() {
    let db = test_db();
    let account_a = insert_test_account(&db);
    let account_b = insert_test_account(&db);
    let feed_a1 = insert_test_feed(&db, &account_a);
    let feed_a2 = insert_test_feed(&db, &account_a);
    let feed_b = insert_test_feed(&db, &account_b);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut unread_a1 = make_article(&feed_a1, "Unread A1");
    unread_a1.is_read = false;
    let mut unread_a2 = make_article(&feed_a2, "Unread A2");
    unread_a2.is_read = false;
    let mut read_a = make_article(&feed_a1, "Read A");
    read_a.is_read = true;
    let mut unread_b = make_article(&feed_b, "Unread B");
    unread_b.is_read = false;

    repo.upsert(&[unread_a1, unread_a2, read_a, unread_b])
        .unwrap();

    assert_eq!(repo.count_unread_by_account(&account_a).unwrap(), 2);
}

#[test]
fn count_unread_by_account_excludes_muted_unread_articles() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let muted = make_article(&feed_id, "Kindle Unlimited offer");
    let visible = make_article(&feed_id, "Visible article");
    repo.upsert(&[muted, visible]).unwrap();
    insert_mute_keyword(&db, "kindle unlimited", "title");

    assert_eq!(repo.count_unread_by_account(&account_id).unwrap(), 1);
}

#[test]
fn find_unread_by_feed_filters_before_pagination() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut older_unread = make_article(&feed_id, "Older unread");
    older_unread.published_at = Utc::now() - chrono::Duration::days(3);

    let mut newer_read_articles = Vec::new();
    for i in 0..60 {
        let mut article = make_article(&feed_id, &format!("Read article {i}"));
        article.published_at = Utc::now() + chrono::Duration::seconds(i);
        article.is_read = true;
        newer_read_articles.push(article);
    }

    let mut articles = newer_read_articles;
    articles.push(older_unread.clone());
    repo.upsert(&articles).unwrap();

    let page = repo
        .find_unread_by_feed(
            &feed_id,
            &Pagination {
                offset: 0,
                limit: 50,
            },
        )
        .unwrap();

    assert_eq!(
        page.iter()
            .map(|article| article.title.as_str())
            .collect::<Vec<_>>(),
        vec!["Older unread"]
    );
}

#[test]
fn find_unread_by_account_filters_before_pagination() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut older_unread = make_article(&feed_id, "Older unread");
    older_unread.published_at = Utc::now() - chrono::Duration::days(3);

    let mut newer_read_articles = Vec::new();
    for i in 0..60 {
        let mut article = make_article(&feed_id, &format!("Read article {i}"));
        article.published_at = Utc::now() + chrono::Duration::seconds(i);
        article.is_read = true;
        newer_read_articles.push(article);
    }

    let mut articles = newer_read_articles;
    articles.push(older_unread.clone());
    repo.upsert(&articles).unwrap();

    let page = repo
        .find_unread_by_account(
            &account_id,
            &Pagination {
                offset: 0,
                limit: 50,
            },
        )
        .unwrap();

    assert_eq!(
        page.iter()
            .map(|article| article.title.as_str())
            .collect::<Vec<_>>(),
        vec!["Older unread"]
    );
}
