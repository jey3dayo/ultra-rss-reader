mod feed_add;
mod feed_mutations;
mod fixtures;
mod folders;

pub(super) use async_trait::async_trait;
pub(super) use rusqlite::params;
pub(super) use std::net::TcpListener;
pub(super) use std::sync::atomic::{AtomicBool, Ordering};
pub(super) use std::sync::{mpsc, Arc, Barrier, Mutex};
pub(super) use std::thread;
pub(super) use std::time::{Duration, Instant};

pub(super) use super::{
    add_local_feed_with_db, add_local_feed_with_provider, classify_update_feed_folder_error,
    create_folder_in_db, delete_feed_in_db, delete_feed_with_provider_sync_boundary,
    delete_feed_with_remote_sync_boundary, delete_feed_with_sync_boundary, lock_db,
    recalculate_feed_unread_count_in_db, rename_feed_in_db, rename_feed_with_remote_sync_boundary,
    update_feed_display_settings_in_db, update_feed_folder_in_db,
    update_feed_folder_with_remote_sync_boundary, validate_add_freshrss_feed_preflight_in_db,
    validate_add_freshrss_subscription_unique_in_db, validate_add_local_feed_account_in_db,
    validate_add_local_feed_duplicate_url_in_db, UPDATE_FEED_FOLDER_TARGET_VALIDATION_MESSAGE,
};
pub(super) use crate::commands::dto::AppError;
pub(super) use crate::domain::account::{Account, ConnectionVerificationStatus};
pub(super) use crate::domain::error::{DomainError, DomainResult};
pub(super) use crate::domain::provider::{
    FeedIdentifier, Mutation, ProviderCapabilities, ProviderKind, PullResult, PullScope,
    RemoteFolder, RemoteState, RemoteSubscription, SyncCursor,
};
pub(super) use crate::domain::types::{AccountId, FeedId, FolderId};
pub(super) use crate::infra::db::connection::DbManager;
pub(super) use crate::infra::db::sqlite_account::SqliteAccountRepository;
pub(super) use crate::infra::db::sqlite_feed::SqliteFeedRepository;
pub(super) use crate::infra::db::sqlite_folder::SqliteFolderRepository;
pub(super) use crate::infra::keyring_store;
pub(super) use crate::infra::provider::local::LocalProvider;
pub(super) use crate::infra::provider::traits::{Credentials, FeedProvider};
pub(super) use crate::repository::account::AccountRepository;
pub(super) use crate::repository::feed::FeedRepository;
pub(super) use crate::repository::folder::FolderRepository;
pub(super) use mockito::Matcher;
