use rusqlite::{params, Connection};

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::feed::Feed;
use crate::domain::types::{AccountId, FeedId, FolderId};
use crate::infra::db::sqlite_mute_keyword::{
    build_mute_keyword_exclusion_clause, SqliteMuteKeywordRepository,
};
use crate::repository::feed::FeedRepository;
use crate::repository::mute_keyword::MuteKeywordRepository;

pub struct SqliteFeedRepository<'a> {
    conn: &'a Connection,
}

impl<'a> SqliteFeedRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    fn validate_folder_account(&self, feed: &Feed) -> DomainResult<()> {
        let Some(folder_id) = &feed.folder_id else {
            return Ok(());
        };

        let belongs_to_account: bool = self.conn.query_row(
            "SELECT EXISTS(
                SELECT 1
                  FROM folders
                 WHERE id = ?1
                   AND account_id = ?2
            )",
            params![folder_id.0, feed.account_id.0],
            |row| row.get::<_, i64>(0).map(|exists| exists != 0),
        )?;

        if !belongs_to_account {
            return Err(DomainError::Validation(
                "feed folder does not belong to feed account".to_string(),
            ));
        }

        Ok(())
    }
}

fn row_to_feed(row: &rusqlite::Row) -> rusqlite::Result<Feed> {
    let folder_id: Option<String> = row.get(2)?;
    Ok(Feed {
        id: FeedId(row.get(0)?),
        account_id: AccountId(row.get(1)?),
        folder_id: folder_id.map(FolderId),
        remote_id: row.get(3)?,
        title: row.get(4)?,
        url: row.get(5)?,
        site_url: row.get(6)?,
        icon: row.get(7)?,
        unread_count: normalize_unread_count(row.get::<_, i64>(8)?),
        reader_mode: row.get(9)?,
        web_preview_mode: row.get(10)?,
    })
}

fn normalize_unread_count(count: i64) -> i32 {
    count.clamp(0, i64::from(i32::MAX)) as i32
}

pub(crate) fn recalculate_unread_count_with_conn(
    conn: &Connection,
    feed_id: &FeedId,
) -> DomainResult<i32> {
    if !SqliteMuteKeywordRepository::new(conn).has_any()? {
        conn.execute(
            "UPDATE feeds SET unread_count = (SELECT COUNT(*) FROM articles WHERE feed_id = ?1 AND is_read = 0) WHERE id = ?1",
            params![feed_id.0],
        )?;
    } else {
        let mute_clause = build_mute_keyword_exclusion_clause(
            "title",
            "CASE WHEN trim(coalesce(content_text, '')) = '' THEN coalesce(summary, '') ELSE content_text END",
        );
        let sql = format!(
            "UPDATE feeds
             SET unread_count = (
               SELECT COUNT(*)
               FROM articles
               WHERE feed_id = ?1
                 AND is_read = 0
                 AND {mute_clause}
             )
             WHERE id = ?1"
        );
        conn.execute(&sql, params![feed_id.0])?;
    }
    let count: i64 = conn.query_row(
        "SELECT unread_count FROM feeds WHERE id = ?1",
        params![feed_id.0],
        |row| row.get(0),
    )?;
    Ok(normalize_unread_count(count))
}

const SELECT_COLS: &str =
    "id, account_id, folder_id, remote_id, title, url, site_url, icon, unread_count, reader_mode, web_preview_mode";

impl FeedRepository for SqliteFeedRepository<'_> {
    fn find_by_account(&self, account_id: &AccountId) -> DomainResult<Vec<Feed>> {
        let sql = if !SqliteMuteKeywordRepository::new(self.conn).has_any()? {
            format!(
                "SELECT {SELECT_COLS} FROM feeds WHERE account_id = ?1 ORDER BY title COLLATE NOCASE, id"
            )
        } else {
            let mute_clause = build_mute_keyword_exclusion_clause(
                "a.title",
                "CASE WHEN trim(coalesce(a.content_text, '')) = '' THEN coalesce(a.summary, '') ELSE a.content_text END",
            );
            format!(
                "SELECT
                    f.id,
                    f.account_id,
                    f.folder_id,
                    f.remote_id,
                    f.title,
                    f.url,
                    f.site_url,
                    f.icon,
                    (
                        SELECT COUNT(*)
                        FROM articles a
                        WHERE a.feed_id = f.id
                          AND a.is_read = 0
                          AND {mute_clause}
                    ) AS unread_count,
                    f.reader_mode,
                    f.web_preview_mode
                 FROM feeds f
                 WHERE f.account_id = ?1
                 ORDER BY f.title COLLATE NOCASE, f.id"
            )
        };
        let mut stmt = self.conn.prepare(&sql)?;
        let feeds = stmt
            .query_map(params![account_id.0], row_to_feed)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(feeds)
    }

    fn find_by_id(&self, feed_id: &FeedId) -> DomainResult<Option<Feed>> {
        let sql = format!("SELECT {SELECT_COLS} FROM feeds WHERE id = ?1");
        let mut stmt = self.conn.prepare(&sql)?;
        let mut rows = stmt.query_map(params![feed_id.0], row_to_feed)?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    fn save(&self, feed: &Feed) -> DomainResult<()> {
        self.validate_folder_account(feed)?;

        self.conn.execute(
            "INSERT INTO feeds (id, account_id, folder_id, remote_id, title, url, site_url, icon, unread_count, reader_mode, web_preview_mode)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
             ON CONFLICT(id) DO UPDATE SET
               folder_id = excluded.folder_id,
               remote_id = excluded.remote_id,
               title = excluded.title,
               url = excluded.url,
               site_url = excluded.site_url,
               icon = excluded.icon,
               unread_count = excluded.unread_count,
               reader_mode = excluded.reader_mode,
               web_preview_mode = excluded.web_preview_mode
             ON CONFLICT(account_id, url) DO UPDATE SET
               folder_id = excluded.folder_id,
               remote_id = excluded.remote_id,
               icon = excluded.icon,
               unread_count = excluded.unread_count
             ON CONFLICT(account_id, remote_id) DO UPDATE SET
               folder_id = excluded.folder_id,
               url = excluded.url,
               icon = excluded.icon,
               unread_count = excluded.unread_count",
            params![
                feed.id.0,
                feed.account_id.0,
                feed.folder_id.as_ref().map(|f| &f.0),
                feed.remote_id,
                feed.title,
                feed.url,
                feed.site_url,
                feed.icon,
                normalize_unread_count(i64::from(feed.unread_count)),
                feed.reader_mode,
                feed.web_preview_mode,
            ],
        )?;
        Ok(())
    }

    fn update_unread_count(&self, feed_id: &FeedId, count: i32) -> DomainResult<()> {
        self.conn.execute(
            "UPDATE feeds SET unread_count = ?1 WHERE id = ?2",
            params![normalize_unread_count(i64::from(count)), feed_id.0],
        )?;
        Ok(())
    }

    fn recalculate_unread_count(&self, feed_id: &FeedId) -> DomainResult<i32> {
        recalculate_unread_count_with_conn(self.conn, feed_id)
    }

    fn find_by_remote_id(
        &self,
        account_id: &AccountId,
        remote_id: &str,
    ) -> DomainResult<Option<Feed>> {
        let sql =
            format!("SELECT {SELECT_COLS} FROM feeds WHERE account_id = ?1 AND remote_id = ?2");
        let mut stmt = self.conn.prepare(&sql)?;
        let mut rows = stmt.query_map(params![account_id.0, remote_id], row_to_feed)?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    fn find_by_url(&self, account_id: &AccountId, url: &str) -> DomainResult<Option<Feed>> {
        let sql = format!("SELECT {SELECT_COLS} FROM feeds WHERE account_id = ?1 AND url = ?2");
        let mut stmt = self.conn.prepare(&sql)?;
        let mut rows = stmt.query_map(params![account_id.0, url], row_to_feed)?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    fn delete(&self, feed_id: &FeedId) -> DomainResult<()> {
        let affected_rows = self
            .conn
            .execute("DELETE FROM feeds WHERE id = ?1", params![feed_id.0])?;
        if affected_rows == 0 {
            return Err(DomainError::Validation("feed not found".to_string()));
        }
        Ok(())
    }

    fn rename(&self, feed_id: &FeedId, title: &str) -> DomainResult<()> {
        let affected_rows = self.conn.execute(
            "UPDATE feeds SET title = ?1 WHERE id = ?2",
            params![title, feed_id.0],
        )?;
        if affected_rows == 0 {
            return Err(DomainError::Validation("feed not found".to_string()));
        }
        Ok(())
    }

    fn update_folder(&self, feed_id: &FeedId, folder_id: Option<&FolderId>) -> DomainResult<()> {
        let affected_rows = self.conn.execute(
            "UPDATE feeds
             SET folder_id = ?1
             WHERE id = ?2
               AND (
                 ?1 IS NULL
                 OR EXISTS (
                   SELECT 1
                   FROM folders
                   WHERE folders.id = ?1
                     AND folders.account_id = feeds.account_id
                 )
               )",
            params![folder_id.map(|f| &f.0), feed_id.0],
        )?;
        if affected_rows == 0 {
            return Err(DomainError::Validation(
                "feed not found or folder does not belong to feed account".to_string(),
            ));
        }
        Ok(())
    }

    fn update_display_settings(
        &self,
        feed_id: &FeedId,
        reader_mode: &str,
        web_preview_mode: &str,
    ) -> DomainResult<()> {
        let affected_rows = self.conn.execute(
            "UPDATE feeds SET reader_mode = ?1, web_preview_mode = ?2 WHERE id = ?3",
            params![reader_mode, web_preview_mode, feed_id.0],
        )?;
        if affected_rows == 0 {
            return Err(DomainError::Validation("feed not found".to_string()));
        }
        Ok(())
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

    fn make_feed(account_id: &AccountId, title: &str, url: &str) -> Feed {
        Feed {
            id: FeedId::new(),
            account_id: account_id.clone(),
            folder_id: None,
            remote_id: None,
            title: title.to_string(),
            url: url.to_string(),
            site_url: String::new(),
            icon: None,
            unread_count: 0,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        }
    }

    #[test]
    fn save_and_find_by_account() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());

        let feed = make_feed(&account_id, "Rust Blog", "http://rust.com/feed");
        repo.save(&feed).unwrap();

        let feeds = repo.find_by_account(&account_id).unwrap();
        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].title, "Rust Blog");
    }

    #[test]
    fn duplicate_url_save_reuses_existing_row_id() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());

        let existing = make_feed(&account_id, "Existing", "http://rust.com/feed");
        let existing_id = existing.id.clone();
        repo.save(&existing).unwrap();

        let duplicate = Feed {
            id: FeedId::new(),
            title: "Updated".to_string(),
            remote_id: Some("remote-updated".to_string()),
            unread_count: 5,
            ..make_feed(&account_id, "Duplicate", "http://rust.com/feed")
        };
        repo.save(&duplicate).unwrap();

        let by_url = repo
            .find_by_url(&account_id, "http://rust.com/feed")
            .unwrap()
            .unwrap();
        let feeds = repo.find_by_account(&account_id).unwrap();

        assert_eq!(feeds.len(), 1);
        assert_eq!(by_url.id, existing_id);
        assert_eq!(by_url.title, "Updated");
        assert_eq!(by_url.remote_id.as_deref(), Some("remote-updated"));
    }

    #[test]
    fn duplicate_url_save_merges_title_site_url_and_folder_into_existing_row() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());
        let existing = Feed {
            id: FeedId("existing-feed".to_string()),
            site_url: "https://example.com/old".to_string(),
            ..make_feed(&account_id, "Old Title", "https://example.com/rss.xml")
        };
        repo.save(&existing).unwrap();
        let folder_id = FolderId::new();
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params![folder_id.0, account_id.0, "Imported", 0],
            )
            .unwrap();

        let duplicate = Feed {
            id: FeedId("ignored-new-feed-id".to_string()),
            folder_id: Some(folder_id.clone()),
            title: "Imported Title".to_string(),
            site_url: "https://example.com/new".to_string(),
            ..make_feed(&account_id, "Duplicate", "https://example.com/rss.xml")
        };
        repo.save(&duplicate).unwrap();

        let saved = repo
            .find_by_url(&account_id, "https://example.com/rss.xml")
            .unwrap()
            .unwrap();

        assert_eq!(saved.id, existing.id);
        assert_eq!(saved.folder_id, Some(folder_id));
        assert_eq!(saved.title, "Imported Title");
        assert_eq!(saved.site_url, "https://example.com/new");
        assert_eq!(repo.find_by_account(&account_id).unwrap().len(), 1);
    }

    #[test]
    fn duplicate_url_save_is_scoped_to_account() {
        let db = test_db();
        let account_a_id = insert_test_account(&db);
        let account_b_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());
        let shared_url = "https://example.com/rss.xml";

        let feed_a = Feed {
            id: FeedId("feed-a".to_string()),
            ..make_feed(&account_a_id, "Account A", shared_url)
        };
        let feed_b = Feed {
            id: FeedId("feed-b".to_string()),
            ..make_feed(&account_b_id, "Account B", shared_url)
        };
        repo.save(&feed_a).unwrap();
        repo.save(&feed_b).unwrap();

        let account_a_feed = repo
            .find_by_url(&account_a_id, shared_url)
            .unwrap()
            .unwrap();
        let account_b_feed = repo
            .find_by_url(&account_b_id, shared_url)
            .unwrap()
            .unwrap();

        assert_eq!(account_a_feed.id, feed_a.id);
        assert_eq!(account_a_feed.title, "Account A");
        assert_eq!(account_b_feed.id, feed_b.id);
        assert_eq!(account_b_feed.title, "Account B");
        assert_eq!(repo.find_by_account(&account_a_id).unwrap().len(), 1);
        assert_eq!(repo.find_by_account(&account_b_id).unwrap().len(), 1);
    }

    #[test]
    fn duplicate_remote_id_save_is_scoped_to_account() {
        let db = test_db();
        let account_a_id = insert_test_account(&db);
        let account_b_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());

        let mut feed_a = make_feed(&account_a_id, "Account A", "https://a.example.com/rss.xml");
        feed_a.id = FeedId("feed-a".to_string());
        feed_a.remote_id = Some("feed/shared".to_string());
        let mut feed_b = make_feed(&account_b_id, "Account B", "https://b.example.com/rss.xml");
        feed_b.id = FeedId("feed-b".to_string());
        feed_b.remote_id = feed_a.remote_id.clone();
        repo.save(&feed_a).unwrap();
        repo.save(&feed_b).unwrap();

        let account_a_feed = repo
            .find_by_remote_id(&account_a_id, "feed/shared")
            .unwrap()
            .unwrap();
        let account_b_feed = repo
            .find_by_remote_id(&account_b_id, "feed/shared")
            .unwrap()
            .unwrap();

        assert_eq!(account_a_feed.id, feed_a.id);
        assert_eq!(account_a_feed.url, "https://a.example.com/rss.xml");
        assert_eq!(account_b_feed.id, feed_b.id);
        assert_eq!(account_b_feed.url, "https://b.example.com/rss.xml");
    }

    #[test]
    fn find_by_account_excludes_muted_unread_articles_from_counts() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());

        let feed = make_feed(&account_id, "Finance", "http://finance.example/rss");
        repo.save(&feed).unwrap();

        db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, content_text, sanitizer_version, summary, url, author, published_at, thumbnail, is_read, is_starred, fetched_at)
                 VALUES (?1, ?2, NULL, ?3, '', '', '', 1, NULL, NULL, NULL, datetime('now'), NULL, 0, 0, datetime('now'))",
                params![uuid::Uuid::new_v4().to_string(), feed.id.0, "Kindle Unlimited offer"],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, remote_id, title, content_raw, content_sanitized, content_text, sanitizer_version, summary, url, author, published_at, thumbnail, is_read, is_starred, fetched_at)
                 VALUES (?1, ?2, NULL, ?3, '', '', '', 1, NULL, NULL, NULL, datetime('now'), NULL, 0, 0, datetime('now'))",
                params![uuid::Uuid::new_v4().to_string(), feed.id.0, "Visible article"],
            )
            .unwrap();
        db.writer()
            .execute(
                "INSERT INTO mute_keywords (id, keyword, scope, created_at, updated_at) VALUES (?1, ?2, ?3, datetime('now'), datetime('now'))",
                params![uuid::Uuid::new_v4().to_string(), "kindle unlimited", "title"],
            )
            .unwrap();
        db.writer()
            .execute(
                "UPDATE feeds SET unread_count = 2 WHERE id = ?1",
                params![feed.id.0],
            )
            .unwrap();

        let feeds = repo.find_by_account(&account_id).unwrap();

        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].unread_count, 1);
    }

    #[test]
    fn find_by_account_normalizes_corrupt_unread_count_before_dto_mapping() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());
        let negative_feed = make_feed(&account_id, "Negative", "http://negative.example/rss");
        let overflow_feed = make_feed(&account_id, "Overflow", "http://overflow.example/rss");
        repo.save(&negative_feed).unwrap();
        repo.save(&overflow_feed).unwrap();

        db.writer()
            .execute(
                "UPDATE feeds SET unread_count = -1 WHERE id = ?1",
                params![negative_feed.id.0],
            )
            .unwrap();
        db.writer()
            .execute(
                "UPDATE feeds SET unread_count = ?1 WHERE id = ?2",
                params![i64::from(i32::MAX) + 1, overflow_feed.id.0],
            )
            .unwrap();

        let feeds = repo.find_by_account(&account_id).unwrap();

        let negative = feeds
            .iter()
            .find(|feed| feed.id == negative_feed.id)
            .unwrap();
        let overflow = feeds
            .iter()
            .find(|feed| feed.id == overflow_feed.id)
            .unwrap();
        assert_eq!(negative.unread_count, 0);
        assert_eq!(overflow.unread_count, i32::MAX);
    }

    #[test]
    fn update_unread_count_normalizes_negative_count_at_repository_boundary() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());
        let feed = make_feed(&account_id, "Rust Blog", "http://rust.example/rss");
        repo.save(&feed).unwrap();

        repo.update_unread_count(&feed.id, -1).unwrap();

        let saved = repo.find_by_id(&feed.id).unwrap().unwrap();
        assert_eq!(saved.unread_count, 0);
    }

    #[test]
    fn find_by_account_returns_feeds_in_stable_title_order() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());

        for feed in [
            Feed {
                id: FeedId("feed-z".to_string()),
                ..make_feed(&account_id, "Zeta", "http://z.example/rss")
            },
            Feed {
                id: FeedId("feed-b".to_string()),
                ..make_feed(&account_id, "alpha", "http://b.example/rss")
            },
            Feed {
                id: FeedId("feed-a".to_string()),
                ..make_feed(&account_id, "Alpha", "http://a.example/rss")
            },
        ] {
            repo.save(&feed).unwrap();
        }

        let feed_ids = repo
            .find_by_account(&account_id)
            .unwrap()
            .into_iter()
            .map(|feed| feed.id.0)
            .collect::<Vec<_>>();

        assert_eq!(feed_ids, vec!["feed-a", "feed-b", "feed-z"]);
    }

    #[test]
    fn find_by_remote_id() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());

        let mut feed = make_feed(&account_id, "Feed", "http://f.com/feed");
        feed.remote_id = Some("remote-1".to_string());
        repo.save(&feed).unwrap();

        let found = repo
            .find_by_remote_id(&account_id, "remote-1")
            .unwrap()
            .unwrap();
        assert_eq!(found.id, feed.id);

        let not_found = repo.find_by_remote_id(&account_id, "nope").unwrap();
        assert!(not_found.is_none());
    }

    #[test]
    fn find_by_url() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());

        let feed = make_feed(&account_id, "Feed", "http://example.com/rss");
        repo.save(&feed).unwrap();

        let found = repo
            .find_by_url(&account_id, "http://example.com/rss")
            .unwrap()
            .unwrap();
        assert_eq!(found.id, feed.id);
    }

    #[test]
    fn find_by_id() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());

        let feed = make_feed(&account_id, "Feed", "http://example.com/rss");
        let feed_id = feed.id.clone();
        repo.save(&feed).unwrap();

        let found = repo.find_by_id(&feed_id).unwrap().unwrap();
        assert_eq!(found.id, feed_id);

        let missing = repo.find_by_id(&FeedId("missing".to_string())).unwrap();
        assert!(missing.is_none());
    }

    #[test]
    fn recalculate_unread_count() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());

        let feed = make_feed(&account_id, "Feed", "http://f.com/rss");
        repo.save(&feed).unwrap();

        // Insert articles: 2 unread, 1 read
        let now = chrono::Utc::now().to_rfc3339();
        for (i, is_read) in [(1, 0), (2, 0), (3, 1)] {
            db.writer()
                .execute(
                    "INSERT INTO articles (id, feed_id, title, published_at, fetched_at, is_read) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![format!("a{i}"), feed.id.0, format!("Article {i}"), now, now, is_read],
                )
                .unwrap();
        }

        let count = repo.recalculate_unread_count(&feed.id).unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn recalculate_unread_count_updates_after_read_state_changes() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());

        let feed = make_feed(&account_id, "Feed", "http://f.com/rss");
        repo.save(&feed).unwrap();

        let now = chrono::Utc::now().to_rfc3339();
        db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, title, published_at, fetched_at, is_read) VALUES (?1, ?2, ?3, ?4, ?5, 0)",
                params!["a1", feed.id.0, "Unread article", now, now],
            )
            .unwrap();

        assert_eq!(repo.recalculate_unread_count(&feed.id).unwrap(), 1);

        db.writer()
            .execute("UPDATE articles SET is_read = 1 WHERE id = 'a1'", [])
            .unwrap();

        assert_eq!(repo.recalculate_unread_count(&feed.id).unwrap(), 0);
    }

    #[test]
    fn update_folder_rejects_folder_from_another_account() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let other_account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());

        let feed = make_feed(&account_id, "Feed", "http://f.com/rss");
        repo.save(&feed).unwrap();
        let other_folder_id = FolderId::new();
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params![other_folder_id.0, other_account_id.0, "Other", 0],
            )
            .unwrap();

        let error = repo
            .update_folder(&feed.id, Some(&other_folder_id))
            .expect_err("folder from another account should be rejected");

        let saved_feed = repo.find_by_id(&feed.id).unwrap().unwrap();
        assert!(saved_feed.folder_id.is_none());
        assert!(
            matches!(error, DomainError::Validation(message) if message == "feed not found or folder does not belong to feed account")
        );
    }

    #[test]
    fn update_folder_rejects_missing_feed() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());
        let folder_id = FolderId::new();
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, ?3, ?4)",
                params![folder_id.0, account_id.0, "Folder", 0],
            )
            .unwrap();

        let error = repo
            .update_folder(&FeedId("missing-feed".to_string()), Some(&folder_id))
            .expect_err("missing feed folder mutation should be rejected");

        let feed_count: i64 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM feeds", [], |row| row.get(0))
            .unwrap();
        assert_eq!(feed_count, 0);
        assert!(
            matches!(error, DomainError::Validation(message) if message == "feed not found or folder does not belong to feed account")
        );
    }

    #[test]
    fn update_display_settings_persists_inherit_on_and_off_values() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());

        let feed = make_feed(&account_id, "Feed", "http://f.com/rss");
        repo.save(&feed).unwrap();

        for (reader_mode, web_preview_mode) in
            [("on", "off"), ("off", "on"), ("inherit", "inherit")]
        {
            repo.update_display_settings(&feed.id, reader_mode, web_preview_mode)
                .unwrap();

            let saved_feed = repo.find_by_id(&feed.id).unwrap().unwrap();
            assert_eq!(saved_feed.reader_mode, reader_mode);
            assert_eq!(saved_feed.web_preview_mode, web_preview_mode);
        }
    }

    #[test]
    fn update_display_settings_rejects_missing_feed() {
        let db = test_db();
        let repo = SqliteFeedRepository::new(db.writer());

        let error = repo
            .update_display_settings(&FeedId("missing-feed".to_string()), "on", "off")
            .expect_err("missing feed display settings mutation should be rejected");

        let feed_count: i64 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM feeds", [], |row| row.get(0))
            .unwrap();
        assert_eq!(feed_count, 0);
        assert!(matches!(error, DomainError::Validation(message) if message == "feed not found"));
    }

    #[test]
    fn delete_cascades_to_articles() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());

        let feed = make_feed(&account_id, "Feed", "http://f.com/rss");
        repo.save(&feed).unwrap();

        // Insert articles
        let now = chrono::Utc::now().to_rfc3339();
        for i in 1..=3 {
            db.writer()
                .execute(
                    "INSERT INTO articles (id, feed_id, title, published_at, fetched_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![format!("a{i}"), feed.id.0, format!("Article {i}"), now, now],
                )
                .unwrap();
        }

        // Verify articles exist
        let article_count: i64 = db
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM articles WHERE feed_id = ?1",
                params![feed.id.0],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(article_count, 3);

        // Delete feed (should cascade to articles via foreign key)
        repo.delete(&feed.id).unwrap();

        // Verify feed is gone
        let feeds = repo.find_by_account(&account_id).unwrap();
        assert_eq!(feeds.len(), 0);

        // Verify articles are cascaded away
        let article_count: i64 = db
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM articles WHERE feed_id = ?1",
                params![feed.id.0],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(article_count, 0);
    }

    #[test]
    fn delete_rejects_missing_feed() {
        let db = test_db();
        let repo = SqliteFeedRepository::new(db.writer());

        let error = repo
            .delete(&FeedId("missing-feed".to_string()))
            .expect_err("missing feed delete should be rejected");

        let feed_count: i64 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM feeds", [], |row| row.get(0))
            .unwrap();
        assert_eq!(feed_count, 0);
        assert!(matches!(error, DomainError::Validation(message) if message == "feed not found"));
    }

    #[test]
    fn save_updates_existing_feed_without_cascading_articles() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());

        let mut feed = make_feed(&account_id, "Feed", "http://f.com/rss");
        feed.remote_id = Some("feed/1".to_string());
        repo.save(&feed).unwrap();

        let now = chrono::Utc::now().to_rfc3339();
        db.writer()
            .execute(
                "INSERT INTO articles (id, feed_id, title, published_at, fetched_at) VALUES (?1, ?2, ?3, ?4, ?5)",
                params!["a1", feed.id.0, "Article 1", now, now],
            )
            .unwrap();

        feed.title = "Updated Feed".to_string();
        repo.save(&feed).unwrap();

        let article_count: i64 = db
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM articles WHERE feed_id = ?1",
                params![feed.id.0],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(article_count, 1);

        let saved_feed = repo
            .find_by_remote_id(&account_id, "feed/1")
            .unwrap()
            .unwrap();
        assert_eq!(saved_feed.title, "Updated Feed");
    }

    #[test]
    fn save_updates_existing_feed_when_account_and_url_match_updates_remote_folder_and_preserves_local_settings(
    ) {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());
        let folder_id = FolderId::new();
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, 'Local Folder', 0)",
                params![folder_id.0, account_id.0],
            )
            .unwrap();

        let existing_feed = Feed {
            id: FeedId::new(),
            account_id: account_id.clone(),
            folder_id: Some(folder_id.clone()),
            remote_id: None,
            title: "Original Feed".to_string(),
            url: "http://example.com/rss".to_string(),
            site_url: "http://example.com".to_string(),
            icon: None,
            unread_count: 0,
            reader_mode: "on".to_string(),
            web_preview_mode: "off".to_string(),
        };
        repo.save(&existing_feed).unwrap();

        let remote_folder_id = FolderId::new();
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, 'Remote Folder', 1)",
                params![remote_folder_id.0, account_id.0],
            )
            .unwrap();
        let replacement_feed = Feed {
            id: FeedId::new(),
            account_id: account_id.clone(),
            folder_id: Some(remote_folder_id.clone()),
            remote_id: Some("feed/1".to_string()),
            title: "Remote Feed".to_string(),
            url: existing_feed.url.clone(),
            site_url: "https://example.com".to_string(),
            icon: Some(vec![1, 2, 3]),
            unread_count: 12,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        };

        repo.save(&replacement_feed).unwrap();

        let feeds = repo.find_by_account(&account_id).unwrap();
        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].id, existing_feed.id);
        assert_eq!(feeds[0].remote_id.as_deref(), Some("feed/1"));
        assert_eq!(feeds[0].title, "Remote Feed");
        assert_eq!(feeds[0].site_url, "https://example.com");
        assert_eq!(feeds[0].icon.as_deref(), Some(&[1, 2, 3][..]));
        assert_eq!(feeds[0].unread_count, 12);
        assert_eq!(feeds[0].folder_id.as_ref(), Some(&remote_folder_id));
        assert_eq!(feeds[0].reader_mode, "on");
        assert_eq!(feeds[0].web_preview_mode, "off");
    }

    #[test]
    fn save_primary_key_conflict_does_not_move_feed_to_incoming_account() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let other_account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());

        let existing_feed = make_feed(&account_id, "Original Feed", "http://example.com/rss");
        repo.save(&existing_feed).unwrap();

        let incoming_feed = Feed {
            id: existing_feed.id.clone(),
            account_id: other_account_id.clone(),
            folder_id: None,
            remote_id: Some("other-remote".to_string()),
            title: "Incoming Feed".to_string(),
            url: "https://other.example/rss".to_string(),
            site_url: "https://other.example".to_string(),
            icon: Some(vec![1, 2, 3]),
            unread_count: 3,
            reader_mode: "off".to_string(),
            web_preview_mode: "on".to_string(),
        };

        repo.save(&incoming_feed).unwrap();

        let original_account_feeds = repo.find_by_account(&account_id).unwrap();
        let other_account_feeds = repo.find_by_account(&other_account_id).unwrap();

        assert_eq!(original_account_feeds.len(), 1);
        assert_eq!(other_account_feeds.len(), 0);
        assert_eq!(original_account_feeds[0].id, existing_feed.id);
        assert_eq!(original_account_feeds[0].account_id, account_id);
        assert_eq!(
            original_account_feeds[0].remote_id.as_deref(),
            Some("other-remote")
        );
        assert_eq!(original_account_feeds[0].url, "https://other.example/rss");
    }

    #[test]
    fn save_rejects_account_url_upsert_when_incoming_folder_belongs_to_another_account() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let other_account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());
        let folder_id = FolderId::new();
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, 'Local Folder', 0)",
                params![folder_id.0, account_id.0],
            )
            .unwrap();

        let existing_feed = Feed {
            id: FeedId::new(),
            account_id: account_id.clone(),
            folder_id: Some(folder_id.clone()),
            remote_id: None,
            title: "Original Feed".to_string(),
            url: "http://example.com/rss".to_string(),
            site_url: "http://example.com".to_string(),
            icon: None,
            unread_count: 0,
            reader_mode: "on".to_string(),
            web_preview_mode: "off".to_string(),
        };
        repo.save(&existing_feed).unwrap();

        let other_folder_id = FolderId::new();
        db.writer()
            .execute(
                "INSERT INTO folders (id, account_id, name, sort_order) VALUES (?1, ?2, 'Other Folder', 0)",
                params![other_folder_id.0, other_account_id.0],
            )
            .unwrap();
        let conflicting_feed = Feed {
            id: FeedId::new(),
            account_id: account_id.clone(),
            folder_id: Some(other_folder_id),
            remote_id: Some("feed/remote".to_string()),
            title: "Remote Feed".to_string(),
            url: existing_feed.url.clone(),
            site_url: "https://example.com".to_string(),
            icon: None,
            unread_count: 3,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        };

        let error = repo
            .save(&conflicting_feed)
            .expect_err("upsert should reject folders owned by another account");

        let feeds = repo.find_by_account(&account_id).unwrap();
        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].id, existing_feed.id);
        assert_eq!(feeds[0].folder_id.as_ref(), Some(&folder_id));
        assert_eq!(feeds[0].remote_id, None);
        assert!(
            matches!(error, DomainError::Validation(message) if message == "feed folder does not belong to feed account")
        );
    }

    #[test]
    fn save_duplicate_account_url_preserves_existing_id_and_user_display_metadata() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());

        let existing_feed = Feed {
            id: FeedId::new(),
            account_id: account_id.clone(),
            folder_id: None,
            remote_id: None,
            title: "Original Feed".to_string(),
            url: "http://example.com/rss".to_string(),
            site_url: "http://example.com".to_string(),
            icon: None,
            unread_count: 7,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        };
        repo.save(&existing_feed).unwrap();

        let incoming_feed = Feed {
            id: FeedId::new(),
            account_id: account_id.clone(),
            folder_id: None,
            remote_id: Some("feed/remote".to_string()),
            title: "Updated Feed".to_string(),
            url: existing_feed.url.clone(),
            site_url: "https://example.com/articles".to_string(),
            icon: Some(vec![9, 8, 7]),
            unread_count: 0,
            reader_mode: "off".to_string(),
            web_preview_mode: "on".to_string(),
        };

        repo.save(&incoming_feed).unwrap();

        let feeds = repo.find_by_account(&account_id).unwrap();
        assert_eq!(feeds.len(), 1);
        let saved_feed = &feeds[0];

        assert_eq!(saved_feed.id, existing_feed.id);
        assert_ne!(saved_feed.id, incoming_feed.id);
        assert_eq!(saved_feed.title, "Original Feed");
        assert_eq!(saved_feed.site_url, "http://example.com");
        assert_eq!(saved_feed.icon.as_deref(), Some(&[9, 8, 7][..]));
        assert_eq!(saved_feed.reader_mode, "inherit");
        assert_eq!(saved_feed.web_preview_mode, "inherit");
    }

    #[test]
    fn save_duplicate_account_remote_id_preserves_user_display_metadata_and_updates_remote_url() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());

        let mut existing_feed = make_feed(&account_id, "Original Feed", "https://old.example/rss");
        existing_feed.remote_id = Some("feed/remote".to_string());
        existing_feed.site_url = "https://old.example".to_string();
        existing_feed.unread_count = 4;
        existing_feed.reader_mode = "on".to_string();
        existing_feed.web_preview_mode = "off".to_string();
        repo.save(&existing_feed).unwrap();

        let mut incoming_feed = make_feed(&account_id, "Updated Feed", "https://new.example/rss");
        incoming_feed.remote_id = existing_feed.remote_id.clone();
        incoming_feed.site_url = "https://new.example".to_string();
        incoming_feed.icon = Some(vec![4, 5, 6]);
        incoming_feed.unread_count = 9;

        repo.save(&incoming_feed).unwrap();

        let feeds = repo.find_by_account(&account_id).unwrap();
        assert_eq!(feeds.len(), 1);
        let saved_feed = &feeds[0];

        assert_eq!(saved_feed.id, existing_feed.id);
        assert_ne!(saved_feed.id, incoming_feed.id);
        assert_eq!(saved_feed.remote_id.as_deref(), Some("feed/remote"));
        assert_eq!(saved_feed.url, "https://new.example/rss");
        assert_eq!(saved_feed.title, "Original Feed");
        assert_eq!(saved_feed.site_url, "https://old.example");
        assert_eq!(saved_feed.icon.as_deref(), Some(&[4, 5, 6][..]));
        assert_eq!(saved_feed.unread_count, 9);
        assert_eq!(saved_feed.reader_mode, "on");
        assert_eq!(saved_feed.web_preview_mode, "off");
    }

    #[test]
    fn rename_updates_title() {
        let db = test_db();
        let account_id = insert_test_account(&db);
        let repo = SqliteFeedRepository::new(db.writer());

        let feed = make_feed(&account_id, "Old Title", "http://f.com/rss");
        repo.save(&feed).unwrap();

        // Rename
        repo.rename(&feed.id, "New Title").unwrap();

        // Verify
        let feeds = repo.find_by_account(&account_id).unwrap();
        assert_eq!(feeds.len(), 1);
        assert_eq!(feeds[0].title, "New Title");
    }

    #[test]
    fn rename_rejects_missing_feed() {
        let db = test_db();
        let repo = SqliteFeedRepository::new(db.writer());

        let error = repo
            .rename(&FeedId("missing-feed".to_string()), "New Title")
            .expect_err("missing feed rename should be rejected");

        let feed_count: i64 = db
            .reader()
            .query_row("SELECT COUNT(*) FROM feeds", [], |row| row.get(0))
            .unwrap();
        assert_eq!(feed_count, 0);
        assert!(matches!(error, DomainError::Validation(message) if message == "feed not found"));
    }
}
