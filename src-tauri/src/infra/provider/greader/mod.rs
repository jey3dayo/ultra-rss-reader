mod http;
mod stream;

use async_trait::async_trait;
use std::fmt;

#[cfg(test)]
use super::http_defaults;
use super::traits::{Credentials, FeedProvider};
use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::*;

#[cfg(test)]
use crate::infra::feed_discovery::validate_discovery_url;
#[cfg(test)]
use chrono::{DateTime, Utc};
#[cfg(test)]
use stream::{
    normalize_item_id, normalize_label_remote_id, valid_item_cursor_timestamp_usec, GReaderItem,
    GReaderLink, GReaderOrigin,
};
pub(crate) use stream::{UnreadPullResult, UnreadPullTermination};

// --- Constants ---

const STATE_READ: &str = "user/-/state/com.google/read";
const STATE_STARRED: &str = "user/-/state/com.google/starred";
const STATE_READING_LIST: &str = "user/-/state/com.google/reading-list";
const LABEL_PREFIX: &str = "user/-/label/";
const STREAM_CONTENTS_LIMIT: u32 = 200;
const STREAM_IDS_LIMIT: u32 = 10000;
const G_READER_MAX_PAGES: usize = 100;
const G_READER_MAX_STREAM_IDS: usize = 50_000;

// --- Provider ---

/// Generic Google Reader API provider for GReader-compatible services.
pub struct GReaderProvider {
    kind: ProviderKind,
    /// Base URL for API calls (e.g., "http://server/api/greader.php")
    api_base: String,
    /// Base URL for authentication (e.g., "http://server/api/greader.php")
    auth_base: String,
    // Keep setup failures for legacy infallible constructors so the first
    // provider operation returns the error instead of silently using a default client.
    http_client: Result<reqwest::Client, DomainError>,
    auth_token: Option<String>,
}

impl fmt::Debug for GReaderProvider {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("GReaderProvider")
            .field("kind", &self.kind)
            .field("api_base", &"[redacted]")
            .field("auth_base", &"[redacted]")
            .field(
                "auth_token",
                &self.auth_token.as_ref().map(|_| "[redacted]"),
            )
            .finish_non_exhaustive()
    }
}

impl GReaderProvider {
    pub(crate) async fn pull_unread_entries_for_feed(
        &self,
        remote_id: &str,
        cursor: Option<SyncCursor>,
    ) -> DomainResult<UnreadPullResult> {
        stream::pull_unread_entries_for_feed(self, remote_id, cursor).await
    }
}

/// Simple percent-encoding for URL form values.
pub(super) fn urlencoded(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                String::from(b as char)
            }
            _ => format!("%{b:02X}"),
        })
        .collect()
}

#[async_trait]
impl FeedProvider for GReaderProvider {
    fn kind(&self) -> ProviderKind {
        self.kind.clone()
    }

    fn capabilities(&self) -> ProviderCapabilities {
        self.kind.capabilities()
    }

    async fn authenticate(&mut self, credentials: &Credentials) -> DomainResult<()> {
        self.authenticate_with_client_login(credentials).await
    }

    async fn get_subscriptions(&self) -> DomainResult<Vec<RemoteSubscription>> {
        self.get_subscriptions_impl().await
    }

    async fn get_folders(&self) -> DomainResult<Vec<RemoteFolder>> {
        self.get_folders_impl().await
    }

    async fn pull_entries(
        &self,
        scope: PullScope,
        cursor: Option<SyncCursor>,
    ) -> DomainResult<PullResult> {
        self.pull_entries_impl(scope, cursor).await
    }

    async fn pull_state(&self) -> DomainResult<RemoteState> {
        self.pull_state_impl().await
    }

    async fn push_mutations(&self, mutations: &[Mutation]) -> DomainResult<()> {
        self.push_mutations_impl(mutations).await
    }

    async fn create_subscription(
        &self,
        url: &str,
        folder: Option<&str>,
    ) -> DomainResult<RemoteSubscription> {
        self.create_subscription_impl(url, folder).await
    }

    async fn delete_subscription(&self, id: &FeedIdentifier) -> DomainResult<()> {
        self.delete_subscription_impl(id).await
    }

    async fn edit_subscription(
        &self,
        remote_id: &str,
        title: Option<&str>,
        add_folder_label: Option<&str>,
        remove_folder_label: Option<&str>,
    ) -> DomainResult<()> {
        self.edit_subscription_impl(remote_id, title, add_folder_label, remove_folder_label)
            .await
    }
}

#[cfg(test)]
mod tests;
