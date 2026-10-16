//! Orphaned-article cleanup and per-feed aggregate queries for CLI diagnostics.

use super::*;

impl<'a> SqliteArticleRepository<'a> {
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

    /// Per-feed article count and newest published/fetched timestamps for
    /// every feed in `account_id`, including feeds with zero articles
    /// (`LEFT JOIN`, so `article_count` is 0 and the timestamps are `None`).
    ///
    /// `article_count` counts every row. `latest_published_at` excludes rows
    /// whose `published_at` is later than the injected `now` (a bind param,
    /// not SQLite's `'now'`, so tests can control it) — a future-dated
    /// `published_at` must not look like the newest article.
    /// `latest_fetched_at` is the app's own ingestion time, not feed-supplied,
    /// so it is not filtered.
    pub fn feed_article_stats_by_account(
        &self,
        account_id: &AccountId,
        now: DateTime<Utc>,
    ) -> DomainResult<HashMap<FeedId, FeedArticleStats>> {
        let mut stmt = self.conn.prepare(
            "SELECT f.id, COUNT(a.id),
                MAX(CASE WHEN julianday(a.published_at) <= julianday(?2) THEN a.published_at ELSE NULL END),
                MAX(a.fetched_at)
             FROM feeds f
             LEFT JOIN articles a ON a.feed_id = f.id
             WHERE f.account_id = ?1
             GROUP BY f.id",
        )?;
        let mut rows = stmt.query(params![account_id.0, now.to_rfc3339()])?;
        let mut stats = HashMap::new();
        while let Some(row) = rows.next()? {
            let feed_id = FeedId(row.get(0)?);
            let article_count: i64 = row.get(1)?;
            let latest_published_at = row
                .get::<_, Option<String>>(2)?
                .map(|raw| parse_datetime(&raw))
                .transpose()?;
            let latest_fetched_at = row
                .get::<_, Option<String>>(3)?
                .map(|raw| parse_datetime(&raw))
                .transpose()?;
            stats.insert(
                feed_id,
                FeedArticleStats {
                    article_count,
                    latest_published_at,
                    latest_fetched_at,
                },
            );
        }
        Ok(stats)
    }

    /// The `limit` most recent `published_at` values for one feed, newest
    /// first, excluding rows whose `published_at` is later than `now` (see
    /// `feed_article_stats_by_account` for why `now` is injected). Used by
    /// `feed stale`'s expected-interval calculation.
    pub fn latest_published_ats_by_feed(
        &self,
        feed_id: &FeedId,
        limit: usize,
        now: DateTime<Utc>,
    ) -> DomainResult<Vec<DateTime<Utc>>> {
        let mut stmt = self.conn.prepare(
            "SELECT published_at FROM articles
             WHERE feed_id = ?1 AND julianday(published_at) <= julianday(?3)
             ORDER BY published_at DESC LIMIT ?2",
        )?;
        let dates = stmt
            .query_map(params![feed_id.0, limit as i64, now.to_rfc3339()], |row| {
                let raw: String = row.get(0)?;
                parse_datetime(&raw)
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(dates)
    }
}
