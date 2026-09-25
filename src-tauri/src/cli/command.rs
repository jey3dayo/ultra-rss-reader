use async_trait::async_trait;
use serde_json::Value;

use super::error::CliResult;
use super::exit_code::CliExitCode;
use super::route::{Capability, NetworkAccess, Route};

/// A command's result: human text plus the machine-readable `data` payload
/// for the `--json` envelope.
///
/// `exit_code` is `None` normally; a command may set it to signal a
/// non-error, non-zero exit while still returning full `data` (`feed
/// diagnose` uses this for exit 7 when a match is unhealthy).
#[derive(Debug)]
pub(crate) struct CommandOutput {
    pub(crate) human: String,
    pub(crate) json_data: Value,
    pub(crate) exit_code: Option<CliExitCode>,
}

/// A dispatchable CLI command. `capabilities()` decides which [`Route`] the
/// dispatcher builds and whether [`NetworkAccess`] is `Allowed`, so a
/// command can only reach resources its declared capabilities allow.
///
/// `?Send`: `rusqlite::Connection` is not `Sync`, and `cli_main` only drives
/// this trait on a single-threaded runtime, so a `Send` bound isn't needed.
#[async_trait(?Send)]
pub(crate) trait CliCommand {
    fn capabilities(&self) -> &'static [Capability];
    async fn run(&self, route: Route, network: NetworkAccess) -> CliResult<CommandOutput>;
}
