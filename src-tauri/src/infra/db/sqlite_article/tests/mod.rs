mod history;
mod list;
mod maintenance;
mod mutation;
mod orphaned;
mod read;
mod remote_state;
mod search;
mod unread;

pub(super) use super::*;

pub(super) use crate::domain::constants::{
    ARTICLE_MUTATION_TRANSACTION_CHUNK_SIZE, RECENT_ARTICLE_HISTORY_LIMIT,
};
pub(super) use crate::domain::error::DomainError;
pub(super) use crate::infra::db::connection::DbManager;
pub(super) use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
pub(super) use crate::repository::article::{
    ArticleHistoryRepository, ArticleListMode, ArticleListRepository, ArticleMaintenanceRepository,
    ArticleMutationRepository, ArticleReadRepository, ArticleRemoteStateRepository,
};
pub(super) use crate::repository::feed::FeedRepository;
pub(super) use crate::repository::pending_mutation::{
    PendingMutation, PendingMutationRepository, PendingMutationType,
};
pub(super) use std::collections::HashSet;

pub(super) fn test_db() -> DbManager {
    DbManager::new_in_memory().unwrap()
}

pub(super) fn insert_test_account(db: &DbManager) -> AccountId {
    insert_test_account_with_kind(db, "Local")
}

pub(super) fn insert_test_account_with_kind(db: &DbManager, kind: &str) -> AccountId {
    let id = AccountId::new();
    db.writer()
        .execute(
            "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
            params![id.0, kind, "Test"],
        )
        .unwrap();
    id
}

pub(super) fn insert_test_feed(db: &DbManager, account_id: &AccountId) -> FeedId {
    let id = FeedId::new();
    let url = format!("http://test.com/feed/{}", id.0);
    db.writer()
        .execute(
            "INSERT INTO feeds (id, account_id, remote_id, title, url) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id.0, account_id.0, format!("feed/{url}"), "Test Feed", url],
        )
        .unwrap();
    id
}

pub(super) fn make_article(feed_id: &FeedId, title: &str) -> Article {
    let now = Utc::now();
    Article {
        id: ArticleId(uuid::Uuid::new_v4().to_string()),
        feed_id: feed_id.clone(),
        remote_id: None,
        title: title.to_string(),
        content_raw: "raw".to_string(),
        content_sanitized: "sanitized".to_string(),
        sanitizer_version: 1,
        summary: None,
        url: None,
        author: None,
        published_at: now,
        thumbnail: None,
        is_read: false,
        is_starred: false,
        fetched_at: now,
    }
}

pub(super) fn assert_utc_rfc3339(value: &str) {
    let parsed = DateTime::parse_from_rfc3339(value).unwrap();
    assert_eq!(parsed.offset().local_minus_utc(), 0);
}

pub(super) fn insert_mute_keyword(db: &DbManager, keyword: &str, scope: &str) {
    let now = Utc::now().to_rfc3339();
    db.writer()
            .execute(
                "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![uuid::Uuid::new_v4().to_string(), keyword, scope, now, now],
            )
            .unwrap();
}

pub(super) fn table_columns(db: &DbManager, table_name: &str) -> HashSet<String> {
    let pragma = format!("PRAGMA table_info({table_name})");
    let mut stmt = db.writer().prepare(&pragma).unwrap();
    stmt.query_map([], |row| row.get::<_, String>(1))
        .unwrap()
        .collect::<Result<HashSet<_>, _>>()
        .unwrap()
}

pub(super) fn index_names(db: &DbManager, table_name: &str) -> HashSet<String> {
    let pragma = format!("PRAGMA index_list({table_name})");
    let mut stmt = db.writer().prepare(&pragma).unwrap();
    stmt.query_map([], |row| row.get::<_, String>(1))
        .unwrap()
        .collect::<Result<HashSet<_>, _>>()
        .unwrap()
}

pub(super) fn explain_query_plan(db: &DbManager, sql: &str) -> Vec<String> {
    let mut stmt = db
        .writer()
        .prepare(&format!("EXPLAIN QUERY PLAN {sql}"))
        .unwrap();
    stmt.query_map([], |row| row.get::<_, String>(3))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap()
}

pub(super) fn assert_plan_uses_any(plan: &[String], expected_markers: &[&str]) {
    assert!(
        plan.iter().any(|detail| expected_markers
            .iter()
            .any(|marker| detail.contains(marker))),
        "query plan should contain one of {expected_markers:?}, got {plan:#?}"
    );
}

pub(super) fn assert_no_unindexed_article_scan(plan: &[String]) {
    assert!(
        !plan
            .iter()
            .any(|detail| detail == "SCAN articles" || detail == "SCAN a"),
        "query plan should not full-scan articles without an index: {plan:#?}"
    );
}

pub(super) fn assert_no_temp_order_sort(plan: &[String]) {
    assert!(
        !plan
            .iter()
            .any(|detail| detail.contains("USE TEMP B-TREE FOR ORDER BY")),
        "query plan should use an ordered index instead of a temp ORDER BY sort: {plan:#?}"
    );
}

pub(super) fn seed_representative_article_dataset(
    db: &DbManager,
) -> (AccountId, FeedId, FeedId, FolderId) {
    let account_id = insert_test_account(db);
    let folder_id = FolderId::new();
    db.writer()
        .execute(
            "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
            params![folder_id.0, account_id.0, "Query Plan Folder", 0],
        )
        .unwrap();
    let feed_a = insert_test_feed(db, &account_id);
    let feed_b = insert_test_feed(db, &account_id);
    db.writer()
        .execute(
            "UPDATE feeds SET folder_id = ?1 WHERE id IN (?2, ?3)",
            params![folder_id.0, feed_a.0, feed_b.0],
        )
        .unwrap();
    let repo = SqliteArticleRepository::new(db.writer());

    let base_published_at = DateTime::parse_from_rfc3339("2026-04-01T00:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    let articles = [feed_a.clone(), feed_b.clone()]
        .into_iter()
        .enumerate()
        .flat_map(|(feed_index, feed_id)| {
            (0..80).map(move |index| {
                let mut article =
                    make_article(&feed_id, &format!("Plan fixture {feed_index}-{index}"));
                article.id = ArticleId(format!("plan-{feed_index}-{index:03}"));
                article.content_sanitized =
                    format!("<p>representative searchable body {feed_index} {index}</p>");
                article.summary = Some(format!("summary {feed_index} {index}"));
                article.published_at = base_published_at
                    + chrono::Duration::seconds((feed_index * 100 + index) as i64);
                article.fetched_at = article.published_at + chrono::Duration::seconds(index as i64);
                article.is_read = index % 3 == 0;
                article.is_starred = index % 11 == 0;
                article
            })
        })
        .collect::<Vec<_>>();
    repo.upsert(&articles).unwrap();
    db.writer().execute_batch("ANALYZE;").unwrap();

    (account_id, feed_a, feed_b, folder_id)
}
