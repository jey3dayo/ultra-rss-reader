use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::{Emitter, State};

use crate::commands::dto::{AppError, FeedDto, FolderDto};
use crate::commands::AppState;
use crate::domain::account::Account;
use crate::domain::feed::Feed;
use crate::domain::provider::{Mutation, ProviderKind};
use crate::domain::types::{AccountId, FeedId, FolderId};
use crate::infra::db::connection::DbManager;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_folder::SqliteFolderRepository;
use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
use crate::infra::db::sqlite_preference::SqlitePreferenceRepository;
use crate::infra::keyring_store;
use crate::infra::provider::greader::GReaderProvider;
use crate::infra::provider::local::LocalProvider;
use crate::infra::provider::traits::{Credentials, FeedProvider};
use crate::repository::account::AccountRepository;
use crate::repository::article::ArticleRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::folder::FolderRepository;
use crate::repository::pending_mutation::PendingMutationRepository;
use crate::repository::preference::PreferenceRepository;
use tracing::warn;

use crate::commands::dto::DiscoveredFeedDto;
use crate::infra::feed_discovery;

fn lock_db(db: &Mutex<DbManager>) -> Result<std::sync::MutexGuard<'_, DbManager>, AppError> {
    db.lock().map_err(|e| AppError::UserVisible {
        message: format!("Lock error: {e}"),
    })
}

#[tauri::command]
pub fn list_folders(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<Vec<FolderDto>, AppError> {
    let db = lock_db(&state.db)?;
    let repo = SqliteFolderRepository::new(db.reader());
    let folders = repo.find_by_account(&AccountId(account_id))?;
    Ok(folders.into_iter().map(FolderDto::from).collect())
}

#[tauri::command]
pub fn list_feeds(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<Vec<FeedDto>, AppError> {
    let db = lock_db(&state.db)?;
    let repo = SqliteFeedRepository::new(db.reader());
    let feeds = repo.find_by_account(&AccountId(account_id))?;
    Ok(feeds.into_iter().map(FeedDto::from).collect())
}

#[tauri::command]
pub fn create_folder(
    state: State<'_, AppState>,
    account_id: String,
    name: String,
) -> Result<FolderDto, AppError> {
    use crate::domain::folder::Folder;

    let db = lock_db(&state.db)?;
    let account_id = AccountId(account_id);
    let folder_repo = SqliteFolderRepository::new(db.writer());

    // Determine next sort_order
    let existing = folder_repo.find_by_account(&account_id)?;
    let sort_order = existing.len() as i32;

    // NOTE: Local-only folder; remote sync will be handled in a future iteration
    let folder = Folder {
        id: FolderId::new(),
        account_id,
        remote_id: None,
        name,
        sort_order,
    };
    folder_repo.save(&folder)?;
    Ok(FolderDto::from(folder))
}

#[tauri::command]
pub fn delete_feed(state: State<'_, AppState>, feed_id: String) -> Result<(), AppError> {
    let db = lock_db(&state.db)?;
    let repo = SqliteFeedRepository::new(db.writer());
    repo.delete(&FeedId(feed_id))?;
    Ok(())
}

#[tauri::command]
pub fn rename_feed(
    state: State<'_, AppState>,
    feed_id: String,
    title: String,
) -> Result<(), AppError> {
    let db = lock_db(&state.db)?;
    let repo = SqliteFeedRepository::new(db.writer());
    repo.rename(&FeedId(feed_id), &title)?;
    Ok(())
}

#[tauri::command]
pub fn update_feed_folder(
    state: State<'_, AppState>,
    feed_id: String,
    folder_id: Option<String>,
) -> Result<(), AppError> {
    let db = lock_db(&state.db)?;
    let repo = SqliteFeedRepository::new(db.writer());
    let fid = folder_id.map(FolderId);
    repo.update_folder(&FeedId(feed_id), fid.as_ref())?;
    Ok(())
}

#[tauri::command]
pub async fn add_local_feed(
    state: State<'_, AppState>,
    account_id: String,
    url: String,
) -> Result<FeedDto, AppError> {
    // 1. Validate by fetching the feed
    let provider = LocalProvider::new();
    let sub = provider.create_subscription(&url, None).await?;

    // 2. Save to DB
    let account_id = AccountId(account_id);
    let feed = Feed {
        id: FeedId::new(),
        account_id: account_id.clone(),
        folder_id: None,
        remote_id: Some(sub.remote_id),
        title: sub.title,
        url: sub.url,
        site_url: sub.site_url,
        icon: None,
        unread_count: 0,
        display_mode: "normal".to_string(),
    };

    {
        let db = lock_db(&state.db)?;
        let feed_repo = SqliteFeedRepository::new(db.writer());
        feed_repo.save(&feed)?;
    }

    // 3. Fetch initial articles for the new feed
    sync_local_feed(&state.db, &provider, &account_id, &feed).await?;

    // 4. Re-read unread count from DB
    let unread_count = {
        let db = lock_db(&state.db)?;
        let feed_repo = SqliteFeedRepository::new(db.reader());
        feed_repo.recalculate_unread_count(&feed.id).unwrap_or(0)
    };
    let mut updated_feed = feed;
    updated_feed.unread_count = unread_count;
    Ok(FeedDto::from(updated_feed))
}

/// Fetch articles for a single local feed and save them to DB.
async fn sync_local_feed(
    db: &Mutex<DbManager>,
    provider: &LocalProvider,
    account_id: &AccountId,
    feed: &Feed,
) -> Result<(), AppError> {
    let scope =
        crate::domain::provider::PullScope::Feed(crate::domain::provider::FeedIdentifier::Local {
            feed_url: feed.url.clone(),
        });

    let result = provider.pull_entries(scope, None).await?;

    let articles: Vec<crate::domain::article::Article> = result
        .entries
        .iter()
        .map(|entry| {
            let id = crate::domain::article::generate_entry_id(
                account_id.as_ref(),
                entry.id.as_deref(),
                &feed.url,
                entry.url.as_deref(),
                Some(&entry.title),
            );
            crate::domain::article::Article {
                id,
                feed_id: feed.id.clone(),
                remote_id: entry.id.clone(),
                title: entry.title.clone(),
                content_raw: entry.content.clone(),
                content_sanitized: crate::infra::sanitizer::sanitize_html(&entry.content),
                sanitizer_version: crate::infra::sanitizer::SANITIZER_VERSION,
                summary: entry.summary.clone(),
                url: entry.url.clone(),
                author: entry.author.clone(),
                published_at: entry.published_at.unwrap_or_else(chrono::Utc::now),
                thumbnail: entry.thumbnail.clone(),
                is_read: entry.is_read.unwrap_or(false),
                is_starred: entry.is_starred.unwrap_or(false),
                fetched_at: chrono::Utc::now(),
            }
        })
        .collect();

    if !articles.is_empty() {
        let db_guard = lock_db(db)?;
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        let feed_repo_w = SqliteFeedRepository::new(db_guard.writer());
        article_repo.upsert(&articles)?;
        let _ = feed_repo_w.recalculate_unread_count(&feed.id);
    }
    Ok(())
}

/// Sync a GReader-compatible account (FreshRSS, Inoreader): authenticate, sync folders, subscriptions, entries, state, unread counts.
async fn sync_greader_account(
    db: &Mutex<DbManager>,
    account: &Account,
    mut provider: GReaderProvider,
) -> Result<(), AppError> {
    use crate::domain::folder::Folder;
    use crate::domain::types::FolderId;

    let username = match &account.username {
        Some(u) => u.clone(),
        None => {
            warn!(
                "GReader account {} has no username, skipping",
                account.id.as_ref()
            );
            return Ok(());
        }
    };

    // Step 1: Authenticate (no DB lock)
    let password = keyring_store::get_password(account.id.as_ref())?;
    provider
        .authenticate(&Credentials {
            token: Some(username),
            password: Some(password),
        })
        .await?;

    // Step 2: Sync folders
    let remote_folders = provider.get_folders().await?;
    {
        let db_guard = lock_db(db)?;
        let folder_repo = SqliteFolderRepository::new(db_guard.writer());
        for rf in &remote_folders {
            let existing_id = folder_repo
                .find_by_remote_id(&account.id, &rf.remote_id)?
                .map(|f| f.id);
            let folder = Folder {
                id: existing_id.unwrap_or_else(FolderId::new),
                account_id: account.id.clone(),
                remote_id: Some(rf.remote_id.clone()),
                name: rf.name.clone(),
                sort_order: rf.sort_order.unwrap_or(0),
            };
            folder_repo.save(&folder)?;
        }
    }

    // Steps 3-7
    sync_greader_feeds(db, &provider, account).await?;

    Ok(())
}

/// Steps 3-7: sync subscriptions, pull entries, push mutations, apply remote state, recalculate unread counts.
async fn sync_greader_feeds(
    db: &Mutex<DbManager>,
    provider: &GReaderProvider,
    account: &Account,
) -> Result<(), AppError> {
    use std::collections::HashMap;

    use crate::domain::article::{generate_entry_id, Article};
    use crate::domain::provider::{FeedIdentifier, PullScope};
    use crate::domain::types::FolderId;
    use crate::infra::sanitizer;

    // Build remote_id -> FolderId map from existing folders
    let folder_remote_id_map: HashMap<String, FolderId> = {
        let db_guard = lock_db(db)?;
        let folder_repo = SqliteFolderRepository::new(db_guard.reader());
        let folders = folder_repo.find_by_account(&account.id)?;
        folders
            .into_iter()
            .filter_map(|f| f.remote_id.map(|rid| (rid, f.id)))
            .collect()
    };

    // Step 3: Sync subscriptions
    let remote_subs = provider.get_subscriptions().await?;
    {
        let db_guard = lock_db(db)?;
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        for rs in &remote_subs {
            let existing = feed_repo.find_by_remote_id(&account.id, &rs.remote_id)?;
            let feed = Feed {
                id: existing
                    .as_ref()
                    .map(|f| f.id.clone())
                    .unwrap_or_else(FeedId::new),
                account_id: account.id.clone(),
                folder_id: rs
                    .folder_remote_id
                    .as_ref()
                    .and_then(|rid| folder_remote_id_map.get(rid))
                    .cloned()
                    .or_else(|| existing.as_ref().and_then(|f| f.folder_id.clone())),
                remote_id: Some(rs.remote_id.clone()),
                title: rs.title.clone(),
                url: rs.url.clone(),
                site_url: rs.site_url.clone(),
                icon: None,
                unread_count: 0,
                display_mode: existing
                    .as_ref()
                    .map(|f| f.display_mode.clone())
                    .unwrap_or_else(|| "normal".to_string()),
            };
            feed_repo.save(&feed)?;
        }
    }

    // Step 4: Pull entries per feed
    let feeds = {
        let db_guard = lock_db(db)?;
        let feed_repo = SqliteFeedRepository::new(db_guard.reader());
        feed_repo.find_by_account(&account.id)?
    };

    for feed in &feeds {
        let scope = if let Some(ref remote_id) = feed.remote_id {
            PullScope::Feed(FeedIdentifier::Remote {
                remote_id: remote_id.clone(),
            })
        } else {
            continue; // Skip feeds without remote_id for FreshRSS
        };

        let result = match provider.pull_entries(scope, None).await {
            Ok(r) => r,
            Err(e) => {
                warn!("Failed to pull entries for feed {}: {e}", feed.url);
                continue;
            }
        };

        let articles: Vec<Article> = result
            .entries
            .iter()
            .map(|entry| {
                let id = generate_entry_id(
                    account.id.as_ref(),
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
                    published_at: entry.published_at.unwrap_or_else(chrono::Utc::now),
                    thumbnail: entry.thumbnail.clone(),
                    is_read: entry.is_read.unwrap_or(false),
                    is_starred: entry.is_starred.unwrap_or(false),
                    fetched_at: chrono::Utc::now(),
                }
            })
            .collect();

        if !articles.is_empty() {
            let db_guard = lock_db(db)?;
            let article_repo = SqliteArticleRepository::new(db_guard.writer());
            article_repo.upsert(&articles)?;
        }
    }

    // Step 5: Push pending mutations to server one by one
    let pending_mutations = {
        let db_guard = lock_db(db)?;
        let pending_repo = SqlitePendingMutationRepository::new(db_guard.reader());
        pending_repo.find_by_account(&account.id)?
    };

    let mut pushed_remote_ids: Vec<String> = Vec::new();
    for pm in &pending_mutations {
        let mutation = match pm.mutation_type.as_str() {
            "mark_read" => Mutation::MarkRead {
                remote_entry_id: pm.remote_entry_id.clone(),
            },
            "mark_unread" => Mutation::MarkUnread {
                remote_entry_id: pm.remote_entry_id.clone(),
            },
            "star" => Mutation::SetStarred {
                remote_entry_id: pm.remote_entry_id.clone(),
                starred: true,
            },
            "unstar" => Mutation::SetStarred {
                remote_entry_id: pm.remote_entry_id.clone(),
                starred: false,
            },
            other => {
                warn!("Unknown mutation type: {other}");
                continue;
            }
        };

        match provider.push_mutations(&[mutation]).await {
            Ok(()) => {
                pushed_remote_ids.push(pm.remote_entry_id.clone());
                if let Some(id) = pm.id {
                    let db_guard = lock_db(db)?;
                    let pending_repo = SqlitePendingMutationRepository::new(db_guard.writer());
                    pending_repo.delete(&[id])?;
                }
            }
            Err(e) => {
                warn!(
                    "Failed to push mutation {} for entry {}: {e}. Will retry next sync.",
                    pm.mutation_type, pm.remote_entry_id
                );
            }
        }
    }

    // Step 6: Pull remote state and apply (skip articles with pending or just-pushed mutations)
    let pending_remote_ids: Vec<String> = {
        let db_guard = lock_db(db)?;
        let pending_repo = SqlitePendingMutationRepository::new(db_guard.reader());
        let mut ids: Vec<String> = pending_repo
            .find_by_account(&account.id)?
            .into_iter()
            .map(|pm| pm.remote_entry_id)
            .collect();
        // Merge with successfully pushed IDs to prevent stale remote data from overwriting
        ids.extend(pushed_remote_ids);
        ids.sort();
        ids.dedup();
        ids
    };

    let remote_state = provider.pull_state().await?;
    {
        let db_guard = lock_db(db)?;
        let article_repo = SqliteArticleRepository::new(db_guard.writer());
        article_repo.apply_remote_state(
            &account.id,
            &remote_state.read_ids,
            &remote_state.starred_ids,
            &pending_remote_ids,
        )?;
    }

    // Step 7: Recalculate unread counts
    {
        let db_guard = lock_db(db)?;
        let feed_repo = SqliteFeedRepository::new(db_guard.writer());
        for feed in &feeds {
            let _ = feed_repo.recalculate_unread_count(&feed.id);
        }
    }

    Ok(())
}

/// RAII guard that resets the `AtomicBool` to `false` on drop, ensuring the
/// sync flag is always cleared even on early return or panic.
struct SyncGuard<'a>(&'a AtomicBool);

impl Drop for SyncGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

/// Run a full sync for all accounts. Shared by `trigger_sync` command and the background scheduler.
///
/// Uses `syncing` as a concurrent-execution guard: if another sync is already
/// in progress the call returns `Ok(false)` immediately (skip, not error).
pub async fn run_full_sync(db: &Mutex<DbManager>, syncing: &AtomicBool) -> Result<bool, AppError> {
    if syncing
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        tracing::info!("Sync already in progress, skipping");
        return Ok(false);
    }
    let _guard = SyncGuard(syncing);

    let accounts: Vec<Account> = {
        let db_guard = lock_db(db)?;
        let account_repo = SqliteAccountRepository::new(db_guard.reader());
        account_repo.find_all()?
    };

    for account in &accounts {
        match account.kind {
            ProviderKind::Local => {
                let provider = LocalProvider::new();
                let feeds = {
                    let db_guard = lock_db(db)?;
                    let feed_repo = SqliteFeedRepository::new(db_guard.reader());
                    feed_repo.find_by_account(&account.id)?
                };
                for feed in &feeds {
                    let _ = sync_local_feed(db, &provider, &account.id, feed).await;
                }
            }
            ProviderKind::FreshRss => {
                let server_url = account.server_url.as_deref().unwrap_or_default();
                let provider = GReaderProvider::for_freshrss(server_url);
                if let Err(e) = sync_greader_account(db, account, provider).await {
                    warn!(
                        "FreshRSS sync failed for account {}: {e}",
                        account.id.as_ref()
                    );
                }
            }
            ProviderKind::Inoreader => {
                let (app_id, app_key) = {
                    let db_guard = lock_db(db)?;
                    let pref_repo = SqlitePreferenceRepository::new(db_guard.reader());
                    (
                        pref_repo.get("inoreader_app_id").unwrap_or(None),
                        pref_repo.get("inoreader_app_key").unwrap_or(None),
                    )
                };
                let provider = GReaderProvider::for_inoreader(app_id, app_key);
                if let Err(e) = sync_greader_account(db, account, provider).await {
                    warn!(
                        "Inoreader sync failed for account {}: {e}",
                        account.id.as_ref()
                    );
                }
            }
        }
    }
    Ok(true)
}

/// Get the minimum sync interval from all accounts (defaults to 3600s if no accounts).
pub fn get_min_sync_interval(db: &Mutex<DbManager>) -> std::time::Duration {
    const DEFAULT_INTERVAL_SECS: u64 = 3600;

    let secs = lock_db(db)
        .ok()
        .and_then(|db_guard| {
            let repo = SqliteAccountRepository::new(db_guard.reader());
            repo.find_all().ok()
        })
        .and_then(|accounts| {
            accounts
                .iter()
                .map(|a| a.sync_interval_secs)
                .filter(|&s| s > 0)
                .min()
        })
        .map(|s| s as u64)
        .unwrap_or(DEFAULT_INTERVAL_SECS);

    std::time::Duration::from_secs(secs)
}

#[tauri::command]
pub fn update_feed_display_mode(
    state: State<'_, AppState>,
    feed_id: String,
    display_mode: String,
) -> Result<(), AppError> {
    let db = lock_db(&state.db)?;
    let repo = SqliteFeedRepository::new(db.writer());
    repo.update_display_mode(&FeedId(feed_id), &display_mode)?;
    Ok(())
}

#[tauri::command]
pub async fn discover_feeds(url: String) -> Result<Vec<DiscoveredFeedDto>, AppError> {
    let feeds = feed_discovery::discover_feeds(&url).await?;
    Ok(feeds.into_iter().map(DiscoveredFeedDto::from).collect())
}

#[tauri::command]
pub async fn trigger_sync(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<bool, AppError> {
    let did_sync = run_full_sync(&state.db, &state.syncing).await?;
    if did_sync {
        let _ = app_handle.emit("sync-completed", ());
    }
    Ok(did_sync)
}
