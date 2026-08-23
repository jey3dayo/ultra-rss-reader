use super::*;
use crate::infra::db::connection::DbManager;

fn test_db() -> std::sync::Mutex<DbManager> {
    std::sync::Mutex::new(DbManager::new_in_memory().unwrap())
}

fn insert_article_and_tag(db: &DbManager) -> (ArticleId, TagId) {
    let account_id = AccountId("account-1".to_string());
    let feed_id = crate::domain::types::FeedId("feed-1".to_string());
    let article_id = ArticleId("article-1".to_string());
    let tag_id = TagId("tag-1".to_string());

    db.writer()
        .execute(
            "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
            params![account_id.0, "Local", "Primary"],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO feeds (id, account_id, title, url, site_url)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                feed_id.0,
                account_id.0,
                "Example Feed",
                "https://example.com/feed.xml",
                "https://example.com"
            ],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, published_at, fetched_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                article_id.0,
                feed_id.0,
                "local-guid-1",
                "Example Article",
                "",
                "",
                1,
                "2026-04-01T00:00:00Z",
                "2026-04-01T00:00:00Z"
            ],
        )
        .unwrap();
    db.writer()
        .execute(
            "INSERT INTO tags (id, name) VALUES (?1, ?2)",
            params![tag_id.0, "Read Later"],
        )
        .unwrap();

    (article_id, tag_id)
}

fn count_article_tag_links(db: &DbManager, article_id: &ArticleId, tag_id: &TagId) -> i64 {
    db.reader()
        .query_row(
            "SELECT COUNT(*) FROM article_tags WHERE article_id = ?1 AND tag_id = ?2",
            params![article_id.0, tag_id.0],
            |row| row.get(0),
        )
        .unwrap()
}

#[test]
fn validate_color_accepts_full_hex_and_rejects_empty_short_or_invalid_values() {
    assert!(validate_color("#ff0000"));
    assert!(validate_color("#FF0000"));
    assert!(validate_color("#Cf7868"));

    assert!(!validate_color(""));
    assert!(!validate_color("#fff"));
    assert!(!validate_color("ff0000"));
    assert!(!validate_color("#gg0000"));
}

#[test]
fn normalize_color_lowercases_full_hex_and_treats_empty_as_none() {
    assert_eq!(normalize_color(None).unwrap(), None);
    assert_eq!(normalize_color(Some(String::new())).unwrap(), None);
    assert_eq!(normalize_color(Some("   ".to_string())).unwrap(), None);
    assert_eq!(
        normalize_color(Some("#FF0000".to_string())).unwrap(),
        Some("#ff0000".to_string())
    );
    assert_eq!(
        normalize_color(Some("#Cf7868".to_string())).unwrap(),
        Some("#cf7868".to_string())
    );
}

#[test]
fn normalize_color_rejects_short_hex_and_invalid_values() {
    assert!(matches!(
        normalize_color(Some("#fff".to_string())),
        Err(AppError::UserVisible { message }) if message == "Color must be a valid hex color (e.g. #ff0000)"
    ));
    assert!(matches!(
        normalize_color(Some("ff0000".to_string())),
        Err(AppError::UserVisible { message }) if message == "Color must be a valid hex color (e.g. #ff0000)"
    ));
    assert!(matches!(
        normalize_color(Some("#gg0000".to_string())),
        Err(AppError::UserVisible { message }) if message == "Color must be a valid hex color (e.g. #ff0000)"
    ));
}

#[test]
fn create_tag_trims_name_before_saving() {
    let db = test_db();

    let tag = create_tag_impl(&db, "  Read Later  ".to_string(), None).unwrap();

    assert_eq!(tag.name, "Read Later");
}

#[test]
fn create_tag_rejects_duplicate_names_case_insensitively() {
    let db = test_db();
    create_tag_impl(&db, "Read Later".to_string(), None).unwrap();

    let error = create_tag_impl(&db, "read later".to_string(), None)
        .expect_err("duplicate tag name should be rejected");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Tag name \"Read Later\" already exists"
    ));
}

#[test]
fn create_tag_rejects_names_over_50_characters_after_trim() {
    let db = test_db();

    create_tag_impl(&db, format!(" {} ", "a".repeat(50)), None)
        .expect("50 character tag name should be accepted after trimming");

    let error = create_tag_impl(&db, "a".repeat(51), None)
        .expect_err("51 character tag name should be rejected");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Tag name must be 50 characters or less"
    ));
}

#[test]
fn create_tag_lowercases_color_before_saving() {
    let db = test_db();

    let tag = create_tag_impl(&db, "Accent".to_string(), Some("#Cf7868".to_string())).unwrap();

    assert_eq!(tag.color.as_deref(), Some("#cf7868"));
}

#[test]
fn rename_tag_trims_name_rejects_case_duplicate_and_clears_color() {
    let db = test_db();
    let current = create_tag_impl(&db, "Inbox".to_string(), Some("#Cf7868".to_string())).unwrap();
    create_tag_impl(&db, "Read Later".to_string(), None).unwrap();

    let duplicate_error = rename_tag_impl(
        &db,
        current.id.clone(),
        " read later ".to_string(),
        Some("#6F8EB8".to_string()),
    )
    .expect_err("rename should reject another tag with the same ASCII case-insensitive name");

    assert!(matches!(
        duplicate_error,
        AppError::UserVisible { message } if message == "Tag name \"read later\" already exists"
    ));

    let renamed = rename_tag_impl(
        &db,
        current.id,
        " Inbox ".to_string(),
        Some("   ".to_string()),
    )
    .expect("same-name rename and color clear should be allowed");

    assert_eq!(renamed.name, "Inbox");
    assert_eq!(renamed.color, None);
}

#[test]
fn duplicate_tag_name_check_uses_ascii_case_only_policy() {
    let tags = vec![Tag {
        id: TagId("tag-other".to_string()),
        name: "İnbox".to_string(),
        color: None,
    }];

    assert!(has_duplicate_tag_name(&tags, "tag-current", "İNBOX"));
    assert!(!has_duplicate_tag_name(&tags, "tag-current", "inbox"));
}

#[test]
fn list_articles_by_tag_rejects_unknown_mode_with_user_visible_error() {
    let db = test_db();

    let error = list_articles_by_tag_impl(
        &db,
        "tag-1".to_string(),
        Some("archived".to_string()),
        None,
        None,
        None,
    )
    .expect_err("unknown tag article mode should be rejected");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Invalid article list mode: archived"
    ));
}

#[test]
fn list_articles_by_tag_accepts_boundary_limit() {
    let db = test_db();

    let articles = list_articles_by_tag_impl(
        &db,
        "tag-1".to_string(),
        None,
        None,
        Some(crate::commands::article_commands::MAX_ARTICLE_COMMAND_LIST_LIMIT),
        None,
    )
    .expect("max tag article list limit should be accepted");

    assert!(articles.is_empty());
}

#[test]
fn list_articles_by_tag_rejects_limit_over_boundary() {
    let db = test_db();

    let error = list_articles_by_tag_impl(
        &db,
        "tag-1".to_string(),
        None,
        None,
        Some(crate::commands::article_commands::MAX_ARTICLE_COMMAND_LIST_LIMIT + 1),
        None,
    )
    .expect_err("tag article list limit over max should be rejected");

    assert!(matches!(
        error,
        AppError::UserVisible { message }
            if message == "Article list limit must be 200 or less"
    ));
}

#[test]
fn list_articles_by_tag_rejects_offset_over_boundary() {
    let db = test_db();

    let error = list_articles_by_tag_impl(
        &db,
        "tag-1".to_string(),
        None,
        Some(crate::commands::article_commands::MAX_ARTICLE_COMMAND_LIST_OFFSET + 1),
        Some(1),
        None,
    )
    .expect_err("tag article list offset over max should be rejected");

    assert!(matches!(
        error,
        AppError::UserVisible { message }
            if message == "Article list offset must be 10000 or less"
    ));
}

#[test]
fn duplicate_tag_name_check_rejects_other_tags_case_insensitively() {
    let current = Tag {
        id: TagId("tag-current".to_string()),
        name: "Inbox".to_string(),
        color: None,
    };
    let other = Tag {
        id: TagId("tag-other".to_string()),
        name: "Read Later".to_string(),
        color: None,
    };
    let tags = vec![current, other];

    assert!(has_duplicate_tag_name(&tags, "tag-current", "read later"));
    assert!(has_duplicate_tag_name(&tags, "tag-current", "READ LATER"));
    assert!(!has_duplicate_tag_name(&tags, "tag-current", "Inbox"));
    assert!(!has_duplicate_tag_name(&tags, "tag-current", "inbox"));
}

#[test]
fn delete_missing_tag_is_successful_noop() {
    let db = test_db();

    delete_tag_impl(&db, "missing-tag".to_string()).unwrap();
}

#[test]
fn tag_article_missing_article_or_tag_is_user_visible_error() {
    let db = test_db();

    let article_error = tag_article_impl(
        &db,
        "missing-article".to_string(),
        "missing-tag".to_string(),
    )
    .expect_err("missing article and tag should surface as a command error");

    assert!(matches!(
        article_error,
        AppError::UserVisible { message } if message == "Article not found"
    ));
}

#[test]
fn tag_article_missing_tag_is_user_visible_error() {
    let db = test_db();
    let (article_id, _) = {
        let db = db.lock().unwrap();
        insert_article_and_tag(&db)
    };

    let error = tag_article_impl(&db, article_id.0, "missing-tag".to_string())
        .expect_err("missing tag should surface as command error");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Tag not found"
    ));
}

#[test]
fn create_tag_and_assign_rolls_back_new_tag_when_assignment_fails() {
    let db = test_db();

    let error = create_tag_and_assign_article_impl(
        &db,
        "missing-article".to_string(),
        "New Tag".to_string(),
        Some("#Cf7868".to_string()),
    )
    .expect_err("missing article should reject the combined create and assign command");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Article not found"
    ));
    let guard = db.lock().unwrap();
    let repo = SqliteTagRepository::new(guard.reader());
    assert!(repo.find_by_name("New Tag").unwrap().is_none());
}

#[test]
fn create_tag_and_assign_reuses_existing_tag_and_assigns_article() {
    let db = test_db();
    let (article_id, _) = {
        let db = db.lock().unwrap();
        insert_article_and_tag(&db)
    };

    let tag = create_tag_and_assign_article_impl(
        &db,
        article_id.0.clone(),
        " read later ".to_string(),
        Some("#Cf7868".to_string()),
    )
    .expect("existing tag should be reused and assigned");

    assert_eq!(tag.name, "Read Later");
    let guard = db.lock().unwrap();
    assert_eq!(
        count_article_tag_links(&guard, &article_id, &TagId(tag.id)),
        1
    );
    assert_eq!(
        SqliteTagRepository::new(guard.reader())
            .find_all()
            .unwrap()
            .len(),
        1
    );
}

#[test]
fn tag_article_transaction_blocks_tag_delete_after_validation() {
    let db = test_db();
    let db = db.lock().unwrap();
    let (article_id, tag_id) = insert_article_and_tag(&db);
    let tx = begin_immediate_transaction(db.writer()).unwrap();

    validate_article_tag_targets(&tx, &article_id.0, &tag_id.0).unwrap();

    let delete_error = db
        .reader()
        .execute("DELETE FROM tags WHERE id = ?1", params![tag_id.0])
        .expect_err("tag delete from another connection should wait until tag transaction ends");
    assert!(
        delete_error.to_string().contains("locked"),
        "unexpected delete error: {delete_error}"
    );

    let repo = SqliteTagRepository::new(&tx);
    repo.tag_article(&article_id, &tag_id).unwrap();
    drop(repo);
    tx.commit().unwrap();
}

#[test]
fn tag_article_transaction_blocks_article_delete_after_validation() {
    let db = test_db();
    let db = db.lock().unwrap();
    let (article_id, tag_id) = insert_article_and_tag(&db);
    let tx = begin_immediate_transaction(db.writer()).unwrap();

    validate_article_tag_targets(&tx, &article_id.0, &tag_id.0).unwrap();

    let delete_error = db
        .reader()
        .execute("DELETE FROM articles WHERE id = ?1", params![article_id.0])
        .expect_err(
            "article delete from another connection should wait until tag transaction ends",
        );
    assert!(
        delete_error.to_string().contains("locked"),
        "unexpected delete error: {delete_error}"
    );

    let repo = SqliteTagRepository::new(&tx);
    repo.tag_article(&article_id, &tag_id).unwrap();
    drop(repo);
    tx.commit().unwrap();
}

#[test]
fn untag_article_missing_article_or_tag_is_user_visible_error() {
    let db = test_db();

    let error = untag_article_impl(
        &db,
        "missing-article".to_string(),
        "missing-tag".to_string(),
    )
    .expect_err("missing article should surface as command error");

    assert!(matches!(
        error,
        AppError::UserVisible { message } if message == "Article not found"
    ));
}

#[test]
fn untag_article_missing_link_is_successful_noop_when_targets_exist() {
    let db = test_db();
    let (article_id, tag_id) = {
        let db = db.lock().unwrap();
        insert_article_and_tag(&db)
    };

    untag_article_impl(&db, article_id.0, tag_id.0).unwrap();
}
