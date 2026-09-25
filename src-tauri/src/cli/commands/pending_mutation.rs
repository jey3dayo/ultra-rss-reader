use async_trait::async_trait;
use serde::Serialize;
use serde_json::json;

use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_pending_mutation::SqlitePendingMutationRepository;
use crate::repository::account::AccountRepository;
use crate::repository::pending_mutation::PendingMutationRepository;

use crate::cli::command::{CliCommand, CommandOutput};
use crate::cli::error::CliResult;
use crate::cli::route::{Capability, NetworkAccess, Route};

const CAPABILITIES: &[Capability] = &[Capability::DbRead];

pub(crate) struct PendingMutationListCommand {
    pub(crate) account: Option<String>,
}

/// `pending_mutations` has no payload-body column (see
/// `repository::pending_mutation::PendingMutation`): only `id`, the account,
/// a mutation type/axis, the target `remote_entry_id`, and `created_at`.
/// Nothing here is sized/redacted because there is nothing beyond these
/// already-non-secret identifiers to show.
#[derive(Serialize)]
struct PendingMutationRow {
    id: Option<i64>,
    account_id: String,
    mutation_type: &'static str,
    target_remote_entry_id: String,
    created_at: String,
}

#[async_trait(?Send)]
impl CliCommand for PendingMutationListCommand {
    fn capabilities(&self) -> &'static [Capability] {
        CAPABILITIES
    }

    async fn run(&self, route: Route, _network: NetworkAccess) -> CliResult<CommandOutput> {
        let Route::ReadOnly(db) = route else {
            unreachable!(
                "PendingMutationListCommand declares Capability::DbRead; dispatcher must route ReadOnly"
            );
        };

        let rows: Vec<PendingMutationRow> = db.with_conn(|conn| {
            let account_repo = SqliteAccountRepository::new(conn);
            let mutation_repo = SqlitePendingMutationRepository::new(conn);

            let accounts = account_repo.find_all()?;
            let mut rows = Vec::new();
            for account in accounts
                .into_iter()
                .filter(|account| self.account.as_deref().is_none_or(|id| id == account.id.0))
            {
                for mutation in mutation_repo.find_by_account(&account.id)? {
                    rows.push(PendingMutationRow {
                        id: mutation.id,
                        account_id: mutation.account_id.0,
                        mutation_type: mutation.mutation_type.as_str(),
                        target_remote_entry_id: mutation.remote_entry_id,
                        created_at: mutation.created_at,
                    });
                }
            }
            Ok(rows)
        })?;

        let human = if rows.is_empty() {
            "no pending mutations".to_string()
        } else {
            rows.iter()
                .map(|row| {
                    format!(
                        "{:?} [{}] {} target={} created_at={}",
                        row.id,
                        row.account_id,
                        row.mutation_type,
                        row.target_remote_entry_id,
                        row.created_at
                    )
                })
                .collect::<Vec<_>>()
                .join("\n")
        };

        Ok(CommandOutput {
            human,
            json_data: json!({ "pending_mutations": rows }),
            exit_code: None,
        })
    }
}
