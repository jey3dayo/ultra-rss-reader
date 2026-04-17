use crate::domain::article::{generate_entry_id, Article};
use crate::domain::error::{DomainError, DomainResult};
use crate::domain::provider::*;
use crate::domain::types::{AccountId, FeedId};
use crate::infra::provider::traits::FeedProvider;
use crate::infra::sanitizer;
use crate::repository::article::ArticleRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::folder::FolderRepository;
use crate::repository::pending_mutation::PendingMutationRepository;
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

    // Step 1: Push pending mutations (remote providers only)
    if caps.supports_remote_state {
        let pending = pending_mutation_repo.find_by_account(account_id)?;
        if !pending.is_empty() {
            let mutations: Vec<Mutation> = pending
                .iter()
                .map(|p| match p.mutation_type.as_str() {
                    "mark_read" => Mutation::MarkRead {
                        remote_entry_id: p.remote_entry_id.clone(),
                    },
                    "mark_unread" => Mutation::MarkUnread {
                        remote_entry_id: p.remote_entry_id.clone(),
                    },
                    "set_starred" => Mutation::SetStarred {
                        remote_entry_id: p.remote_entry_id.clone(),
                        starred: true,
                    },
                    "unset_starred" => Mutation::SetStarred {
                        remote_entry_id: p.remote_entry_id.clone(),
                        starred: false,
                    },
                    _ => Mutation::MarkRead {
                        remote_entry_id: p.remote_entry_id.clone(),
                    },
                })
                .collect();
            provider.push_mutations(&mutations).await?;
            let ids: Vec<i64> = pending.iter().filter_map(|p| p.id).collect();
            pending_mutation_repo.delete(&ids)?;
        }
    }

    // Step 2: Sync folders (remote providers only)
    if caps.supports_folders {
        let remote_folders = provider.get_folders().await?;
        for rf in remote_folders {
            let folder = crate::domain::folder::Folder {
                id: crate::domain::types::FolderId::new(),
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
            let folder_id = match rs.folder_remote_id.as_deref() {
                Some(rid) => folder_repo
                    .find_by_remote_id(account_id, rid)?
                    .map(|f| f.id),
                None => None,
            };
            let feed = crate::domain::feed::Feed {
                id: FeedId::new(),
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
        let pending_ids: Vec<String> = pending.iter().map(|p| p.remote_entry_id.clone()).collect();
        article_repo.apply_remote_state(
            account_id,
            &state.read_ids,
            &state.starred_ids,
            &pending_ids,
        )?;
    }

    // Step 6: Recalculate unread counts
    for feed in &feeds {
        feed_repo.recalculate_unread_count(&feed.id)?;
    }

    Ok(updated_feeds)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infra::db::connection::DbManager;
    use crate::infra::db::sqlite_article::SqliteArticleRepository;
    use crate::infra::db::sqlite_feed::SqliteFeedRepository;
    use crate::infra::db::sqlite_folder::SqliteFolderRepository;
    use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
    use crate::infra::provider::greader::GReaderProvider;

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
}
