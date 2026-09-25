use async_trait::async_trait;
use serde_json::{json, Value};

use crate::domain::account::Account;
use crate::domain::provider::ProviderKind;
use crate::infra::db::migration::{read_schema_version, LATEST_VERSION};
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use crate::repository::account::AccountRepository;
use crate::repository::sync_state::{SyncStateRepository, SyncStateScopeKey};

use crate::cli::command::{CliCommand, CommandOutput};
use crate::cli::error::CliResult;
use crate::cli::route::{Capability, NetworkAccess, Route};

use super::provider_kind_label;
use super::sync_state_view::SyncStateView;

const CAPABILITIES: &[Capability] = &[Capability::DbRead];

pub(crate) struct StatusCommand;

#[async_trait(?Send)]
impl CliCommand for StatusCommand {
    fn capabilities(&self) -> &'static [Capability] {
        CAPABILITIES
    }

    async fn run(&self, route: Route, _network: NetworkAccess) -> CliResult<CommandOutput> {
        let Route::ReadOnly(db) = route else {
            unreachable!(
                "StatusCommand declares Capability::DbRead; dispatcher must route ReadOnly"
            );
        };

        let info = db.database_info()?;
        let (schema_version, accounts, account_entries) = db.with_conn(|conn| {
            let schema_version = read_schema_version(conn)?;
            let account_repo = SqliteAccountRepository::new(conn);
            let sync_state_repo = SqliteSyncStateRepository::new(conn);
            let accounts = account_repo.find_all()?;

            let mut account_entries = Vec::with_capacity(accounts.len());
            for account in &accounts {
                account_entries.push(account_status_json(account, &sync_state_repo)?);
            }

            Ok((schema_version, accounts, account_entries))
        })?;

        let human = format_human(schema_version, &info, &accounts, &account_entries);

        let json_data = json!({
            "schema_version": schema_version,
            "latest_version": LATEST_VERSION,
            "db_size_bytes": info.db_size_bytes,
            "wal_size_bytes": info.wal_size_bytes,
            "shm_size_bytes": info.shm_size_bytes,
            "total_size_bytes": info.total_size_bytes,
            "account_count": accounts.len(),
            "accounts": account_entries,
        });

        Ok(CommandOutput {
            human,
            json_data,
            exit_code: None,
        })
    }
}

fn account_status_json(
    account: &Account,
    sync_state_repo: &SqliteSyncStateRepository<'_>,
) -> CliResult<Value> {
    let scheduler_state = sync_state_repo
        .get(&account.id, SyncStateScopeKey::scheduler())?
        .map(SyncStateView::from);
    let greader_account_all_state = if account.kind == ProviderKind::FreshRss {
        sync_state_repo
            .get(&account.id, SyncStateScopeKey::greader_account_all())?
            .map(SyncStateView::from)
    } else {
        None
    };

    Ok(json!({
        "id": account.id.0,
        "kind": provider_kind_label(&account.kind),
        "name": account.name,
        "scheduler": scheduler_state,
        "greader_account_all": greader_account_all_state,
    }))
}

fn format_human(
    schema_version: i32,
    info: &crate::infra::db::connection::DatabaseInfo,
    accounts: &[Account],
    account_entries: &[Value],
) -> String {
    let mut lines = vec![
        format!("schema_version: {schema_version} (latest: {LATEST_VERSION})"),
        format!(
            "db size: {} bytes (wal {} bytes, shm {} bytes, total {} bytes)",
            info.db_size_bytes, info.wal_size_bytes, info.shm_size_bytes, info.total_size_bytes
        ),
        format!("accounts: {}", accounts.len()),
    ];
    for (account, entry) in accounts.iter().zip(account_entries) {
        lines.push(format!(
            "  - {} ({}) scheduler={} greader_account_all={}",
            account.name,
            provider_kind_label(&account.kind),
            entry["scheduler"],
            entry["greader_account_all"],
        ));
    }
    lines.join("\n")
}
