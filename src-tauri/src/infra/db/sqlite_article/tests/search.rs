use super::*;

#[test]
fn search_finds_by_title() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let a1 = make_article(&feed_id, "Rust Programming Guide");
    let a2 = make_article(&feed_id, "Python Tutorial");
    repo.upsert(&[a1, a2]).unwrap();

    let results = repo
        .search(&account_id, "Rust", &Pagination::default())
        .unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].title, "Rust Programming Guide");
}

#[test]
fn search_finds_by_content() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut a1 = make_article(&feed_id, "Generic Title");
    a1.content_sanitized = "This article is about quantum computing".to_string();
    let a2 = make_article(&feed_id, "Another Title");
    repo.upsert(&[a1, a2]).unwrap();

    let results = repo
        .search(&account_id, "quantum", &Pagination::default())
        .unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].title, "Generic Title");
}

#[test]
fn search_respects_account_scope() {
    let db = test_db();
    let account1 = insert_test_account(&db);
    let account2 = insert_test_account(&db);
    let feed1 = insert_test_feed(&db, &account1);
    let feed2 = insert_test_feed(&db, &account2);
    let repo = SqliteArticleRepository::new(db.writer());

    let a1 = make_article(&feed1, "Shared Keyword Article");
    let a2 = make_article(&feed2, "Shared Keyword Article");
    repo.upsert(&[a1, a2]).unwrap();

    let results1 = repo
        .search(&account1, "Shared", &Pagination::default())
        .unwrap();
    assert_eq!(results1.len(), 1);

    let results2 = repo
        .search(&account2, "Shared", &Pagination::default())
        .unwrap();
    assert_eq!(results2.len(), 1);
}

#[test]
fn search_finds_cjk_mixed_title_via_like_fallback() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    // CJK characters adjacent to ASCII cause FTS5 unicode61 tokenizer to
    // merge them into a single token (e.g. "新型HomePod"), making a pure
    // FTS MATCH on "HomePod" miss. The LIKE fallback should find it.
    let a1 = make_article(&feed_id, "新型HomePod/mini発表");
    let a2 = make_article(&feed_id, "Unrelated Article");
    repo.upsert(&[a1, a2]).unwrap();

    let results = repo
        .search(&account_id, "HomePod", &Pagination::default())
        .unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].title, "新型HomePod/mini発表");
}

#[test]
fn search_finds_pure_cjk_query() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let a1 = make_article(&feed_id, "日本語の記事タイトル");
    let a2 = make_article(&feed_id, "English Only Title");
    repo.upsert(&[a1, a2]).unwrap();

    let results = repo
        .search(&account_id, "記事", &Pagination::default())
        .unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].title, "日本語の記事タイトル");
}

#[test]
fn search_filters_muted_results_case_insensitively() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let muted = make_article(&feed_id, "Kindle Unlimited sale");
    repo.upsert(&[muted]).unwrap();
    insert_mute_keyword(&db, "kindle unlimited", "title_and_body");

    let results = repo
        .search(&account_id, "Kindle", &Pagination::default())
        .unwrap();

    assert!(results.is_empty());
}

#[test]
fn search_returns_empty_for_whitespace_only_query() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    repo.upsert(&[make_article(&feed_id, "Rust Programming Guide")])
        .unwrap();

    let results = repo
        .search(&account_id, " \n\t ", &Pagination::default())
        .unwrap();

    assert!(results.is_empty());
}

#[test]
fn search_treats_fts_special_characters_as_literal_input() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let quoted = make_article(&feed_id, "Rust \"Guide\"");
    let punctuated = make_article(&feed_id, "SQLite NEAR(search) notes");
    let operator = make_article(&feed_id, "FTS OR operator");
    let prefix_marker = make_article(&feed_id, "Prefix star* marker");
    repo.upsert(&[quoted, punctuated, operator, prefix_marker])
        .unwrap();

    let quoted_results = repo
        .search(&account_id, "\"Guide\"", &Pagination::default())
        .unwrap();
    let punctuated_results = repo
        .search(&account_id, "NEAR(search)", &Pagination::default())
        .unwrap();
    let operator_results = repo
        .search(&account_id, "OR", &Pagination::default())
        .unwrap();
    let prefix_results = repo
        .search(&account_id, "star*", &Pagination::default())
        .unwrap();

    assert_eq!(quoted_results.len(), 1);
    assert_eq!(quoted_results[0].title, "Rust \"Guide\"");
    assert_eq!(punctuated_results.len(), 1);
    assert_eq!(punctuated_results[0].title, "SQLite NEAR(search) notes");
    assert_eq!(operator_results.len(), 1);
    assert_eq!(operator_results[0].title, "FTS OR operator");
    assert_eq!(prefix_results.len(), 1);
    assert_eq!(prefix_results[0].title, "Prefix star* marker");
}

#[test]
fn search_fts_query_builder_quotes_every_term_as_literal_text() {
    assert_eq!(
        build_fts_query("alpha beta"),
        Some("\"alpha\" \"beta\"".to_string())
    );
    assert_eq!(
        build_fts_query("\"quoted\" OR prefix*"),
        Some("\"\"\"quoted\"\"\" \"OR\" \"prefix*\"".to_string())
    );
    assert_eq!(build_fts_query(" \n\t "), None);
}

#[test]
fn search_tokenized_fast_path_sql_does_not_include_like_fallback_union() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());
    repo.upsert(&[make_article(&feed_id, "Rust Programming Guide")])
        .unwrap();

    let results = repo
        .search_list(&account_id, "Rust", &Pagination::default())
        .unwrap();
    assert_eq!(results.len(), 1);

    let select_cols_prefixed =
        SqliteArticleRepository::select_cols_prefixed(ARTICLE_LIST_SELECT_COLS, "a");
    let mute_clause = build_mute_keyword_exclusion_clause(
            "a.title",
            "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
        );
    let fast_path_sql = build_search_list_fts_sql(&select_cols_prefixed, &mute_clause);

    assert!(fast_path_sql.contains("articles_fts MATCH ?2"));
    assert!(
        !fast_path_sql.contains("UNION"),
        "tokenized FTS search should not always execute the LIKE fallback: {fast_path_sql}"
    );
}

#[test]
fn search_dedupes_fts_and_like_hits_before_applying_stable_order() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let mut newest = make_article(&feed_id, "Rust duplicate newest");
    newest.id = ArticleId("article-newest".to_string());
    newest.published_at = DateTime::parse_from_rfc3339("2026-04-14T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    newest.fetched_at = DateTime::parse_from_rfc3339("2026-04-14T00:03:00Z")
        .unwrap()
        .with_timezone(&Utc);
    let mut older = make_article(&feed_id, "Rust duplicate older");
    older.id = ArticleId("article-older".to_string());
    older.published_at = newest.published_at;
    older.fetched_at = DateTime::parse_from_rfc3339("2026-04-14T00:01:00Z")
        .unwrap()
        .with_timezone(&Utc);
    repo.upsert(&[older, newest]).unwrap();

    let results = repo
        .search(&account_id, "Rust", &Pagination::default())
        .unwrap();
    let ids = results
        .into_iter()
        .map(|article| article.id.0)
        .collect::<Vec<_>>();

    assert_eq!(ids, vec!["article-newest", "article-older"]);
}

#[test]
fn search_applies_pagination_in_sql_after_deduped_ordering() {
    let db = test_db();
    let account_id = insert_test_account(&db);
    let feed_id = insert_test_feed(&db, &account_id);
    let repo = SqliteArticleRepository::new(db.writer());

    let articles = (0..5)
        .map(|index| {
            let mut article = make_article(&feed_id, &format!("Rust page article {index}"));
            article.id = ArticleId(format!("article-{index}"));
            article.published_at =
                DateTime::parse_from_rfc3339(&format!("2026-04-14T00:0{index}:00Z"))
                    .unwrap()
                    .with_timezone(&Utc);
            article.fetched_at = article.published_at;
            article
        })
        .collect::<Vec<_>>();
    repo.upsert(&articles).unwrap();

    let results = repo
        .search(
            &account_id,
            "Rust",
            &Pagination {
                offset: 1,
                limit: 2,
            },
        )
        .unwrap();
    let ids = results
        .into_iter()
        .map(|article| article.id.0)
        .collect::<Vec<_>>();

    assert_eq!(ids, vec!["article-3", "article-2"]);
}
