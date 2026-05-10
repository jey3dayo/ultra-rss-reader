use crate::domain::error::DomainResult;
use crate::domain::types::AccountId;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SyncStateScopeKey {
    Scheduler,
    GReaderAccountAll,
    GReaderRemoteStateFull,
    Feed(String),
    LocalFeed(String),
    Raw(String),
    LegacyRaw(String),
}

impl SyncStateScopeKey {
    pub fn scheduler() -> Self {
        Self::Scheduler
    }

    pub fn greader_account_all() -> Self {
        Self::GReaderAccountAll
    }

    pub fn greader_remote_state_full() -> Self {
        Self::GReaderRemoteStateFull
    }

    pub fn feed(remote_id: impl Into<String>) -> Self {
        Self::Feed(remote_id.into())
    }

    pub fn local_feed(feed_url: impl Into<String>) -> Self {
        Self::LocalFeed(feed_url.into())
    }

    pub fn raw(scope_key: impl Into<String>) -> Self {
        Self::Raw(scope_key.into())
    }

    pub fn as_string(&self) -> String {
        match self {
            Self::Scheduler => "scheduler".to_string(),
            Self::GReaderAccountAll => "account:greader:all".to_string(),
            Self::GReaderRemoteStateFull => "account:greader:remote-state-full".to_string(),
            Self::Feed(remote_id) => format!("feed:{remote_id}"),
            Self::LocalFeed(feed_url) => format!("local_feed:{feed_url}"),
            Self::Raw(scope_key) => format!("raw:{scope_key}"),
            Self::LegacyRaw(scope_key) => scope_key.clone(),
        }
    }
}

impl From<&str> for SyncStateScopeKey {
    fn from(value: &str) -> Self {
        match value {
            "scheduler" => Self::Scheduler,
            "account:greader:all" => Self::GReaderAccountAll,
            "account:greader:remote-state-full" => Self::GReaderRemoteStateFull,
            value => value
                .strip_prefix("feed:")
                .map(|remote_id| Self::Feed(remote_id.to_string()))
                .or_else(|| {
                    value
                        .strip_prefix("local_feed:")
                        .map(|feed_url| Self::LocalFeed(feed_url.to_string()))
                })
                .or_else(|| {
                    value
                        .strip_prefix("raw:")
                        .map(|scope_key| Self::Raw(scope_key.to_string()))
                })
                .unwrap_or_else(|| Self::LegacyRaw(value.to_string())),
        }
    }
}

impl From<&String> for SyncStateScopeKey {
    fn from(value: &String) -> Self {
        value.as_str().into()
    }
}

impl From<&SyncStateScopeKey> for SyncStateScopeKey {
    fn from(value: &SyncStateScopeKey) -> Self {
        value.clone()
    }
}

impl From<String> for SyncStateScopeKey {
    fn from(value: String) -> Self {
        value.as_str().into()
    }
}

#[derive(Debug, Clone)]
pub struct SyncState {
    pub account_id: AccountId,
    pub scope_key: String,
    pub timestamp_usec: Option<i64>,
    pub continuation: Option<String>,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
    pub last_success_at: Option<String>,
    pub last_error: Option<String>,
    pub error_count: i32,
    pub next_retry_at: Option<String>,
}

pub trait SyncStateRepository {
    fn get<K>(&self, account_id: &AccountId, scope_key: K) -> DomainResult<Option<SyncState>>
    where
        K: Into<SyncStateScopeKey>;
    fn save(&self, state: &SyncState) -> DomainResult<()>;
}
