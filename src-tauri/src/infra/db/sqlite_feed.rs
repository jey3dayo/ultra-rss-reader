use rusqlite::{params, Connection};

use crate::domain::error::DomainResult;
use crate::domain::feed::Feed;
use crate::domain::types::{AccountId, FeedId, FolderId};
use crate::repository::feed::FeedRepository;

pub struct SqliteFeedRepository<'a> {
    conn: &'a Connection,
}

impl<'a> SqliteFeedRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
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
        unread_count: row.get(8)?,
    })
}

const SELECT_COLS: &str =
    "id, account_id, folder_id, remote_id, title, url, site_url, icon, unread_count";

impl FeedRepository for SqliteFeedRepository<'_> {
    fn find_by_account(&self, account_id: &AccountId) -> DomainResult<Vec<Feed>> {
        let sql = format!("SELECT {SELECT_COLS} FROM feeds WHERE account_id = ?1");
        let mut stmt = self.conn.prepare(&sql)?;
        let feeds = stmt
            .query_map(params![account_id.0], row_to_feed)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(feeds)
    }

    fn save(&self, feed: &Feed) -> DomainResult<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO feeds (id, account_id, folder_id, remote_id, title, url, site_url, icon, unread_count) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                feed.id.0,
                feed.account_id.0,
                feed.folder_id.as_ref().map(|f| &f.0),
                feed.remote_id,
                feed.title,
                feed.url,
                feed.site_url,
                feed.icon,
                feed.unread_count,
            ],
        )?;
        Ok(())
    }

    fn update_unread_count(&self, feed_id: &FeedId, count: i32) -> DomainResult<()> {
        self.conn.execute(
            "UPDATE feeds SET unread_count = ?1 WHERE id = ?2",
            params![count, feed_id.0],
        )?;
        Ok(())
    }

    fn recalculate_unread_count(&self, feed_id: &FeedId) -> DomainResult<i32> {
        self.conn.execute(
            "UPDATE feeds SET unread_count = (SELECT COUNT(*) FROM articles WHERE feed_id = ?1 AND is_read = 0) WHERE id = ?1",
            params![feed_id.0],
        )?;
        let count: i32 = self.conn.query_row(
            "SELECT unread_count FROM feeds WHERE id = ?1",
            params![feed_id.0],
            |row| row.get(0),
        )?;
        Ok(count)
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
        self.conn
            .execute("DELETE FROM feeds WHERE id = ?1", params![feed_id.0])?;
        Ok(())
    }

    fn rename(&self, feed_id: &FeedId, title: &str) -> DomainResult<()> {
        self.conn.execute(
            "UPDATE feeds SET title = ?1 WHERE id = ?2",
            params![title, feed_id.0],
        )?;
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
}
