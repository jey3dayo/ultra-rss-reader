//! `ArticleListRepository` implementation.

use super::*;

impl ArticleListRepository for SqliteArticleRepository<'_> {
    fn list_feed_article_summaries_by_account(
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
