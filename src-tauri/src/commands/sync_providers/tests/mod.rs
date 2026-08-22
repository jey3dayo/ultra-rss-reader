//! Shared fixtures and helpers for sync_providers unit tests, split by responsibility
//! across sibling modules in this directory.

pub(super) use super::*;

pub(super) use crate::domain::account::ConnectionVerificationStatus;

pub(super) use crate::domain::provider::ProviderKind;

pub(super) use crate::infra::db::sqlite_account::SqliteAccountRepository;

pub(super) use crate::repository::account::AccountRepository;

pub(super) use crate::repository::article::{ArticleRepository, Pagination};

pub(super) use crate::repository::pending_mutation::PendingMutation;

pub(super) use mockito::Matcher;

pub(super) use std::borrow::Cow;

pub(super) const FEED_REMOTE_ID: &str = "feed/https://example.com/rss";

pub(super) const LOCAL_ETAG_OLD: &str = "\"etag-old\"";

pub(super) const LOCAL_ETAG_NEW: &str = "\"etag-new\"";

pub(super) const LOCAL_LAST_MODIFIED_OLD: &str = "Wed, 01 Jan 2025 00:00:00 GMT";

pub(super) const LOCAL_LAST_MODIFIED_NEW: &str = "Thu, 02 Jan 2025 00:00:00 GMT";

pub(super) static DEV_CREDENTIALS_ENV_LOCK: std::sync::LazyLock<tokio::sync::Mutex<()>> =
    std::sync::LazyLock::new(|| tokio::sync::Mutex::new(()));

pub(super) struct ProviderHttpResponseFixture<'a> {
    status: usize,
    headers: &'a [(&'a str, &'a str)],
    body: Cow<'a, str>,
}

impl<'a> ProviderHttpResponseFixture<'a> {
    fn status(status: usize) -> Self {
        Self {
            status,
            headers: &[],
            body: Cow::Borrowed(""),
        }
    }

    fn body(mut self, body: impl Into<Cow<'a, str>>) -> Self {
        self.body = body.into();
        self
    }

    fn headers(mut self, headers: &'a [(&'a str, &'a str)]) -> Self {
        self.headers = headers;
        self
    }

    fn ok(body: &'static str) -> ProviderHttpResponseFixture<'static> {
        ProviderHttpResponseFixture::status(200).body(body)
    }

    fn json(body: &'static str) -> ProviderHttpResponseFixture<'static> {
        Self::ok(body).headers(&[("content-type", "application/json")])
    }

    fn auth_token() -> ProviderHttpResponseFixture<'static> {
        Self::ok("Auth=tok\n")
    }

    fn empty_item_refs() -> ProviderHttpResponseFixture<'static> {
        Self::json(r#"{ "itemRefs": [] }"#)
    }
}

pub(super) trait ProviderMockResponseExt {
    fn with_provider_response(self, response: ProviderHttpResponseFixture<'_>) -> Self;
}

impl ProviderMockResponseExt for mockito::Mock {
    fn with_provider_response(self, response: ProviderHttpResponseFixture<'_>) -> Self {
        response.headers.iter().fold(
            self.with_status(response.status)
                .with_body(response.body.as_ref()),
            |mock, (name, value)| mock.with_header(*name, value),
        )
    }
}

pub(super) struct DevCredentialsContext {
    _guard: tokio::sync::MutexGuard<'static, ()>,
    _dir: tempfile::TempDir,
    previous_home: Option<String>,
}

impl Drop for DevCredentialsContext {
    fn drop(&mut self) {
        std::env::remove_var("DEV_CREDENTIALS");
        std::env::remove_var("XDG_DATA_HOME");
        match self.previous_home.as_ref() {
            Some(home) => std::env::set_var("HOME", home),
            None => std::env::remove_var("HOME"),
        }
    }
}

pub(super) const LOCAL_RSS_INITIAL: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
    <channel>
        <title>Local Feed</title>
        <item>
            <title>Local Article</title>
            <link>https://example.com/1</link>
            <guid>local-guid-1</guid>
        </item>
    </channel>
    </rss>"#;

pub(super) const LOCAL_RSS_UPDATED: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
    <channel>
        <title>Local Feed</title>
        <item>
            <title>Local Article Updated</title>
            <link>https://example.com/1</link>
            <guid>local-guid-1</guid>
        </item>
    </channel>
    </rss>"#;

pub(super) fn test_db() -> Mutex<DbManager> {
    Mutex::new(DbManager::new_in_memory().unwrap())
}

pub(super) fn test_account(server_url: &str) -> Account {
    Account {
        id: AccountId::new(),
        kind: ProviderKind::FreshRss,
        name: "FreshRSS".to_string(),
        server_url: Some(server_url.to_string()),
        username: Some("u".to_string()),
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    }
}

pub(super) fn test_feed(account_id: &AccountId) -> Feed {
    Feed {
        id: FeedId::new(),
        account_id: account_id.clone(),
        folder_id: None,
        remote_id: Some(FEED_REMOTE_ID.to_string()),
        title: "Example Feed".to_string(),
        url: "https://example.com/rss".to_string(),
        site_url: "https://example.com".to_string(),
        icon: None,
        icon_url: None,
        unread_count: 0,
        reader_mode: "inherit".to_string(),
        web_preview_mode: "inherit".to_string(),
    }
}

pub(super) fn insert_account_and_feed(db: &Mutex<DbManager>, server_url: &str) -> (Account, Feed) {
    let account = test_account(server_url);
    let feed = test_feed(&account.id);

    let db_guard = db.lock().unwrap();
    let account_repo = SqliteAccountRepository::new(db_guard.writer());
    let feed_repo = SqliteFeedRepository::new(db_guard.writer());
    account_repo.save(&account).unwrap();
    feed_repo.save(&feed).unwrap();

    (account, feed)
}

pub(super) fn make_test_feed(
    account_id: &AccountId,
    remote_id: &str,
    title: &str,
    url: &str,
    site_url: &str,
) -> Feed {
    Feed {
        id: FeedId::new(),
        account_id: account_id.clone(),
        folder_id: None,
        remote_id: Some(remote_id.to_string()),
        title: title.to_string(),
        url: url.to_string(),
        site_url: site_url.to_string(),
        icon: None,
        icon_url: None,
        unread_count: 0,
        reader_mode: "inherit".to_string(),
        web_preview_mode: "inherit".to_string(),
    }
}

pub(super) fn insert_account_and_feeds(
    db: &Mutex<DbManager>,
    server_url: &str,
    feed_specs: &[(&str, &str, &str, &str)],
) -> (Account, Vec<Feed>) {
    let account = test_account(server_url);
    let feeds = feed_specs
        .iter()
        .map(|(remote_id, title, url, site_url)| {
            make_test_feed(&account.id, remote_id, title, url, site_url)
        })
        .collect::<Vec<_>>();

    let db_guard = db.lock().unwrap();
    let account_repo = SqliteAccountRepository::new(db_guard.writer());
    let feed_repo = SqliteFeedRepository::new(db_guard.writer());
    account_repo.save(&account).unwrap();
    for feed in &feeds {
        feed_repo.save(feed).unwrap();
    }

    (account, feeds)
}

pub(super) fn test_local_account() -> Account {
    Account {
        id: AccountId::new(),
        kind: ProviderKind::Local,
        name: "Local".to_string(),
        server_url: None,
        username: None,
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    }
}

pub(super) fn test_local_feed(account_id: &AccountId, feed_url: &str) -> Feed {
    Feed {
        id: FeedId::new(),
        account_id: account_id.clone(),
        folder_id: None,
        remote_id: None,
        title: "Local Feed".to_string(),
        url: feed_url.to_string(),
        site_url: "https://example.com".to_string(),
        icon: None,
        icon_url: None,
        unread_count: 0,
        reader_mode: "inherit".to_string(),
        web_preview_mode: "inherit".to_string(),
    }
}

pub(super) fn insert_local_account_and_feed(
    db: &Mutex<DbManager>,
    feed_url: &str,
) -> (Account, Feed) {
    let account = test_local_account();
    let feed = test_local_feed(&account.id, feed_url);

    let db_guard = db.lock().unwrap();
    let account_repo = SqliteAccountRepository::new(db_guard.writer());
    let feed_repo = SqliteFeedRepository::new(db_guard.writer());
    account_repo.save(&account).unwrap();
    feed_repo.save(&feed).unwrap();

    (account, feed)
}

pub(super) async fn authenticated_provider(server_url: &str) -> GReaderProvider {
    let mut provider = GReaderProvider::for_freshrss(server_url);
    provider
        .authenticate(&Credentials {
            token: Some("u".to_string()),
            password: Some("p".to_string()),
        })
        .await
        .unwrap();
    provider
}

pub(super) async fn configure_dev_credentials(account_id: &AccountId) -> DevCredentialsContext {
    let guard = DEV_CREDENTIALS_ENV_LOCK.lock().await;
    let previous_home = std::env::var("HOME").ok();
    std::env::set_var("DEV_CREDENTIALS", "1");
    let credentials_dir = tempfile::tempdir().unwrap();
    std::env::set_var("XDG_DATA_HOME", credentials_dir.path());
    std::env::set_var("HOME", credentials_dir.path());
    std::fs::create_dir_all(credentials_dir.path().join("ultra-rss-reader")).unwrap();
    std::fs::write(
        credentials_dir
            .path()
            .join("ultra-rss-reader")
            .join("dev-credentials.json"),
        "{}",
    )
    .unwrap();
    keyring_store::set_password(account_id.as_ref(), "p").unwrap();
    DevCredentialsContext {
        _guard: guard,
        _dir: credentials_dir,
        previous_home,
    }
}

#[cfg(test)]
mod account_sync;
#[cfg(test)]
mod feed_sync;
#[cfg(test)]
mod remote_state;
#[cfg(test)]
mod subscriptions;
