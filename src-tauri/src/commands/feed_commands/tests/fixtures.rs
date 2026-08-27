use super::*;

pub(super) const SAMPLE_RSS: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
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
pub(super) static DEV_CREDENTIALS_ENV_LOCK: std::sync::LazyLock<tokio::sync::Mutex<()>> =
    std::sync::LazyLock::new(|| tokio::sync::Mutex::new(()));

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

pub(super) fn test_db() -> DbManager {
    DbManager::new_in_memory().unwrap()
}

pub(super) fn insert_test_account_with_kind(db: &DbManager, name: &str, kind: &str) -> AccountId {
    let id = AccountId::new();
    db.writer()
        .execute(
            "INSERT INTO accounts (id, kind, name) VALUES (?1, ?2, ?3)",
            params![id.0, kind, name],
        )
        .unwrap();
    id
}

pub(super) fn insert_test_account(db: &DbManager, name: &str) -> AccountId {
    insert_test_account_with_kind(db, name, "Local")
}

pub(super) fn insert_freshrss_account(db: &DbManager, server_url: &str) -> AccountId {
    let account = Account {
        id: AccountId::new(),
        kind: ProviderKind::FreshRss,
        name: "FreshRSS".to_string(),
        server_url: Some(server_url.to_string()),
        username: Some("u".to_string()),
        sync_interval_secs: 900,
        sync_on_startup: false,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Verified,
        connection_verified_at: None,
        connection_verification_error: None,
    };
    let id = account.id.clone();
    SqliteAccountRepository::new(db.writer())
        .save(&account)
        .unwrap();
    id
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

pub(super) fn insert_test_feed(db: &DbManager, account_id: &AccountId) -> FeedId {
    let id = FeedId::new();
    db.writer()
        .execute(
            "INSERT INTO feeds (id, account_id, title, url) VALUES (?1, ?2, ?3, ?4)",
            params![id.0, account_id.0, "Feed", "http://example.com/rss"],
        )
        .unwrap();
    id
}

pub(super) fn insert_remote_test_feed(
    db: &DbManager,
    account_id: &AccountId,
    remote_id: &str,
) -> FeedId {
    let id = FeedId::new();
    db.writer()
        .execute(
            "INSERT INTO feeds (id, account_id, remote_id, title, url) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                id.0,
                account_id.0,
                remote_id,
                "Feed",
                "http://example.com/rss"
            ],
        )
        .unwrap();
    id
}

pub(super) struct RecordingDeleteProvider {
    pub(super) deleted_ids: Mutex<Vec<FeedIdentifier>>,
    pub(super) subscriptions: Vec<RemoteSubscription>,
}

#[async_trait]
impl FeedProvider for RecordingDeleteProvider {
    fn kind(&self) -> ProviderKind {
        ProviderKind::FreshRss
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderKind::FreshRss.capabilities()
    }

    async fn authenticate(&mut self, _credentials: &Credentials) -> DomainResult<()> {
        Ok(())
    }

    async fn get_subscriptions(&self) -> DomainResult<Vec<RemoteSubscription>> {
        Ok(self.subscriptions.clone())
    }

    async fn get_folders(&self) -> DomainResult<Vec<RemoteFolder>> {
        Ok(Vec::new())
    }

    async fn pull_entries(
        &self,
        _scope: PullScope,
        _cursor: Option<SyncCursor>,
    ) -> DomainResult<PullResult> {
        Err(DomainError::Validation(
            "test provider does not pull entries".to_string(),
        ))
    }

    async fn pull_state(&self) -> DomainResult<RemoteState> {
        Ok(RemoteState::default())
    }

    async fn push_mutations(&self, _mutations: &[Mutation]) -> DomainResult<()> {
        Ok(())
    }

    async fn create_subscription(
        &self,
        _url: &str,
        _folder: Option<&str>,
    ) -> DomainResult<RemoteSubscription> {
        Err(DomainError::Validation(
            "test provider does not create subscriptions".to_string(),
        ))
    }

    async fn delete_subscription(&self, id: &FeedIdentifier) -> DomainResult<()> {
        self.deleted_ids.lock().unwrap().push(id.clone());
        Ok(())
    }

    async fn edit_subscription(
        &self,
        _remote_id: &str,
        _title: Option<&str>,
        _add_folder_label: Option<&str>,
        _remove_folder_label: Option<&str>,
    ) -> DomainResult<()> {
        Ok(())
    }
}
