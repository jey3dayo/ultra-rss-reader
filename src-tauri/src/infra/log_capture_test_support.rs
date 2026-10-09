//! `log::set_logger` is process-global, so log-line assertions run the test in a child process.

const CHILD_ENV: &str = "URR_LOG_CAPTURE_SCENARIO";
const LINE_PREFIX: &str = "LOGLINE ";

struct StdoutLogger;

impl log::Log for StdoutLogger {
    fn enabled(&self, metadata: &log::Metadata<'_>) -> bool {
        metadata.level() <= log::Level::Warn
    }

    fn log(&self, record: &log::Record<'_>) {
        if self.enabled(record.metadata()) {
            println!("{LINE_PREFIX}{}", record.args());
        }
    }

    fn flush(&self) {}
}

static STDOUT_LOGGER: StdoutLogger = StdoutLogger;

/// Returns the scenario name when running as the isolated child, with the capturing logger installed.
pub(crate) fn child_scenario() -> Option<String> {
    let scenario = std::env::var(CHILD_ENV).ok()?;
    log::set_logger(&STDOUT_LOGGER).expect("isolated child should install its logger");
    log::set_max_level(log::LevelFilter::Warn);
    Some(scenario)
}

/// `module_path` and `test_name` identify the calling test (`module_path!()` and its fn name).
pub(crate) fn run_in_isolated_process(
    module_path: &str,
    test_name: &str,
    scenario: &str,
) -> Vec<String> {
    let crate_relative_module = module_path
        .split_once("::")
        .expect("module path should include the crate name")
        .1;
    let output = std::process::Command::new(
        std::env::current_exe().expect("test binary path should be available"),
    )
    .arg("--exact")
    .arg(format!("{crate_relative_module}::{test_name}"))
    .arg("--nocapture")
    .env(CHILD_ENV, scenario)
    .output()
    .expect("isolated test subprocess should start");
    let stdout = String::from_utf8(output.stdout).expect("child stdout should be UTF-8");
    assert!(
        output.status.success() && stdout.contains("test result: ok. 1 passed; 0 failed;"),
        "scenario {scenario} should pass in the child: {stdout}{}",
        String::from_utf8_lossy(&output.stderr)
    );
    stdout
        .lines()
        .filter_map(|line| line.strip_prefix(LINE_PREFIX))
        .map(str::to_string)
        .collect()
}
