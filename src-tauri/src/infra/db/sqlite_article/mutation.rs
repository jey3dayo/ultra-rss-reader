use std::collections::HashSet;

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension};

use super::{
    row_to_article, row_to_article_list_history_item, row_to_article_view_history_item,
    SqliteArticleRepository, ARTICLE_LIST_SELECT_COLS, SELECT_COLS,
};
use crate::domain::article::{Article, ArticleListHistoryItem, ArticleViewHistoryItem};
use crate::domain::constants::RECENT_ARTICLE_HISTORY_LIMIT;
use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::{is_greader_managed_feed_remote_id, GREADER_FEED_ID_PREFIX};
use crate::domain::types::{AccountId, ArticleId, FeedId, FolderId};
use crate::infra::db::sqlite_feed::recalculate_unread_count_with_conn;
use crate::infra::db::sqlite_mute_keyword::{
    build_mute_keyword_exclusion_clause, build_mute_keyword_match_clause,
    SqliteMuteKeywordRepository,
};
use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
use crate::repository::article::{
    ArticleHistoryRepository, ArticleListMode, ArticleMaintenanceRepository,
    ArticleMutationRepository, ArticleRemoteStateRepository, Pagination,
};
use crate::repository::mute_keyword::MuteKeywordRepository;
use crate::repository::pending_mutation::{
    PendingMutationAxis, PendingMutationRepository, PendingMutationType,
};

/// The single upsert of materialized `Article` rows into `articles`.
/// Does not open or commit a transaction: callers provide the transaction
/// scope, either `SqliteArticleRepository::upsert`'s own `unchecked_transaction`
/// or an existing transaction the caller already holds (e.g. local feed sync).
pub(crate) fn upsert_articles_with_conn(
    conn: &Connection,
    articles: &[Article],
) -> DomainResult<()> {
    let mut stmt = conn.prepare(
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
           published_at = MIN(articles.published_at, excluded.published_at),
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
    Ok(())
}

pub(in crate::infra::db) fn article_body_text(value: &str, summary: Option<&str>) -> String {
    if value.trim().is_empty() {
        summary.unwrap_or("").to_string()
    } else {
        crate::infra::sanitizer::extract_visible_text(value)
    }
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
        let mut pending_remote_entry_ids = Vec::new();
        let mut seen_pending_remote_entry_ids = HashSet::new();
        for (_, _, remote_entry_id, account_kind, _, feed_remote_id) in &rows {
            let Some(remote_entry_id) = remote_entry_id else {
                continue;
            };
            let supports_remote_mutations = matches!(account_kind.as_str(), "FreshRss")
                && is_greader_managed_feed_remote_id(feed_remote_id.as_deref());
            if supports_remote_mutations
                && seen_pending_remote_entry_ids.insert(remote_entry_id.clone())
            {
                pending_remote_entry_ids.push(remote_entry_id.clone());
            }
        }

        let pending_repo = SqlitePendingMutationRepository::new(conn);
        pending_repo.delete_by_account_remote_entry_ids_and_axis(
            account_id,
            &pending_remote_entry_ids,
            PendingMutationAxis::ReadState,
        )?;

        let mut insert_pending_stmt = conn.prepare(
            "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
             VALUES (?1, ?2, ?3, ?4)",
        )?;
        let now = Utc::now().to_rfc3339();

        for remote_entry_id in pending_remote_entry_ids {
            insert_pending_stmt.execute(params![
                account_id.0,
                PendingMutationType::MarkRead.as_str(),
                remote_entry_id,
                now.clone(),
            ])?;
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

impl ArticleHistoryRepository for SqliteArticleRepository<'_> {
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

    fn list_recently_viewed_by_account(
        &self,
        account_id: &AccountId,
        pagination: &Pagination,
        mode: ArticleListMode,
    ) -> DomainResult<Vec<ArticleListHistoryItem>> {
        let select_cols_prefixed =
            super::SqliteArticleRepository::select_cols_prefixed(ARTICLE_LIST_SELECT_COLS, "a");
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
}

impl ArticleMutationRepository for SqliteArticleRepository<'_> {
    fn upsert(&self, articles: &[Article]) -> DomainResult<()> {
        let tx = self.conn.unchecked_transaction()?;
        upsert_articles_with_conn(&tx, articles)?;
        tx.commit()?;
        Ok(())
    }

    fn mark_as_read(&self, id: &ArticleId, read: bool) -> DomainResult<()> {
        let affected_rows = self.conn.execute(
            "UPDATE articles SET is_read = ?1 WHERE id = ?2",
            params![read, id.0],
        )?;
        require_article_row_affected(affected_rows, id)
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
        let affected_rows = self.conn.execute(
            "UPDATE articles SET is_starred = ?1 WHERE id = ?2",
            params![starred, id.0],
        )?;
        require_article_row_affected(affected_rows, id)
    }
}

impl ArticleMaintenanceRepository for SqliteArticleRepository<'_> {
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
               )
               AND EXISTS (
                 SELECT 1
                 FROM articles newer
                 WHERE newer.feed_id = articles.feed_id
                   AND (
                     newer.published_at > articles.published_at
                     OR (
                       newer.published_at = articles.published_at
                       AND newer.fetched_at > articles.fetched_at
                     )
                     OR (
                       newer.published_at = articles.published_at
                       AND newer.fetched_at = articles.fetched_at
                       AND newer.id > articles.id
                     )
                   )
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
}

impl ArticleRemoteStateRepository for SqliteArticleRepository<'_> {
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
        let mut stmt = tx.prepare(&format!(
            "SELECT a.id, a.remote_id, a.is_read, a.is_starred FROM articles a
             JOIN feeds f ON a.feed_id = f.id
             WHERE f.account_id = ?1
               AND a.remote_id IS NOT NULL
               AND f.remote_id LIKE '{GREADER_FEED_ID_PREFIX}%'"
        ))?;

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
}

fn require_article_row_affected(rows_affected: usize, id: &ArticleId) -> DomainResult<()> {
    if rows_affected == 0 {
        return Err(DomainError::Validation(format!(
            "Article not found: {}",
            id.as_ref()
        )));
    }
    Ok(())
}
