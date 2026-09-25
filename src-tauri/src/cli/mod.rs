//! `urr`, the read-only diagnostics CLI (design doc:
//! `plans/cli/001-cli-design.md`, Phase 1).
//!
//! This module never starts the Tauri runtime, never calls [`crate::run`],
//! and never constructs an `AppHandle`. `cli_main` is the only public item;
//! everything else is `pub(crate)` or private so a future command cannot
//! bypass the capability-gated `Route` dispatch in `route`/`command` by
//! reaching into internals directly (design doc §5).

mod args;
mod command;
mod commands;
mod error;
mod exit_code;
mod output;
mod paths;
mod route;

use std::ffi::OsString;
use std::path::PathBuf;

use clap::error::ErrorKind;
use clap::Parser;

use command::CliCommand;
use error::{CliError, CliResult};
use exit_code::CliExitCode;
use paths::Profile;
use route::{Capability, NetworkAccess, ReadOnlyDb, Route};

pub fn cli_main() -> std::process::ExitCode {
    let raw_args: Vec<OsString> = std::env::args_os().collect();

    let cli = match args::Cli::try_parse_from(&raw_args) {
        Ok(cli) => cli,
        Err(err) => return handle_clap_error(&err, json_flag_present(&raw_args)),
    };

    init_tracing(cli.quiet, cli.verbose);

    let as_json = cli.json;
    match run(&cli) {
        Ok((output, envelope)) => {
            let exit_code = output.exit_code.unwrap_or(CliExitCode::Ok);
            output::print_success(&envelope, output, as_json);
            exit_code.into()
        }
        Err(error) => {
            output::print_error(&error, as_json);
            error.exit_code.into()
        }
    }
}

fn json_flag_present(args: &[OsString]) -> bool {
    args.iter().any(|arg| arg == "--json")
}

fn handle_clap_error(err: &clap::Error, as_json: bool) -> std::process::ExitCode {
    match err.kind() {
        ErrorKind::DisplayHelp
        | ErrorKind::DisplayHelpOnMissingArgumentOrSubcommand
        | ErrorKind::DisplayVersion => {
            print!("{err}");
            CliExitCode::Ok.into()
        }
        _ => {
            let error = CliError::usage(err.to_string());
            output::print_error(&error, as_json);
            error.exit_code.into()
        }
    }
}

fn init_tracing(quiet: u8, verbose: u8) {
    use tracing_subscriber::filter::LevelFilter;

    let level = if quiet >= 2 {
        LevelFilter::OFF
    } else if quiet == 1 {
        LevelFilter::ERROR
    } else if verbose >= 2 {
        LevelFilter::DEBUG
    } else if verbose == 1 {
        LevelFilter::INFO
    } else {
        LevelFilter::WARN
    };

    let _ = tracing_subscriber::fmt()
        .with_writer(std::io::stderr)
        .with_max_level(level)
        .try_init();
}

fn resolve_profile(cli: &args::Cli) -> Profile {
    match cli.profile {
        args::ProfileArg::Prod => Profile::Prod,
        args::ProfileArg::Dev => Profile::Dev,
    }
}

fn resolve_db_path(cli: &args::Cli, profile: Profile) -> CliResult<PathBuf> {
    match &cli.db {
        Some(path) => Ok(path.clone()),
        None => paths::default_db_path(profile),
    }
}

fn resolve_profile_label(cli: &args::Cli, profile: Profile) -> String {
    if cli.db.is_some() {
        "custom".to_string()
    } else {
        profile.label().to_string()
    }
}

fn resolve_network_access(cli: &args::Cli) -> NetworkAccess {
    if cli.no_network {
        NetworkAccess::Disabled
    } else {
        NetworkAccess::Allowed
    }
}

fn run(cli: &args::Cli) -> CliResult<(command::CommandOutput, output::Envelope)> {
    let profile = resolve_profile(cli);
    let db_path = resolve_db_path(cli, profile)?;
    let profile_label = resolve_profile_label(cli, profile);
    let network = resolve_network_access(cli);

    let command = commands::build(&cli.command, profile.identifier());
    let needs_db = command.capabilities().contains(&Capability::DbRead);

    let (output, route_label) = if needs_db {
        let route = Route::ReadOnly(ReadOnlyDb::open(&db_path)?);
        (run_command(command.as_ref(), route, network)?, "read_only")
    } else {
        (run_command(command.as_ref(), Route::None, network)?, "none")
    };

    let envelope = output::Envelope {
        profile: profile_label,
        db_path: paths::shorten_home_prefix(&db_path),
        route: route_label,
    };

    Ok((output, envelope))
}

fn run_command(
    command: &dyn CliCommand,
    route: Route,
    network: NetworkAccess,
) -> CliResult<command::CommandOutput> {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|e| CliError::failed(format!("failed to start async runtime: {e}")))?;
    runtime.block_on(command.run(route, network))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn json_flag_present_detects_the_flag_anywhere_in_argv() {
        let args = |v: &[&str]| v.iter().map(OsString::from).collect::<Vec<_>>();

        assert!(json_flag_present(&args(&["urr", "--json", "status"])));
        assert!(json_flag_present(&args(&["urr", "status", "--json"])));
        assert!(!json_flag_present(&args(&["urr", "status"])));
    }

    #[test]
    fn custom_db_path_reports_a_custom_profile_label() {
        let cli = args::Cli::try_parse_from(["urr", "--db", "/tmp/custom.db", "status"])
            .expect("parsing should succeed");
        let profile = resolve_profile(&cli);

        assert_eq!(resolve_profile_label(&cli, profile), "custom");
        assert_eq!(
            resolve_db_path(&cli, profile).expect("explicit --db should resolve directly"),
            PathBuf::from("/tmp/custom.db")
        );
    }

    #[test]
    fn default_profile_reports_the_prod_label() {
        let cli = args::Cli::try_parse_from(["urr", "status"]).expect("parsing should succeed");
        let profile = resolve_profile(&cli);

        assert_eq!(resolve_profile_label(&cli, profile), "prod");
    }
}
