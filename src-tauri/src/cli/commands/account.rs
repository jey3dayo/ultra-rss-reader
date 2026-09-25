use async_trait::async_trait;
use serde::Serialize;
use serde_json::json;

use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::repository::account::AccountRepository;

use crate::cli::command::{CliCommand, CommandOutput};
use crate::cli::error::CliResult;
use crate::cli::route::{Capability, NetworkAccess, Route};

use super::provider_kind_label;

const CAPABILITIES: &[Capability] = &[Capability::DbRead];

pub(crate) struct AccountListCommand;

/// `username` is the actual value, not a presence flag: only
/// passwords/tokens/keyring contents are secrets, and a username is already
/// visible in the app's account list UI.
#[derive(Serialize)]
struct AccountListItem {
    id: String,
    kind: &'static str,
    name: String,
    server_url: Option<String>,
    username: Option<String>,
    sync_interval_secs: i64,
    sync_on_startup: bool,
    keep_read_items_days: i64,
    connection_verification_status: serde_json::Value,
}

#[async_trait(?Send)]
impl CliCommand for AccountListCommand {
    fn capabilities(&self) -> &'static [Capability] {
        CAPABILITIES
    }

    async fn run(&self, route: Route, _network: NetworkAccess) -> CliResult<CommandOutput> {
        let Route::ReadOnly(db) = route else {
            unreachable!(
                "AccountListCommand declares Capability::DbRead; dispatcher must route ReadOnly"
            );
        };

        let items: Vec<AccountListItem> = db.with_conn(|conn| {
            let repo = SqliteAccountRepository::new(conn);
            let accounts = repo.find_all()?;
            Ok(accounts
                .into_iter()
                .map(|account| AccountListItem {
                    id: account.id.0,
                    kind: provider_kind_label(&account.kind),
                    name: account.name,
                    server_url: account.server_url,
                    username: account.username,
                    sync_interval_secs: account.sync_interval_secs,
                    sync_on_startup: account.sync_on_startup,
                    keep_read_items_days: account.keep_read_items_days,
                    connection_verification_status: serde_json::to_value(
                        account.connection_verification_status,
                    )
                    .unwrap_or(serde_json::Value::Null),
                })
                .collect())
        })?;

        let human = if items.is_empty() {
            "no accounts configured".to_string()
        } else {
            items
                .iter()
                .map(|item| {
                    format!(
                        "{} [{}] {} interval={}s startup={} status={}",
                        item.id,
                        item.kind,
                        item.name,
                        item.sync_interval_secs,
                        item.sync_on_startup,
                        item.connection_verification_status
                    )
                })
                .collect::<Vec<_>>()
                .join("\n")
        };

        let json_data = json!({ "accounts": items });

        Ok(CommandOutput {
            human,
            json_data,
            exit_code: None,
        })
    }
}
