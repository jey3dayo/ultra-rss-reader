use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProviderKind {
    Local,
    FreshRss,
    Quarantined,
}

/// GReader protocol stream-id prefix for feed-backed streams (e.g.
/// `feed/https://example.com/rss`). Single owner for the identity check used
/// by both Rust predicates and raw SQL `LIKE` construction, so a prefix
/// change cannot update one side without the other.
pub const GREADER_FEED_ID_PREFIX: &str = "feed/";

/// Whether `remote_id` identifies a GReader-protocol feed stream, i.e. a feed
/// synced from a provider that speaks the GReader API (currently FreshRSS).
pub fn is_greader_managed_feed_remote_id(remote_id: Option<&str>) -> bool {
    remote_id.is_some_and(|id| id.starts_with(GREADER_FEED_ID_PREFIX))
}

#[derive(Debug, Clone)]
pub enum FeedIdentifier {
    Local { feed_url: String },
    Remote { remote_id: String },
}

#[derive(Debug, Clone)]
pub enum PullScope {
    Feed(FeedIdentifier),
    All,
    Unread,
    Starred,
}

#[derive(Debug, Clone, Default)]
pub struct SyncCursor {
    pub continuation: Option<String>,
    pub since: Option<DateTime<Utc>>,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PullResult {
    pub entries: Vec<RemoteEntry>,
    pub next_cursor: Option<SyncCursor>,
    pub has_more: bool,
    pub not_modified: bool,
    pub skipped_entries: usize,
}

#[derive(Debug, Clone)]
pub struct RemoteEntry {
    pub id: Option<String>,
    pub source_feed_id: FeedIdentifier,
    pub title: String,
    pub content: String,
    pub summary: Option<String>,
    pub url: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub thumbnail: Option<String>,
    pub author: Option<String>,
    pub is_read: Option<bool>,
    pub is_starred: Option<bool>,
}

#[derive(Debug, Clone)]
pub struct RemoteSubscription {
    pub remote_id: String,
    pub title: String,
    pub url: String,
    pub site_url: String,
    pub folder_remote_id: Option<String>,
    pub icon_url: Option<String>,
}

#[derive(Debug, Clone)]
pub struct RemoteFolder {
    pub remote_id: String,
    pub name: String,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Clone, Default)]
pub struct RemoteState {
    pub read_ids: Vec<String>,
    pub starred_ids: Vec<String>,
}

#[derive(Debug, Clone)]
pub enum Mutation {
    MarkRead {
        remote_entry_id: String,
    },
    MarkUnread {
        remote_entry_id: String,
    },
    SetStarred {
        remote_entry_id: String,
        starred: bool,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderCapabilities {
    pub supports_folders: bool,
    pub supports_starring: bool,
    pub supports_search: bool,
    pub supports_delta_sync: bool,
    pub supports_remote_state: bool,
}

impl ProviderCapabilities {
    pub fn supports_read_state_mutations(&self) -> bool {
        self.supports_remote_state
    }

    pub fn supports_star_state_mutations(&self) -> bool {
        self.supports_remote_state && self.supports_starring
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderSideDeletionRetention {
    NotApplicable,
    DeleteLocal,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProviderDeletionRetentionPolicy {
    pub missing_remote_feed: ProviderSideDeletionRetention,
    pub missing_remote_folder: ProviderSideDeletionRetention,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RemoteDeleteOptimisticMutationConflict {
    NotApplicable,
    KeepPendingLocalMutation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProviderOptimisticMutationConflictPolicy {
    pub read_state: RemoteDeleteOptimisticMutationConflict,
    pub star_state: RemoteDeleteOptimisticMutationConflict,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderApiIdentity {
    pub protocol: &'static str,
    pub server_product: &'static str,
    pub server_product_version_detection: &'static str,
    pub diagnostics_product_label: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderAuthSemantics {
    pub credential_material: &'static str,
    pub token_expiry: &'static str,
    pub refresh_strategy: &'static str,
    pub expiry_recovery: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderClockPolicy {
    pub server_timestamp_source: &'static str,
    pub cursor_timestamp_policy: &'static str,
    pub backoff_time_source: &'static str,
    pub skew_policy: &'static str,
}

impl ProviderKind {
    pub fn capabilities(&self) -> ProviderCapabilities {
        match self {
            Self::Local => ProviderCapabilities {
                supports_folders: false,
                supports_starring: false,
                supports_search: false,
                supports_delta_sync: false,
                supports_remote_state: false,
            },
            Self::FreshRss => ProviderCapabilities {
                supports_folders: true,
                supports_starring: true,
                supports_search: true,
                supports_delta_sync: true,
                supports_remote_state: true,
            },
            Self::Quarantined => ProviderCapabilities {
                supports_folders: false,
                supports_starring: false,
                supports_search: false,
                supports_delta_sync: false,
                supports_remote_state: false,
            },
        }
    }

    pub fn api_identity(&self) -> ProviderApiIdentity {
        match self {
            Self::Local => ProviderApiIdentity {
                protocol: "local-feed",
                server_product: "Local",
                server_product_version_detection: "not_applicable",
                diagnostics_product_label: "local",
            },
            Self::FreshRss => ProviderApiIdentity {
                protocol: "greader",
                server_product: "FreshRSS",
                server_product_version_detection: "unsupported_by_greader_contract",
                diagnostics_product_label: "freshrss-greader",
            },
            Self::Quarantined => ProviderApiIdentity {
                protocol: "disabled",
                server_product: "Quarantined",
                server_product_version_detection: "not_applicable",
                diagnostics_product_label: "quarantined",
            },
        }
    }

    pub fn auth_semantics(&self) -> ProviderAuthSemantics {
        match self {
            Self::Local => ProviderAuthSemantics {
                credential_material: "none",
                token_expiry: "not_applicable",
                refresh_strategy: "not_applicable",
                expiry_recovery: "not_applicable",
            },
            Self::FreshRss => ProviderAuthSemantics {
                credential_material: "username_password_client_login",
                token_expiry: "server_defined_not_reported",
                refresh_strategy: "reauthenticate_before_each_sync_session",
                expiry_recovery: "treat_401_403_as_auth_failure_and_scheduler_backoff",
            },
            Self::Quarantined => ProviderAuthSemantics {
                credential_material: "none",
                token_expiry: "not_applicable",
                refresh_strategy: "sync_disabled",
                expiry_recovery: "sync_disabled",
            },
        }
    }

    pub fn clock_policy(&self) -> ProviderClockPolicy {
        match self {
            Self::Local => ProviderClockPolicy {
                server_timestamp_source: "http_cache_headers",
                cursor_timestamp_policy: "etag_last_modified_only",
                backoff_time_source: "local_scheduler_clock",
                skew_policy: "ignore_provider_clock_for_backoff",
            },
            Self::FreshRss => ProviderClockPolicy {
                server_timestamp_source: "greader_timestamp_usec_updated_published",
                cursor_timestamp_policy: "oldest_seen_timestamp_usec_with_equal_timestamp_guard",
                backoff_time_source: "local_scheduler_clock_with_retry_after_floor",
                skew_policy: "use_provider_item_time_only_for_cursor_never_for_retry_schedule",
            },
            Self::Quarantined => ProviderClockPolicy {
                server_timestamp_source: "none",
                cursor_timestamp_policy: "sync_disabled",
                backoff_time_source: "sync_disabled",
                skew_policy: "sync_disabled",
            },
        }
    }

    pub fn deletion_retention_policy(&self) -> ProviderDeletionRetentionPolicy {
        match self {
            Self::Local | Self::Quarantined => ProviderDeletionRetentionPolicy {
                missing_remote_feed: ProviderSideDeletionRetention::NotApplicable,
                missing_remote_folder: ProviderSideDeletionRetention::NotApplicable,
            },
            Self::FreshRss => ProviderDeletionRetentionPolicy {
                missing_remote_feed: ProviderSideDeletionRetention::DeleteLocal,
                missing_remote_folder: ProviderSideDeletionRetention::DeleteLocal,
            },
        }
    }

    pub fn optimistic_mutation_conflict_policy(&self) -> ProviderOptimisticMutationConflictPolicy {
        match self {
            Self::Local | Self::Quarantined => ProviderOptimisticMutationConflictPolicy {
                read_state: RemoteDeleteOptimisticMutationConflict::NotApplicable,
                star_state: RemoteDeleteOptimisticMutationConflict::NotApplicable,
            },
            Self::FreshRss => ProviderOptimisticMutationConflictPolicy {
                read_state: RemoteDeleteOptimisticMutationConflict::KeepPendingLocalMutation,
                star_state: RemoteDeleteOptimisticMutationConflict::KeepPendingLocalMutation,
            },
        }
    }
}

#[cfg(test)]
mod tests;
