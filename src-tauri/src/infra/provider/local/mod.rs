mod http;
mod metadata;

use async_trait::async_trait;
use reqwest::header::{IF_MODIFIED_SINCE, IF_NONE_MATCH};
use reqwest::StatusCode;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::Semaphore;

#[cfg(test)]
use super::http_defaults;
use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::*;
use crate::domain::url_policy::{
    validate_http_url_without_credentials, UNSUPPORTED_URL_VALIDATION_MESSAGE,
};
use crate::infra::feed_discovery::resolve_validated_public_addrs;

use super::normalizer;
use super::traits::{Credentials, FeedProvider};

#[cfg(test)]
const DOWNGRADE_REDIRECT_VALIDATION_MESSAGE: &str =
    http_defaults::DOWNGRADE_REDIRECT_VALIDATION_MESSAGE;
const LOCAL_PROVIDER_SYNC_REQUEST_CONCURRENCY_LIMIT: usize = 1;
const LOCAL_PROVIDER_DISCOVERY_REQUEST_CONCURRENCY_LIMIT: usize = 1;

pub struct LocalProvider {
    // Keep setup failures for legacy infallible constructors so the first
    // provider operation returns the error instead of silently using a default client.
    http_client: Result<reqwest::Client, DomainError>,
    allow_private_feed_urls: bool,
    sync_request_permits: Arc<Semaphore>,
    discovery_request_permits: Arc<Semaphore>,
}

impl Default for LocalProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl LocalProvider {
    pub fn new() -> Self {
        Self::with_private_feed_url_policy(false)
    }

    fn with_private_feed_url_policy(allow_private_feed_urls: bool) -> Self {
        Self {
            http_client: Self::build_http_client(allow_private_feed_urls),
            allow_private_feed_urls,
            sync_request_permits: Arc::new(Semaphore::new(
                LOCAL_PROVIDER_SYNC_REQUEST_CONCURRENCY_LIMIT,
            )),
            discovery_request_permits: Arc::new(Semaphore::new(
                LOCAL_PROVIDER_DISCOVERY_REQUEST_CONCURRENCY_LIMIT,
            )),
        }
    }

    #[doc(hidden)]
    pub fn new_allowing_private_feed_urls_for_tests() -> Self {
        Self::with_private_feed_url_policy(true)
    }

    pub fn try_new() -> DomainResult<Self> {
        Self::try_with_private_feed_url_policy(false)
    }

    fn try_with_private_feed_url_policy(allow_private_feed_urls: bool) -> DomainResult<Self> {
        Ok(Self {
            http_client: Ok(Self::build_http_client(allow_private_feed_urls)?),
            allow_private_feed_urls,
            sync_request_permits: Arc::new(Semaphore::new(
                LOCAL_PROVIDER_SYNC_REQUEST_CONCURRENCY_LIMIT,
            )),
            discovery_request_permits: Arc::new(Semaphore::new(
                LOCAL_PROVIDER_DISCOVERY_REQUEST_CONCURRENCY_LIMIT,
            )),
        })
    }

    fn validate_feed_url(&self, feed_url: &str) -> DomainResult<(reqwest::Url, Vec<SocketAddr>)> {
        let url = reqwest::Url::parse(feed_url)
            .map_err(|_| DomainError::Validation(UNSUPPORTED_URL_VALIDATION_MESSAGE.to_string()))?;

        // Test/bypass mode neither resolves against DNS nor pins the connection,
        // so it returns no addresses. Production resolves the host and returns the
        // validated public addresses so the fetch can be pinned to them, closing
        // the DNS-rebinding window between validation and connect.
        let resolved_addrs = if self.allow_private_feed_urls {
            validate_http_url_without_credentials(&url)?;
            Vec::new()
        } else {
            resolve_validated_public_addrs(&url)?
        };

        Ok((url, resolved_addrs))
    }

    async fn acquire_sync_request_permit(&self) -> DomainResult<tokio::sync::OwnedSemaphorePermit> {
        self.sync_request_permits
            .clone()
            .acquire_owned()
            .await
            .map_err(|_| DomainError::Network("Local provider sync request limiter closed".into()))
    }

    async fn acquire_discovery_request_permit(
        &self,
    ) -> DomainResult<tokio::sync::OwnedSemaphorePermit> {
        self.discovery_request_permits
            .clone()
            .acquire_owned()
            .await
            .map_err(|_| {
                DomainError::Network("Local provider discovery request limiter closed".into())
            })
    }
}

#[cfg(test)]
impl LocalProvider {
    pub(super) fn resolve_feed_site_url(feed_url: &str, raw_site_url: &str) -> Option<String> {
        metadata::resolve_feed_site_url(feed_url, raw_site_url)
    }

    pub(super) fn select_raw_feed_site_url(feed_body: &[u8], feed_url: &str) -> Option<String> {
        metadata::select_raw_feed_site_url(feed_body, feed_url)
    }
}

#[async_trait]
impl FeedProvider for LocalProvider {
    fn kind(&self) -> ProviderKind {
        ProviderKind::Local
    }

    fn capabilities(&self) -> ProviderCapabilities {
        self.kind().capabilities()
    }

    async fn authenticate(&mut self, _: &Credentials) -> DomainResult<()> {
        Ok(())
    }

    async fn get_subscriptions(&self) -> DomainResult<Vec<RemoteSubscription>> {
        Ok(vec![])
    }

    async fn get_folders(&self) -> DomainResult<Vec<RemoteFolder>> {
        Ok(vec![])
    }

    async fn pull_entries(
        &self,
        scope: PullScope,
        cursor: Option<SyncCursor>,
    ) -> DomainResult<PullResult> {
        let feed_url = match &scope {
            PullScope::Feed(FeedIdentifier::Local { feed_url }) => feed_url.clone(),
            _ => {
                return Err(DomainError::Validation(
                    "LocalProvider only supports PullScope::Feed(Local)".into(),
                ))
            }
        };

        let (feed_url, resolved_addrs) = self.validate_feed_url(&feed_url)?;
        let _permit = self.acquire_sync_request_permit().await?;
        let client = self.feed_http_client(&feed_url, &resolved_addrs)?;
        let mut request = client.get(feed_url.clone());
        if let Some(current) = cursor.as_ref() {
            if let Some(etag) = current.etag.as_deref() {
                request = request.header(IF_NONE_MATCH, etag);
            }
            if let Some(last_modified) = current.last_modified.as_deref() {
                request = request.header(IF_MODIFIED_SINCE, last_modified);
            }
        }

        let response = request
            .send()
            .await
            .map_err(http::map_local_provider_request_error)?;
        let status = response.status();
        let response_etag = Self::response_etag_validator(response.headers());
        let response_last_modified = Self::response_last_modified_validator(response.headers());
        let next_cursor = Some(SyncCursor {
            continuation: None,
            since: None,
            etag: response_etag.clone().or_else(|| {
                (status == StatusCode::NOT_MODIFIED)
                    .then(|| cursor.as_ref().and_then(|current| current.etag.clone()))
                    .flatten()
            }),
            last_modified: response_last_modified.clone().or_else(|| {
                (status == StatusCode::NOT_MODIFIED)
                    .then(|| {
                        cursor
                            .as_ref()
                            .and_then(|current| current.last_modified.clone())
                    })
                    .flatten()
            }),
        });

        if status == StatusCode::NOT_MODIFIED {
            return Ok(PullResult {
                entries: vec![],
                next_cursor,
                has_more: false,
                not_modified: true,
                skipped_entries: 0,
            });
        }

        if !status.is_success() {
            return Err(DomainError::from_provider_http_response_status(
                status,
                response.headers(),
            ));
        }

        let response_url = response.url().to_string();
        let (bytes, _) = Self::response_bytes_with_limit(response).await?;
        Self::reject_xml_doctype_declaration(&bytes)?;
        let entries = normalizer::normalize_feed(&bytes, response_url.as_str())?;

        Ok(PullResult {
            entries,
            next_cursor,
            has_more: false,
            not_modified: false,
            skipped_entries: 0,
        })
    }

    async fn pull_state(&self) -> DomainResult<RemoteState> {
        Ok(RemoteState::default())
    }

    async fn push_mutations(&self, _: &[Mutation]) -> DomainResult<()> {
        Ok(())
    }

    async fn create_subscription(
        &self,
        url: &str,
        _folder: Option<&str>,
    ) -> DomainResult<RemoteSubscription> {
        // For local feeds, just validate the URL by fetching and parsing
        let (url, resolved_addrs) = self.validate_feed_url(url)?;
        let _permit = self.acquire_discovery_request_permit().await?;
        let client = self.feed_http_client(&url, &resolved_addrs)?;
        let response = client
            .get(url.clone())
            .send()
            .await
            .map_err(http::map_local_provider_request_error)?;
        if !response.status().is_success() {
            return Err(DomainError::from_provider_http_response_status(
                response.status(),
                response.headers(),
            ));
        }
        let (bytes, _) = Self::response_bytes_with_limit(response).await?;
        Self::reject_xml_doctype_declaration(&bytes)?;
        let feed =
            feed_rs::parser::parse(&bytes[..]).map_err(|e| DomainError::Parse(e.to_string()))?;

        let site_url = metadata::select_raw_feed_site_url(&bytes, url.as_str())
            .unwrap_or_else(|| metadata::select_feed_site_url(&feed, url.as_str()));

        Ok(RemoteSubscription {
            remote_id: url.to_string(),
            title: feed
                .title
                .as_ref()
                .map(|t| t.content.clone())
                .unwrap_or_else(|| url.to_string()),
            url: url.to_string(),
            site_url,
            folder_remote_id: None,
            icon_url: feed
                .icon
                .and_then(|icon| normalizer::normalize_provider_metadata_url(&icon.uri)),
        })
    }

    async fn delete_subscription(&self, _: &FeedIdentifier) -> DomainResult<()> {
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

#[cfg(test)]
mod tests;
