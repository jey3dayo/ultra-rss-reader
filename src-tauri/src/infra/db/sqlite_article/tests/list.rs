use super::*;

#[test]
fn article_repository_sql_inventory_matches_latest_migration() {
    let db = test_db();
    let article_columns = table_columns(&db, "articles");
    let feed_columns = table_columns(&db, "feeds");
    let article_view_history_columns = table_columns(&db, "article_view_history");

    for column in SELECT_COLS.split(", ") {
        assert!(
            article_columns.contains(column),
            "SELECT_COLS references missing articles.{column}"
        );
    }
    for column in ["published_at", "fetched_at", "id"] {
        assert!(
            article_columns.contains(column),
            "article ordering references missing articles.{column}"
        );
    }
    assert!(
        article_columns.contains("account_id"),
        "account-wide article listing should not need a feeds join for account scoping"
    );
    for column in ["id", "account_id", "folder_id", "remote_id"] {
        assert!(
            feed_columns.contains(column),
            "article repository joins reference missing feeds.{column}"
        );
    }
    for column in ["account_id", "article_id", "viewed_at"] {
        assert!(
            article_view_history_columns.contains(column),
            "recently viewed query references missing article_view_history.{column}"
        );
    }

    let article_indexes = index_names(&db, "articles");
    for index_name in [
        "idx_articles_feed_id",
        "idx_articles_published_at",
        "idx_articles_is_read",
        "idx_articles_is_starred",
        "idx_articles_remote_id",
        "idx_articles_feed_published_fetched_id",
        "idx_articles_account_published_fetched_id",
        "idx_articles_account_unread_published_fetched_id",
        "idx_articles_account_starred_published_fetched_id",
    ] {
        assert!(
            article_indexes.contains(index_name),
            "latest migration inventory is missing index {index_name}"
        );
    }

    let select_cols_prefixed = SELECT_COLS
        .split(", ")
        .map(|col| format!("a.{col}"))
        .collect::<Vec<_>>()
        .join(", ");
    let representative_sql = [
            format!(
                "SELECT {SELECT_COLS} FROM articles WHERE feed_id = ?1 ORDER BY {ARTICLE_ORDER_DESC} LIMIT ?2 OFFSET ?3"
            ),
            format!("SELECT {SELECT_COLS} FROM articles WHERE account_id = ?1 ORDER BY {ARTICLE_ORDER_DESC} LIMIT ?2 OFFSET ?3"),
            format!(
                "SELECT {select_cols_prefixed}, h.account_id, h.viewed_at FROM article_view_history h JOIN articles a ON h.article_id = a.id JOIN feeds f ON a.feed_id = f.id WHERE h.account_id = ?1 AND f.account_id = ?1 ORDER BY h.viewed_at DESC LIMIT ?2 OFFSET ?3"
            ),
            format!(
                "WITH matched(article_id, published_at, fetched_at) AS (
                   SELECT a.id, a.published_at, a.fetched_at FROM articles a
                   JOIN feeds f ON a.feed_id = f.id
                   JOIN articles_fts fts ON a.rowid = fts.rowid
                   WHERE f.account_id = ?1 AND articles_fts MATCH ?2
                 )
                 SELECT {select_cols_prefixed} FROM articles a
                 JOIN matched m ON m.article_id = a.id
                 ORDER BY m.published_at DESC, m.fetched_at DESC, m.article_id DESC
                 LIMIT ?3 OFFSET ?4"
            ),
        ];

    for sql in representative_sql {
        db.writer().prepare(&sql).unwrap_or_else(|error| {
            panic!("article repository SQL should prepare: {error}\n{sql}")
        });
    }
}

#[test]
fn article_list_projection_omits_article_body_columns() {
    assert!(!ARTICLE_LIST_SELECT_COLS.contains("content_raw"));
    assert!(!ARTICLE_LIST_SELECT_COLS.contains("content_sanitized"));
}

#[test]
fn list_by_feed_returns_summary_items_without_loading_article_body() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut article = make_article(&feed_id, "Summary article");
    article.content_raw = "raw body should stay out of list rows".to_string();
    article.content_sanitized = "<p>sanitized body should stay out of list rows</p>".to_string();
    article.summary = Some("List summary".to_string());
    article.url = Some("https://example.com/summary".to_string());
    article.author = Some("Author".to_string());
    repo.upsert(std::slice::from_ref(&article)).unwrap();

    let listed = repo
        .list_by_feed(&feed_id, &Pagination::default(), ArticleListMode::All)
        .unwrap();
    let full = repo.find_by_id(&article.id).unwrap().unwrap();

    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, article.id);
    assert_eq!(listed[0].title, "Summary article");
    assert_eq!(listed[0].summary.as_deref(), Some("List summary"));
    assert_eq!(
        full.content_sanitized,
        "<p>sanitized body should stay out of list rows</p>"
    );
}

#[test]
fn article_list_query_plans_keep_index_and_fts_coverage() {
    let db = test_db();
    let (account_id, feed_a, _feed_b, folder_id) = seed_representative_article_dataset(&db);
    let select_cols_prefixed = SELECT_COLS
        .split(", ")
        .map(|col| format!("a.{col}"))
        .collect::<Vec<_>>()
        .join(", ");

    let feed_unread_plan = explain_query_plan(
        &db,
        &format!(
            "SELECT {SELECT_COLS} FROM articles
                 WHERE feed_id = '{}' AND is_read = 0
                 ORDER BY {ARTICLE_ORDER_DESC}
                 LIMIT 30 OFFSET 0",
            feed_a.0
        ),
    );
    assert_no_unindexed_article_scan(&feed_unread_plan);
    assert_plan_uses_any(
        &feed_unread_plan,
        &[
            "idx_articles_is_read",
            "idx_articles_feed_id",
            "idx_articles_feed_published_fetched_id",
        ],
    );

    let feed_list_plan = explain_query_plan(
        &db,
        &format!(
            "SELECT {SELECT_COLS} FROM articles
                 WHERE feed_id = '{}'
                 ORDER BY {ARTICLE_ORDER_DESC}
                 LIMIT 30 OFFSET 0",
            feed_a.0
        ),
    );
    assert_no_unindexed_article_scan(&feed_list_plan);
    assert_no_temp_order_sort(&feed_list_plan);
    assert_plan_uses_any(&feed_list_plan, &["idx_articles_feed_published_fetched_id"]);

    let account_starred_plan = explain_query_plan(
        &db,
        &format!(
            "SELECT {SELECT_COLS} FROM articles
                 WHERE account_id = '{}' AND is_starred = 1
                 ORDER BY {ARTICLE_ORDER_DESC}
                 LIMIT 30 OFFSET 0",
            account_id.0
        ),
    );
    assert_no_unindexed_article_scan(&account_starred_plan);
    assert_no_temp_order_sort(&account_starred_plan);
    assert_plan_uses_any(
        &account_starred_plan,
        &["idx_articles_account_starred_published_fetched_id"],
    );

    let account_unread_plan = explain_query_plan(
        &db,
        &format!(
            "SELECT {SELECT_COLS} FROM articles
                 WHERE account_id = '{}' AND is_read = 0
                 ORDER BY {ARTICLE_ORDER_DESC}
                 LIMIT 30 OFFSET 0",
            account_id.0
        ),
    );
    assert_no_unindexed_article_scan(&account_unread_plan);
    assert_no_temp_order_sort(&account_unread_plan);
    assert_plan_uses_any(
        &account_unread_plan,
        &["idx_articles_account_unread_published_fetched_id"],
    );

    let account_list_plan = explain_query_plan(
        &db,
        &format!(
            "SELECT {SELECT_COLS} FROM articles
                 WHERE account_id = '{}'
                 ORDER BY {ARTICLE_ORDER_DESC}
                 LIMIT 30 OFFSET 0",
            account_id.0
        ),
    );
    assert_no_unindexed_article_scan(&account_list_plan);
    assert_no_temp_order_sort(&account_list_plan);
    assert_plan_uses_any(
        &account_list_plan,
        &["idx_articles_account_published_fetched_id"],
    );

    let folder_plan = explain_query_plan(
        &db,
        &format!(
            "SELECT {select_cols_prefixed} FROM articles a
                 JOIN feeds f ON a.feed_id = f.id
                 WHERE f.folder_id = '{}'
                 ORDER BY {ARTICLE_ORDER_DESC_PREFIXED}
                 LIMIT 30 OFFSET 0",
            folder_id.0
        ),
    );
    assert_no_unindexed_article_scan(&folder_plan);
    assert_plan_uses_any(
        &folder_plan,
        &[
            "idx_articles_feed_id",
            "idx_articles_published_at",
            "idx_articles_is_read",
            "idx_articles_feed_published_fetched_id",
        ],
    );

    let search_plan = explain_query_plan(
        &db,
        &format!(
            "WITH matched(article_id, published_at, fetched_at) AS (
                   SELECT a.id, a.published_at, a.fetched_at FROM articles a
                   JOIN feeds f ON a.feed_id = f.id
                   JOIN articles_fts fts ON a.rowid = fts.rowid
                   WHERE f.account_id = '{}' AND articles_fts MATCH 'representative'
                   UNION
                   SELECT a.id, a.published_at, a.fetched_at FROM articles a
                   JOIN feeds f ON a.feed_id = f.id
                   WHERE f.account_id = '{}'
                     AND (a.title LIKE '%representative%' ESCAPE '\\'
                       OR a.content_text LIKE '%representative%' ESCAPE '\\')
                 )
                 SELECT {select_cols_prefixed} FROM articles a
                 JOIN matched m ON m.article_id = a.id
                 ORDER BY m.published_at DESC, m.fetched_at DESC, m.article_id DESC
                 LIMIT 30 OFFSET 0",
            account_id.0, account_id.0
        ),
    );
    assert_no_unindexed_article_scan(&search_plan);
    assert_plan_uses_any(&search_plan, &["VIRTUAL TABLE INDEX", "articles_fts"]);
}

#[test]
fn list_feed_article_summaries_returns_latest_and_starred_count_per_feed() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let old_feed_id = insert_test_feed(&db, &account_id);
    let fresh_feed_id = insert_test_feed(&db, &account_id);
    let empty_feed_id = insert_test_feed(&db, &account_id);
    let other_account_id = insert_test_account(&db);
    let other_feed_id = insert_test_feed(&db, &other_account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut old_article = make_article(&old_feed_id, "Old article");
    old_article.published_at = DateTime::parse_from_rfc3339("2025-01-01T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    old_article.is_starred = true;
    let mut newer_old_article = make_article(&old_feed_id, "Newer old article");
    newer_old_article.published_at = DateTime::parse_from_rfc3339("2025-02-01T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    let mut fresh_article = make_article(&fresh_feed_id, "Fresh article");
    fresh_article.published_at = DateTime::parse_from_rfc3339("2026-04-01T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    fresh_article.is_starred = true;
    let other_article = make_article(&other_feed_id, "Other account article");
    repo.upsert(&[old_article, newer_old_article, fresh_article, other_article])
        .unwrap();

    let summaries = repo
        .list_feed_article_summaries_by_account(&account_id)
        .unwrap();
    let summary_by_feed_id = summaries
        .into_iter()
        .map(|summary| (summary.feed_id.0.clone(), summary))
        .collect::<std::collections::HashMap<_, _>>();

    assert_eq!(
        summary_by_feed_id
            .get(&old_feed_id.0)
            .and_then(|summary| summary.latest_article_at.as_deref()),
        Some("2025-02-01T00:00:00+00:00")
    );
    assert_eq!(
        summary_by_feed_id
            .get(&old_feed_id.0)
            .map(|summary| summary.starred_count),
        Some(1)
    );
    assert_eq!(
        summary_by_feed_id
            .get(&fresh_feed_id.0)
            .and_then(|summary| summary.latest_article_at.as_deref()),
        Some("2026-04-01T00:00:00+00:00")
    );
    assert_eq!(
        summary_by_feed_id
            .get(&empty_feed_id.0)
            .and_then(|summary| summary.latest_article_at.as_deref()),
        None
    );
    assert!(!summary_by_feed_id.contains_key(&other_feed_id.0));
}

#[test]
fn list_feed_article_summaries_counts_recent_articles_within_window_excluding_future_and_muted() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let active_feed_id = insert_test_feed(&db, &account_id);
    let quiet_feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let now = Utc::now();
    let mut within_recent = make_article(&active_feed_id, "Within window recent");
    within_recent.published_at = now - chrono::Duration::days(5);
    let mut within_edge = make_article(&active_feed_id, "Within window edge");
    within_edge.published_at =
        now - chrono::Duration::days(RECENT_ARTICLE_ACTIVITY_WINDOW_DAYS - 1);
    let mut outside_old = make_article(&active_feed_id, "Outside window old");
    outside_old.published_at =
        now - chrono::Duration::days(RECENT_ARTICLE_ACTIVITY_WINDOW_DAYS + 10);
    let mut future_dated = make_article(&active_feed_id, "Future dated article");
    future_dated.published_at = now + chrono::Duration::days(5);
    // Muted article inside the window must not count (article_visible_clause reuse).
    let mut muted_recent = make_article(&active_feed_id, "Kindle Unlimited recent");
    muted_recent.published_at = now - chrono::Duration::days(3);
    let mut quiet_old = make_article(&quiet_feed_id, "Quiet old article");
    quiet_old.published_at = now - chrono::Duration::days(60);

    repo.upsert(&[
        within_recent,
        within_edge,
        outside_old,
        future_dated,
        muted_recent,
        quiet_old,
    ])
    .unwrap();
    insert_mute_keyword(&db, "kindle unlimited", "title");

    let summaries = repo
        .list_feed_article_summaries_by_account(&account_id)
        .unwrap();
    let summary_by_feed_id = summaries
        .into_iter()
        .map(|summary| (summary.feed_id.0.clone(), summary))
        .collect::<std::collections::HashMap<_, _>>();

    assert_eq!(
        summary_by_feed_id
            .get(&active_feed_id.0)
            .map(|summary| summary.recent_article_count),
        Some(2),
        "only the two visible articles inside the window should count"
    );
    assert_eq!(
        summary_by_feed_id
            .get(&quiet_feed_id.0)
            .map(|summary| summary.recent_article_count),
        Some(0),
        "a feed with no article inside the window should count zero"
    );
}

#[test]
fn list_feed_article_summaries_excludes_muted_articles_from_latest_and_starred_count() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let muted_only_feed_id = insert_test_feed(&db, &account_id);
    let empty_feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut newest_muted_starred = make_article(&feed_id, "Kindle Unlimited campaign");
    newest_muted_starred.published_at = DateTime::parse_from_rfc3339("2026-04-02T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    newest_muted_starred.is_starred = true;
    let mut visible = make_article(&feed_id, "Visible article");
    visible.published_at = DateTime::parse_from_rfc3339("2026-04-01T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    let mut muted_only_starred = make_article(&muted_only_feed_id, "Kindle Unlimited roundup");
    muted_only_starred.published_at = DateTime::parse_from_rfc3339("2026-04-03T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    muted_only_starred.is_starred = true;
    repo.upsert(&[newest_muted_starred, visible, muted_only_starred])
        .unwrap();
    insert_mute_keyword(&db, "kindle unlimited", "title");

    let summaries = repo
        .list_feed_article_summaries_by_account(&account_id)
        .unwrap();
    let summary_by_feed_id = summaries
        .into_iter()
        .map(|summary| (summary.feed_id.0.clone(), summary))
        .collect::<std::collections::HashMap<_, _>>();
    let summary = summary_by_feed_id
        .get(&feed_id.0)
        .expect("feed summary should exist");

    assert_eq!(
        summary.latest_article_at.as_deref(),
        Some("2026-04-01T00:00:00+00:00")
    );
    assert_eq!(summary.starred_count, 0);
    assert_eq!(
        summary_by_feed_id
            .get(&muted_only_feed_id.0)
            .and_then(|summary| summary.latest_article_at.as_deref()),
        None
    );
    assert_eq!(
        summary_by_feed_id
            .get(&muted_only_feed_id.0)
            .map(|summary| summary.starred_count),
        Some(0)
    );
    assert_eq!(
        summary_by_feed_id
            .get(&empty_feed_id.0)
            .and_then(|summary| summary.latest_article_at.as_deref()),
        None
    );
    assert_eq!(
        summary_by_feed_id
            .get(&empty_feed_id.0)
            .map(|summary| summary.starred_count),
        Some(0)
    );
}

#[test]
fn find_and_count_starred_by_account_ignore_unstarred_and_other_accounts() {
    let db = test_db();
    let account_a = insert_test_account(&db);
    let account_b = insert_test_account(&db);
    let feed_a1 = insert_test_feed(&db, &account_a);
    let feed_a2 = insert_test_feed(&db, &account_a);
    let feed_b = insert_test_feed(&db, &account_b);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut newest_starred = make_article(&feed_a1, "Newest starred");
    newest_starred.is_starred = true;
    newest_starred.published_at = Utc::now() + chrono::Duration::seconds(2);

    let mut older_starred = make_article(&feed_a2, "Older starred");
    older_starred.is_starred = true;
    older_starred.published_at = Utc::now() + chrono::Duration::seconds(1);

    let unstarred = make_article(&feed_a1, "Unstarred");

    let mut other_account_starred = make_article(&feed_b, "Other account starred");
    other_account_starred.is_starred = true;

    repo.upsert(&[
        newest_starred.clone(),
        older_starred.clone(),
        unstarred,
        other_account_starred,
    ])
    .unwrap();

    let found = repo
        .find_starred_by_account(&account_a, &Pagination::default())
        .unwrap();

    assert_eq!(
        found
            .iter()
            .map(|article| article.title.as_str())
            .collect::<Vec<_>>(),
        ["Newest starred", "Older starred"]
    );
    assert_eq!(repo.count_starred_by_account(&account_a).unwrap(), 2);
}
