use chrono::{DateTime, Utc};
use rusqlite::{params, Connection};

use crate::domain::article::Article;
use crate::domain::error::DomainResult;
use crate::domain::types::{AccountId, ArticleId, FeedId, FolderId};
use crate::infra::db::sqlite_mute_keyword::{
    build_mute_keyword_exclusion_clause, SqliteMuteKeywordRepository,
};
use crate::repository::article::{ArticleRepository, Pagination};
use crate::repository::mute_keyword::MuteKeywordRepository;

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
}

fn parse_datetime(s: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_default()
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
        published_at: parse_datetime(&published_at_str),
        is_read: row.get(12)?,
        is_starred: row.get(13)?,
        fetched_at: parse_datetime(&fetched_at_str),
    })
}

const SELECT_COLS: &str = "id, feed_id, remote_id, title, content_raw, content_sanitized, sanitizer_version, summary, url, author, thumbnail, published_at, is_read, is_starred, fetched_at";

fn article_body_text(value: &str, summary: Option<&str>) -> String {
    if value.trim().is_empty() {
        summary.unwrap_or("").to_string()
    } else {
        crate::infra::sanitizer::extract_visible_text(value)
    }
}

impl ArticleRepository for SqliteArticleRepository<'_> {
    fn find_by_feed(
        &self,
        feed_id: &FeedId,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>> {
        if !SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            let sql = format!(
                "SELECT {SELECT_COLS} FROM articles WHERE feed_id = ?1 ORDER BY published_at DESC LIMIT ?2 OFFSET ?3"
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
             ORDER BY published_at DESC
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
                 ORDER BY a.published_at DESC
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
             ORDER BY a.published_at DESC
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
                 ORDER BY a.published_at DESC
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
             ORDER BY a.published_at DESC
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

    fn count_unread_by_account(&self, account_id: &AccountId) -> DomainResult<i32> {
        let count = self.conn.query_row(
            "SELECT COUNT(*) FROM articles a JOIN feeds f ON a.feed_id = f.id WHERE f.account_id = ?1 AND a.is_read = 0",
            params![account_id.0],
            |row| row.get(0),
        )?;
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

    fn purge_old_read(&self, before: DateTime<Utc>) -> DomainResult<u64> {
        let deleted = self.conn.execute(
            "DELETE FROM articles WHERE is_read = 1 AND is_starred = 0 AND fetched_at < ?1",
            params![before.to_rfc3339()],
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
        pending_remote_ids: &[String],
    ) -> DomainResult<()> {
        let tx = self.conn.unchecked_transaction()?;

        // Get all articles with remote_id in this account (via feed -> account join)
        // that are NOT in pending_remote_ids
        let mut stmt = tx.prepare(
            "SELECT a.id, a.remote_id FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             WHERE f.account_id = ?1
               AND a.remote_id IS NOT NULL
               AND f.remote_id LIKE 'feed/%'",
        )?;

        let rows: Vec<(String, String)> = stmt
            .query_map(params![account_id.0], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let mut update_stmt =
            tx.prepare("UPDATE articles SET is_read = ?1, is_starred = ?2 WHERE id = ?3")?;

        for (article_id, remote_id) in &rows {
            // Skip articles with pending mutations
            if pending_remote_ids.contains(remote_id) {
                continue;
            }
            let is_read = read_remote_ids.contains(remote_id);
            let is_starred = starred_remote_ids.contains(remote_id);
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
        let select_cols_prefixed = SELECT_COLS
            .split(", ")
            .map(|c| format!("a.{c}"))
            .collect::<Vec<_>>()
            .join(", ");

        // Try FTS5 first for performance
        let fts_query = query
            .split_whitespace()
            .map(|term| format!("\"{term}\""))
            .collect::<Vec<_>>()
            .join(" ");
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
             ORDER BY a.published_at DESC"
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
        let start = pagination.offset.min(merged.len());
        let end = (start + pagination.limit).min(merged.len());
        Ok(merged[start..end].to_vec())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::db::connection::DbManager;

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
        article.is_read = false;
        article.is_starred = false;
        repo.upsert(std::slice::from_ref(&article)).unwrap();

        let found = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
        assert_eq!(found[0].title, "Updated Title");
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

        let deleted = repo.purge_old_read(cutoff).unwrap();
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
        repo.apply_remote_state(&account_id, &["r1".to_string()], &["r2".to_string()], &[])
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

        // Remote says r1 is NOT read and NOT starred, but r1 is pending
        repo.apply_remote_state(&account_id, &[], &[], &["r1".to_string()])
            .unwrap();

        let articles = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
        // Should be unchanged because r1 is pending
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

        repo.apply_remote_state(&account_id, &[], &[], &[]).unwrap();

        let articles = repo.find_by_feed(&feed_id, &Pagination::default()).unwrap();
        assert!(articles[0].is_read);
    }

    #[test]
    fn update_sanitized_and_find_by_version() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let feed_id = insert_test_feed(&db, &account_id);
        let repo = SqliteArticleRepository::new(db.writer());

        let mut a1 = make_article(&feed_id, "Article 1");
        a1.sanitizer_version = 1;
        let mut a2 = make_article(&feed_id, "Article 2");
        a2.sanitizer_version = 2;

        repo.upsert(&[a1.clone(), a2.clone()]).unwrap();

        // Find articles with sanitizer_version below 2
        let old = repo.find_by_sanitizer_version_below(2, 100).unwrap();
        assert_eq!(old.len(), 1);
        assert_eq!(old[0].id, a1.id);

        // Update sanitized content
        repo.update_sanitized(&a1.id, "new sanitized", 2).unwrap();

        let old = repo.find_by_sanitizer_version_below(2, 100).unwrap();
        assert_eq!(old.len(), 0);
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
}
