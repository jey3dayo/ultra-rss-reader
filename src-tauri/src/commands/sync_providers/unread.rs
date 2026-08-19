use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

use crate::commands::dto::AppError;
use crate::commands::feed_commands::lock_db;
use crate::domain::account::Account;
use crate::domain::article::Article;
use crate::domain::feed::Feed;
use crate::domain::provider::SyncCursor;
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_article::mark_muted_unread_as_read_for_feed_with_conn;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
use crate::infra::provider::greader::GReaderProvider;
use crate::repository::article::ArticleRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::pending_mutation::{PendingMutationAxis, PendingMutationRepository};

use super::build_article_from_remote_entry;
use super::subscriptions::is_provider_managed_greader_feed;

pub(super) async fn reconcile_greader_unread_counts(
    db: &Mutex<DbManager>,
    provider: &GReaderProvider,
    account: &Account,
    feeds: &[Feed],
    server_unread_counts: &HashMap<String, i32>,
) -> Result<usize, AppError> {
    let mut backfilled_feeds = 0usize;
    for feed in feeds {
        let Some(remote_id) = feed.remote_id.as_deref() else {
            continue;
        };
        if !is_provider_managed_greader_feed(Some(remote_id)) {
            continue;
        }

        let server_unread_count = server_unread_counts.get(remote_id).copied().unwrap_or(0);
        let local_unread_count = {
            let db_guard = lock_db(db)?;
            let feed_repo = SqliteFeedRepository::new(db_guard.reader());
            feed_repo
                .find_by_id(&feed.id)?
                .map(|current_feed| current_feed.unread_count)
                .unwrap_or(0)
        };

        if server_unread_count != local_unread_count {
            reconcile_greader_unread_state_for_feed(db, provider, account, feed).await?;
            if server_unread_count > local_unread_count {
                backfilled_feeds += 1;
            }
        }

        let db_guard = lock_db(db)?;
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        feed_repo.recalculate_unread_count(&feed.id)?;
    }

    Ok(backfilled_feeds)
}

async fn reconcile_greader_unread_state_for_feed(
    db: &Mutex<DbManager>,
    provider: &GReaderProvider,
    account: &Account,
    feed: &Feed,
) -> Result<(), AppError> {
    let unread_remote_ids =
        fetch_greader_unread_entries_for_feed(db, provider, account, feed).await?;
    let pending_remote_ids = {
        let db_guard = lock_db(db)?;
        let pending_repo = SqlitePendingMutationRepository::new(db_guard.reader());
        pending_repo
            .find_by_account(&account.id)?
            .into_iter()
            .filter(|mutation| mutation.mutation_type.axis() == PendingMutationAxis::ReadState)
            .map(|mutation| mutation.remote_entry_id)
            .collect::<HashSet<_>>()
    };

    let db_guard = lock_db(db)?;
    let tx = db_guard
        .writer()
        .unchecked_transaction()
        .map_err(crate::domain::error::DomainError::from)
        .map_err(AppError::from)?;
    let rows = {
        let mut stmt = tx
            .prepare(
                "SELECT id, remote_id
             FROM articles
             WHERE feed_id = ?1 AND remote_id IS NOT NULL",
            )
            .map_err(crate::domain::error::DomainError::from)
            .map_err(AppError::from)?;
        let rows = stmt
            .query_map(rusqlite::params![feed.id.as_ref()], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(crate::domain::error::DomainError::from)
            .map_err(AppError::from)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(crate::domain::error::DomainError::from)
            .map_err(AppError::from)?;
        rows
    };

    {
        let mut update_stmt = tx
            .prepare("UPDATE articles SET is_read = ?1 WHERE id = ?2")
            .map_err(crate::domain::error::DomainError::from)
            .map_err(AppError::from)?;
        for (article_id, remote_id) in rows {
            if pending_remote_ids.contains(&remote_id) {
                continue;
            }
            update_stmt
                .execute(rusqlite::params![
                    !unread_remote_ids.contains(&remote_id),
                    article_id
                ])
                .map_err(crate::domain::error::DomainError::from)
                .map_err(AppError::from)?;
        }
    }

    tx.commit()
        .map_err(crate::domain::error::DomainError::from)
        .map_err(AppError::from)?;
    drop(db_guard);

    let db_guard = lock_db(db)?;
    mark_muted_unread_as_read_for_feed_with_conn(db_guard.writer(), &account.id, &feed.id)?;

    Ok(())
}

async fn fetch_greader_unread_entries_for_feed(
    db: &Mutex<DbManager>,
    provider: &GReaderProvider,
    account: &Account,
    feed: &Feed,
) -> Result<HashSet<String>, AppError> {
    let Some(remote_id) = feed.remote_id.as_deref() else {
        return Ok(HashSet::new());
    };

    let mut unread_remote_ids = HashSet::new();
    let mut cursor: Option<SyncCursor> = None;
    loop {
        let result = provider
            .pull_unread_entries_for_feed(remote_id, cursor.clone())
            .await?;

        let articles: Vec<Article> = result
            .entries
            .iter()
            .map(|entry| {
                if let Some(remote_id) = entry.id.as_ref() {
                    unread_remote_ids.insert(remote_id.clone());
                }
                build_article_from_remote_entry(account, feed, entry)
            })
            .collect();

        if !articles.is_empty() {
            let db_guard = lock_db(db)?;
            let article_repo = SqliteArticleRepository::new(db_guard.writer());
            article_repo.upsert(&articles)?;
            let candidate_ids = articles
                .iter()
                .map(|article| article.id.clone())
                .collect::<Vec<_>>();
            article_repo.mark_muted_unread_as_read(&account.id, Some(&candidate_ids))?;
        }

        if !result.has_more {
            break;
        }
        cursor = result.next_cursor;
    }

    Ok(unread_remote_ids)
}
