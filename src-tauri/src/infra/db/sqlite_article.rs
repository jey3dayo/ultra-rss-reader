use std::collections::HashSet;

use chrono::{DateTime, Utc};
use rusqlite::types::Type;
use rusqlite::{params, Connection, OptionalExtension};

use crate::domain::article::{
    Article, ArticleListHistoryItem, ArticleListItem, ArticleViewHistoryItem,
};
#[cfg(test)]
use crate::domain::constants::ARTICLE_MUTATION_TRANSACTION_CHUNK_SIZE;
use crate::domain::constants::RECENT_ARTICLE_HISTORY_LIMIT;
use crate::domain::error::DomainResult;
use crate::domain::types::{AccountId, ArticleId, FeedId, FolderId};
use crate::infra::db::sqlite_feed::recalculate_unread_count_with_conn;
use crate::infra::db::sqlite_mute_keyword::{
    build_mute_keyword_exclusion_clause, build_mute_keyword_match_clause,
    SqliteMuteKeywordRepository,
};
use crate::repository::article::{ArticleListMode, ArticleRepository, Pagination};
use crate::repository::mute_keyword::MuteKeywordRepository;
use crate::repository::pending_mutation::{PendingMutation, PendingMutationType};

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

        let sql = format!(
            "SELECT
                f.id,
                MAX(CASE WHEN {article_visible_clause} THEN a.published_at ELSE NULL END) AS latest_article_at,
                COALESCE(SUM(CASE WHEN {article_visible_clause} AND a.is_starred = 1 THEN 1 ELSE 0 END), 0) AS starred_count
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

pub(super) fn article_body_text(value: &str, summary: Option<&str>) -> String {
    if value.trim().is_empty() {
        summary.unwrap_or("").to_string()
    } else {
        crate::infra::sanitizer::extract_visible_text(value)
    }
}

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

pub(crate) fn mark_muted_unread_as_read_with_conn(
    conn: &Connection,
    account_id: &AccountId,
    candidate_ids: Option<&[ArticleId]>,
) -> DomainResult<usize> {
    let scope = candidate_ids
        .map(MutedUnreadCandidateScope::ArticleIds)
        .unwrap_or(MutedUnreadCandidateScope::Account);
    mark_muted_unread_as_read_with_scope(conn, account_id, scope)
}

pub(crate) fn mark_muted_unread_as_read_for_feed_with_conn(
    conn: &Connection,
    account_id: &AccountId,
    feed_id: &FeedId,
) -> DomainResult<usize> {
    mark_muted_unread_as_read_with_scope(conn, account_id, MutedUnreadCandidateScope::Feed(feed_id))
}

enum MutedUnreadCandidateScope<'a> {
    Account,
    Feed(&'a FeedId),
    ArticleIds(&'a [ArticleId]),
}

fn mark_muted_unread_as_read_with_scope(
    conn: &Connection,
    account_id: &AccountId,
    scope: MutedUnreadCandidateScope<'_>,
) -> DomainResult<usize> {
    let auto_mark_read_enabled = conn
        .query_row(
            "SELECT value FROM preferences WHERE key = 'mute_auto_mark_read'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()?
        .is_some_and(|value| value == "true");

    if !auto_mark_read_enabled || !SqliteMuteKeywordRepository::new(conn).has_any()? {
        return Ok(0);
    }

    if matches!(scope, MutedUnreadCandidateScope::ArticleIds([])) {
        return Ok(0);
    }

    let match_clause = build_mute_keyword_match_clause(
        "a.title",
        "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
    );

    let (scope_clause, params): (String, Vec<&dyn rusqlite::ToSql>) = match scope {
        MutedUnreadCandidateScope::Account => ("".to_string(), vec![&account_id.0]),
        MutedUnreadCandidateScope::Feed(feed_id) => (
            "AND a.feed_id = ?2".to_string(),
            vec![&account_id.0, &feed_id.0],
        ),
        MutedUnreadCandidateScope::ArticleIds(ids) => {
            let placeholders = ids
                .iter()
                .enumerate()
                .map(|(index, _)| format!("?{}", index + 2))
                .collect::<Vec<_>>()
                .join(", ");
            let mut params: Vec<&dyn rusqlite::ToSql> = vec![&account_id.0];
            for id in ids {
                params.push(&id.0);
            }
            (format!("AND a.id IN ({placeholders})"), params)
        }
    };
    let sql = format!(
        "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
         FROM articles a
         JOIN feeds f ON a.feed_id = f.id
         JOIN accounts acc ON f.account_id = acc.id
         WHERE f.account_id = ?1
           AND a.is_read = 0
           {scope_clause}
           AND {match_clause}"
    );

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map(params.as_slice(), |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    drop(stmt);

    if rows.is_empty() {
        return Ok(0);
    }

    {
        let mut update_stmt = conn.prepare("UPDATE articles SET is_read = 1 WHERE id = ?1")?;
        for (article_id, _, _, _, _, _) in &rows {
            update_stmt.execute(params![article_id])?;
        }
    }

    {
        let mut delete_pending_stmt = conn.prepare(
            "DELETE FROM pending_mutations WHERE account_id = ?1 AND remote_entry_id = ?2",
        )?;
        let mut insert_pending_stmt = conn.prepare(
            "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
             VALUES (?1, ?2, ?3, ?4)",
        )?;
        let now = Utc::now().to_rfc3339();

        for (_, _, remote_entry_id, account_kind, row_account_id, feed_remote_id) in &rows {
            if let Some(remote_entry_id) = remote_entry_id {
                let supports_remote_mutations = matches!(account_kind.as_str(), "FreshRss")
                    && feed_remote_id
                        .as_deref()
                        .is_some_and(|remote_id| remote_id.starts_with("feed/"));

                if supports_remote_mutations {
                    let mutation = PendingMutation {
                        id: None,
                        account_id: AccountId(row_account_id.clone()),
                        mutation_type: PendingMutationType::MarkRead,
                        remote_entry_id: remote_entry_id.clone(),
                        created_at: now.clone(),
                    };
                    delete_pending_stmt
                        .execute(params![mutation.account_id.0, mutation.remote_entry_id])?;
                    insert_pending_stmt.execute(params![
                        mutation.account_id.0,
                        mutation.mutation_type.as_str(),
                        mutation.remote_entry_id,
                        mutation.created_at,
                    ])?;
                }
            }
        }
    }

    {
        let mut feed_ids = rows
            .iter()
            .map(|(_, feed_id, _, _, _, _)| feed_id.clone())
            .collect::<Vec<_>>();
        feed_ids.sort();
        feed_ids.dedup();
        for feed_id in &feed_ids {
            recalculate_unread_count_with_conn(conn, &FeedId(feed_id.clone()))?;
        }
    }

    Ok(rows.len())
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
        let viewed_at = Utc::now().to_rfc3339();
        let tx = self.conn.unchecked_transaction()?;
        tx.execute(
            "INSERT INTO article_view_history (account_id, article_id, viewed_at)
             SELECT ?1, ?2, ?3
             WHERE EXISTS (
               SELECT 1
               FROM articles a
               JOIN feeds f ON a.feed_id = f.id
               WHERE a.id = ?2
                 AND f.account_id = ?1
             )
             ON CONFLICT(account_id, article_id)
             DO UPDATE SET viewed_at = excluded.viewed_at",
            params![account_id.0, article_id.0, viewed_at],
        )?;
        tx.execute(
            "DELETE FROM article_view_history
             WHERE account_id = ?1
               AND article_id NOT IN (
                 SELECT article_id
                 FROM article_view_history
                 WHERE account_id = ?1
                 ORDER BY viewed_at DESC
                 LIMIT ?2
               )",
            params![account_id.0, RECENT_ARTICLE_HISTORY_LIMIT as i64],
        )?;
        tx.commit()?;
        Ok(())
    }

    fn clear_view_history(&self, account_id: &AccountId) -> DomainResult<u64> {
        let removed = self.conn.execute(
            "DELETE FROM article_view_history WHERE account_id = ?1",
            params![account_id.0],
        )?;
        Ok(removed as u64)
    }

    fn upsert(&self, articles: &[Article]) -> DomainResult<()> {
        let tx = self.conn.unchecked_transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT INTO articles (id, account_id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, summary, url, author, published_at, thumbnail, is_read, is_starred, fetched_at, content_text)
                 VALUES (?1, (SELECT account_id FROM feeds WHERE id = ?2), ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
                 ON CONFLICT(id) DO UPDATE SET
                   account_id = excluded.account_id,
                   feed_id = excluded.feed_id,
                   title = excluded.title,
                   content_raw = excluded.content_raw,
                   content_sanitized = excluded.content_sanitized,
                   content_text = excluded.content_text,
                   sanitizer_version = excluded.sanitizer_version,
                   summary = excluded.summary,
                   url = excluded.url,
                   author = excluded.author,
                   published_at = excluded.published_at,
                   thumbnail = excluded.thumbnail,
                   fetched_at = excluded.fetched_at",
            )?;
            for article in articles {
                stmt.execute(params![
                    article.id.0,
                    article.feed_id.0,
                    article.remote_id,
                    article.title,
                    article.content_raw,
                    article.content_sanitized,
                    article.sanitizer_version,
                    article.summary,
                    article.url,
                    article.author,
                    article.published_at.to_rfc3339(),
                    article.thumbnail,
                    article.is_read,
                    article.is_starred,
                    article.fetched_at.to_rfc3339(),
                    article_body_text(&article.content_sanitized, article.summary.as_deref()),
                ])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    fn mark_as_read(&self, id: &ArticleId, read: bool) -> DomainResult<()> {
        self.conn.execute(
            "UPDATE articles SET is_read = ?1 WHERE id = ?2",
            params![read, id.0],
        )?;
        Ok(())
    }

    fn mark_many_as_read(&self, ids: &[ArticleId]) -> DomainResult<()> {
        if ids.is_empty() {
            return Ok(());
        }
        let tx = self.conn.unchecked_transaction()?;
        {
            let mut stmt = tx.prepare("UPDATE articles SET is_read = 1 WHERE id = ?1")?;
            for id in ids {
                stmt.execute(params![id.0])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    fn mark_muted_unread_as_read(
        &self,
        account_id: &AccountId,
        candidate_ids: Option<&[ArticleId]>,
    ) -> DomainResult<usize> {
        let tx = self.conn.unchecked_transaction()?;
        let changed = mark_muted_unread_as_read_with_conn(&tx, account_id, candidate_ids)?;
        tx.commit()?;
        Ok(changed)
    }

    fn mark_feed_as_read(&self, feed_id: &FeedId) -> DomainResult<u64> {
        let updated = self.conn.execute(
            "UPDATE articles SET is_read = 1 WHERE feed_id = ?1 AND is_read = 0",
            params![feed_id.0],
        )?;
        Ok(updated as u64)
    }

    fn mark_folder_as_read(&self, folder_id: &FolderId) -> DomainResult<u64> {
        let updated = self.conn.execute(
            "UPDATE articles SET is_read = 1 WHERE feed_id IN (SELECT id FROM feeds WHERE folder_id = ?1) AND is_read = 0",
            params![folder_id.0],
        )?;
        Ok(updated as u64)
    }

    fn mark_as_starred(&self, id: &ArticleId, starred: bool) -> DomainResult<()> {
        self.conn.execute(
            "UPDATE articles SET is_starred = ?1 WHERE id = ?2",
            params![starred, id.0],
        )?;
        Ok(())
    }

    fn purge_old_read(&self, account_id: &AccountId, before: DateTime<Utc>) -> DomainResult<u64> {
        let deleted = self.conn.execute(
            "DELETE FROM articles
             WHERE is_read = 1
               AND is_starred = 0
               AND fetched_at < ?1
               AND feed_id IN (SELECT id FROM feeds WHERE account_id = ?2)
               AND NOT EXISTS (
                 SELECT 1 FROM article_tags at WHERE at.article_id = articles.id
               )
               AND NOT EXISTS (
                 SELECT 1
                 FROM article_view_history h
                 WHERE h.account_id = ?2
                   AND h.article_id = articles.id
               )",
            params![before.to_rfc3339(), account_id.0],
        )?;
        Ok(deleted as u64)
    }

    fn update_sanitized(&self, id: &ArticleId, sanitized: &str, version: u32) -> DomainResult<()> {
        let summary = self
            .conn
            .query_row(
                "SELECT summary FROM articles WHERE id = ?1",
                params![id.0],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()?
            .flatten();
        self.conn.execute(
            "UPDATE articles
             SET content_sanitized = ?1,
                 content_text = ?2,
                 sanitizer_version = ?3
             WHERE id = ?4",
            params![
                sanitized,
                article_body_text(sanitized, summary.as_deref()),
                version,
                id.0
            ],
        )?;
        Ok(())
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
        let tx = self.conn.unchecked_transaction()?;
        let read_remote_id_set: HashSet<&str> =
            read_remote_ids.iter().map(String::as_str).collect();
        let starred_remote_id_set: HashSet<&str> =
            starred_remote_ids.iter().map(String::as_str).collect();
        let pending_read_remote_id_set: HashSet<&str> =
            pending_read_remote_ids.iter().map(String::as_str).collect();
        let pending_starred_remote_id_set: HashSet<&str> = pending_starred_remote_ids
            .iter()
            .map(String::as_str)
            .collect();

        // Get all articles with remote_id in this account (via feed -> account join)
        let mut stmt = tx.prepare(
            "SELECT a.id, a.remote_id, a.is_read, a.is_starred FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             WHERE f.account_id = ?1
               AND a.remote_id IS NOT NULL
               AND f.remote_id LIKE 'feed/%'",
        )?;

        let rows: Vec<(String, String, bool, bool)> = stmt
            .query_map(params![account_id.0], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, bool>(2)?,
                    row.get::<_, bool>(3)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let mut update_stmt =
            tx.prepare("UPDATE articles SET is_read = ?1, is_starred = ?2 WHERE id = ?3")?;

        for (article_id, remote_id, current_read, current_starred) in &rows {
            let remote_id = remote_id.as_str();
            let is_read = if pending_read_remote_id_set.contains(remote_id) {
                *current_read
            } else {
                read_remote_id_set.contains(remote_id)
            };
            let is_starred = if pending_starred_remote_id_set.contains(remote_id) {
                *current_starred
            } else {
                starred_remote_id_set.contains(remote_id)
            };
            if is_read == *current_read && is_starred == *current_starred {
                continue;
            }
            update_stmt.execute(params![is_read, is_starred, article_id])?;
        }

        drop(update_stmt);
        drop(stmt);
        tx.commit()?;
        Ok(())
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::db::connection::DbManager;
    use crate::repository::article::ArticleListMode;
    use crate::repository::feed::FeedRepository;
    use std::collections::HashSet;

    fn test_db() -> DbManager {
        DbManager::new_in_memory().unwrap()
    }

    fn insert_test_account(db: &DbManager) -> AccountId {
        let id = AccountId::new();
        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                params![id.0, "Local", "Test"],
            )
            .unwrap();
        id
    }

    fn insert_test_feed(db: &DbManager, account_id: &AccountId) -> FeedId {
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

    fn make_article(feed_id: &FeedId, title: &str) -> Article {
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

    fn assert_utc_rfc3339(value: &str) {
        let parsed = DateTime::parse_from_rfc3339(value).unwrap();
        assert_eq!(parsed.offset().local_minus_utc(), 0);
    }

    fn insert_mute_keyword(db: &DbManager, keyword: &str, scope: &str) {
        let now = Utc::now().to_rfc3339();
        db.writer()
            .execute(
                "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![uuid::Uuid::new_v4().to_string(), keyword, scope, now, now],
            )
            .unwrap();
    }

    #[test]
    fn upsert_persists_article_time_fields_as_utc_rfc3339() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        let mut article = make_article(&feed_id, "Offset article");
        article.published_at = DateTime::parse_from_rfc3339("2026-05-10T23:30:00+09:00")
            .unwrap()
            .with_timezone(&Utc);
        article.fetched_at = DateTime::parse_from_rfc3339("2026-05-11T00:30:00+09:00")
            .unwrap()
            .with_timezone(&Utc);

        repo.upsert(&[article.clone()]).unwrap();

        let (published_at, fetched_at): (String, String) = db
            .reader()
            .query_row(
                "SELECT published_at, fetched_at FROM articles WHERE id = ?1",
                params![article.id.0],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(published_at, "2026-05-10T14:30:00+00:00");
        assert_eq!(fetched_at, "2026-05-10T15:30:00+00:00");
        assert_utc_rfc3339(&published_at);
        assert_utc_rfc3339(&fetched_at);
    }

    #[test]
    fn raw_insert_normalizes_article_account_id_from_feed() {
        let db = test_db();
        let target_account_id = insert_test_account(&db);
        let other_account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &target_account_id);

        db.writer()
            .execute(
                "INSERT INTO articles (
                    id, account_id, feed_id, title, published_at, fetched_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    "raw-account-mismatch",
                    other_account_id.0,
                    feed_id.0,
                    "Raw mismatch",
                    "2026-06-17T00:00:00Z",
                    "2026-06-17T00:00:00Z"
                ],
            )
            .unwrap();

        let stored_account_id: String = db
            .reader()
            .query_row(
                "SELECT account_id FROM articles WHERE id = ?1",
                params!["raw-account-mismatch"],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(stored_account_id, target_account_id.0);

        let repo = SqliteArticleRepository::new(db.reader());
        assert!(repo
            .find_by_account(&other_account_id, &Pagination::default())
            .unwrap()
            .is_empty());
        assert_eq!(
            repo.find_by_account(&target_account_id, &Pagination::default())
                .unwrap()
                .len(),
            1
        );
    }

    #[test]
    fn feed_account_update_syncs_denormalized_article_account_ids() {
        let db = test_db();
        let original_account_id = insert_test_account(&db);
        let next_account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &original_account_id);
        let repo = SqliteArticleRepository::new(db.writer());
        let article = make_article(&feed_id, "Moved feed article");
        repo.upsert(std::slice::from_ref(&article)).unwrap();

        db.writer()
            .execute(
                "UPDATE feeds SET account_id = ?1 WHERE id = ?2",
                params![next_account_id.0, feed_id.0],
            )
            .unwrap();

        let stored_account_id: String = db
            .reader()
            .query_row(
                "SELECT account_id FROM articles WHERE id = ?1",
                params![article.id.0],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(stored_account_id, next_account_id.0);
    }

    fn table_columns(db: &DbManager, table_name: &str) -> HashSet<String> {
        let pragma = format!("PRAGMA table_info({table_name})");
        let mut stmt = db.writer().prepare(&pragma).unwrap();
        stmt.query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .collect::<Result<HashSet<_>, _>>()
            .unwrap()
    }

    fn index_names(db: &DbManager, table_name: &str) -> HashSet<String> {
        let pragma = format!("PRAGMA index_list({table_name})");
        let mut stmt = db.writer().prepare(&pragma).unwrap();
        stmt.query_map([], |row| row.get::<_, String>(1))
            .unwrap()
            .collect::<Result<HashSet<_>, _>>()
            .unwrap()
    }

    fn explain_query_plan(db: &DbManager, sql: &str) -> Vec<String> {
        let mut stmt = db
            .writer()
            .prepare(&format!("EXPLAIN QUERY PLAN {sql}"))
            .unwrap();
        stmt.query_map([], |row| row.get::<_, String>(3))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap()
    }

    fn assert_plan_uses_any(plan: &[String], expected_markers: &[&str]) {
        assert!(
            plan.iter().any(|detail| expected_markers
                .iter()
                .any(|marker| detail.contains(marker))),
            "query plan should contain one of {expected_markers:?}, got {plan:#?}"
        );
    }

    fn assert_no_unindexed_article_scan(plan: &[String]) {
        assert!(
            !plan
                .iter()
                .any(|detail| detail == "SCAN articles" || detail == "SCAN a"),
            "query plan should not full-scan articles without an index: {plan:#?}"
        );
    }

    fn assert_no_temp_order_sort(plan: &[String]) {
        assert!(
            !plan
                .iter()
                .any(|detail| detail.contains("USE TEMP B-TREE FOR ORDER BY")),
            "query plan should use an ordered index instead of a temp ORDER BY sort: {plan:#?}"
        );
    }

    fn seed_representative_article_dataset(
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
                    article.fetched_at =
                        article.published_at + chrono::Duration::seconds(index as i64);
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
        article.content_sanitized =
            "<p>sanitized body should stay out of list rows</p>".to_string();
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
    fn upsert_inserts_new_article() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        let article = make_article(&feed_id, "New Article");
        repo.upsert(std::slice::from_ref(&article)).unwrap();

        let found = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].title, "New Article");
    }

    #[test]
    fn find_by_feed_returns_decode_error_for_malformed_published_at() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        let article = make_article(&feed_id, "Malformed date article");
        repo.upsert(std::slice::from_ref(&article)).unwrap();
        db.writer()
            .execute(
                "UPDATE articles SET published_at = ?1 WHERE id = ?2",
                params!["not-a-date", article.id.0],
            )
            .unwrap();

        let result = repo.find_by_feed(&feed_id, &Pagination::default());

        assert!(result.is_err());
    }

    #[test]
    fn find_by_feed_returns_decode_error_for_malformed_fetched_at() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        let article = make_article(&feed_id, "Malformed fetched date article");
        repo.upsert(std::slice::from_ref(&article)).unwrap();
        db.writer()
            .execute(
                "UPDATE articles SET fetched_at = ?1 WHERE id = ?2",
                params!["not-a-date", article.id.0],
            )
            .unwrap();

        let result = repo.find_by_feed(&feed_id, &Pagination::default());

        assert!(result.is_err());
    }

    #[test]
    fn upsert_preserves_is_read_and_is_starred() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        let mut article = make_article(&feed_id, "Article");
        article.is_read = false;
        article.is_starred = false;
        repo.upsert(std::slice::from_ref(&article)).unwrap();

        // Mark as read and starred
        repo.mark_as_read(&article.id, true).unwrap();
        repo.mark_as_starred(&article.id, true).unwrap();

        // Upsert again with is_read=false, is_starred=false in the input
        article.title = "Updated Title".to_string();
        article.content_raw = "updated raw content".to_string();
        article.content_sanitized = "<p>Updated sanitized content</p>".to_string();
        article.is_read = false;
        article.is_starred = false;
        repo.upsert(std::slice::from_ref(&article)).unwrap();

        let found = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
        assert_eq!(found[0].title, "Updated Title");
        assert_eq!(found[0].content_raw, "updated raw content");
        assert_eq!(
            found[0].content_sanitized,
            "<p>Updated sanitized content</p>"
        );
        // is_read and is_starred should be preserved from the DB
        assert!(found[0].is_read);
        assert!(found[0].is_starred);
    }

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

    #[test]
    fn recalculate_unread_count_excludes_muted_unread_articles() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let article_repo = SqliteArticleRepository::new(db.writer());
        let feed_repo = crate::infra::db::sqlite_feed::SqliteFeedRepository::new(db.writer());

        let muted = make_article(&feed_id, "Kindle Unlimited offer");
        let visible = make_article(&feed_id, "Visible article");
        article_repo.upsert(&[muted, visible]).unwrap();
        insert_mute_keyword(&db, "kindle unlimited", "title");

        assert_eq!(feed_repo.recalculate_unread_count(&feed_id).unwrap(), 1);
    }

    #[test]
    fn mark_muted_unread_as_read_marks_existing_matches_and_updates_unread_count() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        db.writer()
            .execute(
                "INSERT INTO preferences (key, value) VALUES ('mute_auto_mark_read', 'true')",
                [],
            )
            .unwrap();
        insert_mute_keyword(&db, "kindle unlimited", "title");

        let repo = SqliteArticleRepository::new(db.writer());
        let feed_repo = crate::infra::db::sqlite_feed::SqliteFeedRepository::new(db.writer());

        let muted = make_article(&feed_id, "Kindle Unlimited offer");
        let visible = make_article(&feed_id, "Visible article");
        repo.upsert(&[muted.clone(), visible.clone()]).unwrap();
        feed_repo.recalculate_unread_count(&feed_id).unwrap();

        let changed = repo.mark_muted_unread_as_read(&account_id, None).unwrap();

        assert_eq!(changed, 1);
        let muted_is_read: bool = db
            .reader()
            .query_row(
                "SELECT is_read FROM articles WHERE id = ?1",
                params![muted.id.0],
                |row| row.get(0),
            )
            .unwrap();
        let visible_is_read: bool = db
            .reader()
            .query_row(
                "SELECT is_read FROM articles WHERE id = ?1",
                params![visible.id.0],
                |row| row.get(0),
            )
            .unwrap();
        assert!(muted_is_read);
        assert!(!visible_is_read);
        assert_eq!(feed_repo.recalculate_unread_count(&feed_id).unwrap(), 1);
    }

    #[test]
    fn mark_muted_unread_as_read_limits_changes_to_candidate_ids() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        db.writer()
            .execute(
                "INSERT INTO preferences (key, value) VALUES ('mute_auto_mark_read', 'true')",
                [],
            )
            .unwrap();
        insert_mute_keyword(&db, "kindle unlimited", "title");

        let repo = SqliteArticleRepository::new(db.writer());
        let feed_repo = crate::infra::db::sqlite_feed::SqliteFeedRepository::new(db.writer());

        let first = make_article(&feed_id, "Kindle Unlimited one");
        let second = make_article(&feed_id, "Kindle Unlimited two");
        repo.upsert(&[first.clone(), second.clone()]).unwrap();
        feed_repo.update_unread_count(&feed_id, 99).unwrap();

        let changed = repo
            .mark_muted_unread_as_read(&account_id, Some(std::slice::from_ref(&first.id)))
            .unwrap();

        assert_eq!(changed, 1);
        let first_is_read: bool = db
            .reader()
            .query_row(
                "SELECT is_read FROM articles WHERE id = ?1",
                params![first.id.0],
                |row| row.get(0),
            )
            .unwrap();
        let second_is_read: bool = db
            .reader()
            .query_row(
                "SELECT is_read FROM articles WHERE id = ?1",
                params![second.id.0],
                |row| row.get(0),
            )
            .unwrap();
        assert!(first_is_read);
        let stored_unread_count: i64 = db
            .reader()
            .query_row(
                "SELECT unread_count FROM feeds WHERE id = ?1",
                params![feed_id.0],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(stored_unread_count, 0);
        assert!(!second_is_read);
    }

    #[test]
    fn mark_muted_unread_as_read_for_feed_limits_empty_sync_repair_to_feed() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_a_id = insert_test_feed(&db, &account_id);
        let feed_b_id = insert_test_feed(&db, &account_id);
        db.writer()
            .execute(
                "INSERT INTO preferences (key, value) VALUES ('mute_auto_mark_read', 'true')",
                [],
            )
            .unwrap();
        insert_mute_keyword(&db, "kindle unlimited", "title");

        let repo = SqliteArticleRepository::new(db.writer());
        let feed_repo = crate::infra::db::sqlite_feed::SqliteFeedRepository::new(db.writer());

        let feed_a_muted = make_article(&feed_a_id, "Kindle Unlimited current feed");
        let feed_b_muted = make_article(&feed_b_id, "Kindle Unlimited sibling feed");
        repo.upsert(&[feed_a_muted.clone(), feed_b_muted.clone()])
            .unwrap();
        feed_repo.update_unread_count(&feed_a_id, 99).unwrap();
        feed_repo.update_unread_count(&feed_b_id, 77).unwrap();

        let changed =
            mark_muted_unread_as_read_for_feed_with_conn(db.writer(), &account_id, &feed_a_id)
                .unwrap();

        assert_eq!(changed, 1);
        let feed_a_is_read: bool = db
            .reader()
            .query_row(
                "SELECT is_read FROM articles WHERE id = ?1",
                params![feed_a_muted.id.0],
                |row| row.get(0),
            )
            .unwrap();
        let feed_b_is_read: bool = db
            .reader()
            .query_row(
                "SELECT is_read FROM articles WHERE id = ?1",
                params![feed_b_muted.id.0],
                |row| row.get(0),
            )
            .unwrap();
        let feed_a_unread_count: i64 = db
            .reader()
            .query_row(
                "SELECT unread_count FROM feeds WHERE id = ?1",
                params![feed_a_id.0],
                |row| row.get(0),
            )
            .unwrap();
        let feed_b_unread_count: i64 = db
            .reader()
            .query_row(
                "SELECT unread_count FROM feeds WHERE id = ?1",
                params![feed_b_id.0],
                |row| row.get(0),
            )
            .unwrap();

        assert!(feed_a_is_read);
        assert!(!feed_b_is_read);
        assert_eq!(feed_a_unread_count, 0);
        assert_eq!(feed_b_unread_count, 77);
    }

    #[test]
    fn article_mutation_transaction_policy_muted_auto_read_rolls_back_on_mid_batch_failure() {
        assert_eq!(ARTICLE_MUTATION_TRANSACTION_CHUNK_SIZE, None);

        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        db.writer()
            .execute(
                "INSERT INTO preferences (key, value) VALUES ('mute_auto_mark_read', 'true')",
                [],
            )
            .unwrap();
        insert_mute_keyword(&db, "kindle unlimited", "title");

        let repo = SqliteArticleRepository::new(db.writer());
        let first = make_article(&feed_id, "Kindle Unlimited first");
        let failing = make_article(&feed_id, "Kindle Unlimited failure");
        repo.upsert(&[first.clone(), failing.clone()]).unwrap();

        db.writer()
            .execute(
                "CREATE TEMP TRIGGER fail_muted_mark_read
                 BEFORE UPDATE OF is_read ON articles
                 WHEN NEW.title = 'Kindle Unlimited failure'
                 BEGIN
                   SELECT RAISE(ABORT, 'forced muted mark read failure');
                 END",
                [],
            )
            .unwrap();

        let error = repo
            .mark_muted_unread_as_read(&account_id, None)
            .expect_err("mid-batch failure should abort the transaction");

        assert!(error.to_string().contains("forced muted mark read failure"));
        for article in [&first, &failing] {
            let is_read: bool = db
                .reader()
                .query_row(
                    "SELECT is_read FROM articles WHERE id = ?1",
                    params![article.id.0],
                    |row| row.get(0),
                )
                .unwrap();
            assert!(!is_read);
        }
    }

    #[test]
    fn article_mutation_transaction_policy_muted_auto_read_handles_large_match_set() {
        assert_eq!(ARTICLE_MUTATION_TRANSACTION_CHUNK_SIZE, None);

        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        db.writer()
            .execute(
                "INSERT INTO preferences (key, value) VALUES ('mute_auto_mark_read', 'true')",
                [],
            )
            .unwrap();
        insert_mute_keyword(&db, "kindle unlimited", "title");

        let repo = SqliteArticleRepository::new(db.writer());
        let feed_repo = crate::infra::db::sqlite_feed::SqliteFeedRepository::new(db.writer());
        let articles = (0..250)
            .map(|index| make_article(&feed_id, &format!("Kindle Unlimited batch {index}")))
            .collect::<Vec<_>>();
        repo.upsert(&articles).unwrap();
        feed_repo.recalculate_unread_count(&feed_id).unwrap();

        let changed = repo.mark_muted_unread_as_read(&account_id, None).unwrap();

        assert_eq!(changed, articles.len());
        let unread_count: i64 = db
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM articles WHERE feed_id = ?1 AND is_read = 0",
                params![feed_id.0],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(unread_count, 0);
        assert_eq!(feed_repo.recalculate_unread_count(&feed_id).unwrap(), 0);
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
            .find_recently_viewed_by_account(
                &account_b,
                &Pagination::default(),
                ArticleListMode::All,
            )
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
            .find_recently_viewed_by_account(
                &account_id,
                &Pagination::default(),
                ArticleListMode::All,
            )
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
            .find_recently_viewed_by_account(
                &account_a,
                &Pagination::default(),
                ArticleListMode::All
            )
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

    #[test]
    fn mark_as_read_and_starred() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        let article = make_article(&feed_id, "Article");
        repo.upsert(std::slice::from_ref(&article)).unwrap();

        repo.mark_as_read(&article.id, true).unwrap();
        let found = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
        assert!(found[0].is_read);

        repo.mark_as_starred(&article.id, true).unwrap();
        let found = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
        assert!(found[0].is_starred);

        repo.mark_as_starred(&article.id, false).unwrap();
        let found = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
        assert!(!found[0].is_starred);
    }

    #[test]
    fn article_mutation_missing_id_contract_is_repository_noop() {
        let db = test_db();
        let repo = SqliteArticleRepository::new(db.writer());
        let missing_id = ArticleId("missing-article".to_string());

        repo.mark_as_read(&missing_id, true)
            .expect("missing article read mutation should be a no-op");
        repo.mark_many_as_read(&[missing_id.clone()])
            .expect("missing bulk article read mutation should be a no-op");
        repo.mark_as_starred(&missing_id, true)
            .expect("missing article star mutation should be a no-op");

        let article_count: i64 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM articles", [], |row| row.get(0))
            .expect("article count should succeed");
        assert_eq!(article_count, 0);
    }

    #[test]
    fn mark_many_as_read_with_empty_ids_is_repository_noop() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());
        let article = make_article(&feed_id, "Unread article");
        repo.upsert(std::slice::from_ref(&article))
            .expect("article insert should succeed");

        repo.mark_many_as_read(&[])
            .expect("empty bulk article read mutation should be a no-op");
        repo.mark_as_read(&article.id, true)
            .expect("subsequent article update should succeed");

        let found = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
        assert_eq!(found.len(), 1);
        assert!(found[0].is_read);
    }

    #[test]
    fn purge_old_read_keeps_unread_and_starred() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        let cutoff = Utc::now();
        let old_time = cutoff - chrono::Duration::days(1);

        // Old read article (should be purged)
        let mut a1 = make_article(&feed_id, "Old Read");
        a1.is_read = true;
        a1.fetched_at = old_time;

        // Old unread article (should be kept)
        let mut a2 = make_article(&feed_id, "Old Unread");
        a2.is_read = false;
        a2.fetched_at = old_time;

        // Old starred read article (should be kept)
        let mut a3 = make_article(&feed_id, "Old Starred");
        a3.is_read = true;
        a3.is_starred = true;
        a3.fetched_at = old_time;

        // New read article (should be kept)
        let mut a4 = make_article(&feed_id, "New Read");
        a4.is_read = true;
        a4.fetched_at = cutoff + chrono::Duration::hours(1);

        repo.upsert(&[a1, a2, a3, a4]).unwrap();

        let deleted = repo.purge_old_read(&account_id, cutoff).unwrap();
        assert_eq!(deleted, 1);

        let remaining = repo
            .find_by_feed(
                &feed_id,
                &Pagination {
                    offset: 0,
                    limit: 100,
                },
            )
            .unwrap();
        assert_eq!(remaining.len(), 3);
    }

    #[test]
    fn purge_old_read_keeps_tagged_and_view_history_articles() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        let cutoff = Utc::now();
        let old_time = cutoff - chrono::Duration::days(1);

        let mut plain_old_read = make_article(&feed_id, "Plain old read");
        plain_old_read.is_read = true;
        plain_old_read.published_at = old_time;
        plain_old_read.fetched_at = old_time;

        let mut tagged_old_read = make_article(&feed_id, "Tagged old read");
        tagged_old_read.is_read = true;
        tagged_old_read.published_at = old_time + chrono::Duration::minutes(1);
        tagged_old_read.fetched_at = old_time + chrono::Duration::minutes(1);

        let mut viewed_old_read = make_article(&feed_id, "Viewed old read");
        viewed_old_read.is_read = true;
        viewed_old_read.published_at = old_time + chrono::Duration::minutes(2);
        viewed_old_read.fetched_at = old_time + chrono::Duration::minutes(2);

        repo.upsert(&[
            plain_old_read.clone(),
            tagged_old_read.clone(),
            viewed_old_read.clone(),
        ])
        .unwrap();
        db.writer()
            .execute(
                "INSERT INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
                params!["tag-keep", "Keep", Option::<String>::None],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO article_tags (article_id, tag_id) VALUES (?1, ?2)",
                params![tagged_old_read.id.0, "tag-keep"],
            )
            .unwrap();
        repo.record_view(&account_id, &viewed_old_read.id).unwrap();

        let deleted = repo.purge_old_read(&account_id, cutoff).unwrap();

        assert_eq!(deleted, 1);
        let remaining_titles = repo
            .find_by_feed(
                &feed_id,
                &Pagination {
                    offset: 0,
                    limit: 10,
                },
            )
            .unwrap()
            .into_iter()
            .map(|article| article.title)
            .collect::<Vec<_>>();
        assert_eq!(remaining_titles, ["Viewed old read", "Tagged old read"]);
        assert_eq!(
            repo.find_recently_viewed_by_account(
                &account_id,
                &Pagination::default(),
                ArticleListMode::All
            )
            .unwrap()
            .len(),
            1
        );
    }

    #[test]
    fn purge_old_read_is_scoped_to_account() {
        let db = test_db();
        let target_account_id = insert_test_account(&db);
        let other_account_id = insert_test_account(&db);
        let target_feed_id = insert_test_feed(&db, &target_account_id);
        let other_feed_id = insert_test_feed(&db, &other_account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        let cutoff = Utc::now();
        let old_time = cutoff - chrono::Duration::days(1);

        let mut target_article = make_article(&target_feed_id, "Target Old Read");
        target_article.is_read = true;
        target_article.fetched_at = old_time;

        let mut other_article = make_article(&other_feed_id, "Other Old Read");
        other_article.is_read = true;
        other_article.fetched_at = old_time;

        repo.upsert(&[target_article, other_article]).unwrap();

        let deleted = repo.purge_old_read(&target_account_id, cutoff).unwrap();
        assert_eq!(deleted, 1);

        let other_remaining = repo
            .find_by_feed(&other_feed_id, &Pagination::default())
            .unwrap();
        assert_eq!(other_remaining.len(), 1);
    }

    #[test]
    fn apply_remote_state_sets_correct_states() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        let mut a1 = make_article(&feed_id, "Article 1");
        a1.remote_id = Some("r1".to_string());
        let mut a2 = make_article(&feed_id, "Article 2");
        a2.remote_id = Some("r2".to_string());
        let mut a3 = make_article(&feed_id, "Article 3");
        a3.remote_id = Some("r3".to_string());

        repo.upsert(&[a1.clone(), a2.clone(), a3.clone()]).unwrap();

        // r1 is read, r2 is starred, r3 is neither
        repo.apply_remote_state(
            &account_id,
            &["r1".to_string()],
            &["r2".to_string()],
            &[],
            &[],
        )
        .unwrap();

        let articles = repo
            .find_by_feed(
                &feed_id,
                &Pagination {
                    offset: 0,
                    limit: 100,
                },
            )
            .unwrap();

        let find = |id: &ArticleId| articles.iter().find(|a| a.id == *id).unwrap();

        assert!(find(&a1.id).is_read);
        assert!(!find(&a1.id).is_starred);

        assert!(!find(&a2.id).is_read);
        assert!(find(&a2.id).is_starred);

        assert!(!find(&a3.id).is_read);
        assert!(!find(&a3.id).is_starred);
    }

    #[test]
    fn apply_remote_state_skips_unchanged_rows() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        let mut read_article = make_article(&feed_id, "Read Article");
        read_article.remote_id = Some("r1".to_string());
        read_article.is_read = true;
        read_article.is_starred = false;

        let mut starred_article = make_article(&feed_id, "Starred Article");
        starred_article.remote_id = Some("r2".to_string());
        starred_article.is_read = false;
        starred_article.is_starred = true;

        repo.upsert(&[read_article, starred_article]).unwrap();

        let before = db.writer().total_changes();
        repo.apply_remote_state(
            &account_id,
            &["r1".to_string()],
            &["r2".to_string()],
            &[],
            &[],
        )
        .unwrap();

        assert_eq!(db.writer().total_changes(), before);
    }

    #[test]
    fn apply_remote_state_skips_pending_articles() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        let mut a1 = make_article(&feed_id, "Article 1");
        a1.remote_id = Some("r1".to_string());
        a1.is_read = true; // already read locally
        a1.is_starred = true;

        repo.upsert(&[a1.clone()]).unwrap();

        // Remote says r1 is NOT read and NOT starred, but r1 has both axes pending.
        repo.apply_remote_state(
            &account_id,
            &[],
            &[],
            &["r1".to_string()],
            &["r1".to_string()],
        )
        .unwrap();

        let articles = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
        // Should be unchanged because r1 is pending
        assert!(articles[0].is_read);
        assert!(articles[0].is_starred);
    }

    #[test]
    fn apply_remote_state_keeps_read_pending_separate_from_star_state() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        let mut article = make_article(&feed_id, "Article 1");
        article.remote_id = Some("r1".to_string());
        article.is_read = true;
        article.is_starred = false;

        repo.upsert(&[article.clone()]).unwrap();

        repo.apply_remote_state(
            &account_id,
            &[],
            &["r1".to_string()],
            &["r1".to_string()],
            &[],
        )
        .unwrap();

        let articles = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();

        assert!(articles[0].is_read);
        assert!(articles[0].is_starred);
    }

    #[test]
    fn apply_remote_state_keeps_star_pending_separate_from_read_state() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        let mut article = make_article(&feed_id, "Article 1");
        article.remote_id = Some("r1".to_string());
        article.is_read = false;
        article.is_starred = true;

        repo.upsert(&[article.clone()]).unwrap();

        repo.apply_remote_state(
            &account_id,
            &["r1".to_string()],
            &[],
            &[],
            &["r1".to_string()],
        )
        .unwrap();

        let articles = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();

        assert!(articles[0].is_read);
        assert!(articles[0].is_starred);
    }

    #[test]
    fn apply_remote_state_ignores_local_like_feed_ids() {
        let db = test_db();
        let account_id = AccountId::new();
        let feed_id = FeedId::new();
        let repo = SqliteArticleRepository::new(db.writer());

        db.writer()
            .execute(
                "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
                params![account_id.0, "FreshRss", "FreshRSS"],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO feeds (id, account_id, remote_id, title, url) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    feed_id.0,
                    account_id.0,
                    "https://example.com/feed.xml",
                    "Local-like Feed",
                    "https://example.com/feed.xml"
                ],
            )
            .unwrap();

        let mut article = make_article(&feed_id, "Article 1");
        article.remote_id = Some("local-guid-1".to_string());
        article.is_read = true;
        repo.upsert(&[article]).unwrap();

        repo.apply_remote_state(&account_id, &[], &[], &[], &[])
            .unwrap();

        let articles = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
        assert!(articles[0].is_read);
    }

    // Conflict-resolution contract (a): a queued local mutation masks the remote
    // value on the same axis, so the local pending intent wins during apply while
    // a non-pending entry on the same axis still adopts the remote value.
    #[test]
    fn local_pending_read_mutation_wins_over_remote_unread_during_apply() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        // r1 has a local "mark read" intent still queued; remote has not seen it yet.
        let mut pending_local = make_article(&feed_id, "Pending local read");
        pending_local.remote_id = Some("r1".to_string());
        pending_local.is_read = true;
        pending_local.is_starred = false;

        // r2 has no pending intent and should follow remote on the read axis.
        let mut remote_driven = make_article(&feed_id, "Remote driven read");
        remote_driven.remote_id = Some("r2".to_string());
        remote_driven.is_read = false;
        remote_driven.is_starred = false;

        repo.upsert(&[pending_local.clone(), remote_driven.clone()])
            .unwrap();

        // Remote reports neither entry as read; only r1 is pending on the read axis.
        repo.apply_remote_state(
            &account_id,
            &[],                 // remote read ids
            &[],                 // remote starred ids
            &["r1".to_string()], // pending read ids
            &[],                 // pending starred ids
        )
        .unwrap();

        let articles = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
        let find = |id: &ArticleId| articles.iter().find(|a| a.id == *id).unwrap();

        // r1 keeps the local pending read state (local wins over remote unread).
        assert!(find(&pending_local.id).is_read);
        // r2 follows remote and stays unread (remote wins when there is no pending intent).
        assert!(!find(&remote_driven.id).is_read);
        // Star axis was never touched by either remote or pending: both entries stay unstarred.
        assert!(!find(&pending_local.id).is_starred);
        assert!(!find(&remote_driven.id).is_starred);
    }

    // Conflict-resolution contract (b): re-applying the same remote state is
    // idempotent. The second apply touches no rows and leaves identical state.
    #[test]
    fn reapplying_same_remote_state_is_idempotent_for_read_and_star() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        let mut a1 = make_article(&feed_id, "Becomes read");
        a1.remote_id = Some("r1".to_string());
        let mut a2 = make_article(&feed_id, "Becomes starred");
        a2.remote_id = Some("r2".to_string());

        repo.upsert(&[a1.clone(), a2.clone()]).unwrap();

        let read_ids = ["r1".to_string()];
        let starred_ids = ["r2".to_string()];

        // First apply mutates rows to match remote.
        repo.apply_remote_state(&account_id, &read_ids, &starred_ids, &[], &[])
            .unwrap();

        let after_first = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
        let find_first = |id: &ArticleId| after_first.iter().find(|a| a.id == *id).unwrap();
        assert!(find_first(&a1.id).is_read);
        assert!(find_first(&a2.id).is_starred);

        // Second apply with the identical remote state must be a no-op (idempotent).
        // total_changes() is a session-cumulative counter: it counts only DML rows
        // (INSERT/UPDATE/DELETE) and does not increment for SELECT statements.
        let before_second = db.writer().total_changes();
        repo.apply_remote_state(&account_id, &read_ids, &starred_ids, &[], &[])
            .unwrap();
        assert_eq!(db.writer().total_changes(), before_second);

        let after_second = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
        let find_second = |id: &ArticleId| after_second.iter().find(|a| a.id == *id).unwrap();
        assert!(find_second(&a1.id).is_read);
        assert!(!find_second(&a1.id).is_starred);
        assert!(find_second(&a2.id).is_starred);
        assert!(!find_second(&a2.id).is_read);
    }

    // Conflict-resolution contract (c): after an interrupted sync, a re-sync
    // converges. While the mutation is still pending, apply preserves the local
    // value; once the push succeeds and the pending mask is gone, the next apply
    // adopts the remote value (state converges instead of oscillating).
    #[test]
    fn resync_converges_state_after_pending_mutation_clears() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        // Local marked r1 read; remote has not yet observed the change.
        let mut article = make_article(&feed_id, "Interrupted read");
        article.remote_id = Some("r1".to_string());
        article.is_read = true;
        article.is_starred = false;
        repo.upsert(&[article.clone()]).unwrap();

        // Interrupted sync: push failed, mutation is still queued, so the pending
        // mask protects the local read state even though remote reports unread.
        repo.apply_remote_state(&account_id, &[], &[], &["r1".to_string()], &[])
            .unwrap();
        let mid = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
        assert!(mid[0].is_read);
        // Star axis was never involved: still unstarred at mid-phase.
        assert!(!mid[0].is_starred);

        // Re-sync after the push succeeded and the pending mutation was cleared.
        // Remote now reflects the local change, so apply converges to remote=read.
        repo.apply_remote_state(&account_id, &["r1".to_string()], &[], &[], &[])
            .unwrap();
        let converged = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
        assert!(converged[0].is_read);
        assert!(!converged[0].is_starred);
    }

    #[test]
    fn update_sanitized_refreshes_search_text_and_version_for_old_article() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        let mut a1 = make_article(&feed_id, "Article 1");
        a1.sanitizer_version = 1;
        let mut a2 = make_article(&feed_id, "Article 2");
        a2.sanitizer_version = 2;

        repo.upsert(&[a1.clone(), a2.clone()]).unwrap();

        let old = repo.find_by_sanitizer_version_below(2, 100).unwrap();
        assert_eq!(old.len(), 1);
        assert_eq!(old[0].id, a1.id);

        repo.update_sanitized(&a1.id, "<p>new <strong>sanitized</strong></p>", 2)
            .unwrap();

        let old = repo.find_by_sanitizer_version_below(2, 100).unwrap();
        assert_eq!(old.len(), 0);

        let (content_text, sanitizer_version): (String, u32) = db
            .writer()
            .query_row(
                "SELECT content_text, sanitizer_version FROM articles WHERE id = ?1",
                params![a1.id.0],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();

        assert_eq!(content_text, "new sanitized");
        assert_eq!(sanitizer_version, 2);

        let visible_text_results = repo
            .search(&account_id, "new", &Pagination::default())
            .unwrap();
        let html_tag_results = repo
            .search(&account_id, "strong", &Pagination::default())
            .unwrap();

        assert_eq!(visible_text_results.len(), 1);
        assert_eq!(visible_text_results[0].id, a1.id);
        assert!(
            html_tag_results.is_empty(),
            "sanitizer repair should refresh FTS from content_text, not sanitized HTML tags"
        );
    }

    #[test]
    fn find_by_sanitizer_version_below_uses_deterministic_policy_then_oldest_batches() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());
        let base_time = DateTime::parse_from_rfc3339("2024-01-01T00:00:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let mut old_later = make_article(&feed_id, "Old later");
        old_later.id = ArticleId("old-later".to_string());
        old_later.sanitizer_version = 1;
        old_later.fetched_at = base_time + chrono::Duration::seconds(20);
        let mut older_same_time_b = make_article(&feed_id, "Older same time B");
        older_same_time_b.id = ArticleId("older-same-time-b".to_string());
        older_same_time_b.sanitizer_version = 0;
        older_same_time_b.fetched_at = base_time;
        let mut older_same_time_a = make_article(&feed_id, "Older same time A");
        older_same_time_a.id = ArticleId("older-same-time-a".to_string());
        older_same_time_a.sanitizer_version = 0;
        older_same_time_a.fetched_at = base_time;
        let mut current = make_article(&feed_id, "Current");
        current.id = ArticleId("current".to_string());
        current.sanitizer_version = 2;
        current.fetched_at = base_time - chrono::Duration::seconds(20);

        repo.upsert(&[
            old_later.clone(),
            older_same_time_b.clone(),
            current,
            older_same_time_a.clone(),
        ])
        .unwrap();

        let batch = repo.find_by_sanitizer_version_below(2, 2).unwrap();

        assert_eq!(
            batch
                .iter()
                .map(|article| article.id.0.as_str())
                .collect::<Vec<_>>(),
            vec!["older-same-time-a", "older-same-time-b"]
        );
    }

    #[test]
    fn upsert_uses_summary_fallback_when_sanitized_html_is_empty() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        let mut article = make_article(&feed_id, "Article 1");
        article.content_sanitized = "   ".to_string();
        article.summary = Some("Summary fallback body".to_string());

        repo.upsert(&[article.clone()]).unwrap();

        let content_text: String = db
            .writer()
            .query_row(
                "SELECT content_text FROM articles WHERE id = ?1",
                params![article.id.0],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(content_text, "Summary fallback body");
    }

    #[test]
    fn upsert_extracts_search_text_from_sanitized_html_for_new_articles() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        let mut article = make_article(&feed_id, "Article 1");
        article.content_sanitized = "<article><p>Lead <strong>body</article>Trailing".to_string();
        article.summary = Some("Summary fallback body".to_string());

        repo.upsert(&[article.clone()]).unwrap();

        let content_text: String = db
            .writer()
            .query_row(
                "SELECT content_text FROM articles WHERE id = ?1",
                params![article.id.0],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(content_text, "Lead body Trailing");
    }

    #[test]
    fn update_sanitized_preserves_summary_fallback_when_sanitized_html_is_empty() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        let mut article = make_article(&feed_id, "Article 1");
        article.summary = Some("Existing summary body".to_string());
        repo.upsert(&[article.clone()]).unwrap();

        repo.update_sanitized(&article.id, "", 2).unwrap();

        let content_text: String = db
            .writer()
            .query_row(
                "SELECT content_text FROM articles WHERE id = ?1",
                params![article.id.0],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(content_text, "Existing summary body");
    }

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

    #[test]
    fn count_orphaned_articles_detects_missing_feed_references() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        repo.upsert(&[make_article(&feed_id, "Healthy Article")])
            .unwrap();

        db.writer()
            .execute_batch("PRAGMA foreign_keys = OFF;")
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, summary, url, author, published_at, thumbnail, is_read, is_starred, fetched_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                params![
                    "orphan-article",
                    "missing-feed",
                    Option::<String>::None,
                    "Broken Article",
                    "",
                    "",
                    1,
                    Option::<String>::None,
                    Option::<String>::None,
                    Option::<String>::None,
                    "2026-04-01T00:00:00Z",
                    Option::<String>::None,
                    false,
                    false,
                    "2026-04-01T00:00:00Z"
                ],
            )
            .unwrap();
        db.writer()
            .execute_batch("PRAGMA foreign_keys = ON;")
            .unwrap();

        assert_eq!(repo.count_orphaned_articles().unwrap(), 1);
    }

    #[test]
    fn list_orphaned_feed_groups_returns_grouped_details() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        repo.upsert(&[make_article(&feed_id, "Healthy Article")])
            .unwrap();

        db.writer()
            .execute_batch("PRAGMA foreign_keys = OFF;")
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, summary, url, author, published_at, thumbnail, is_read, is_starred, fetched_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                params![
                    "orphan-article-1",
                    "missing-feed",
                    Option::<String>::None,
                    "Broken Latest",
                    "",
                    "",
                    1,
                    Option::<String>::None,
                    Option::<String>::None,
                    Option::<String>::None,
                    "2026-04-02T00:00:00Z",
                    Option::<String>::None,
                    false,
                    false,
                    "2026-04-02T00:00:00Z"
                ],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, summary, url, author, published_at, thumbnail, is_read, is_starred, fetched_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                params![
                    "orphan-article-2",
                    "missing-feed",
                    Option::<String>::None,
                    "Broken Older",
                    "",
                    "",
                    1,
                    Option::<String>::None,
                    Option::<String>::None,
                    Option::<String>::None,
                    "2026-04-01T00:00:00Z",
                    Option::<String>::None,
                    false,
                    false,
                    "2026-04-01T00:00:00Z"
                ],
            )
            .unwrap();
        db.writer()
            .execute_batch("PRAGMA foreign_keys = ON;")
            .unwrap();

        let groups = repo.list_orphaned_feed_groups().unwrap();

        assert_eq!(
            groups,
            vec![OrphanedFeedGroup {
                missing_feed_id: "missing-feed".to_string(),
                article_count: 2,
                latest_article_title: Some("Broken Latest".to_string()),
                latest_article_published_at: Some("2026-04-02T00:00:00Z".to_string()),
            }]
        );
    }

    #[test]
    fn delete_orphaned_articles_removes_only_missing_feed_references() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        repo.upsert(&[make_article(&feed_id, "Healthy Article")])
            .unwrap();

        db.writer()
            .execute_batch("PRAGMA foreign_keys = OFF;")
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, summary, url, author, published_at, thumbnail, is_read, is_starred, fetched_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                params![
                    "orphan-article",
                    "missing-feed",
                    Option::<String>::None,
                    "Broken Article",
                    "",
                    "",
                    1,
                    Option::<String>::None,
                    Option::<String>::None,
                    Option::<String>::None,
                    "2026-04-01T00:00:00Z",
                    Option::<String>::None,
                    false,
                    false,
                    "2026-04-01T00:00:00Z"
                ],
            )
            .unwrap();
        db.writer()
            .execute_batch("PRAGMA foreign_keys = ON;")
            .unwrap();

        assert_eq!(repo.delete_orphaned_articles().unwrap(), 1);
        assert_eq!(repo.count_orphaned_articles().unwrap(), 0);
        assert_eq!(
            repo.find_by_feed(&feed_id, &Pagination::default())
                .unwrap()
                .len(),
            1
        );
    }
}
