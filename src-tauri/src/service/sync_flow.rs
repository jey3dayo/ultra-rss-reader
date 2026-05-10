use crate::domain::article::{generate_entry_id, Article};
use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::*;
use crate::domain::types::{AccountId, FeedId};
use crate::infra::provider::traits::FeedProvider;
use crate::infra::sanitizer;
use crate::repository::article::ArticleRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::folder::FolderRepository;
use crate::repository::pending_mutation::{
    PendingMutationAxis, PendingMutationRepository, PendingMutationType,
};
use chrono::Utc;

/// Generic repository-driven sync flow used by non-delta providers and lower-level tests.
///
/// GReader providers require per-feed cursor persistence and multi-page delta sync,
/// so their authoritative sync path lives in `commands::sync_providers`.
pub async fn sync_account(
    account_id: &AccountId,
    provider: &dyn FeedProvider,
    article_repo: &dyn ArticleRepository,
    feed_repo: &dyn FeedRepository,
    folder_repo: &dyn FolderRepository,
    pending_mutation_repo: &dyn PendingMutationRepository,
) -> DomainResult<Vec<FeedId>> {
    let caps = provider.capabilities();
    if caps.supports_delta_sync {
        return Err(DomainError::Validation(
            "Delta-sync providers must use commands::sync_providers".into(),
        ));
    }
    let mut updated_feeds = Vec::new();
    repair_outdated_sanitized_articles(article_repo)?;

    // Step 1: Push pending mutations (remote providers only)
    if caps.supports_remote_state {
        let pending = pending_mutation_repo.find_by_account(account_id)?;
        for pending_mutation in pending {
            let mutation = pending_to_provider_mutation(&pending_mutation);
            provider
                .push_mutations(std::slice::from_ref(&mutation))
                .await?;
            pending_mutation_repo.delete_by_account_remote_entry_ids_and_axis(
                account_id,
                std::slice::from_ref(&pending_mutation.remote_entry_id),
                pending_mutation.mutation_type.axis(),
            )?;
        }
    }

    // Step 2: Sync folders (remote providers only)
    if caps.supports_folders {
        let remote_folders = provider.get_folders().await?;
        for rf in remote_folders {
            let existing_remote_id = folder_repo
                .find_by_remote_id(account_id, &rf.remote_id)?
                .map(|folder| folder.id);
            let existing_name_id = if existing_remote_id.is_none() {
                let remote_name_key = folder_name_case_key(&rf.name);
                folder_repo
                    .find_by_account(account_id)?
                    .into_iter()
                    .find(|folder| folder_name_case_key(&folder.name) == remote_name_key)
                    .map(|folder| folder.id)
            } else {
                None
            };
            let folder = crate::domain::folder::Folder {
                id: existing_remote_id
                    .or(existing_name_id)
                    .unwrap_or_else(crate::domain::types::FolderId::new),
                account_id: account_id.clone(),
                remote_id: Some(rf.remote_id),
                name: rf.name,
                sort_order: rf.sort_order.unwrap_or(0),
            };
            folder_repo.save(&folder)?;
        }
    }

    // Step 3: Sync subscriptions (remote providers only)
    if caps.supports_remote_state {
        let remote_subs = provider.get_subscriptions().await?;
        for rs in remote_subs {
            let existing_feed = feed_repo
                .find_by_remote_id(account_id, &rs.remote_id)?
                .or_else(|| feed_repo.find_by_url(account_id, &rs.url).ok().flatten());
            let folder_id = match rs.folder_remote_id.as_deref() {
                Some(rid) => folder_repo
                    .find_by_remote_id(account_id, rid)?
                    .map(|f| f.id),
                None => existing_feed
                    .as_ref()
                    .and_then(|feed| feed.folder_id.clone()),
            };
            let feed = crate::domain::feed::Feed {
                id: existing_feed
                    .as_ref()
                    .map(|feed| feed.id.clone())
                    .unwrap_or_else(FeedId::new),
                account_id: account_id.clone(),
                folder_id,
                remote_id: Some(rs.remote_id),
                title: rs.title,
                url: rs.url.clone(),
                site_url: rs.site_url,
                icon: None,
                unread_count: 0,
                reader_mode: "inherit".to_string(),
                web_preview_mode: "inherit".to_string(),
            };
            feed_repo.save(&feed)?;
        }
    }

    // Step 4: Pull entries
    let feeds = feed_repo.find_by_account(account_id)?;
    for feed in &feeds {
        let scope = if let Some(ref remote_id) = feed.remote_id {
            PullScope::Feed(FeedIdentifier::Remote {
                remote_id: remote_id.clone(),
            })
        } else {
            PullScope::Feed(FeedIdentifier::Local {
                feed_url: feed.url.clone(),
            })
        };

        let result = provider.pull_entries(scope, None).await?;

        let articles: Vec<Article> = result
            .entries
            .iter()
            .map(|entry| {
                let id = generate_entry_id(
                    account_id.as_ref(),
                    entry.id.as_deref(),
                    &feed.url,
                    entry.url.as_deref(),
                    Some(&entry.title),
                );
                Article {
                    id,
                    feed_id: feed.id.clone(),
                    remote_id: entry.id.clone(),
                    title: entry.title.clone(),
                    content_raw: entry.content.clone(),
                    content_sanitized: sanitizer::sanitize_html(&entry.content),
                    sanitizer_version: sanitizer::SANITIZER_VERSION,
                    summary: entry.summary.clone(),
                    url: entry.url.clone(),
                    author: entry.author.clone(),
                    published_at: entry.published_at.unwrap_or_else(Utc::now),
                    thumbnail: entry.thumbnail.clone(),
                    is_read: entry.is_read.unwrap_or(false),
                    is_starred: entry.is_starred.unwrap_or(false),
                    fetched_at: Utc::now(),
                }
            })
            .collect();

        if !articles.is_empty() {
            article_repo.upsert(&articles)?;
            let candidate_ids = articles
                .iter()
                .map(|article| article.id.clone())
                .collect::<Vec<_>>();
            article_repo.mark_muted_unread_as_read(account_id, Some(&candidate_ids))?;
            updated_feeds.push(feed.id.clone());
        }
    }

    // Step 5: Pull state (remote providers only)
    if caps.supports_remote_state {
        let state = provider.pull_state().await?;
        let pending = pending_mutation_repo.find_by_account(account_id)?;
        let pending_read_ids: Vec<String> = pending
            .iter()
            .filter(|p| p.mutation_type.axis() == PendingMutationAxis::ReadState)
            .map(|p| p.remote_entry_id.clone())
            .collect();
        let pending_starred_ids: Vec<String> = pending
            .iter()
            .filter(|p| p.mutation_type.axis() == PendingMutationAxis::StarState)
            .map(|p| p.remote_entry_id.clone())
            .collect();
        article_repo.apply_remote_state(
            account_id,
            &state.read_ids,
            &state.starred_ids,
            &pending_read_ids,
            &pending_starred_ids,
        )?;
    }

    // Step 6: Recalculate unread counts
    for feed in &feeds {
        feed_repo.recalculate_unread_count(&feed.id)?;
    }

    Ok(updated_feeds)
}

fn folder_name_case_key(name: &str) -> String {
    name.trim().to_lowercase()
}

fn pending_to_provider_mutation(
    pending: &crate::repository::pending_mutation::PendingMutation,
) -> Mutation {
    match pending.mutation_type {
        PendingMutationType::MarkRead => Mutation::MarkRead {
            remote_entry_id: pending.remote_entry_id.clone(),
        },
        PendingMutationType::MarkUnread => Mutation::MarkUnread {
            remote_entry_id: pending.remote_entry_id.clone(),
        },
        PendingMutationType::Star => Mutation::SetStarred {
            remote_entry_id: pending.remote_entry_id.clone(),
            starred: true,
        },
        PendingMutationType::Unstar => Mutation::SetStarred {
            remote_entry_id: pending.remote_entry_id.clone(),
            starred: false,
        },
    }
}

fn repair_outdated_sanitized_articles(article_repo: &dyn ArticleRepository) -> DomainResult<()> {
    const REPAIR_BATCH_LIMIT: usize = 500;

    let articles = article_repo
        .find_by_sanitizer_version_below(sanitizer::SANITIZER_VERSION, REPAIR_BATCH_LIMIT)?;
    for article in articles {
        let sanitized = sanitizer::sanitize_html(&article.content_raw);
        article_repo.update_sanitized(&article.id, &sanitized, sanitizer::SANITIZER_VERSION)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::account::{Account, ConnectionVerificationStatus};
    use crate::domain::feed::Feed;
    use crate::domain::folder::Folder;
    use crate::domain::provider::ProviderKind;
    use crate::domain::types::FolderId;
    use crate::infra::db::connection::DbManager;
    use crate::infra::db::sqlite_account::SqliteAccountRepository;
    use crate::infra::db::sqlite_article::SqliteArticleRepository;
    use crate::infra::db::sqlite_feed::SqliteFeedRepository;
    use crate::infra::db::sqlite_folder::SqliteFolderRepository;
    use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
    use crate::infra::provider::greader::GReaderProvider;
    use crate::infra::provider::traits::Credentials;
    use crate::repository::account::AccountRepository;
    use crate::repository::pending_mutation::PendingMutation;
    use async_trait::async_trait;
    use std::sync::Mutex;

    #[derive(Clone, Copy)]
    enum ProviderFailureKind {
        Network,
        Auth,
        RateLimit,
    }

    impl ProviderFailureKind {
        fn to_error(self) -> DomainError {
            match self {
                Self::Network => DomainError::Network("network unavailable".to_string()),
                Self::Auth => DomainError::Auth("session expired".to_string()),
                Self::RateLimit => DomainError::RateLimit("retry later".to_string()),
            }
        }
    }

    struct FailingPullProvider {
        failure: ProviderFailureKind,
    }

    struct FolderSyncProvider {
        folders: Vec<RemoteFolder>,
    }

    struct RemoteStateProvider {
        pushed: Mutex<Vec<Mutation>>,
    }

    struct FailingSecondPushProvider {
        pushed: Mutex<Vec<Mutation>>,
    }

    struct RemoteSubscriptionProvider {
        subscriptions: Vec<RemoteSubscription>,
    }

    struct RemoteSubscriptionEntryProvider {
        subscription: RemoteSubscription,
        entry: RemoteEntry,
    }

    struct DeltaSyncProvider;

    struct FakePendingMutationRepository {
        pending: Vec<PendingMutation>,
        deleted_ids: Mutex<Vec<Vec<i64>>>,
    }

    #[async_trait]
    impl FeedProvider for FailingPullProvider {
        fn kind(&self) -> ProviderKind {
            ProviderKind::Local
        }

        fn capabilities(&self) -> ProviderCapabilities {
            ProviderKind::Local.capabilities()
        }

        async fn authenticate(&mut self, _credentials: &Credentials) -> DomainResult<()> {
            Ok(())
        }

        async fn get_subscriptions(&self) -> DomainResult<Vec<RemoteSubscription>> {
            Ok(Vec::new())
        }

        async fn get_folders(&self) -> DomainResult<Vec<RemoteFolder>> {
            Ok(Vec::new())
        }

        async fn pull_entries(
            &self,
            _scope: PullScope,
            _cursor: Option<SyncCursor>,
        ) -> DomainResult<PullResult> {
            Err(self.failure.to_error())
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

        async fn delete_subscription(&self, _id: &FeedIdentifier) -> DomainResult<()> {
            Ok(())
        }
    }

    #[async_trait]
    impl FeedProvider for FolderSyncProvider {
        fn kind(&self) -> ProviderKind {
            ProviderKind::Local
        }

        fn capabilities(&self) -> ProviderCapabilities {
            ProviderCapabilities {
                supports_folders: true,
                supports_starring: false,
                supports_search: false,
                supports_delta_sync: false,
                supports_remote_state: false,
            }
        }

        async fn authenticate(&mut self, _credentials: &Credentials) -> DomainResult<()> {
            Ok(())
        }

        async fn get_subscriptions(&self) -> DomainResult<Vec<RemoteSubscription>> {
            Ok(Vec::new())
        }

        async fn get_folders(&self) -> DomainResult<Vec<RemoteFolder>> {
            Ok(self.folders.clone())
        }

        async fn pull_entries(
            &self,
            _scope: PullScope,
            _cursor: Option<SyncCursor>,
        ) -> DomainResult<PullResult> {
            Ok(PullResult {
                entries: Vec::new(),
                next_cursor: None,
                has_more: false,
                not_modified: false,
                skipped_entries: 0,
            })
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

        async fn delete_subscription(&self, _id: &FeedIdentifier) -> DomainResult<()> {
            Ok(())
        }
    }

    #[async_trait]
    impl FeedProvider for RemoteStateProvider {
        fn kind(&self) -> ProviderKind {
            ProviderKind::Local
        }

        fn capabilities(&self) -> ProviderCapabilities {
            ProviderCapabilities {
                supports_folders: false,
                supports_starring: true,
                supports_search: false,
                supports_delta_sync: false,
                supports_remote_state: true,
            }
        }

        async fn authenticate(&mut self, _credentials: &Credentials) -> DomainResult<()> {
            Ok(())
        }

        async fn get_subscriptions(&self) -> DomainResult<Vec<RemoteSubscription>> {
            Ok(Vec::new())
        }

        async fn get_folders(&self) -> DomainResult<Vec<RemoteFolder>> {
            Ok(Vec::new())
        }

        async fn pull_entries(
            &self,
            _scope: PullScope,
            _cursor: Option<SyncCursor>,
        ) -> DomainResult<PullResult> {
            Ok(PullResult {
                entries: Vec::new(),
                next_cursor: None,
                has_more: false,
                not_modified: false,
                skipped_entries: 0,
            })
        }

        async fn pull_state(&self) -> DomainResult<RemoteState> {
            Ok(RemoteState::default())
        }

        async fn push_mutations(&self, mutations: &[Mutation]) -> DomainResult<()> {
            self.pushed.lock().unwrap().extend_from_slice(mutations);
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

        async fn delete_subscription(&self, _id: &FeedIdentifier) -> DomainResult<()> {
            Ok(())
        }
    }

    #[async_trait]
    impl FeedProvider for FailingSecondPushProvider {
        fn kind(&self) -> ProviderKind {
            ProviderKind::Local
        }

        fn capabilities(&self) -> ProviderCapabilities {
            ProviderCapabilities {
                supports_folders: false,
                supports_starring: true,
                supports_search: false,
                supports_delta_sync: false,
                supports_remote_state: true,
            }
        }

        async fn authenticate(&mut self, _credentials: &Credentials) -> DomainResult<()> {
            Ok(())
        }

        async fn get_subscriptions(&self) -> DomainResult<Vec<RemoteSubscription>> {
            Ok(Vec::new())
        }

        async fn get_folders(&self) -> DomainResult<Vec<RemoteFolder>> {
            Ok(Vec::new())
        }

        async fn pull_entries(
            &self,
            _scope: PullScope,
            _cursor: Option<SyncCursor>,
        ) -> DomainResult<PullResult> {
            Ok(PullResult {
                entries: Vec::new(),
                next_cursor: None,
                has_more: false,
                not_modified: false,
                skipped_entries: 0,
            })
        }

        async fn pull_state(&self) -> DomainResult<RemoteState> {
            Ok(RemoteState::default())
        }

        async fn push_mutations(&self, mutations: &[Mutation]) -> DomainResult<()> {
            let mut pushed = self.pushed.lock().unwrap();
            if !pushed.is_empty() {
                return Err(DomainError::Network("second push failed".to_string()));
            }
            pushed.extend_from_slice(mutations);
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

        async fn delete_subscription(&self, _id: &FeedIdentifier) -> DomainResult<()> {
            Ok(())
        }
    }

    #[async_trait]
    impl FeedProvider for RemoteSubscriptionProvider {
        fn kind(&self) -> ProviderKind {
            ProviderKind::Local
        }

        fn capabilities(&self) -> ProviderCapabilities {
            ProviderCapabilities {
                supports_folders: false,
                supports_starring: false,
                supports_search: false,
                supports_delta_sync: false,
                supports_remote_state: true,
            }
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
            Ok(PullResult {
                entries: Vec::new(),
                next_cursor: None,
                has_more: false,
                not_modified: false,
                skipped_entries: 0,
            })
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

        async fn delete_subscription(&self, _id: &FeedIdentifier) -> DomainResult<()> {
            Ok(())
        }
    }

    #[async_trait]
    impl FeedProvider for RemoteSubscriptionEntryProvider {
        fn kind(&self) -> ProviderKind {
            ProviderKind::Local
        }

        fn capabilities(&self) -> ProviderCapabilities {
            ProviderCapabilities {
                supports_folders: false,
                supports_starring: false,
                supports_search: false,
                supports_delta_sync: false,
                supports_remote_state: true,
            }
        }

        async fn authenticate(&mut self, _credentials: &Credentials) -> DomainResult<()> {
            Ok(())
        }

        async fn get_subscriptions(&self) -> DomainResult<Vec<RemoteSubscription>> {
            Ok(vec![self.subscription.clone()])
        }

        async fn get_folders(&self) -> DomainResult<Vec<RemoteFolder>> {
            Ok(Vec::new())
        }

        async fn pull_entries(
            &self,
            scope: PullScope,
            _cursor: Option<SyncCursor>,
        ) -> DomainResult<PullResult> {
            let entries = match scope {
                PullScope::Feed(FeedIdentifier::Remote { remote_id })
                    if remote_id == self.subscription.remote_id =>
                {
                    vec![self.entry.clone()]
                }
                _ => Vec::new(),
            };

            Ok(PullResult {
                entries,
                next_cursor: None,
                has_more: false,
                not_modified: false,
                skipped_entries: 0,
            })
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

        async fn delete_subscription(&self, _id: &FeedIdentifier) -> DomainResult<()> {
            Ok(())
        }
    }

    #[async_trait]
    impl FeedProvider for DeltaSyncProvider {
        fn kind(&self) -> ProviderKind {
            ProviderKind::FreshRss
        }

        fn capabilities(&self) -> ProviderCapabilities {
            ProviderCapabilities {
                supports_folders: true,
                supports_starring: true,
                supports_search: true,
                supports_delta_sync: true,
                supports_remote_state: true,
            }
        }

        async fn authenticate(&mut self, _credentials: &Credentials) -> DomainResult<()> {
            unreachable!("sync_account must reject delta-sync providers before authentication")
        }

        async fn get_subscriptions(&self) -> DomainResult<Vec<RemoteSubscription>> {
            unreachable!("sync_account must reject delta-sync providers before subscriptions sync")
        }

        async fn get_folders(&self) -> DomainResult<Vec<RemoteFolder>> {
            unreachable!("sync_account must reject delta-sync providers before folders sync")
        }

        async fn pull_entries(
            &self,
            _scope: PullScope,
            _cursor: Option<SyncCursor>,
        ) -> DomainResult<PullResult> {
            unreachable!("sync_account must reject delta-sync providers before entry sync")
        }

        async fn pull_state(&self) -> DomainResult<RemoteState> {
            unreachable!("sync_account must reject delta-sync providers before state sync")
        }

        async fn push_mutations(&self, _mutations: &[Mutation]) -> DomainResult<()> {
            unreachable!("sync_account must reject delta-sync providers before mutation push")
        }

        async fn create_subscription(
            &self,
            _url: &str,
            _folder: Option<&str>,
        ) -> DomainResult<RemoteSubscription> {
            unreachable!("sync_account must not manage provider subscriptions")
        }

        async fn delete_subscription(&self, _id: &FeedIdentifier) -> DomainResult<()> {
            unreachable!("sync_account must not manage provider subscriptions")
        }
    }

    impl PendingMutationRepository for FakePendingMutationRepository {
        fn find_by_account(&self, _account_id: &AccountId) -> DomainResult<Vec<PendingMutation>> {
            Ok(self.pending.clone())
        }

        fn save(&self, _mutation: &PendingMutation) -> DomainResult<()> {
            Ok(())
        }

        fn delete(&self, ids: &[i64]) -> DomainResult<()> {
            self.deleted_ids.lock().unwrap().push(ids.to_vec());
            Ok(())
        }

        fn delete_by_account_remote_entry_ids_and_axis(
            &self,
            _account_id: &AccountId,
            remote_entry_ids: &[String],
            axis: PendingMutationAxis,
        ) -> DomainResult<()> {
            let ids = self
                .pending
                .iter()
                .filter(|pending| {
                    remote_entry_ids.contains(&pending.remote_entry_id)
                        && pending.mutation_type.axis() == axis
                })
                .filter_map(|pending| pending.id)
                .collect::<Vec<_>>();
            self.deleted_ids.lock().unwrap().push(ids);
            Ok(())
        }
    }

    fn test_account() -> Account {
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

    fn test_feed(account_id: &AccountId) -> Feed {
        Feed {
            id: FeedId::new(),
            account_id: account_id.clone(),
            folder_id: None,
            remote_id: None,
            title: "Local Feed".to_string(),
            url: "https://example.com/rss".to_string(),
            site_url: "https://example.com".to_string(),
            icon: None,
            unread_count: 0,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        }
    }

    fn stale_saved_article(feed: &Feed, index: usize) -> Article {
        let timestamp = Utc::now() + chrono::Duration::seconds(index as i64);
        Article {
            id: crate::domain::types::ArticleId(format!("saved-old-policy-{index:03}")),
            feed_id: feed.id.clone(),
            remote_id: Some(format!("remote-saved-old-policy-{index:03}")),
            title: format!("Saved article {index}"),
            content_raw: format!(
                r#"<article><p onclick="evil()">Lead {index}</p><img src="https://cdn.example.com/body-{index}.jpg" onerror="evil()" alt="Body"><script>alert(1)</script></article>"#
            ),
            content_sanitized: "<script>stale saved html</script>".to_string(),
            sanitizer_version: sanitizer::SANITIZER_VERSION - 1,
            summary: None,
            url: Some(format!("https://publisher.example.com/read/{index}")),
            author: None,
            published_at: timestamp,
            thumbnail: None,
            is_read: false,
            is_starred: false,
            fetched_at: timestamp,
        }
    }

    #[tokio::test]
    async fn sync_account_rejects_delta_sync_providers() {
        let db = DbManager::new_in_memory().unwrap();
        let account_id = AccountId::new();
        let provider = GReaderProvider::for_freshrss("https://example.com");
        let article_repo = SqliteArticleRepository::new(db.writer());
        let feed_repo = SqliteFeedRepository::new(db.writer());
        let folder_repo = SqliteFolderRepository::new(db.writer());
        let pending_repo = SqlitePendingMutationRepository::new(db.writer());

        let error = sync_account(
            &account_id,
            &provider,
            &article_repo,
            &feed_repo,
            &folder_repo,
            &pending_repo,
        )
        .await
        .unwrap_err();

        assert!(matches!(
            error,
            DomainError::Validation(message)
                if message.contains("commands::sync_providers")
        ));
    }

    #[tokio::test]
    async fn sync_account_rejects_delta_sync_providers_before_orchestration_side_effects() {
        let db = DbManager::new_in_memory().unwrap();
        let account_id = AccountId::new();
        let provider = DeltaSyncProvider;
        let article_repo = SqliteArticleRepository::new(db.writer());
        let feed_repo = SqliteFeedRepository::new(db.writer());
        let folder_repo = SqliteFolderRepository::new(db.writer());
        let pending_repo = FakePendingMutationRepository {
            pending: vec![PendingMutation {
                id: Some(1),
                account_id: account_id.clone(),
                mutation_type: PendingMutationType::MarkRead,
                remote_entry_id: "remote-entry-1".to_string(),
                created_at: "2024-01-01T00:00:00Z".to_string(),
            }],
            deleted_ids: Mutex::new(Vec::new()),
        };

        let error = sync_account(
            &account_id,
            &provider,
            &article_repo,
            &feed_repo,
            &folder_repo,
            &pending_repo,
        )
        .await
        .unwrap_err();

        assert!(matches!(
            error,
            DomainError::Validation(message)
                if message.contains("commands::sync_providers")
        ));
        assert!(pending_repo.deleted_ids.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn sync_account_preserves_provider_failure_categories() {
        let cases = [
            (
                ProviderFailureKind::Network,
                "Network error: network unavailable",
            ),
            (ProviderFailureKind::Auth, "Auth error: session expired"),
            (
                ProviderFailureKind::RateLimit,
                "Rate limit error: retry later",
            ),
        ];

        for (failure, expected_message) in cases {
            let db = DbManager::new_in_memory().unwrap();
            let account = test_account();
            let feed = test_feed(&account.id);
            let account_repo = SqliteAccountRepository::new(db.writer());
            let feed_repo = SqliteFeedRepository::new(db.writer());
            account_repo.save(&account).unwrap();
            feed_repo.save(&feed).unwrap();

            let provider = FailingPullProvider { failure };
            let article_repo = SqliteArticleRepository::new(db.writer());
            let folder_repo = SqliteFolderRepository::new(db.writer());
            let pending_repo = SqlitePendingMutationRepository::new(db.writer());

            let error = sync_account(
                &account.id,
                &provider,
                &article_repo,
                &feed_repo,
                &folder_repo,
                &pending_repo,
            )
            .await
            .unwrap_err();

            assert_eq!(error.to_string(), expected_message);
        }
    }

    #[tokio::test]
    async fn sync_account_repairs_outdated_saved_articles_before_provider_pull() {
        let db = DbManager::new_in_memory().unwrap();
        let account = test_account();
        let feed = test_feed(&account.id);
        let account_repo = SqliteAccountRepository::new(db.writer());
        let feed_repo = SqliteFeedRepository::new(db.writer());
        let article_repo = SqliteArticleRepository::new(db.writer());
        let folder_repo = SqliteFolderRepository::new(db.writer());
        let pending_repo = SqlitePendingMutationRepository::new(db.writer());
        account_repo.save(&account).unwrap();
        feed_repo.save(&feed).unwrap();

        let article = Article {
            id: crate::domain::types::ArticleId("saved-old-policy".to_string()),
            feed_id: feed.id.clone(),
            remote_id: Some("remote-saved-old-policy".to_string()),
            title: "Saved article".to_string(),
            content_raw: r#"
                <article>
                  <p onclick="evil()">Lead <strong>body</strong></p>
                  <a href="https://publisher.example.com/read" ping="https://tracker.example.com">Read</a>
                  <img src="https://cdn.example.com/body.jpg" onerror="evil()" alt="Body">
                  <script>alert(1)</script>
                </article>
            "#
            .to_string(),
            content_sanitized: "<script>stale saved html</script>".to_string(),
            sanitizer_version: sanitizer::SANITIZER_VERSION - 1,
            summary: None,
            url: Some("https://publisher.example.com/read".to_string()),
            author: None,
            published_at: Utc::now(),
            thumbnail: None,
            is_read: false,
            is_starred: false,
            fetched_at: Utc::now(),
        };
        article_repo.upsert(&[article.clone()]).unwrap();

        let provider = FailingPullProvider {
            failure: ProviderFailureKind::Network,
        };
        let error = sync_account(
            &account.id,
            &provider,
            &article_repo,
            &feed_repo,
            &folder_repo,
            &pending_repo,
        )
        .await
        .expect_err("provider pull fails after saved article repair");

        assert_eq!(error.to_string(), "Network error: network unavailable");

        let saved = article_repo
            .find_by_feed(&feed.id, &crate::repository::article::Pagination::default())
            .unwrap()
            .into_iter()
            .find(|saved| saved.id == article.id)
            .unwrap();

        assert_eq!(saved.sanitizer_version, sanitizer::SANITIZER_VERSION);
        assert!(saved.content_sanitized.contains("Lead"));
        assert!(saved
            .content_sanitized
            .contains(r#"src="https://cdn.example.com/body.jpg""#));
        assert!(saved
            .content_sanitized
            .contains(r#"rel="noopener noreferrer""#));
        assert!(!saved.content_sanitized.contains("<script"));
        assert!(!saved.content_sanitized.contains("onclick"));
        assert!(!saved.content_sanitized.contains("onerror"));
        assert!(!saved.content_sanitized.contains("ping="));
    }

    #[tokio::test]
    async fn sync_account_repairs_saved_articles_in_bounded_batches_across_launches() {
        let db = DbManager::new_in_memory().unwrap();
        let account = test_account();
        let feed = test_feed(&account.id);
        let account_repo = SqliteAccountRepository::new(db.writer());
        let feed_repo = SqliteFeedRepository::new(db.writer());
        let article_repo = SqliteArticleRepository::new(db.writer());
        let folder_repo = SqliteFolderRepository::new(db.writer());
        let pending_repo = SqlitePendingMutationRepository::new(db.writer());
        account_repo.save(&account).unwrap();
        feed_repo.save(&feed).unwrap();

        let stale_articles = (0..501)
            .map(|index| stale_saved_article(&feed, index))
            .collect::<Vec<_>>();
        article_repo.upsert(&stale_articles).unwrap();

        let provider = FailingPullProvider {
            failure: ProviderFailureKind::Network,
        };

        let first_error = sync_account(
            &account.id,
            &provider,
            &article_repo,
            &feed_repo,
            &folder_repo,
            &pending_repo,
        )
        .await
        .expect_err("provider pull fails after first repair batch");
        assert_eq!(
            first_error.to_string(),
            "Network error: network unavailable"
        );

        let remaining_after_first_batch = article_repo
            .find_by_sanitizer_version_below(sanitizer::SANITIZER_VERSION, 1_000)
            .unwrap();
        assert_eq!(
            remaining_after_first_batch.len(),
            1,
            "repair should process at most one 500-row batch before provider work"
        );

        let second_error = sync_account(
            &account.id,
            &provider,
            &article_repo,
            &feed_repo,
            &folder_repo,
            &pending_repo,
        )
        .await
        .expect_err("provider pull fails after second repair batch");
        assert_eq!(
            second_error.to_string(),
            "Network error: network unavailable"
        );

        let remaining_after_second_batch = article_repo
            .find_by_sanitizer_version_below(sanitizer::SANITIZER_VERSION, 1_000)
            .unwrap();
        assert!(
            remaining_after_second_batch.is_empty(),
            "next launch should continue repairing saved articles left by the previous batch"
        );
    }

    #[tokio::test]
    async fn sync_account_reuses_existing_remote_folder_id() {
        let db = DbManager::new_in_memory().unwrap();
        let account = test_account();
        let account_repo = SqliteAccountRepository::new(db.writer());
        let folder_repo = SqliteFolderRepository::new(db.writer());
        account_repo.save(&account).unwrap();

        let existing_folder_id = FolderId::new();
        folder_repo
            .save(&Folder {
                id: existing_folder_id.clone(),
                account_id: account.id.clone(),
                remote_id: Some("folder/tech".to_string()),
                name: "Old Tech".to_string(),
                sort_order: 3,
            })
            .unwrap();

        let provider = FolderSyncProvider {
            folders: vec![RemoteFolder {
                remote_id: "folder/tech".to_string(),
                name: "Tech".to_string(),
                sort_order: Some(1),
            }],
        };
        let article_repo = SqliteArticleRepository::new(db.writer());
        let feed_repo = SqliteFeedRepository::new(db.writer());
        let pending_repo = SqlitePendingMutationRepository::new(db.writer());

        sync_account(
            &account.id,
            &provider,
            &article_repo,
            &feed_repo,
            &folder_repo,
            &pending_repo,
        )
        .await
        .unwrap();

        let folders = folder_repo.find_by_account(&account.id).unwrap();
        assert_eq!(folders.len(), 1);
        assert_eq!(folders[0].id, existing_folder_id);
        assert_eq!(folders[0].name, "Tech");
        assert_eq!(folders[0].sort_order, 1);
    }

    #[tokio::test]
    async fn sync_account_reuses_existing_local_folder_on_name_collision() {
        let db = DbManager::new_in_memory().unwrap();
        let account = test_account();
        let account_repo = SqliteAccountRepository::new(db.writer());
        let folder_repo = SqliteFolderRepository::new(db.writer());
        account_repo.save(&account).unwrap();

        let existing_folder_id = FolderId::new();
        folder_repo
            .save(&Folder {
                id: existing_folder_id.clone(),
                account_id: account.id.clone(),
                remote_id: None,
                name: "Tech".to_string(),
                sort_order: 3,
            })
            .unwrap();

        let provider = FolderSyncProvider {
            folders: vec![RemoteFolder {
                remote_id: "user/-/label/Tech".to_string(),
                name: " tech ".to_string(),
                sort_order: Some(1),
            }],
        };
        let article_repo = SqliteArticleRepository::new(db.writer());
        let feed_repo = SqliteFeedRepository::new(db.writer());
        let pending_repo = SqlitePendingMutationRepository::new(db.writer());

        sync_account(
            &account.id,
            &provider,
            &article_repo,
            &feed_repo,
            &folder_repo,
            &pending_repo,
        )
        .await
        .unwrap();

        let folders = folder_repo.find_by_account(&account.id).unwrap();
        assert_eq!(folders.len(), 1);
        assert_eq!(folders[0].id, existing_folder_id);
        assert_eq!(folders[0].remote_id.as_deref(), Some("user/-/label/Tech"));
        assert_eq!(folders[0].name, " tech ");
        assert_eq!(folders[0].sort_order, 1);
    }

    #[tokio::test]
    async fn sync_account_deletes_pushed_pending_mutation_by_remote_id() {
        let db = DbManager::new_in_memory().unwrap();
        let account = test_account();
        let account_repo = SqliteAccountRepository::new(db.writer());
        account_repo.save(&account).unwrap();

        let provider = RemoteStateProvider {
            pushed: Mutex::new(Vec::new()),
        };
        let article_repo = SqliteArticleRepository::new(db.writer());
        let feed_repo = SqliteFeedRepository::new(db.writer());
        let folder_repo = SqliteFolderRepository::new(db.writer());
        let pending_repo = FakePendingMutationRepository {
            pending: vec![PendingMutation {
                id: None,
                account_id: account.id.clone(),
                mutation_type: PendingMutationType::MarkRead,
                remote_entry_id: "remote-entry-1".to_string(),
                created_at: "2024-01-01T00:00:00Z".to_string(),
            }],
            deleted_ids: Mutex::new(Vec::new()),
        };

        sync_account(
            &account.id,
            &provider,
            &article_repo,
            &feed_repo,
            &folder_repo,
            &pending_repo,
        )
        .await
        .unwrap();

        assert_eq!(provider.pushed.lock().unwrap().len(), 1);
        assert_eq!(
            *pending_repo.deleted_ids.lock().unwrap(),
            vec![Vec::<i64>::new()]
        );
    }

    #[tokio::test]
    async fn sync_account_deletes_each_pending_mutation_after_its_remote_push() {
        let db = DbManager::new_in_memory().unwrap();
        let account = test_account();
        let account_repo = SqliteAccountRepository::new(db.writer());
        account_repo.save(&account).unwrap();

        let provider = FailingSecondPushProvider {
            pushed: Mutex::new(Vec::new()),
        };
        let article_repo = SqliteArticleRepository::new(db.writer());
        let feed_repo = SqliteFeedRepository::new(db.writer());
        let folder_repo = SqliteFolderRepository::new(db.writer());
        let pending_repo = FakePendingMutationRepository {
            pending: vec![
                PendingMutation {
                    id: Some(10),
                    account_id: account.id.clone(),
                    mutation_type: PendingMutationType::MarkRead,
                    remote_entry_id: "remote-entry-1".to_string(),
                    created_at: "2024-01-01T00:00:00Z".to_string(),
                },
                PendingMutation {
                    id: Some(11),
                    account_id: account.id.clone(),
                    mutation_type: PendingMutationType::Star,
                    remote_entry_id: "remote-entry-2".to_string(),
                    created_at: "2024-01-01T00:00:01Z".to_string(),
                },
            ],
            deleted_ids: Mutex::new(Vec::new()),
        };

        let error = sync_account(
            &account.id,
            &provider,
            &article_repo,
            &feed_repo,
            &folder_repo,
            &pending_repo,
        )
        .await
        .expect_err("second remote push should fail");

        assert_eq!(error.to_string(), "Network error: second push failed");
        assert_eq!(provider.pushed.lock().unwrap().len(), 1);
        assert_eq!(*pending_repo.deleted_ids.lock().unwrap(), vec![vec![10]]);
    }

    #[tokio::test]
    async fn sync_account_recalculates_unread_count_for_remote_subscription_added_during_sync() {
        let db = DbManager::new_in_memory().unwrap();
        let account = test_account();
        let account_repo = SqliteAccountRepository::new(db.writer());
        account_repo.save(&account).unwrap();

        let remote_id = "feed/https://example.com/new.xml".to_string();
        let provider = RemoteSubscriptionEntryProvider {
            subscription: RemoteSubscription {
                remote_id: remote_id.clone(),
                title: "New Remote".to_string(),
                url: "https://example.com/new.xml".to_string(),
                site_url: "https://example.com".to_string(),
                folder_remote_id: None,
                icon_url: None,
            },
            entry: RemoteEntry {
                id: Some("remote-entry-new".to_string()),
                source_feed_id: FeedIdentifier::Remote {
                    remote_id: remote_id.clone(),
                },
                title: "Unread remote entry".to_string(),
                content: "<p>Unread</p>".to_string(),
                summary: None,
                url: Some("https://example.com/new-entry".to_string()),
                published_at: Some(Utc::now()),
                updated_at: None,
                thumbnail: None,
                author: None,
                is_read: Some(false),
                is_starred: Some(false),
            },
        };
        let article_repo = SqliteArticleRepository::new(db.writer());
        let feed_repo = SqliteFeedRepository::new(db.writer());
        let folder_repo = SqliteFolderRepository::new(db.writer());
        let pending_repo = SqlitePendingMutationRepository::new(db.writer());

        sync_account(
            &account.id,
            &provider,
            &article_repo,
            &feed_repo,
            &folder_repo,
            &pending_repo,
        )
        .await
        .unwrap();

        let saved_feed = feed_repo
            .find_by_remote_id(&account.id, &remote_id)
            .unwrap()
            .unwrap();
        assert_eq!(saved_feed.unread_count, 1);
    }

    #[tokio::test]
    async fn sync_account_preserves_local_folder_when_remote_subscription_has_no_folder() {
        let db = DbManager::new_in_memory().unwrap();
        let account = test_account();
        let account_repo = SqliteAccountRepository::new(db.writer());
        let feed_repo = SqliteFeedRepository::new(db.writer());
        let folder_repo = SqliteFolderRepository::new(db.writer());
        account_repo.save(&account).unwrap();

        let folder_id = FolderId::new();
        folder_repo
            .save(&Folder {
                id: folder_id.clone(),
                account_id: account.id.clone(),
                remote_id: Some("folder/tech".to_string()),
                name: "Tech".to_string(),
                sort_order: 0,
            })
            .unwrap();
        let feed = Feed {
            id: FeedId("existing-feed".to_string()),
            account_id: account.id.clone(),
            folder_id: Some(folder_id.clone()),
            remote_id: Some("feed/remote".to_string()),
            title: "Existing".to_string(),
            url: "https://example.com/rss.xml".to_string(),
            site_url: "https://example.com".to_string(),
            icon: None,
            unread_count: 0,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        };
        feed_repo.save(&feed).unwrap();

        let provider = RemoteSubscriptionProvider {
            subscriptions: vec![RemoteSubscription {
                remote_id: "feed/remote".to_string(),
                title: "Remote title".to_string(),
                url: "https://example.com/rss.xml".to_string(),
                site_url: "https://example.com".to_string(),
                folder_remote_id: None,
                icon_url: None,
            }],
        };
        let article_repo = SqliteArticleRepository::new(db.writer());
        let pending_repo = SqlitePendingMutationRepository::new(db.writer());

        sync_account(
            &account.id,
            &provider,
            &article_repo,
            &feed_repo,
            &folder_repo,
            &pending_repo,
        )
        .await
        .unwrap();

        let saved = feed_repo
            .find_by_remote_id(&account.id, "feed/remote")
            .unwrap()
            .unwrap();
        assert_eq!(saved.id.0, "existing-feed");
        assert_eq!(saved.folder_id, Some(folder_id));
        assert_eq!(feed_repo.find_by_account(&account.id).unwrap().len(), 1);
    }
}
