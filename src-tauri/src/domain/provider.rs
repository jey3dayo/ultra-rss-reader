use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProviderKind {
    Local,
    FreshRss,
    Quarantined,
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

#[derive(Debug, Clone)]
pub struct ProviderCapabilities {
    pub supports_folders: bool,
    pub supports_starring: bool,
    pub supports_search: bool,
    pub supports_delta_sync: bool,
    pub supports_remote_state: bool,
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
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn freshrss_capability_is_connected_to_greader_product_diagnostics() {
        let capabilities = ProviderKind::FreshRss.capabilities();
        let identity = ProviderKind::FreshRss.api_identity();

        assert!(capabilities.supports_delta_sync);
        assert!(capabilities.supports_remote_state);
        assert_eq!(identity.protocol, "greader");
        assert_eq!(identity.server_product, "FreshRSS");
        assert_eq!(
            identity.server_product_version_detection,
            "unsupported_by_greader_contract"
        );
        assert_eq!(identity.diagnostics_product_label, "freshrss-greader");
    }

    #[test]
    fn provider_auth_semantics_document_token_refresh_contract() {
        let local = ProviderKind::Local.auth_semantics();
        assert_eq!(local.credential_material, "none");
        assert_eq!(local.token_expiry, "not_applicable");

        let freshrss = ProviderKind::FreshRss.auth_semantics();
        assert_eq!(
            freshrss.credential_material,
            "username_password_client_login"
        );
        assert_eq!(freshrss.token_expiry, "server_defined_not_reported");
        assert_eq!(
            freshrss.refresh_strategy,
            "reauthenticate_before_each_sync_session"
        );
        assert_eq!(
            freshrss.expiry_recovery,
            "treat_401_403_as_auth_failure_and_scheduler_backoff"
        );
    }

    #[test]
    fn provider_clock_policy_keeps_server_time_out_of_backoff() {
        let freshrss = ProviderKind::FreshRss.clock_policy();
        assert_eq!(
            freshrss.server_timestamp_source,
            "greader_timestamp_usec_updated_published"
        );
        assert_eq!(
            freshrss.cursor_timestamp_policy,
            "oldest_seen_timestamp_usec_with_equal_timestamp_guard"
        );
        assert_eq!(
            freshrss.backoff_time_source,
            "local_scheduler_clock_with_retry_after_floor"
        );
        assert_eq!(
            freshrss.skew_policy,
            "use_provider_item_time_only_for_cursor_never_for_retry_schedule"
        );
    }
}
