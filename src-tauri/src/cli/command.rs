use async_trait::async_trait;
use serde_json::Value;

use super::error::CliResult;
use super::exit_code::CliExitCode;
use super::route::{Capability, NetworkAccess, Route};

/// A command's result: a human-readable rendering and the machine-readable
/// `data` payload for the `--json` envelope (see `super::output`).
///
/// `exit_code` is `None` for the ordinary case (exit 0). A command may set it
/// to signal a non-error, non-zero exit while still returning full `data` —
/// `feed diagnose` uses this for exit 7 (`DIAGNOSIS_UNHEALTHY`) when a match
/// is unhealthy but the diagnosis itself succeeded and should still be
/// printed in full.
#[derive(Debug)]
pub(crate) struct CommandOutput {
    pub(crate) human: String,
    pub(crate) json_data: Value,
    pub(crate) exit_code: Option<CliExitCode>,
}

/// A dispatchable CLI command. `capabilities()` is declarative and read
/// before `run` is ever called: the dispatcher uses it to decide which
/// [`Route`] to construct and whether [`NetworkAccess`] is `Allowed`, so a
/// command can only reach the resources its declared capabilities allow
/// (design doc §5).
///
/// `?Send` (and no `Send + Sync` supertrait): `cli_main` only ever drives
/// this trait on a single `tokio::runtime::Builder::new_current_thread()`
/// runtime, so a `Send` bound would add a constraint the dispatcher never
/// needs. `Route::ReadOnly` opens a `rusqlite::Connection` (not `Sync`) only
/// for the duration of a synchronous `ReadOnlyDb::with_conn` closure, never
/// across an `.await`, but keeping the trait `?Send` avoids re-deriving that
/// argument for every future command.
#[async_trait(?Send)]
pub(crate) trait CliCommand {
    fn capabilities(&self) -> &'static [Capability];
    async fn run(&self, route: Route, network: NetworkAccess) -> CliResult<CommandOutput>;
}
