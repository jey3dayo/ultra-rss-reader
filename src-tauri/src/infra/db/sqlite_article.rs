use chrono::{DateTime, Utc};
use rusqlite::types::Type;
use rusqlite::{params, Connection, OptionalExtension};

use crate::domain::article::{Article, ArticleViewHistoryItem};
use crate::domain::constants::RECENT_ARTICLE_HISTORY_LIMIT;
use crate::domain::error::DomainResult;
use crate::domain::types::{AccountId, ArticleId, FeedId, FolderId};
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

pub(crate) fn mark_muted_unread_as_read_with_conn(
    conn: &Connection,
    account_id: &AccountId,
    candidate_ids: Option<&[ArticleId]>,
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

    if candidate_ids.is_some_and(|ids| ids.is_empty()) {
        return Ok(0);
    }

    let match_clause = build_mute_keyword_match_clause(
        "a.title",
        "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
    );

    let (sql, params): (String, Vec<&dyn rusqlite::ToSql>) = if let Some(ids) = candidate_ids {
        let placeholders = ids
            .iter()
            .enumerate()
            .map(|(index, _)| format!("?{}", index + 2))
            .collect::<Vec<_>>()
            .join(", ");
        let sql = format!(
            "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
             FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             JOIN accounts acc ON f.account_id = acc.id
             WHERE f.account_id = ?1
               AND a.is_read = 0
               AND a.id IN ({placeholders})
               AND {match_clause}"
        );
        let mut params: Vec<&dyn rusqlite::ToSql> = vec![&account_id.0];
        for id in ids {
            params.push(&id.0);
        }
        (sql, params)
    } else {
        (
            format!(
                "SELECT a.id, a.feed_id, a.remote_id, acc.kind, f.account_id, f.remote_id
                 FROM articles a
                 JOIN feeds f ON a.feed_id = f.id
                 JOIN accounts acc ON f.account_id = acc.id
                 WHERE f.account_id = ?1
                   AND a.is_read = 0
                   AND {match_clause}"
            ),
            vec![&account_id.0],
        )
    };

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
        let mut recalc_stmt = conn.prepare(
            "UPDATE feeds
             SET unread_count = (
                SELECT COUNT(*)
                FROM articles
                WHERE feed_id = ?1 AND is_read = 0
             )
             WHERE id = ?1",
        )?;
        for feed_id in &feed_ids {
            recalc_stmt.execute(params![feed_id])?;
        }
    }

    Ok(rows.len())
}

impl ArticleRepository for SqliteArticleRepository<'_> {
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
            let select_cols_prefixed = SELECT_COLS
                .split(", ")
                .map(|col| format!("a.{col}"))
                .collect::<Vec<_>>()
                .join(", ");
            let sql = format!(
                "SELECT {select_cols_prefixed} FROM articles a
                 JOIN feeds f ON a.feed_id = f.id
                 WHERE f.account_id = ?1
                 ORDER BY {ARTICLE_ORDER_DESC_PREFIXED}
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

        let select_cols_prefixed = SELECT_COLS
            .split(", ")
            .map(|col| format!("a.{col}"))
            .collect::<Vec<_>>()
            .join(", ");
        let mute_clause = build_mute_keyword_exclusion_clause(
            "a.title",
            "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
        );
        let sql = format!(
            "SELECT {select_cols_prefixed} FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             WHERE f.account_id = ?1
               AND {mute_clause}
             ORDER BY {ARTICLE_ORDER_DESC_PREFIXED}
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
        let select_cols_prefixed = SELECT_COLS
            .split(", ")
            .map(|col| format!("a.{col}"))
            .collect::<Vec<_>>()
            .join(", ");

        if !SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            let sql = format!(
                "SELECT {select_cols_prefixed} FROM articles a
                 JOIN feeds f ON a.feed_id = f.id
                 WHERE f.account_id = ?1
                   AND a.is_read = 0
                 ORDER BY {ARTICLE_ORDER_DESC_PREFIXED}
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
            "a.title",
            "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
        );
        let sql = format!(
            "SELECT {select_cols_prefixed} FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             WHERE f.account_id = ?1
               AND a.is_read = 0
               AND {mute_clause}
             ORDER BY {ARTICLE_ORDER_DESC_PREFIXED}
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
        let select_cols_prefixed = SELECT_COLS
            .split(", ")
            .map(|col| format!("a.{col}"))
            .collect::<Vec<_>>()
            .join(", ");

        if !SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            let sql = format!(
                "SELECT {select_cols_prefixed} FROM articles a
                 JOIN feeds f ON a.feed_id = f.id
                 WHERE f.account_id = ?1
                   AND a.is_starred = 1
                 ORDER BY {ARTICLE_ORDER_DESC_PREFIXED}
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
            "a.title",
            "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
        );
        let sql = format!(
            "SELECT {select_cols_prefixed} FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             WHERE f.account_id = ?1
               AND a.is_starred = 1
               AND {mute_clause}
             ORDER BY {ARTICLE_ORDER_DESC_PREFIXED}
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
                "SELECT COUNT(*) FROM articles a JOIN feeds f ON a.feed_id = f.id WHERE f.account_id = ?1 AND a.is_read = 0",
                params![account_id.0],
                |row| row.get(0),
            )?;
            return Ok(count);
        }

        let mute_clause = build_mute_keyword_exclusion_clause(
            "a.title",
            "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
        );
        let sql = format!(
            "SELECT COUNT(*) FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             WHERE f.account_id = ?1
               AND a.is_read = 0
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
                "SELECT COUNT(*) FROM articles a JOIN feeds f ON a.feed_id = f.id WHERE f.account_id = ?1 AND a.is_starred = 1",
                params![account_id.0],
                |row| row.get(0),
            )?;
            return Ok(count);
        }

        let mute_clause = build_mute_keyword_exclusion_clause(
            "a.title",
            "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
        );
        let sql = format!(
            "SELECT COUNT(*) FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             WHERE f.account_id = ?1
               AND a.is_starred = 1
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
                "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, summary, url, author, published_at, thumbnail, is_read, is_starred, fetched_at, content_text)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
                 ON CONFLICT(id) DO UPDATE SET
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
               AND feed_id IN (SELECT id FROM feeds WHERE account_id = ?2)",
            params![before.to_rfc3339(), account_id.0],
        )?;
        Ok(deleted as u64)
    }

    fn update_sanitized(&self, id: &ArticleId, sanitized: &str, version: u32) -> DomainResult<()> {
        self.conn.execute(
            "UPDATE articles
             SET content_sanitized = ?1,
                 content_text = ?2,
                 sanitizer_version = ?3
             WHERE id = ?4",
            params![sanitized, article_body_text(sanitized, None), version, id.0],
        )?;
        Ok(())
    }

    fn find_by_sanitizer_version_below(
        &self,
        version: u32,
        limit: usize,
    ) -> DomainResult<Vec<Article>> {
        let sql =
            format!("SELECT {SELECT_COLS} FROM articles WHERE sanitizer_version < ?1 LIMIT ?2");
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
            let is_read = if pending_read_remote_ids.contains(remote_id) {
                *current_read
            } else {
                read_remote_ids.contains(remote_id)
            };
            let is_starred = if pending_starred_remote_ids.contains(remote_id) {
                *current_starred
            } else {
                starred_remote_ids.contains(remote_id)
            };
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

        // Try FTS5 first for performance
        // Do not apply LIMIT/OFFSET per-query — pagination is applied after
        // merging FTS and LIKE results to ensure correct page boundaries.
        let fts_sql = format!(
            "SELECT {select_cols_prefixed} FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             JOIN articles_fts fts ON a.rowid = fts.rowid
             WHERE f.account_id = ?1
             AND articles_fts MATCH ?2
             AND {}
             ORDER BY fts.rank"
            ,
            build_mute_keyword_exclusion_clause(
                "a.title",
                "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
            )
        );
        let mut stmt = self.conn.prepare(&fts_sql)?;
        let fts_articles: Vec<Article> = stmt
            .query_map(params![account_id.0, fts_query], row_to_article)?
            .collect::<Result<Vec<_>, _>>()?;

        // Always run LIKE search as well to catch CJK-mixed titles where FTS5
        // unicode61 tokenizer merges adjacent scripts into a single token
        // (e.g. "新型HomePod"). Merge results with deduplication by article id.
        // Escape SQL LIKE wildcards in the query to match literal characters.
        let escaped_query = query
            .replace('\\', "\\\\")
            .replace('%', "\\%")
            .replace('_', "\\_");
        let like_pattern = format!("%{escaped_query}%");
        // Do not apply LIMIT/OFFSET here — pagination is applied after merging
        // with FTS results to avoid duplicate/missing rows across pages.
        let like_sql = format!(
            "SELECT {select_cols_prefixed} FROM articles a
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
             AND {}
             ORDER BY {ARTICLE_ORDER_DESC_PREFIXED}"
            ,
            build_mute_keyword_exclusion_clause(
                "a.title",
                "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
            )
        );
        let mut stmt = self.conn.prepare(&like_sql)?;
        let like_articles: Vec<Article> = stmt
            .query_map(params![account_id.0, like_pattern], row_to_article)?
            .collect::<Result<Vec<_>, _>>()?;

        // Merge FTS and LIKE results, deduplicating by article id
        let mut seen = std::collections::HashSet::new();
        let mut merged = Vec::with_capacity(fts_articles.len() + like_articles.len());
        for article in fts_articles.into_iter().chain(like_articles) {
            if seen.insert(article.id.0.clone()) {
                merged.push(article);
            }
        }
        merged.sort_by(|left, right| {
            right
                .published_at
                .cmp(&left.published_at)
                .then_with(|| right.fetched_at.cmp(&left.fetched_at))
                .then_with(|| right.id.0.cmp(&left.id.0))
        });
        let start = pagination.offset.min(merged.len());
        let end = (start + pagination.limit).min(merged.len());
        Ok(merged[start..end].to_vec())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::db::connection::DbManager;
    use crate::repository::article::ArticleListMode;
    use crate::repository::feed::FeedRepository;

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

        let first = make_article(&feed_id, "Kindle Unlimited one");
        let second = make_article(&feed_id, "Kindle Unlimited two");
        repo.upsert(&[first.clone(), second.clone()]).unwrap();

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
        assert!(!second_is_read);
    }

    #[test]
    fn mark_muted_unread_as_read_rolls_back_all_changes_on_mid_batch_failure() {
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
    fn mark_muted_unread_as_read_handles_large_match_set_in_one_transaction() {
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
    fn update_sanitized_does_not_use_summary_fallback_when_sanitized_html_is_empty() {
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

        assert_eq!(content_text, "");
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
        repo.upsert(&[quoted, punctuated]).unwrap();

        let quoted_results = repo
            .search(&account_id, "\"Guide\"", &Pagination::default())
            .unwrap();
        let punctuated_results = repo
            .search(&account_id, "NEAR(search)", &Pagination::default())
            .unwrap();

        assert_eq!(quoted_results.len(), 1);
        assert_eq!(quoted_results[0].title, "Rust \"Guide\"");
        assert_eq!(punctuated_results.len(), 1);
        assert_eq!(punctuated_results[0].title, "SQLite NEAR(search) notes");
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
