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
    let mut pushed_read_remote_ids: Vec<String> = Vec::new();
    let mut pushed_starred_remote_ids: Vec<String> = Vec::new();
    if caps.supports_remote_state {
        let pending = pending_mutation_repo.find_by_account(account_id)?;
        for pending_mutation in pending {
            let Some(pending_mutation_id) = pending_mutation.id else {
                continue;
            };

            let mutation = pending_to_provider_mutation(&pending_mutation);
            provider
                .push_mutations(std::slice::from_ref(&mutation))
                .await?;
            match pending_mutation.mutation_type.axis() {
                PendingMutationAxis::ReadState => {
                    pushed_read_remote_ids.push(pending_mutation.remote_entry_id.clone());
                }
                PendingMutationAxis::StarState => {
                    pushed_starred_remote_ids.push(pending_mutation.remote_entry_id.clone());
                }
            }
            pending_mutation_repo.delete(&[pending_mutation_id])?;
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
            let existing_feed = match feed_repo.find_by_remote_id(account_id, &rs.remote_id)? {
                Some(feed) => Some(feed),
                None => match feed_repo.find_by_url(account_id, &rs.url)? {
                    Some(feed) if feed.remote_id.is_none() => Some(feed),
                    Some(_) => continue,
                    None => None,
                },
            };
            let folder_id = match rs.folder_remote_id.as_deref() {
                Some(rid) => folder_repo
                    .find_by_remote_id(account_id, rid)?
                    .map(|f| f.id)
                    .or_else(|| {
                        existing_feed
                            .as_ref()
                            .and_then(|feed| feed.folder_id.clone())
                    }),
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
                icon_url: rs.icon_url.or_else(|| {
                    existing_feed
                        .as_ref()
                        .and_then(|feed| feed.icon_url.clone())
                }),
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
                    summary: entry.summary.as_deref().map(sanitizer::sanitize_html),
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
        let mut pending_read_ids: Vec<String> = pending
            .iter()
            .filter(|p| p.mutation_type.axis() == PendingMutationAxis::ReadState)
            .map(|p| p.remote_entry_id.clone())
            .collect();
        pending_read_ids.extend(pushed_read_remote_ids);
        pending_read_ids.sort();
        pending_read_ids.dedup();
        let mut pending_starred_ids: Vec<String> = pending
            .iter()
            .filter(|p| p.mutation_type.axis() == PendingMutationAxis::StarState)
            .map(|p| p.remote_entry_id.clone())
            .collect();
        pending_starred_ids.extend(pushed_starred_remote_ids);
        pending_starred_ids.sort();
        pending_starred_ids.dedup();
        article_repo.apply_remote_state(
            account_id,
            &state.read_ids,
            &state.starred_ids,
            &pending_read_ids,
            &pending_starred_ids,
        )?;
    }

    // Step 6: Recalculate unread counts
    let feed_ids: Vec<FeedId> = feeds.iter().map(|feed| feed.id.clone()).collect();
    feed_repo.recalculate_unread_counts(&feed_ids)?;

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
mod tests;
