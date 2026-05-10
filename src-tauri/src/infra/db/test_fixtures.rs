use chrono::Utc;
use rusqlite::{params, Connection};

use crate::domain::types::{AccountId, ArticleId, FeedId, TagId};

pub(crate) struct AccountFixture {
    pub(crate) id: AccountId,
    pub(crate) kind: &'static str,
    pub(crate) name: &'static str,
}

impl AccountFixture {
    pub(crate) fn local(id: impl Into<String>) -> Self {
        Self {
            id: AccountId(id.into()),
            kind: "Local",
            name: "Test Account",
        }
    }

    pub(crate) fn insert(&self, conn: &Connection) {
        conn.execute(
            "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
            params![self.id.0, self.kind, self.name],
        )
        .unwrap();
    }
}

pub(crate) struct FeedFixture {
    pub(crate) id: FeedId,
    pub(crate) account_id: AccountId,
    pub(crate) remote_id: Option<String>,
    pub(crate) title: &'static str,
    pub(crate) url: String,
}

impl FeedFixture {
    pub(crate) fn new(account_id: &AccountId, id: impl Into<String>) -> Self {
        let id = FeedId(id.into());
        Self {
            url: format!("https://example.test/feeds/{}.xml", id.0),
            id,
            account_id: account_id.clone(),
            remote_id: None,
            title: "Test Feed",
        }
    }

    pub(crate) fn remote_id(mut self, remote_id: impl Into<String>) -> Self {
        self.remote_id = Some(remote_id.into());
        self
    }

    pub(crate) fn insert(&self, conn: &Connection) {
        conn.execute(
            "INSERT INTO feeds (id, account_id, remote_id, title, url)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                self.id.0,
                self.account_id.0,
                self.remote_id,
                self.title,
                self.url
            ],
        )
        .unwrap();
    }
}

pub(crate) struct ArticleFixture {
    pub(crate) id: ArticleId,
    pub(crate) feed_id: FeedId,
    pub(crate) remote_id: Option<String>,
    pub(crate) title: &'static str,
    pub(crate) is_read: bool,
    pub(crate) is_starred: bool,
}

impl ArticleFixture {
    pub(crate) fn new(feed_id: &FeedId, id: impl Into<String>) -> Self {
        Self {
            id: ArticleId(id.into()),
            feed_id: feed_id.clone(),
            remote_id: None,
            title: "Test Article",
            is_read: false,
            is_starred: false,
        }
    }

    pub(crate) fn remote_id(mut self, remote_id: impl Into<String>) -> Self {
        self.remote_id = Some(remote_id.into());
        self
    }

    pub(crate) fn read(mut self) -> Self {
        self.is_read = true;
        self
    }

    pub(crate) fn starred(mut self) -> Self {
        self.is_starred = true;
        self
    }

    pub(crate) fn insert(&self, conn: &Connection) {
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO articles (
                id,
                feed_id,
                remote_id,
                title,
                published_at,
                is_read,
                is_starred,
                fetched_at
             )
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                self.id.0,
                self.feed_id.0,
                self.remote_id,
                self.title,
                now,
                self.is_read,
                self.is_starred,
                now
            ],
        )
        .unwrap();
    }
}

pub(crate) struct TagFixture {
    pub(crate) id: TagId,
    pub(crate) name: String,
}

impl TagFixture {
    pub(crate) fn new(id: impl Into<String>, name: impl Into<String>) -> Self {
        Self {
            id: TagId(id.into()),
            name: name.into(),
        }
    }

    pub(crate) fn insert(&self, conn: &Connection) {
        conn.execute(
            "INSERT INTO tags (id, name) VALUES (?1, ?2)",
            params![self.id.0, self.name],
        )
        .unwrap();
    }
}

pub(crate) struct PendingMutationFixture {
    pub(crate) account_id: AccountId,
    pub(crate) mutation_type: &'static str,
    pub(crate) remote_entry_id: String,
}

impl PendingMutationFixture {
    pub(crate) fn mark_read(account_id: &AccountId, remote_entry_id: impl Into<String>) -> Self {
        Self {
            account_id: account_id.clone(),
            mutation_type: "mark_read",
            remote_entry_id: remote_entry_id.into(),
        }
    }

    pub(crate) fn insert(&self, conn: &Connection) {
        conn.execute(
            "INSERT INTO pending_mutations (account_id, mutation_type, remote_entry_id, created_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                self.account_id.0,
                self.mutation_type,
                self.remote_entry_id,
                Utc::now().to_rfc3339()
            ],
        )
        .unwrap();
    }
}

pub(crate) fn insert_account_with_invalid_provider_kind(
    conn: &Connection,
    id: impl Into<String>,
) -> AccountId {
    let id = AccountId(id.into());
    conn.execute(
        "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
        params![id.0, "UnknownProvider", "Corrupt Account"],
    )
    .unwrap();
    id
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::db::connection::DbManager;

    #[test]
    fn repository_fixture_builders_insert_minimal_valid_rows_by_domain() {
        let db = DbManager::new_in_memory().unwrap();
        let account = AccountFixture::local("fixture-account");
        let feed = FeedFixture::new(&account.id, "fixture-feed").remote_id("feed/fixture");
        let article = ArticleFixture::new(&feed.id, "fixture-article")
            .remote_id("entry/fixture")
            .read()
            .starred();
        let tag = TagFixture::new("fixture-tag", "Fixture Tag");
        let pending = PendingMutationFixture::mark_read(&account.id, "entry/fixture");

        account.insert(db.writer());
        feed.insert(db.writer());
        article.insert(db.writer());
        tag.insert(db.writer());
        pending.insert(db.writer());

        let row_count = |table: &str| -> i64 {
            db.reader()
                .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
                    row.get(0)
                })
                .unwrap()
        };

        assert_eq!(row_count("accounts"), 1);
        assert_eq!(row_count("feeds"), 1);
        assert_eq!(row_count("articles"), 1);
        assert_eq!(row_count("tags"), 1);
        assert_eq!(row_count("pending_mutations"), 1);
    }

    #[test]
    fn corruption_helper_is_separate_from_minimal_valid_account_fixture() {
        let db = DbManager::new_in_memory().unwrap();

        AccountFixture::local("valid-account").insert(db.writer());
        let corrupt_id = insert_account_with_invalid_provider_kind(db.writer(), "corrupt-account");

        let invalid_kind_count: i64 = db
            .reader()
            .query_row(
                "SELECT COUNT(*) FROM accounts WHERE kind = 'UnknownProvider'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(corrupt_id, AccountId("corrupt-account".to_string()));
        assert_eq!(invalid_kind_count, 1);
    }
}
