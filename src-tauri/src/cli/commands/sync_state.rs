use async_trait::async_trait;
use serde::Serialize;
use serde_json::json;

use crate::domain::types::AccountId;
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;

use crate::cli::command::{CliCommand, CommandOutput};
use crate::cli::error::CliResult;
use crate::cli::route::{Capability, NetworkAccess, Route};

use super::sync_state_view::timestamp_usec_to_rfc3339;

const CAPABILITIES: &[Capability] = &[Capability::DbRead];

pub(crate) struct SyncStateShowCommand {
    pub(crate) account_id: String,
    pub(crate) scope: Option<String>,
}

/// Never carries the raw `continuation` or `etag` value (this task's MUST
/// #6): only presence booleans, mirroring `sync_state_view::SyncStateView`'s
/// treatment of `last_error`.
#[derive(Serialize)]
struct SyncStateRow {
    scope_key: String,
    timestamp_usec_rfc3339: Option<String>,
    has_continuation: bool,
    has_etag: bool,
    has_last_modified: bool,
    last_success_at: Option<String>,
    has_last_error: bool,
    error_count: i32,
    next_retry_at: Option<String>,
}

#[async_trait(?Send)]
impl CliCommand for SyncStateShowCommand {
    fn capabilities(&self) -> &'static [Capability] {
        CAPABILITIES
    }

    async fn run(&self, route: Route, _network: NetworkAccess) -> CliResult<CommandOutput> {
        let Route::ReadOnly(db) = route else {
            unreachable!(
                "SyncStateShowCommand declares Capability::DbRead; dispatcher must route ReadOnly"
            );
        };

        let account_id = AccountId(self.account_id.clone());
        let rows: Vec<SyncStateRow> = db.with_conn(|conn| {
            let repo = SqliteSyncStateRepository::new(conn);
            let states = repo.find_all_by_account(&account_id)?;
            Ok(states
                .into_iter()
                .filter(|state| {
                    self.scope
                        .as_deref()
                        .is_none_or(|scope| scope == state.scope_key)
                })
                .map(|state| SyncStateRow {
                    scope_key: state.scope_key,
                    timestamp_usec_rfc3339: state
                        .timestamp_usec
                        .and_then(timestamp_usec_to_rfc3339),
                    has_continuation: state.continuation.is_some(),
                    has_etag: state.etag.is_some(),
                    has_last_modified: state.last_modified.is_some(),
                    last_success_at: state.last_success_at,
                    has_last_error: state.last_error.is_some(),
                    error_count: state.error_count,
                    next_retry_at: state.next_retry_at,
                })
                .collect())
        })?;

        let human = if rows.is_empty() {
            format!("no sync_state rows for account {}", self.account_id)
        } else {
            rows.iter()
                .map(|row| {
                    format!(
                        "{} last_success_at={:?} has_last_error={} error_count={} next_retry_at={:?}",
                        row.scope_key,
                        row.last_success_at,
                        row.has_last_error,
                        row.error_count,
                        row.next_retry_at
                    )
                })
                .collect::<Vec<_>>()
                .join("\n")
        };

        Ok(CommandOutput {
            human,
            json_data: json!({ "account_id": self.account_id, "rows": rows }),
            exit_code: None,
        })
    }
}
