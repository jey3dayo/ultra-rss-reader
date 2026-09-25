use async_trait::async_trait;
use serde_json::json;

use crate::cli::command::{CliCommand, CommandOutput};
use crate::cli::error::CliResult;
use crate::cli::paths;
use crate::cli::route::{Capability, NetworkAccess, Route};

const CAPABILITIES: &[Capability] = &[];

/// No DB involved: declares no capabilities, routed as `Route::None`.
/// `identifier` is resolved by the dispatcher and passed in at construction.
pub(crate) struct LogPathCommand {
    identifier: &'static str,
}

impl LogPathCommand {
    pub(crate) fn new(identifier: &'static str) -> Self {
        Self { identifier }
    }
}

#[async_trait(?Send)]
impl CliCommand for LogPathCommand {
    fn capabilities(&self) -> &'static [Capability] {
        CAPABILITIES
    }

    async fn run(&self, _route: Route, _network: NetworkAccess) -> CliResult<CommandOutput> {
        let log_dir = paths::app_log_dir(self.identifier)?;
        let human = log_dir.display().to_string();
        let json_data = json!({ "log_dir": log_dir.display().to_string() });

        Ok(CommandOutput {
            human,
            json_data,
            exit_code: None,
        })
    }
}
