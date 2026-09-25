use std::path::PathBuf;

use clap::{Parser, Subcommand, ValueEnum};

#[derive(Debug, Parser)]
#[command(name = "urr", about = "Ultra RSS Reader diagnostics CLI", version)]
pub(crate) struct Cli {
    #[arg(long, value_enum, default_value_t = ProfileArg::Prod, global = true)]
    pub(crate) profile: ProfileArg,

    #[arg(long, global = true)]
    pub(crate) db: Option<PathBuf>,

    #[arg(long, global = true)]
    pub(crate) json: bool,

    #[arg(short = 'q', long = "quiet", global = true, action = clap::ArgAction::Count)]
    pub(crate) quiet: u8,

    #[arg(short = 'v', long = "verbose", global = true, action = clap::ArgAction::Count)]
    pub(crate) verbose: u8,

    /// Disable network-capable commands (`feed diagnose` skips its source
    /// layer and reports it as `source_skipped` instead of fetching it).
    #[arg(long = "no-network", global = true)]
    pub(crate) no_network: bool,

    #[command(subcommand)]
    pub(crate) command: Command,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, ValueEnum)]
pub(crate) enum ProfileArg {
    Prod,
    Dev,
}

#[derive(Debug, Subcommand)]
pub(crate) enum Command {
    /// Resolved profile, DB path, schema version, and per-account sync status.
    Status,
    /// Account-related read-only commands.
    Account {
        #[command(subcommand)]
        command: AccountCommand,
    },
    /// Database-related read-only commands.
    Db {
        #[command(subcommand)]
        command: DbCommand,
    },
    /// Log-directory-related commands.
    Log {
        #[command(subcommand)]
        command: LogCommand,
    },
    /// Feed-related read-only commands.
    Feed {
        #[command(subcommand)]
        command: FeedCommand,
    },
    /// Sync-state-related read-only commands.
    SyncState {
        #[command(subcommand)]
        command: SyncStateCommand,
    },
    /// Pending-mutation-related read-only commands.
    PendingMutation {
        #[command(subcommand)]
        command: PendingMutationCommand,
    },
}

#[derive(Debug, Subcommand)]
pub(crate) enum AccountCommand {
    /// List every configured account.
    List,
}

#[derive(Debug, Subcommand)]
pub(crate) enum DbCommand {
    /// Report DB/WAL/SHM file sizes and schema version.
    Info,
    /// Report orphaned-article/orphaned-feed-group counts.
    Integrity,
}

#[derive(Debug, Subcommand)]
pub(crate) enum LogCommand {
    /// Print the resolved log directory path.
    Path,
}

#[derive(Debug, Subcommand)]
pub(crate) enum FeedCommand {
    /// List feeds, optionally filtered by account and/or folder.
    List {
        #[arg(long)]
        account: Option<String>,
        #[arg(long)]
        folder: Option<String>,
    },
    /// Diagnose a feed by id or exact source URL across its source, the
    /// app's local copy, and its sync state.
    Diagnose {
        query: String,
        #[arg(long)]
        account: Option<String>,
    },
    /// List feeds whose latest article is stale relative to their own
    /// posting cadence.
    Stale {
        #[arg(long)]
        account: Option<String>,
        #[arg(long, default_value_t = 6.0)]
        min_hours: f64,
    },
}

#[derive(Debug, Subcommand)]
pub(crate) enum SyncStateCommand {
    /// Show sync_state rows for an account, optionally filtered to one scope.
    Show {
        account_id: String,
        #[arg(long)]
        scope: Option<String>,
    },
}

#[derive(Debug, Subcommand)]
pub(crate) enum PendingMutationCommand {
    /// List pending (not-yet-pushed) mutations, optionally for one account.
    List {
        #[arg(long)]
        account: Option<String>,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_profile_is_prod_and_json_is_off() {
        let cli = Cli::try_parse_from(["urr", "status"]).expect("status should parse");

        assert_eq!(cli.profile, ProfileArg::Prod);
        assert!(!cli.json);
        assert!(cli.db.is_none());
        assert!(matches!(cli.command, Command::Status));
    }

    #[test]
    fn global_options_parse_before_and_after_the_subcommand() {
        let cli = Cli::try_parse_from(["urr", "--profile", "dev", "--json", "account", "list"])
            .expect("global options before the subcommand should parse");
        assert_eq!(cli.profile, ProfileArg::Dev);
        assert!(cli.json);
        assert!(matches!(
            cli.command,
            Command::Account {
                command: AccountCommand::List
            }
        ));
    }

    #[test]
    fn db_override_parses_as_a_path() {
        let cli = Cli::try_parse_from(["urr", "--db", "/tmp/custom.db", "db", "info"])
            .expect("--db override should parse");
        assert_eq!(cli.db, Some(PathBuf::from("/tmp/custom.db")));
        assert!(matches!(
            cli.command,
            Command::Db {
                command: DbCommand::Info
            }
        ));
    }

    #[test]
    fn log_path_subcommand_parses() {
        let cli = Cli::try_parse_from(["urr", "log", "path"]).expect("log path should parse");
        assert!(matches!(
            cli.command,
            Command::Log {
                command: LogCommand::Path
            }
        ));
    }

    #[test]
    fn unknown_subcommand_is_a_usage_error() {
        let result = Cli::try_parse_from(["urr", "not-a-command"]);
        assert!(result.is_err());
    }

    #[test]
    fn verbosity_flags_count_repetitions() {
        let cli = Cli::try_parse_from(["urr", "-vv", "-q", "status"]).expect("counts should parse");
        assert_eq!(cli.verbose, 2);
        assert_eq!(cli.quiet, 1);
    }

    #[test]
    fn no_network_flag_defaults_off_and_parses_before_or_after_the_subcommand() {
        let default_cli = Cli::try_parse_from(["urr", "status"]).expect("status should parse");
        assert!(!default_cli.no_network);

        let before = Cli::try_parse_from(["urr", "--no-network", "feed", "diagnose", "u"])
            .expect("--no-network before the subcommand should parse");
        assert!(before.no_network);

        let after = Cli::try_parse_from(["urr", "feed", "diagnose", "u", "--no-network"])
            .expect("--no-network after the subcommand should parse");
        assert!(after.no_network);
    }

    #[test]
    fn feed_diagnose_parses_query_and_optional_account() {
        let cli = Cli::try_parse_from([
            "urr",
            "feed",
            "diagnose",
            "https://example.invalid/feed.xml",
            "--account",
            "acct-1",
        ])
        .expect("feed diagnose should parse");
        match cli.command {
            Command::Feed {
                command: FeedCommand::Diagnose { query, account },
            } => {
                assert_eq!(query, "https://example.invalid/feed.xml");
                assert_eq!(account.as_deref(), Some("acct-1"));
            }
            other => panic!("expected Feed::Diagnose, got {other:?}"),
        }
    }

    #[test]
    fn feed_stale_defaults_min_hours_to_six() {
        let cli = Cli::try_parse_from(["urr", "feed", "stale"]).expect("feed stale should parse");
        match cli.command {
            Command::Feed {
                command: FeedCommand::Stale { min_hours, account },
            } => {
                assert_eq!(min_hours, 6.0);
                assert!(account.is_none());
            }
            other => panic!("expected Feed::Stale, got {other:?}"),
        }
    }

    #[test]
    fn sync_state_show_parses_account_id_and_optional_scope() {
        let cli = Cli::try_parse_from([
            "urr",
            "sync-state",
            "show",
            "acct-1",
            "--scope",
            "account:greader:all",
        ])
        .expect("sync-state show should parse");
        match cli.command {
            Command::SyncState {
                command: SyncStateCommand::Show { account_id, scope },
            } => {
                assert_eq!(account_id, "acct-1");
                assert_eq!(scope.as_deref(), Some("account:greader:all"));
            }
            other => panic!("expected SyncState::Show, got {other:?}"),
        }
    }

    #[test]
    fn pending_mutation_list_parses_optional_account() {
        let cli = Cli::try_parse_from(["urr", "pending-mutation", "list"])
            .expect("pending-mutation list should parse");
        assert!(matches!(
            cli.command,
            Command::PendingMutation {
                command: PendingMutationCommand::List { account: None }
            }
        ));
    }

    #[test]
    fn db_integrity_subcommand_parses() {
        let cli =
            Cli::try_parse_from(["urr", "db", "integrity"]).expect("db integrity should parse");
        assert!(matches!(
            cli.command,
            Command::Db {
                command: DbCommand::Integrity
            }
        ));
    }
}
