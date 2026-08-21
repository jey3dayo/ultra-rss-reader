use std::collections::HashMap;

use rusqlite::{params, Connection};

use crate::domain::error::DomainResult;
use crate::domain::types::FeedId;
use crate::infra::db::sqlite_mute_keyword::{
    build_mute_keyword_exclusion_clause, SqliteMuteKeywordRepository,
};
use crate::repository::mute_keyword::MuteKeywordRepository;

use super::mapping::normalize_unread_count;

/// SQLite's default compile-time limit on the number of host parameters in a
/// single statement (`SQLITE_LIMIT_VARIABLE_NUMBER`) is 999 in many builds;
/// keep well under that so IN (...) queries never fail on large feed sets.
#[cfg(not(test))]
const UNREAD_QUERY_FEED_ID_CHUNK_SIZE: usize = 500;
#[cfg(test)]
const UNREAD_QUERY_FEED_ID_CHUNK_SIZE: usize = 3;

pub(crate) fn recalculate_unread_count_with_conn(
    conn: &Connection,
    feed_id: &FeedId,
) -> DomainResult<i32> {
    if !SqliteMuteKeywordRepository::new(conn).has_any()? {
        conn.execute(
            "UPDATE feeds SET unread_count = (SELECT COUNT(*) FROM articles WHERE feed_id = ?1 AND is_read = 0) WHERE id = ?1",
            params![feed_id.0],
        )?;
    } else {
        let mute_clause = build_mute_keyword_exclusion_clause(
            "title",
            "CASE WHEN trim(coalesce(content_text, '')) = '' THEN coalesce(summary, '') ELSE content_text END",
        );
        let sql = format!(
            "UPDATE feeds
             SET unread_count = (
               SELECT COUNT(*)
               FROM articles
               WHERE feed_id = ?1
                 AND is_read = 0
                 AND {mute_clause}
             )
             WHERE id = ?1"
        );
        conn.execute(&sql, params![feed_id.0])?;
    }
    let count: i64 = conn.query_row(
        "SELECT unread_count FROM feeds WHERE id = ?1",
        params![feed_id.0],
        |row| row.get(0),
    )?;
    Ok(normalize_unread_count(count))
}

pub(crate) fn recalculate_unread_counts_with_conn(
    conn: &Connection,
    feed_ids: &[FeedId],
) -> DomainResult<()> {
    if feed_ids.is_empty() {
        return Ok(());
    }

    let has_mute_keywords = SqliteMuteKeywordRepository::new(conn).has_any()?;
    let mute_clause = if has_mute_keywords {
        Some(build_mute_keyword_exclusion_clause(
            "title",
            "CASE WHEN trim(coalesce(content_text, '')) = '' THEN coalesce(summary, '') ELSE content_text END",
        ))
    } else {
        None
    };

    for chunk in feed_ids.chunks(UNREAD_QUERY_FEED_ID_CHUNK_SIZE) {
        let placeholders = std::iter::repeat_n("?", chunk.len())
            .collect::<Vec<_>>()
            .join(", ");
        let params: Vec<&dyn rusqlite::types::ToSql> = chunk
            .iter()
            .map(|id| &id.0 as &dyn rusqlite::types::ToSql)
            .collect();

        if let Some(ref mute_clause) = mute_clause {
            let sql = format!(
                "UPDATE feeds
                 SET unread_count = (
                   SELECT COUNT(*)
                   FROM articles
                   WHERE articles.feed_id = feeds.id
                     AND articles.is_read = 0
                     AND {mute_clause}
                 )
                 WHERE feeds.id IN ({placeholders})"
            );
            conn.execute(&sql, rusqlite::params_from_iter(params))?;
        } else {
            let sql = format!(
                "UPDATE feeds
                 SET unread_count = (
                   SELECT COUNT(*) FROM articles WHERE articles.feed_id = feeds.id AND articles.is_read = 0
                 )
                 WHERE feeds.id IN ({placeholders})"
            );
            conn.execute(&sql, rusqlite::params_from_iter(params))?;
        }
    }
    Ok(())
}

pub(crate) fn unread_counts_for_feed_ids_with_conn(
    conn: &Connection,
    feed_ids: &[FeedId],
) -> DomainResult<HashMap<FeedId, i32>> {
    if feed_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let mut counts = HashMap::with_capacity(feed_ids.len());
    for chunk in feed_ids.chunks(UNREAD_QUERY_FEED_ID_CHUNK_SIZE) {
        let placeholders = std::iter::repeat_n("?", chunk.len())
            .collect::<Vec<_>>()
            .join(", ");
        let params: Vec<&dyn rusqlite::types::ToSql> = chunk
            .iter()
            .map(|id| &id.0 as &dyn rusqlite::types::ToSql)
            .collect();

        let sql = format!("SELECT id, unread_count FROM feeds WHERE id IN ({placeholders})");
        let mut stmt = conn.prepare(&sql)?;
        let chunk_counts = stmt
            .query_map(rusqlite::params_from_iter(params), |row| {
                Ok((FeedId(row.get::<_, String>(0)?), row.get::<_, i32>(1)?))
            })?
            .collect::<Result<HashMap<_, _>, _>>()?;
        counts.extend(chunk_counts);
    }

    Ok(counts)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::types::AccountId;
    use crate::infra::db::connection::DbManager;

    fn test_db() -> DbManager {
        DbManager::new_in_memory().expect("in-memory db should initialize")
    }

    fn insert_test_account(db: &DbManager) -> AccountId {
        let id = AccountId::new();
        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                params![id.0, "Local", "Test"],
            )
            .expect("account fixture insert should succeed");
        id
    }

    fn insert_test_feed(db: &DbManager, account_id: &AccountId, index: usize) -> FeedId {
        let feed_id = FeedId(format!("feed-{index}"));
        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, title, url, unread_count) VALUES (?1, ?2, ?3, ?4, 0)",
                params![
                    feed_id.0,
                    account_id.0,
                    format!("Feed {index}"),
                    format!("http://example.com/feed-{index}"),
                ],
            )
            .expect("feed fixture insert should succeed");
        feed_id
    }

    fn insert_unread_article(db: &DbManager, feed_id: &FeedId, article_index: usize) {
        let now = chrono::Utc::now().to_rfc3339();
        db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, title, published_at, fetched_at, is_read) VALUES (?1, ?2, ?3, ?4, ?5, 0)",
                params![
                    format!("{}-a{article_index}", feed_id.0),
                    feed_id.0,
                    format!("Article {article_index}"),
                    now,
                    now,
                ],
            )
            .expect("article fixture insert should succeed");
    }

    #[test]
    fn recalculate_unread_counts_with_conn_handles_feed_count_over_chunk_size() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        // UNREAD_QUERY_FEED_ID_CHUNK_SIZE is overridden to 3 under #[cfg(test)];
        // use more than 2x that to exercise the chunk-boundary and final partial chunk.
        let feed_ids: Vec<FeedId> = (0..7)
            .map(|i| insert_test_feed(&db, &account_id, i))
            .collect();
        for feed_id in &feed_ids {
            insert_unread_article(&db, feed_id, 1);
            insert_unread_article(&db, feed_id, 2);
        }

        recalculate_unread_counts_with_conn(db.writer(), &feed_ids)
            .expect("recalculation across chunk boundary should succeed");

        for feed_id in &feed_ids {
            let count: i64 = db
                .writer()
                .query_row(
                    "SELECT unread_count FROM feeds WHERE id = ?1",
                    params![feed_id.0],
                    |row| row.get(0),
                )
                .expect("feed row should exist after recalculation");
            assert_eq!(count, 2, "feed {} should have 2 unread articles", feed_id.0);
        }
    }

    #[test]
    fn unread_counts_for_feed_ids_with_conn_handles_feed_count_over_chunk_size() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_ids: Vec<FeedId> = (0..7)
            .map(|i| insert_test_feed(&db, &account_id, i))
            .collect();
        for (i, feed_id) in feed_ids.iter().enumerate() {
            for article_index in 0..=i {
                insert_unread_article(&db, feed_id, article_index);
            }
            recalculate_unread_count_with_conn(db.writer(), feed_id)
                .expect("per-feed recalculation fixture setup should succeed");
        }

        let counts = unread_counts_for_feed_ids_with_conn(db.writer(), &feed_ids)
            .expect("count lookup across chunk boundary should succeed");

        assert_eq!(counts.len(), feed_ids.len());
        for (i, feed_id) in feed_ids.iter().enumerate() {
            assert_eq!(
                counts.get(feed_id).copied(),
                Some((i + 1) as i32),
                "feed {} should report {} unread articles",
                feed_id.0,
                i + 1
            );
        }
    }
}
