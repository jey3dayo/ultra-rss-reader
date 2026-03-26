use async_trait::async_trait;

use crate::domain::error::DomainResult;
use crate::domain::provider::*;

/// Credentials for authentication
pub struct Credentials {
    pub password: Option<String>,
    pub token: Option<String>,
}

#[async_trait]
pub trait FeedProvider: Send + Sync {
    fn kind(&self) -> ProviderKind;
    fn capabilities(&self) -> ProviderCapabilities;
    async fn authenticate(&mut self, credentials: &Credentials) -> DomainResult<()>;
    async fn get_subscriptions(&self) -> DomainResult<Vec<RemoteSubscription>>;
    async fn get_folders(&self) -> DomainResult<Vec<RemoteFolder>>;
    async fn pull_entries(
        &self,
        scope: PullScope,
        cursor: Option<SyncCursor>,
    ) -> DomainResult<PullResult>;
    async fn pull_state(&self) -> DomainResult<RemoteState>;
    async fn push_mutations(&self, mutations: &[Mutation]) -> DomainResult<()>;
    async fn create_subscription(
        &self,
        url: &str,
        folder: Option<&str>,
    ) -> DomainResult<RemoteSubscription>;
    async fn delete_subscription(&self, id: &FeedIdentifier) -> DomainResult<()>;
}
