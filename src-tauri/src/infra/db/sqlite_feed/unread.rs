use std::collections::HashMap;

use rusqlite::{params, Connection};

use crate::domain::error::DomainResult;
use crate::domain::types::FeedId;
use crate::infra::db::sqlite_mute_keyword::{
    build_mute_keyword_exclusion_clause, SqliteMuteKeywordRepository,
};
use crate::repository::mute_keyword::MuteKeywordRepository;

use super::mapping::normalize_unread_count;

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

    let placeholders = std::iter::repeat_n("?", feed_ids.len())
        .collect::<Vec<_>>()
        .join(", ");
    let params: Vec<&dyn rusqlite::types::ToSql> = feed_ids
        .iter()
        .map(|id| &id.0 as &dyn rusqlite::types::ToSql)
        .collect();

    if !SqliteMuteKeywordRepository::new(conn).has_any()? {
        let sql = format!(
            "UPDATE feeds
             SET unread_count = (
               SELECT COUNT(*) FROM articles WHERE articles.feed_id = feeds.id AND articles.is_read = 0
             )
             WHERE feeds.id IN ({placeholders})"
        );
        conn.execute(&sql, rusqlite::params_from_iter(params))?;
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
               WHERE articles.feed_id = feeds.id
                 AND articles.is_read = 0
                 AND {mute_clause}
             )
             WHERE feeds.id IN ({placeholders})"
        );
        conn.execute(&sql, rusqlite::params_from_iter(params))?;
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

    let placeholders = std::iter::repeat_n("?", feed_ids.len())
        .collect::<Vec<_>>()
        .join(", ");
    let params: Vec<&dyn rusqlite::types::ToSql> = feed_ids
        .iter()
        .map(|id| &id.0 as &dyn rusqlite::types::ToSql)
        .collect();

    let sql = format!("SELECT id, unread_count FROM feeds WHERE id IN ({placeholders})");
    let mut stmt = conn.prepare(&sql)?;
    let counts = stmt
        .query_map(rusqlite::params_from_iter(params), |row| {
            Ok((FeedId(row.get::<_, String>(0)?), row.get::<_, i32>(1)?))
        })?
        .collect::<Result<HashMap<_, _>, _>>()?;

    Ok(counts)
}
