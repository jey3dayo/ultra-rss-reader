//! `ArticleReadRepository` implementation.

use super::*;

impl ArticleReadRepository for SqliteArticleRepository<'_> {
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
}
