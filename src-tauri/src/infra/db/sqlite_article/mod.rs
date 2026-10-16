use std::collections::HashMap;

use chrono::{DateTime, Utc};
use rusqlite::types::Type;
use rusqlite::{params, Connection, OptionalExtension};

use crate::domain::article::{
    Article, ArticleListHistoryItem, ArticleListItem, ArticleViewHistoryItem,
};
use crate::domain::constants::RECENT_ARTICLE_ACTIVITY_WINDOW_DAYS;
use crate::domain::error::DomainResult;
use crate::domain::types::{AccountId, ArticleId, FeedId, FolderId};
use crate::infra::db::sqlite_mute_keyword::{
    build_mute_keyword_exclusion_clause, SqliteMuteKeywordRepository,
};
pub use crate::repository::article::FeedArticleSummary;
use crate::repository::article::{
    ArticleListMode, ArticleListRepository, ArticleReadRepository, Pagination,
};
use crate::repository::mute_keyword::MuteKeywordRepository;

mod diagnostics;
mod history;
mod list;
mod maintenance;
mod mutation;
mod read;
mod remote_state;
#[cfg(test)]
mod tests;

pub(in crate::infra::db) use mutation::article_body_text;
pub(crate) use mutation::{
    mark_muted_unread_as_read_for_feed_with_conn, mark_muted_unread_as_read_with_conn,
    upsert_articles_with_conn,
};

pub struct SqliteArticleRepository<'a> {
    conn: &'a Connection,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OrphanedFeedGroup {
    pub missing_feed_id: String,
    pub article_count: i64,
    pub latest_article_title: Option<String>,
    pub latest_article_published_at: Option<String>,
}

/// Per-feed article aggregates for the `urr feed list` / `feed diagnose` CLI
/// commands. Not part of `ArticleReadRepository` or `ArticleListRepository`:
/// those serve the app's own read paths.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct FeedArticleStats {
    pub article_count: i64,
    pub latest_published_at: Option<DateTime<Utc>>,
    pub latest_fetched_at: Option<DateTime<Utc>>,
}

impl<'a> SqliteArticleRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    fn select_cols_prefixed(cols: &str, alias: &str) -> String {
        cols.split(", ")
            .map(|col| format!("{alias}.{col}"))
            .collect::<Vec<_>>()
            .join(", ")
    }

    fn find_by_folder_with_filter(
        &self,
        folder_id: &FolderId,
        pagination: &Pagination,
        article_filter: Option<&str>,
    ) -> DomainResult<Vec<Article>> {
        let select_cols_prefixed = SELECT_COLS
            .split(", ")
            .map(|col| format!("a.{col}"))
            .collect::<Vec<_>>()
            .join(", ");
        let mut filters = vec!["f.folder_id = ?1".to_string()];

        if let Some(filter) = article_filter {
            filters.push(filter.to_string());
        }

        if SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            filters.push(build_mute_keyword_exclusion_clause(
                "a.title",
                "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
            ));
        }

        let where_clause = filters.join(" AND ");
        let sql = format!(
            "SELECT {select_cols_prefixed} FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             WHERE {where_clause}
             ORDER BY {ARTICLE_ORDER_DESC_PREFIXED}
             LIMIT ?2 OFFSET ?3"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let articles = stmt
            .query_map(
                params![
                    folder_id.0,
                    pagination.limit as i64,
                    pagination.offset as i64
                ],
                row_to_article,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(articles)
    }

    fn list_by_folder_with_filter(
        &self,
        folder_id: &FolderId,
        pagination: &Pagination,
        article_filter: Option<&str>,
    ) -> DomainResult<Vec<ArticleListItem>> {
        let select_cols_prefixed = Self::select_cols_prefixed(ARTICLE_LIST_SELECT_COLS, "a");
        let mut filters = vec!["f.folder_id = ?1".to_string()];

        if let Some(filter) = article_filter {
            filters.push(filter.to_string());
        }

        if SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            filters.push(build_mute_keyword_exclusion_clause(
                "a.title",
                "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
            ));
        }

        let where_clause = filters.join(" AND ");
        let sql = format!(
            "SELECT {select_cols_prefixed} FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             WHERE {where_clause}
             ORDER BY {ARTICLE_ORDER_DESC_PREFIXED}
             LIMIT ?2 OFFSET ?3"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let articles = stmt
            .query_map(
                params![
                    folder_id.0,
                    pagination.limit as i64,
                    pagination.offset as i64
                ],
                row_to_article_list_item,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(articles)
    }
}

fn parse_datetime(s: &str) -> rusqlite::Result<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|err| rusqlite::Error::FromSqlConversionFailure(0, Type::Text, Box::new(err)))
}

fn row_to_article(row: &rusqlite::Row) -> rusqlite::Result<Article> {
    let published_at_str: String = row.get(11)?;
    let fetched_at_str: String = row.get(14)?;
    Ok(Article {
        id: ArticleId(row.get(0)?),
        feed_id: FeedId(row.get(1)?),
        remote_id: row.get(2)?,
        title: row.get(3)?,
        content_raw: row.get(4)?,
        content_sanitized: row.get(5)?,
        sanitizer_version: row.get(6)?,
        summary: row.get(7)?,
        url: row.get(8)?,
        author: row.get(9)?,
        thumbnail: row.get(10)?,
        published_at: parse_datetime(&published_at_str)?,
        is_read: row.get(12)?,
        is_starred: row.get(13)?,
        fetched_at: parse_datetime(&fetched_at_str)?,
    })
}

const SELECT_COLS: &str = "id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, summary, url, author, thumbnail, published_at, is_read, is_starred, fetched_at";
const ARTICLE_LIST_SELECT_COLS: &str =
    "id, feed_id, title, summary, url, author, published_at, thumbnail, is_read, is_starred";
const ARTICLE_ORDER_DESC: &str = "published_at DESC, fetched_at DESC, id DESC";
const ARTICLE_ORDER_DESC_PREFIXED: &str = "a.published_at DESC, a.fetched_at DESC, a.id DESC";

fn build_fts_query(query: &str) -> Option<String> {
    // Search treats every whitespace-separated token as literal text. FTS5
    // operators, quotes, and prefix markers are intentionally not user syntax.
    let terms = query
        .split_whitespace()
        .filter(|term| !term.is_empty())
        .map(|term| format!("\"{}\"", term.replace('"', "\"\"")))
        .collect::<Vec<_>>();
    if terms.is_empty() {
        None
    } else {
        Some(terms.join(" "))
    }
}

fn escaped_like_pattern(query: &str) -> String {
    let escaped_query = query
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");
    format!("%{escaped_query}%")
}

fn build_search_fts_sql(select_cols_prefixed: &str, mute_clause: &str) -> String {
    format!(
        "WITH matched(article_id, published_at, fetched_at) AS (
           SELECT a.id, a.published_at, a.fetched_at FROM articles a
           JOIN feeds f ON a.feed_id = f.id
           JOIN articles_fts fts ON a.rowid = fts.rowid
           WHERE f.account_id = ?1
             AND articles_fts MATCH ?2
             AND {mute_clause}
         )
         SELECT {select_cols_prefixed} FROM articles a
         JOIN matched m ON m.article_id = a.id
         ORDER BY m.published_at DESC, m.fetched_at DESC, m.article_id DESC
         LIMIT ?3 OFFSET ?4"
    )
}

fn build_search_list_fts_sql(select_cols_prefixed: &str, mute_clause: &str) -> String {
    build_search_fts_sql(select_cols_prefixed, mute_clause)
}

fn build_search_like_sql(select_cols_prefixed: &str, mute_clause: &str) -> String {
    format!(
        "WITH matched(article_id, published_at, fetched_at) AS (
           SELECT a.id, a.published_at, a.fetched_at FROM articles a
           JOIN feeds f ON a.feed_id = f.id
           WHERE f.account_id = ?1
             AND (
               a.title LIKE ?2 ESCAPE '\\'
               OR (
                 CASE
                   WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '')
                   ELSE a.content_text
                 END
               ) LIKE ?2 ESCAPE '\\'
             )
             AND {mute_clause}
         )
         SELECT {select_cols_prefixed} FROM articles a
         JOIN matched m ON m.article_id = a.id
         ORDER BY m.published_at DESC, m.fetched_at DESC, m.article_id DESC
         LIMIT ?3 OFFSET ?4"
    )
}

fn search_fts_has_any(
    conn: &Connection,
    account_id: &AccountId,
    fts_query: &str,
    mute_clause: &str,
) -> DomainResult<bool> {
    let sql = format!(
        "SELECT 1 FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         JOIN articles_fts fts ON a.rowid = fts.rowid
         WHERE f.account_id = ?1
           AND articles_fts MATCH ?2
           AND {mute_clause}
         LIMIT 1"
    );
    let has_any = conn
        .query_row(&sql, params![account_id.0, fts_query], |_| Ok(()))
        .optional()?
        .is_some();
    Ok(has_any)
}

fn row_to_article_view_history_item(
    row: &rusqlite::Row,
) -> rusqlite::Result<ArticleViewHistoryItem> {
    let article = row_to_article(row)?;
    let viewed_at_str: String = row.get(16)?;
    Ok(ArticleViewHistoryItem {
        account_id: AccountId(row.get(15)?),
        article,
        viewed_at: parse_datetime(&viewed_at_str)?,
    })
}

fn row_to_article_list_item(row: &rusqlite::Row) -> rusqlite::Result<ArticleListItem> {
    let published_at_str: String = row.get(6)?;
    Ok(ArticleListItem {
        id: ArticleId(row.get(0)?),
        feed_id: FeedId(row.get(1)?),
        title: row.get(2)?,
        summary: row.get(3)?,
        url: row.get(4)?,
        author: row.get(5)?,
        published_at: parse_datetime(&published_at_str)?,
        thumbnail: row.get(7)?,
        is_read: row.get(8)?,
        is_starred: row.get(9)?,
    })
}

fn row_to_article_list_history_item(
    row: &rusqlite::Row,
) -> rusqlite::Result<ArticleListHistoryItem> {
    let article = row_to_article_list_item(row)?;
    let viewed_at_str: String = row.get(11)?;
    Ok(ArticleListHistoryItem {
        account_id: AccountId(row.get(10)?),
        article,
        viewed_at: parse_datetime(&viewed_at_str)?,
    })
}
