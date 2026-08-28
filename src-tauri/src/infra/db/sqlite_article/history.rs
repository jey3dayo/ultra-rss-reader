use chrono::Utc;
use rusqlite::params;

use super::{
    row_to_article_list_history_item, row_to_article_view_history_item, SqliteArticleRepository,
    ARTICLE_LIST_SELECT_COLS, SELECT_COLS,
};
use crate::domain::article::{ArticleListHistoryItem, ArticleViewHistoryItem};
use crate::domain::constants::RECENT_ARTICLE_HISTORY_LIMIT;
use crate::domain::error::DomainResult;
use crate::domain::types::{AccountId, ArticleId};
use crate::infra::db::sqlite_mute_keyword::{
    build_mute_keyword_exclusion_clause, SqliteMuteKeywordRepository,
};
use crate::repository::article::{ArticleHistoryRepository, ArticleListMode, Pagination};
use crate::repository::mute_keyword::MuteKeywordRepository;

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
