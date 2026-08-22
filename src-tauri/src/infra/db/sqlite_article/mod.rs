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
use crate::repository::article::{ArticleListMode, ArticleRepository, Pagination};
use crate::repository::mute_keyword::MuteKeywordRepository;

mod mutation;
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FeedArticleSummary {
    pub feed_id: FeedId,
    pub latest_article_at: Option<String>,
    pub starred_count: i32,
    /// Number of visible articles published within the recent activity window
    /// (last `RECENT_ARTICLE_ACTIVITY_WINDOW_DAYS` days, future-dated rows excluded).
    /// Raw count only; frequency-tier classification lives in the frontend
    /// (`src/lib/subscriptions/subscription-update-frequency.ts`).
    pub recent_article_count: i32,
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

    pub fn count_orphaned_articles(&self) -> DomainResult<i64> {
        let count = self.conn.query_row(
            "SELECT COUNT(*)
             FROM articles a
             LEFT JOIN feeds f ON a.feed_id = f.id
             WHERE f.id IS NULL",
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    pub fn list_orphaned_article_ids(&self) -> DomainResult<Vec<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT a.id
             FROM articles a
             LEFT JOIN feeds f ON a.feed_id = f.id
             WHERE f.id IS NULL
             ORDER BY a.id ASC",
        )?;
        let ids = stmt
            .query_map([], |row| row.get(0))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(ids)
    }

    pub fn delete_orphaned_articles(&self) -> DomainResult<i64> {
        let deleted = self.conn.execute(
            "DELETE FROM articles
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM feeds f
                 WHERE f.id = articles.feed_id
             )",
            [],
        )?;
        Ok(deleted as i64)
    }

    pub fn delete_orphaned_articles_by_ids(&self, article_ids: &[String]) -> DomainResult<i64> {
        let mut deleted = 0_i64;
        for article_id in article_ids {
            deleted += self.conn.execute(
                "DELETE FROM articles
                 WHERE id = ?1
                   AND NOT EXISTS (
                       SELECT 1
                       FROM feeds f
                       WHERE f.id = articles.feed_id
                   )",
                params![article_id],
            )? as i64;
        }
        Ok(deleted)
    }

    pub fn list_orphaned_feed_groups(&self) -> DomainResult<Vec<OrphanedFeedGroup>> {
        let mut stmt = self.conn.prepare(
            "SELECT
                a.feed_id,
                COUNT(*) AS article_count,
                (
                    SELECT a2.title
                    FROM articles a2
                    WHERE a2.feed_id = a.feed_id
                    ORDER BY a2.published_at DESC, a2.fetched_at DESC, a2.id DESC
                    LIMIT 1
                ) AS latest_article_title,
                (
                    SELECT a2.published_at
                    FROM articles a2
                    WHERE a2.feed_id = a.feed_id
                    ORDER BY a2.published_at DESC, a2.fetched_at DESC, a2.id DESC
                    LIMIT 1
                ) AS latest_article_published_at
            FROM articles a
            LEFT JOIN feeds f ON a.feed_id = f.id
            WHERE f.id IS NULL
            GROUP BY a.feed_id
            ORDER BY article_count DESC, latest_article_published_at DESC, a.feed_id ASC",
        )?;
        let groups = stmt
            .query_map([], |row| {
                Ok(OrphanedFeedGroup {
                    missing_feed_id: row.get(0)?,
                    article_count: row.get(1)?,
                    latest_article_title: row.get(2)?,
                    latest_article_published_at: row.get(3)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(groups)
    }

    pub fn list_feed_article_summaries_by_account(
        &self,
        account_id: &AccountId,
    ) -> DomainResult<Vec<FeedArticleSummary>> {
        let article_visible_clause = if SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            let mute_clause = build_mute_keyword_exclusion_clause(
                "a.title",
                "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
            );
            format!("a.id IS NOT NULL AND {mute_clause}")
        } else {
            "a.id IS NOT NULL".to_string()
        };

        // Recent activity window is bounded on both sides so future-dated rows
        // (feeds that publish with pubDates ahead of "now") never inflate the
        // count. `julianday` parses RFC3339 offsets; NULL/malformed published_at
        // yields NULL and is excluded by the comparison.
        let recent_window_clause = format!(
            "julianday(a.published_at) >= julianday('now', '-{RECENT_ARTICLE_ACTIVITY_WINDOW_DAYS} days') \
             AND julianday(a.published_at) <= julianday('now')"
        );

        let sql = format!(
            "SELECT
                f.id,
                MAX(CASE WHEN {article_visible_clause} THEN a.published_at ELSE NULL END) AS latest_article_at,
                COALESCE(SUM(CASE WHEN {article_visible_clause} AND a.is_starred = 1 THEN 1 ELSE 0 END), 0) AS starred_count,
                COALESCE(SUM(CASE WHEN {article_visible_clause} AND {recent_window_clause} THEN 1 ELSE 0 END), 0) AS recent_article_count
             FROM feeds f
             LEFT JOIN articles a ON a.feed_id = f.id
             WHERE f.account_id = ?1
             GROUP BY f.id
             ORDER BY f.title ASC, f.id ASC"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let summaries = stmt
            .query_map(params![account_id.0], |row| {
                Ok(FeedArticleSummary {
                    feed_id: FeedId(row.get(0)?),
                    latest_article_at: row.get(1)?,
                    starred_count: row.get(2)?,
                    recent_article_count: row.get(3)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(summaries)
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

impl ArticleRepository for SqliteArticleRepository<'_> {
    fn find_by_id(&self, id: &ArticleId) -> DomainResult<Option<Article>> {
        let sql = format!("SELECT {SELECT_COLS} FROM articles WHERE id = ?1");
        let article = self
            .conn
            .query_row(&sql, params![id.0], row_to_article)
            .optional()?;
        Ok(article)
    }

    fn find_by_feed(
        &self,
        feed_id: &FeedId,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>> {
        if !SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            let sql = format!(
                "SELECT {SELECT_COLS} FROM articles WHERE feed_id = ?1 ORDER BY {ARTICLE_ORDER_DESC} LIMIT ?2 OFFSET ?3"
            );
            let mut stmt = self.conn.prepare(&sql)?;
            let articles = stmt
                .query_map(
                    params![feed_id.0, pagination.limit as i64, pagination.offset as i64],
                    row_to_article,
                )?
                .collect::<Result<Vec<_>, _>>()?;
            return Ok(articles);
        }

        let mute_clause = build_mute_keyword_exclusion_clause(
            "title",
            "CASE WHEN trim(coalesce(content_text, '')) = '' THEN coalesce(summary, '') ELSE content_text END",
        );
        let sql = format!(
            "SELECT {SELECT_COLS} FROM articles
             WHERE feed_id = ?1
               AND {mute_clause}
             ORDER BY {ARTICLE_ORDER_DESC}
             LIMIT ?2 OFFSET ?3"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let articles = stmt
            .query_map(
                params![feed_id.0, pagination.limit as i64, pagination.offset as i64],
                row_to_article,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(articles)
    }

    fn find_unread_by_feed(
        &self,
        feed_id: &FeedId,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>> {
        if !SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            let sql = format!(
                "SELECT {SELECT_COLS} FROM articles
                 WHERE feed_id = ?1
                   AND is_read = 0
                 ORDER BY {ARTICLE_ORDER_DESC}
                 LIMIT ?2 OFFSET ?3"
            );
            let mut stmt = self.conn.prepare(&sql)?;
            let articles = stmt
                .query_map(
                    params![feed_id.0, pagination.limit as i64, pagination.offset as i64],
                    row_to_article,
                )?
                .collect::<Result<Vec<_>, _>>()?;
            return Ok(articles);
        }

        let mute_clause = build_mute_keyword_exclusion_clause(
            "title",
            "CASE WHEN trim(coalesce(content_text, '')) = '' THEN coalesce(summary, '') ELSE content_text END",
        );
        let sql = format!(
            "SELECT {SELECT_COLS} FROM articles
             WHERE feed_id = ?1
               AND is_read = 0
               AND {mute_clause}
             ORDER BY {ARTICLE_ORDER_DESC}
             LIMIT ?2 OFFSET ?3"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let articles = stmt
            .query_map(
                params![feed_id.0, pagination.limit as i64, pagination.offset as i64],
                row_to_article,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(articles)
    }

    fn find_starred_by_feed(
        &self,
        feed_id: &FeedId,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>> {
        if !SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            let sql = format!(
                "SELECT {SELECT_COLS} FROM articles
                 WHERE feed_id = ?1
                   AND is_starred = 1
                 ORDER BY {ARTICLE_ORDER_DESC}
                 LIMIT ?2 OFFSET ?3"
            );
            let mut stmt = self.conn.prepare(&sql)?;
            let articles = stmt
                .query_map(
                    params![feed_id.0, pagination.limit as i64, pagination.offset as i64],
                    row_to_article,
                )?
                .collect::<Result<Vec<_>, _>>()?;
            return Ok(articles);
        }

        let mute_clause = build_mute_keyword_exclusion_clause(
            "title",
            "CASE WHEN trim(coalesce(content_text, '')) = '' THEN coalesce(summary, '') ELSE content_text END",
        );
        let sql = format!(
            "SELECT {SELECT_COLS} FROM articles
             WHERE feed_id = ?1
               AND is_starred = 1
               AND {mute_clause}
             ORDER BY {ARTICLE_ORDER_DESC}
             LIMIT ?2 OFFSET ?3"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let articles = stmt
            .query_map(
                params![feed_id.0, pagination.limit as i64, pagination.offset as i64],
                row_to_article,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(articles)
    }

    fn find_by_account(
        &self,
        account_id: &AccountId,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>> {
        if !SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            let sql = format!(
                "SELECT {SELECT_COLS} FROM articles
                 WHERE account_id = ?1
                 ORDER BY {ARTICLE_ORDER_DESC}
                 LIMIT ?2 OFFSET ?3"
            );
            let mut stmt = self.conn.prepare(&sql)?;
            let articles = stmt
                .query_map(
                    params![
                        account_id.0,
                        pagination.limit as i64,
                        pagination.offset as i64
                    ],
                    row_to_article,
                )?
                .collect::<Result<Vec<_>, _>>()?;
            return Ok(articles);
        }

        let mute_clause = build_mute_keyword_exclusion_clause(
            "title",
            "CASE WHEN trim(coalesce(content_text, '')) = '' THEN coalesce(summary, '') ELSE content_text END",
        );
        let sql = format!(
            "SELECT {SELECT_COLS} FROM articles
             WHERE account_id = ?1
               AND {mute_clause}
             ORDER BY {ARTICLE_ORDER_DESC}
             LIMIT ?2 OFFSET ?3"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let articles = stmt
            .query_map(
                params![
                    account_id.0,
                    pagination.limit as i64,
                    pagination.offset as i64
                ],
                row_to_article,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(articles)
    }

    fn find_unread_by_account(
        &self,
        account_id: &AccountId,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>> {
        if !SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            let sql = format!(
                "SELECT {SELECT_COLS} FROM articles
                 WHERE account_id = ?1
                   AND is_read = 0
                 ORDER BY {ARTICLE_ORDER_DESC}
                 LIMIT ?2 OFFSET ?3"
            );
            let mut stmt = self.conn.prepare(&sql)?;
            let articles = stmt
                .query_map(
                    params![
                        account_id.0,
                        pagination.limit as i64,
                        pagination.offset as i64
                    ],
                    row_to_article,
                )?
                .collect::<Result<Vec<_>, _>>()?;
            return Ok(articles);
        }

        let mute_clause = build_mute_keyword_exclusion_clause(
            "title",
            "CASE WHEN trim(coalesce(content_text, '')) = '' THEN coalesce(summary, '') ELSE content_text END",
        );
        let sql = format!(
            "SELECT {SELECT_COLS} FROM articles
             WHERE account_id = ?1
               AND is_read = 0
               AND {mute_clause}
             ORDER BY {ARTICLE_ORDER_DESC}
             LIMIT ?2 OFFSET ?3"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let articles = stmt
            .query_map(
                params![
                    account_id.0,
                    pagination.limit as i64,
                    pagination.offset as i64
                ],
                row_to_article,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(articles)
    }

    fn find_by_folder(
        &self,
        folder_id: &FolderId,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>> {
        self.find_by_folder_with_filter(folder_id, pagination, None)
    }

    fn find_unread_by_folder(
        &self,
        folder_id: &FolderId,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>> {
        self.find_by_folder_with_filter(folder_id, pagination, Some("a.is_read = 0"))
    }

    fn find_starred_by_folder(
        &self,
        folder_id: &FolderId,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>> {
        self.find_by_folder_with_filter(folder_id, pagination, Some("a.is_starred = 1"))
    }

    fn find_starred_by_account(
        &self,
        account_id: &AccountId,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>> {
        if !SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            let sql = format!(
                "SELECT {SELECT_COLS} FROM articles
                 WHERE account_id = ?1
                   AND is_starred = 1
                 ORDER BY {ARTICLE_ORDER_DESC}
                 LIMIT ?2 OFFSET ?3"
            );
            let mut stmt = self.conn.prepare(&sql)?;
            let articles = stmt
                .query_map(
                    params![
                        account_id.0,
                        pagination.limit as i64,
                        pagination.offset as i64
                    ],
                    row_to_article,
                )?
                .collect::<Result<Vec<_>, _>>()?;
            return Ok(articles);
        }

        let mute_clause = build_mute_keyword_exclusion_clause(
            "title",
            "CASE WHEN trim(coalesce(content_text, '')) = '' THEN coalesce(summary, '') ELSE content_text END",
        );
        let sql = format!(
            "SELECT {SELECT_COLS} FROM articles
             WHERE account_id = ?1
               AND is_starred = 1
               AND {mute_clause}
             ORDER BY {ARTICLE_ORDER_DESC}
             LIMIT ?2 OFFSET ?3"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let articles = stmt
            .query_map(
                params![
                    account_id.0,
                    pagination.limit as i64,
                    pagination.offset as i64
                ],
                row_to_article,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(articles)
    }

    fn find_recently_viewed_by_account(
        &self,
        account_id: &AccountId,
        pagination: &Pagination,
        mode: ArticleListMode,
    ) -> DomainResult<Vec<ArticleViewHistoryItem>> {
        let select_cols_prefixed = SELECT_COLS
            .split(", ")
            .map(|col| format!("a.{col}"))
            .collect::<Vec<_>>()
            .join(", ");
        let mut filters = vec![
            "h.account_id = ?1".to_string(),
            "f.account_id = ?1".to_string(),
        ];
        if let Some(mode_filter) = mode.sql_filter("a") {
            filters.push(mode_filter);
        }
        if SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            filters.push(build_mute_keyword_exclusion_clause(
                "a.title",
                "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
            ));
        }
        let where_clause = filters.join(" AND ");
        let sql = format!(
            "SELECT {select_cols_prefixed}, h.account_id, h.viewed_at
             FROM article_view_history h
             JOIN articles a ON h.article_id = a.id
             JOIN feeds f ON a.feed_id = f.id
             WHERE {where_clause}
             ORDER BY h.viewed_at DESC
             LIMIT ?2 OFFSET ?3"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let items = stmt
            .query_map(
                params![
                    account_id.0,
                    pagination.limit as i64,
                    pagination.offset as i64
                ],
                row_to_article_view_history_item,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(items)
    }

    fn count_unread_by_account(&self, account_id: &AccountId) -> DomainResult<i32> {
        if !SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            let count = self.conn.query_row(
                "SELECT COUNT(*) FROM articles WHERE account_id = ?1 AND is_read = 0",
                params![account_id.0],
                |row| row.get(0),
            )?;
            return Ok(count);
        }

        let mute_clause = build_mute_keyword_exclusion_clause(
            "title",
            "CASE WHEN trim(coalesce(content_text, '')) = '' THEN coalesce(summary, '') ELSE content_text END",
        );
        let sql = format!(
            "SELECT COUNT(*) FROM articles
             WHERE account_id = ?1
               AND is_read = 0
               AND {mute_clause}"
        );
        let count = self
            .conn
            .query_row(&sql, params![account_id.0], |row| row.get(0))?;
        Ok(count)
    }

    fn count_starred_by_account(&self, account_id: &AccountId) -> DomainResult<i32> {
        if !SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            let count = self.conn.query_row(
                "SELECT COUNT(*) FROM articles WHERE account_id = ?1 AND is_starred = 1",
                params![account_id.0],
                |row| row.get(0),
            )?;
            return Ok(count);
        }

        let mute_clause = build_mute_keyword_exclusion_clause(
            "title",
            "CASE WHEN trim(coalesce(content_text, '')) = '' THEN coalesce(summary, '') ELSE content_text END",
        );
        let sql = format!(
            "SELECT COUNT(*) FROM articles
             WHERE account_id = ?1
               AND is_starred = 1
               AND {mute_clause}"
        );
        let count = self
            .conn
            .query_row(&sql, params![account_id.0], |row| row.get(0))?;
        Ok(count)
    }

    fn record_view(&self, account_id: &AccountId, article_id: &ArticleId) -> DomainResult<()> {
        self.record_view_body(account_id, article_id)
    }

    fn clear_view_history(&self, account_id: &AccountId) -> DomainResult<u64> {
        self.clear_view_history_body(account_id)
    }

    fn upsert(&self, articles: &[Article]) -> DomainResult<()> {
        self.upsert_body(articles)
    }

    fn mark_as_read(&self, id: &ArticleId, read: bool) -> DomainResult<()> {
        self.mark_as_read_body(id, read)
    }

    fn mark_many_as_read(&self, ids: &[ArticleId]) -> DomainResult<()> {
        self.mark_many_as_read_body(ids)
    }

    fn mark_muted_unread_as_read(
        &self,
        account_id: &AccountId,
        candidate_ids: Option<&[ArticleId]>,
    ) -> DomainResult<usize> {
        self.mark_muted_unread_as_read_body(account_id, candidate_ids)
    }

    fn mark_feed_as_read(&self, feed_id: &FeedId) -> DomainResult<u64> {
        self.mark_feed_as_read_body(feed_id)
    }

    fn mark_folder_as_read(&self, folder_id: &FolderId) -> DomainResult<u64> {
        self.mark_folder_as_read_body(folder_id)
    }

    fn mark_as_starred(&self, id: &ArticleId, starred: bool) -> DomainResult<()> {
        self.mark_as_starred_body(id, starred)
    }

    fn purge_old_read(&self, account_id: &AccountId, before: DateTime<Utc>) -> DomainResult<u64> {
        self.purge_old_read_body(account_id, before)
    }

    fn update_sanitized(&self, id: &ArticleId, sanitized: &str, version: u32) -> DomainResult<()> {
        self.update_sanitized_body(id, sanitized, version)
    }

    fn find_by_sanitizer_version_below(
        &self,
        version: u32,
        limit: usize,
    ) -> DomainResult<Vec<Article>> {
        let sql = format!(
            "SELECT {SELECT_COLS} FROM articles
             WHERE sanitizer_version < ?1
             ORDER BY sanitizer_version ASC, fetched_at ASC, id ASC
             LIMIT ?2"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let articles = stmt
            .query_map(params![version, limit as i64], row_to_article)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(articles)
    }

    fn apply_remote_state(
        &self,
        account_id: &AccountId,
        read_remote_ids: &[String],
        starred_remote_ids: &[String],
        pending_read_remote_ids: &[String],
        pending_starred_remote_ids: &[String],
    ) -> DomainResult<()> {
        self.apply_remote_state_body(
            account_id,
            read_remote_ids,
            starred_remote_ids,
            pending_read_remote_ids,
            pending_starred_remote_ids,
        )
    }

    fn search(
        &self,
        account_id: &AccountId,
        query: &str,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>> {
        let Some(fts_query) = build_fts_query(query) else {
            return Ok(Vec::new());
        };
        let select_cols_prefixed = SELECT_COLS
            .split(", ")
            .map(|c| format!("a.{c}"))
            .collect::<Vec<_>>()
            .join(", ");

        let mute_clause = build_mute_keyword_exclusion_clause(
            "a.title",
            "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
        );

        let search_sql = build_search_fts_sql(&select_cols_prefixed, &mute_clause);
        let mut stmt = self.conn.prepare(&search_sql)?;
        let articles = stmt
            .query_map(
                params![
                    account_id.0,
                    fts_query,
                    pagination.limit as i64,
                    pagination.offset as i64
                ],
                row_to_article,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        if !articles.is_empty() {
            return Ok(articles);
        }
        if pagination.offset > 0
            && search_fts_has_any(self.conn, account_id, &fts_query, &mute_clause)?
        {
            return Ok(Vec::new());
        }

        let search_sql = build_search_like_sql(&select_cols_prefixed, &mute_clause);
        let like_pattern = escaped_like_pattern(query);
        let mut stmt = self.conn.prepare(&search_sql)?;
        let articles = stmt
            .query_map(
                params![
                    account_id.0,
                    like_pattern,
                    pagination.limit as i64,
                    pagination.offset as i64
                ],
                row_to_article,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(articles)
    }

    fn list_by_feed(
        &self,
        feed_id: &FeedId,
        pagination: &Pagination,
        mode: ArticleListMode,
    ) -> DomainResult<Vec<ArticleListItem>> {
        let mut filters = vec!["feed_id = ?1".to_string()];
        if let Some(mode_filter) = mode.sql_filter("articles") {
            filters.push(mode_filter);
        }
        if SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            filters.push(build_mute_keyword_exclusion_clause(
                "title",
                "CASE WHEN trim(coalesce(content_text, '')) = '' THEN coalesce(summary, '') ELSE content_text END",
            ));
        }
        let where_clause = filters.join(" AND ");
        let sql = format!(
            "SELECT {ARTICLE_LIST_SELECT_COLS} FROM articles
             WHERE {where_clause}
             ORDER BY {ARTICLE_ORDER_DESC}
             LIMIT ?2 OFFSET ?3"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let articles = stmt
            .query_map(
                params![feed_id.0, pagination.limit as i64, pagination.offset as i64],
                row_to_article_list_item,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(articles)
    }

    fn list_by_account(
        &self,
        account_id: &AccountId,
        pagination: &Pagination,
        mode: ArticleListMode,
    ) -> DomainResult<Vec<ArticleListItem>> {
        let mut filters = vec!["account_id = ?1".to_string()];
        if let Some(mode_filter) = mode.sql_filter("articles") {
            filters.push(mode_filter);
        }
        if SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            filters.push(build_mute_keyword_exclusion_clause(
                "title",
                "CASE WHEN trim(coalesce(content_text, '')) = '' THEN coalesce(summary, '') ELSE content_text END",
            ));
        }
        let where_clause = filters.join(" AND ");
        let sql = format!(
            "SELECT {ARTICLE_LIST_SELECT_COLS} FROM articles
             WHERE {where_clause}
             ORDER BY {ARTICLE_ORDER_DESC}
             LIMIT ?2 OFFSET ?3"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let articles = stmt
            .query_map(
                params![
                    account_id.0,
                    pagination.limit as i64,
                    pagination.offset as i64
                ],
                row_to_article_list_item,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(articles)
    }

    fn list_by_folder(
        &self,
        folder_id: &FolderId,
        pagination: &Pagination,
        mode: ArticleListMode,
    ) -> DomainResult<Vec<ArticleListItem>> {
        self.list_by_folder_with_filter(folder_id, pagination, mode.sql_filter("a").as_deref())
    }

    fn list_recently_viewed_by_account(
        &self,
        account_id: &AccountId,
        pagination: &Pagination,
        mode: ArticleListMode,
    ) -> DomainResult<Vec<ArticleListHistoryItem>> {
        let select_cols_prefixed = Self::select_cols_prefixed(ARTICLE_LIST_SELECT_COLS, "a");
        let mut filters = vec![
            "h.account_id = ?1".to_string(),
            "f.account_id = ?1".to_string(),
        ];
        if let Some(mode_filter) = mode.sql_filter("a") {
            filters.push(mode_filter);
        }
        if SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            filters.push(build_mute_keyword_exclusion_clause(
                "a.title",
                "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
            ));
        }
        let where_clause = filters.join(" AND ");
        let sql = format!(
            "SELECT {select_cols_prefixed}, h.account_id, h.viewed_at
             FROM article_view_history h
             JOIN articles a ON h.article_id = a.id
             JOIN feeds f ON a.feed_id = f.id
             WHERE {where_clause}
             ORDER BY h.viewed_at DESC
             LIMIT ?2 OFFSET ?3"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let items = stmt
            .query_map(
                params![
                    account_id.0,
                    pagination.limit as i64,
                    pagination.offset as i64
                ],
                row_to_article_list_history_item,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(items)
    }

    fn search_list(
        &self,
        account_id: &AccountId,
        query: &str,
        pagination: &Pagination,
    ) -> DomainResult<Vec<ArticleListItem>> {
        let Some(fts_query) = build_fts_query(query) else {
            return Ok(Vec::new());
        };
        let select_cols_prefixed = Self::select_cols_prefixed(ARTICLE_LIST_SELECT_COLS, "a");
        let mute_clause = build_mute_keyword_exclusion_clause(
            "a.title",
            "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
        );
        let search_sql = build_search_list_fts_sql(&select_cols_prefixed, &mute_clause);
        let mut stmt = self.conn.prepare(&search_sql)?;
        let articles = stmt
            .query_map(
                params![
                    account_id.0,
                    fts_query,
                    pagination.limit as i64,
                    pagination.offset as i64
                ],
                row_to_article_list_item,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        if !articles.is_empty() {
            return Ok(articles);
        }
        if pagination.offset > 0
            && search_fts_has_any(self.conn, account_id, &fts_query, &mute_clause)?
        {
            return Ok(Vec::new());
        }

        let search_sql = build_search_like_sql(&select_cols_prefixed, &mute_clause);
        let like_pattern = escaped_like_pattern(query);
        let mut stmt = self.conn.prepare(&search_sql)?;
        let articles = stmt
            .query_map(
                params![
                    account_id.0,
                    like_pattern,
                    pagination.limit as i64,
                    pagination.offset as i64
                ],
                row_to_article_list_item,
            )?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(articles)
    }
}
