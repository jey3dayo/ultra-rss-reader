use async_trait::async_trait;

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::*;

use super::normalizer;
use super::traits::{Credentials, FeedProvider};

pub struct LocalProvider {
    http_client: reqwest::Client,
}

impl Default for LocalProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl LocalProvider {
    pub fn new() -> Self {
        Self {
            http_client: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl FeedProvider for LocalProvider {
    fn kind(&self) -> ProviderKind {
        ProviderKind::Local
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            supports_folders: false,
            supports_starring: false,
            supports_search: false,
            supports_delta_sync: false,
            supports_remote_state: false,
        }
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
        _cursor: Option<SyncCursor>,
    ) -> DomainResult<PullResult> {
        let feed_url = match &scope {
            PullScope::Feed(FeedIdentifier::Local { feed_url }) => feed_url.clone(),
            _ => {
                return Err(DomainError::Validation(
                    "LocalProvider only supports PullScope::Feed(Local)".into(),
                ))
            }
        };

        let response = self.http_client.get(&feed_url).send().await?;
        let bytes = response.bytes().await?;
        let entries = normalizer::normalize_feed(&bytes, &feed_url)?;

        Ok(PullResult {
            entries,
            next_cursor: None,
            has_more: false,
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
        let response = self.http_client.get(url).send().await?;
        let bytes = response.bytes().await?;
        let feed =
            feed_rs::parser::parse(&bytes[..]).map_err(|e| DomainError::Parse(e.to_string()))?;

        Ok(RemoteSubscription {
            remote_id: url.to_string(),
            title: feed
                .title
                .map(|t| t.content)
                .unwrap_or_else(|| url.to_string()),
            url: url.to_string(),
            site_url: feed
                .links
                .first()
                .map(|l| l.href.clone())
                .unwrap_or_default(),
            folder_remote_id: None,
            icon_url: feed.icon.map(|i| i.uri),
        })
    }

    async fn delete_subscription(&self, _: &FeedIdentifier) -> DomainResult<()> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE_RSS: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
    <channel>
        <title>Mock Feed</title>
        <item>
            <title>Article 1</title>
            <link>https://example.com/1</link>
            <guid>guid-1</guid>
        </item>
    </channel>
    </rss>"#;

    #[tokio::test]
    async fn pull_entries_fetches_and_parses() {
        let mut server = mockito::Server::new_async().await;
        let mock = server
            .mock("GET", "/feed.xml")
            .with_body(SAMPLE_RSS)
            .with_header("content-type", "application/rss+xml")
            .create_async()
            .await;

        let provider = LocalProvider::new();
        let scope = PullScope::Feed(FeedIdentifier::Local {
            feed_url: format!("{}/feed.xml", server.url()),
        });

        let result = provider.pull_entries(scope, None).await.unwrap();
        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].title, "Article 1");
        assert!(!result.has_more);
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn pull_entries_rejects_non_local_scope() {
        let provider = LocalProvider::new();
        let scope = PullScope::All;
        let result = provider.pull_entries(scope, None).await;
        assert!(result.is_err());
    }
}
