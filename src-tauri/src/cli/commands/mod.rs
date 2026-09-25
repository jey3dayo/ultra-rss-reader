mod account;
mod db;
mod feed;
mod log;
mod pending_mutation;
mod status;
mod sync_state;
mod sync_state_view;
#[cfg(test)]
mod tests;

use crate::domain::provider::ProviderKind;

use super::args::{
    AccountCommand, Command, DbCommand, FeedCommand, LogCommand, PendingMutationCommand,
    SyncStateCommand,
};
use super::command::CliCommand;

pub(super) fn provider_kind_label(kind: &ProviderKind) -> &'static str {
    match kind {
        ProviderKind::Local => "local",
        ProviderKind::FreshRss => "freshrss",
        ProviderKind::Quarantined => "quarantined",
    }
}

/// Builds the command for the parsed subcommand. `identifier` is only used by
/// commands that need it directly (currently `log path`); commands that read
/// the database receive it indirectly through the dispatcher-resolved DB
/// path instead.
pub(crate) fn build(command: &Command, identifier: &'static str) -> Box<dyn CliCommand> {
    match command {
        Command::Status => Box::new(status::StatusCommand),
        Command::Account {
            command: AccountCommand::List,
        } => Box::new(account::AccountListCommand),
        Command::Db {
            command: DbCommand::Info,
        } => Box::new(db::DbInfoCommand),
        Command::Db {
            command: DbCommand::Integrity,
        } => Box::new(db::DbIntegrityCommand),
        Command::Log {
            command: LogCommand::Path,
        } => Box::new(log::LogPathCommand::new(identifier)),
        Command::Feed {
            command: FeedCommand::List { account, folder },
        } => Box::new(feed::FeedListCommand {
            account: account.clone(),
            folder: folder.clone(),
        }),
        Command::Feed {
            command: FeedCommand::Diagnose { query, account },
        } => Box::new(feed::FeedDiagnoseCommand {
            query: query.clone(),
            account: account.clone(),
        }),
        Command::Feed {
            command: FeedCommand::Stale { account, min_hours },
        } => Box::new(feed::FeedStaleCommand {
            account: account.clone(),
            min_hours: *min_hours,
        }),
        Command::SyncState {
            command: SyncStateCommand::Show { account_id, scope },
        } => Box::new(sync_state::SyncStateShowCommand {
            account_id: account_id.clone(),
            scope: scope.clone(),
        }),
        Command::PendingMutation {
            command: PendingMutationCommand::List { account },
        } => Box::new(pending_mutation::PendingMutationListCommand {
            account: account.clone(),
        }),
    }
}
