mod local_sync;
mod progress;
mod scheduler_purge;
mod startup_repair;

pub(super) use super::*;

pub(super) use crate::commands::start_database_maintenance;
pub(super) use crate::domain::account::{Account, ConnectionVerificationStatus};
pub(super) use crate::domain::feed::Feed;
pub(super) use crate::domain::provider::ProviderKind;
pub(super) use crate::domain::types::AccountId;
pub(super) use crate::infra::db::connection::DbManager;
pub(super) use crate::infra::db::sqlite_feed::SqliteFeedRepository;
pub(super) use crate::repository::feed::FeedRepository;
pub(super) use mockito::Server;
pub(super) use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
pub(super) use std::sync::Mutex;

pub(super) fn test_sync_command_account(
    id: &str,
    kind: ProviderKind,
    sync_on_startup: bool,
) -> Account {
    Account {
        id: AccountId(id.to_string()),
        kind,
        name: id.to_string(),
        server_url: Some("https://example.com".to_string()),
        username: Some("user".to_string()),
        sync_interval_secs: 3600,
        sync_on_startup,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: ConnectionVerificationStatus::Unverified,
        connection_verified_at: None,
        connection_verification_error: None,
    }
}
