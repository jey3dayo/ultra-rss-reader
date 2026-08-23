use super::super::http_defaults;
use super::super::normalizer::normalize_provider_metadata_url;
use super::stream_types::{
    normalize_label_remote_id, quickadd_fallback_subscription, quickadd_match_keys,
    subscription_matches_quickadd_keys, SubscriptionListResponse, TagListResponse,
};
use super::{urlencoded, GReaderProvider, LABEL_PREFIX};
use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::{RemoteFolder, RemoteSubscription};

impl GReaderProvider {
    pub(super) async fn get_subscriptions_impl(&self) -> DomainResult<Vec<RemoteSubscription>> {
        let url = self.api_url("/reader/api/0/subscription/list?output=json");
        let resp = self
            .http_client()?
            .get(&url)
            .header("Authorization", self.auth_header()?)
            .send()
            .await
            .map_err(http_defaults::map_provider_request_error)
            .and_then(Self::ensure_success_response)?;
        let resp: SubscriptionListResponse = Self::read_json_response(resp).await?;

        let subscriptions = resp
            .subscriptions
            .into_iter()
            .map(|s| {
                let folder_remote_id = s.categories.iter().find_map(|category| {
                    normalize_label_remote_id(&category.id, category.label.as_deref())
                        .map(|(remote_id, _)| remote_id)
                });
                RemoteSubscription {
                    remote_id: s.id,
                    title: s.title,
                    url: s.url,
                    site_url: normalize_provider_metadata_url(&s.html_url).unwrap_or_default(),
                    folder_remote_id,
                    icon_url: s
                        .icon_url
                        .and_then(|icon_url| normalize_provider_metadata_url(&icon_url)),
                }
            })
            .collect();

        Ok(subscriptions)
    }

    pub(super) async fn get_folders_impl(&self) -> DomainResult<Vec<RemoteFolder>> {
        let url = self.api_url("/reader/api/0/tag/list?output=json");
        let resp = self
            .http_client()?
            .get(&url)
            .header("Authorization", self.auth_header()?)
            .send()
            .await
            .map_err(http_defaults::map_provider_request_error)
            .and_then(Self::ensure_success_response)?;
        let resp: TagListResponse = Self::read_json_response(resp).await?;

        let mut folders = Vec::with_capacity(resp.tags.len());
        for tag in resp.tags {
            if !tag.id.starts_with(LABEL_PREFIX) {
                continue;
            }
            let (remote_id, name) = normalize_label_remote_id(&tag.id, tag.label.as_deref())
                .ok_or_else(|| {
                    DomainError::Parse(
                        "FreshRSS folder snapshot contained an invalid label".to_string(),
                    )
                })?;
            folders.push(RemoteFolder {
                remote_id,
                name,
                sort_order: None,
            });
        }

        Ok(folders)
    }

    pub(super) async fn create_subscription_impl(
        &self,
        url: &str,
        folder: Option<&str>,
    ) -> DomainResult<RemoteSubscription> {
        let api_url = self.api_url("/reader/api/0/subscription/quickadd");
        let auth = self.auth_header()?;

        let mut body = format!("quickadd={}", urlencoded(url));
        if let Some(folder_name) = folder {
            body.push_str(&format!(
                "&a={}{}",
                urlencoded(LABEL_PREFIX),
                urlencoded(folder_name)
            ));
        }

        let resp = self
            .http_client()?
            .post(&api_url)
            .header("Authorization", auth)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body)
            .send()
            .await
            .map_err(http_defaults::map_provider_request_error)
            .and_then(Self::ensure_success_response)?;

        let response_body = resp.text().await?;

        // After quickadd, fetch subscriptions to find the new one. If the
        // verification fetch fails after the remote mutation succeeded, keep a
        // minimal local subscription when the quickadd response gives us a stream id.
        let subs = match self.get_subscriptions_impl().await {
            Ok(subs) => subs,
            Err(error) => {
                if let Some(subscription) = quickadd_fallback_subscription(url, &response_body) {
                    tracing::warn!(
                        "GReader quickadd succeeded but subscription verification failed: {error}"
                    );
                    return Ok(subscription);
                }
                return Err(error);
            }
        };
        let quickadd_keys = quickadd_match_keys(url, &response_body);
        let mut matches = subs
            .into_iter()
            .filter(|subscription| subscription_matches_quickadd_keys(subscription, &quickadd_keys))
            .collect::<Vec<_>>();

        match matches.len() {
            1 => Ok(matches.remove(0)),
            0 => Err(DomainError::Validation(format!(
                "Subscription was created but could not be found by feed URL: {url}"
            ))),
            _ => Err(DomainError::Validation(format!(
                "Subscription was created but feed URL match is ambiguous: {url}"
            ))),
        }
    }
}
