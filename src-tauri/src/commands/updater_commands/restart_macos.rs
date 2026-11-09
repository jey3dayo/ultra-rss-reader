use std::path::{Path, PathBuf};

#[cfg(any(target_os = "macos", all(test, unix)))]
use std::ffi::OsString;

#[cfg(target_os = "macos")]
use std::process::Command;

#[cfg(target_os = "macos")]
use tauri::{AppHandle, Manager};

#[cfg(any(target_os = "macos", all(test, unix)))]
const RELAUNCH_SCRIPT: &str = r#"
bundle="$1"
pid="$2"
bundle_id="$3"
log_path="$4"
open_command="$5"
lsappinfo_command="$6"
sleep_command="$7"
pid_polls="$8"
ls_polls="$9"
shift 9
open_attempts="$1"
poll_delay="$2"
retry_delay="$3"
shift 3

log() {
    if [ -n "$log_path" ]; then
        printf '%s %s\n' "$(/bin/date '+%Y-%m-%dT%H:%M:%S%z' 2>/dev/null)" "$*" 2>/dev/null >> "$log_path" || :
    fi
}

if [ -n "$log_path" ] && [ -f "$log_path" ]; then
    log_size=$(/usr/bin/wc -c 2>/dev/null < "$log_path")
    if [ "${log_size:-0}" -gt 262144 ] 2>/dev/null; then
        printf '' 2>/dev/null > "$log_path" || :
    fi
fi
log "relaunch helper started; pid=$pid"

remaining="$pid_polls"
while [ "$remaining" -gt 0 ] && kill -0 "$pid" 2>/dev/null; do
    "$sleep_command" "$poll_delay"
    remaining=$((remaining - 1))
done
if kill -0 "$pid" 2>/dev/null; then
    log "PID wait exhausted"
else
    log "PID exited"
fi

# LaunchServices can retain the registration after the process has exited.
remaining="$ls_polls"
while [ "$remaining" -gt 0 ]; do
    registration=$("$lsappinfo_command" find "bundleid=$bundle_id" 2>/dev/null)
    status=$?
    if [ "$status" -ne 0 ]; then
        log "LaunchServices wait skipped; lsappinfo exit=$status"
        break
    fi
    if [ -z "$registration" ]; then
        log "LaunchServices registration cleared"
        break
    fi
    "$sleep_command" "$poll_delay"
    remaining=$((remaining - 1))
done
if [ "$remaining" -eq 0 ]; then
    log "LaunchServices wait exhausted"
fi

launch() {
    if [ "$mode" = fallback ]; then
        set -- -n "$bundle" "$@"
    else
        set -- "$bundle" "$@"
    fi
    output=$("$open_command" "$@" 2>&1)
    status=$?
    log "open mode=$mode attempt=$attempt exit=$status"
    if [ -n "$output" ]; then
        log "$output"
    fi
    return "$status"
}

# An empty argument list must not introduce --args.
if [ "$#" -gt 0 ]; then
    set -- --args "$@"
fi
mode=normal
attempt=1
while [ "$attempt" -le "$open_attempts" ]; do
    if launch "$@"; then
        log "relaunch succeeded"
        exit 0
    fi
    if [ "$attempt" -lt "$open_attempts" ]; then
        "$sleep_command" "$retry_delay"
    fi
    attempt=$((attempt + 1))
done

log "normal open attempts exhausted; trying -n fallback"
mode=fallback
attempt=1
launch "$@"
status=$?
log "relaunch finished; exit=$status"
exit "$status"
"#;

#[cfg(any(target_os = "macos", all(test, unix)))]
struct RelaunchOptions<'a> {
    open_command: &'a Path,
    lsappinfo_command: &'a Path,
    sleep_command: &'a Path,
    pid_polls: u32,
    ls_polls: u32,
    open_attempts: u32,
    poll_delay: &'a str,
    retry_delay: &'a str,
}

#[cfg(any(target_os = "macos", all(test, unix)))]
impl Default for RelaunchOptions<'_> {
    fn default() -> Self {
        Self {
            open_command: Path::new("/usr/bin/open"),
            lsappinfo_command: Path::new("/usr/bin/lsappinfo"),
            sleep_command: Path::new("/bin/sleep"),
            pid_polls: 100,
            ls_polls: 30,
            open_attempts: 5,
            poll_delay: "0.1",
            retry_delay: "0.5",
        }
    }
}

#[cfg(any(target_os = "macos", all(test, unix)))]
fn relaunch_arguments(
    bundle: &Path,
    pid: u32,
    bundle_id: &str,
    log_path: Option<&Path>,
    args: &[OsString],
    options: &RelaunchOptions<'_>,
) -> Vec<OsString> {
    let mut parameters = vec![
        OsString::from("-c"),
        OsString::from(RELAUNCH_SCRIPT),
        OsString::from("relaunch-helper"),
        bundle.as_os_str().to_owned(),
        OsString::from(pid.to_string()),
        OsString::from(bundle_id),
        log_path.map_or_else(OsString::new, |path| path.as_os_str().to_owned()),
        options.open_command.as_os_str().to_owned(),
        options.lsappinfo_command.as_os_str().to_owned(),
        options.sleep_command.as_os_str().to_owned(),
        OsString::from(options.pid_polls.to_string()),
        OsString::from(options.ls_polls.to_string()),
        OsString::from(options.open_attempts.to_string()),
        OsString::from(options.poll_delay),
        OsString::from(options.retry_delay),
    ];
    parameters.extend_from_slice(args);
    parameters
}

/// Restarts through LaunchServices, preferring reuse of the existing Dock icon.
#[cfg(target_os = "macos")]
pub fn restart_preserving_dock_icon(app: &AppHandle) -> ! {
    use std::os::unix::process::CommandExt;

    // Gather all info before spawning or running cleanup
    let current_exe = match tauri::utils::platform::current_exe() {
        Ok(exe) => exe,
        Err(e) => {
            tracing::error!("failed to get current exe path: {e}");
            app.restart()
        }
    };

    let Some(bundle_path) = find_app_bundle(&current_exe) else {
        tracing::warn!(
            "could not determine .app bundle path from {}; using fallback restart",
            current_exe.display()
        );
        app.restart()
    };

    let current_pid = std::process::id();

    // Collect args before spawning (app.env() must not be called after cleanup)
    let args: Vec<std::ffi::OsString> = app.env().args_os.into_iter().skip(1).collect();

    let log_path = match app.path().app_log_dir() {
        Ok(directory) => match std::fs::create_dir_all(&directory) {
            Ok(()) => Some(directory.join("relaunch.log")),
            Err(error) => {
                tracing::warn!("failed to create relaunch log directory: {error}");
                None
            }
        },
        Err(error) => {
            tracing::warn!("failed to resolve relaunch log directory: {error}");
            None
        }
    };

    let mut cmd = Command::new("/bin/sh");
    cmd.args(relaunch_arguments(
        &bundle_path,
        current_pid,
        &app.config().identifier,
        log_path.as_deref(),
        &args,
        &RelaunchOptions::default(),
    ))
    .stdin(std::process::Stdio::null())
    .stdout(std::process::Stdio::null())
    .stderr(std::process::Stdio::null())
    .process_group(0); // Create new process group

    match cmd.spawn() {
        Ok(_) => {
            tracing::debug!(
                "spawned relaunch helper (waiting for PID {} to exit) for {}",
                current_pid,
                bundle_path.display()
            );
            // Only run cleanup after successful spawn
            app.cleanup_before_exit();
            std::process::exit(0);
        }
        Err(e) => {
            tracing::error!("failed to spawn relaunch helper: {e}; falling back to app.restart()");
            app.restart()
        }
    }
}

/// Finds the .app bundle path from a binary path.
/// Returns the path to the .app directory (e.g., /Applications/Ultra RSS Reader.app).
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn find_app_bundle(binary_path: &Path) -> Option<PathBuf> {
    let mut current = binary_path;

    // Walk up the directory tree to find the .app bundle
    while let Some(parent) = current.parent() {
        // Check if this directory is the Contents/MacOS directory
        if let Some(dir_name) = parent.file_name() {
            if dir_name == "MacOS" {
                // We're in Contents/MacOS, so go up to Contents, then to the .app
                if let Some(contents) = parent.parent() {
                    if let Some(contents_name) = contents.file_name() {
                        if contents_name == "Contents" {
                            // The parent of Contents is the .app bundle
                            if let Some(app_bundle) = contents.parent() {
                                return Some(app_bundle.to_path_buf());
                            }
                        }
                    }
                }
            }
        }
        current = parent;
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn find_app_bundle_returns_correct_path() {
        let binary_path =
            Path::new("/Applications/Ultra RSS Reader.app/Contents/MacOS/ultra-rss-reader");
        let bundle = find_app_bundle(binary_path);
        assert_eq!(
            bundle,
            Some(PathBuf::from("/Applications/Ultra RSS Reader.app"))
        );
    }

    #[test]
    fn find_app_bundle_returns_none_for_non_bundle() {
        let binary_path = Path::new("/usr/bin/some-binary");
        let bundle = find_app_bundle(binary_path);
        assert_eq!(bundle, None);
    }

    #[cfg(unix)]
    mod helper {
        use super::*;
        use std::os::unix::{ffi::OsStrExt, ffi::OsStringExt, fs::PermissionsExt};
        use std::process::{Command, Output};

        struct Fixture {
            directory: tempfile::TempDir,
            open: PathBuf,
            lsappinfo: PathBuf,
            sleep: PathBuf,
            bundle: PathBuf,
            log: PathBuf,
        }

        impl Fixture {
            fn new() -> Self {
                let directory = tempfile::tempdir().expect("helper fixture directory should exist");
                let root = directory.path();
                let write_executable = |name: &str, script: &str| {
                    let path = root.join(name);
                    std::fs::write(&path, script).expect("helper stub should be written");
                    std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o700))
                        .expect("helper stub should be executable");
                    path
                };
                let open = write_executable(
                    "open stub",
                    r#"#!/bin/sh
count=0
if [ -f "$FIXTURE/open-count" ]; then read -r count < "$FIXTURE/open-count"; fi
count=$((count + 1))
printf '%s\n' "$count" > "$FIXTURE/open-count"
printf 'open\n' >> "$FIXTURE/events"
printf '%s\0' "$@" > "$FIXTURE/open-args-$count"
if [ "$count" -le "${OPEN_FAILURES:-0}" ]; then
    printf 'stub open failed\n' >&2
    exit 17
fi
"#,
                );
                let lsappinfo = write_executable(
                    "lsappinfo stub",
                    r#"#!/bin/sh
printf 'lsappinfo\n' >> "$FIXTURE/events"
printf '%s\0' "$@" > "$FIXTURE/ls-args"
if [ "${LS_FAIL:-0}" -ne 0 ]; then exit 23; fi
count=0
if [ -f "$FIXTURE/ls-count" ]; then read -r count < "$FIXTURE/ls-count"; fi
count=$((count + 1))
printf '%s\n' "$count" > "$FIXTURE/ls-count"
if [ "$count" -le "${LS_REGISTERED_POLLS:-0}" ]; then printf 'ASN:0x0-0x123:'; fi
"#,
                );
                let sleep = write_executable(
                    "sleep stub",
                    "#!/bin/sh\nprintf 'sleep %s\\n' \"$1\" >> \"$FIXTURE/events\"\n",
                );
                Self {
                    open,
                    lsappinfo,
                    sleep,
                    bundle: root.join("Reader 'quoted' $(touch injected).app"),
                    log: root.join("relaunch log"),
                    directory,
                }
            }

            fn command(&self, pid: u32, args: &[OsString]) -> Command {
                let options = RelaunchOptions {
                    open_command: &self.open,
                    lsappinfo_command: &self.lsappinfo,
                    sleep_command: &self.sleep,
                    pid_polls: 3,
                    ls_polls: 3,
                    ..RelaunchOptions::default()
                };
                let mut command = Command::new("/bin/sh");
                command
                    .args(relaunch_arguments(
                        &self.bundle,
                        pid,
                        "test.reader",
                        Some(&self.log),
                        args,
                        &options,
                    ))
                    .env("FIXTURE", self.directory.path())
                    .current_dir(self.directory.path());
                command
            }

            fn read(&self, name: &str) -> String {
                std::fs::read_to_string(self.directory.path().join(name))
                    .expect("helper output fixture should be readable")
            }

            fn log(&self) -> String {
                std::fs::read_to_string(&self.log).expect("helper should write diagnostic log")
            }

            fn assert_open_args(&self, attempt: u32, expected: &[OsString]) {
                let actual =
                    std::fs::read(self.directory.path().join(format!("open-args-{attempt}")))
                        .expect("open stub should record arguments");
                let expected: Vec<_> = expected
                    .iter()
                    .flat_map(|arg| arg.as_bytes().iter().copied().chain([0]))
                    .collect();
                assert_eq!(actual, expected);
            }
        }

        fn run(command: &mut Command) -> Output {
            command.output().expect("helper fixture shell should start")
        }

        #[test]
        fn argument_builder_keeps_script_constant_and_production_bounds() {
            let args = relaunch_arguments(
                Path::new("/Reader 'quoted'.app"),
                42,
                "reader.$(bundle)",
                None,
                &[OsString::from("forwarded")],
                &RelaunchOptions::default(),
            );
            assert_eq!(args[1], RELAUNCH_SCRIPT);
            assert_eq!(
                &args[3..],
                [
                    "/Reader 'quoted'.app",
                    "42",
                    "reader.$(bundle)",
                    "",
                    "/usr/bin/open",
                    "/usr/bin/lsappinfo",
                    "/bin/sleep",
                    "100",
                    "30",
                    "5",
                    "0.1",
                    "0.5",
                    "forwarded",
                ]
                .map(OsString::from)
            );
        }

        #[test]
        fn arguments_are_data_and_non_utf8_is_forwarded_unchanged() {
            let fixture = Fixture::new();
            let args = vec![
                OsString::from("two words"),
                OsString::from("'\"; $(touch injected)"),
                OsString::new(),
                OsString::from_vec(vec![b'x', 0xff]),
            ];
            let output = run(&mut fixture.command(i32::MAX as u32, &args));
            assert!(output.status.success(), "{output:?}");
            let mut expected = vec![fixture.bundle.clone().into_os_string(), "--args".into()];
            expected.extend(args);
            fixture.assert_open_args(1, &expected);
            assert!(!fixture.directory.path().join("injected").exists());
            assert!(!fixture.log().contains("touch injected"));
        }

        #[test]
        fn no_arguments_omits_args_separator_and_stops_on_first_success() {
            let fixture = Fixture::new();
            assert!(run(&mut fixture.command(i32::MAX as u32, &[]))
                .status
                .success());
            fixture.assert_open_args(1, &[fixture.bundle.clone().into_os_string()]);
            assert_eq!(fixture.read("open-count"), "1\n");
            assert!(fixture.log().contains("relaunch succeeded"));
        }

        #[test]
        fn pid_and_launchservices_waits_are_ordered_and_bounded() {
            let fixture = Fixture::new();
            let output = run(fixture
                .command(std::process::id(), &[])
                .env("LS_REGISTERED_POLLS", "9"));
            assert!(output.status.success());
            assert_eq!(
                fixture.read("events"),
                "sleep 0.1\nsleep 0.1\nsleep 0.1\nlsappinfo\nsleep 0.1\nlsappinfo\nsleep 0.1\nlsappinfo\nsleep 0.1\nopen\n"
            );
            let log = fixture.log();
            assert!(log.contains("PID wait exhausted"));
            assert!(log.contains("LaunchServices wait exhausted"));
        }

        #[test]
        fn waits_for_launchservices_registration_to_clear() {
            let fixture = Fixture::new();
            let output = run(fixture
                .command(i32::MAX as u32, &[])
                .env("LS_REGISTERED_POLLS", "2"));
            assert!(output.status.success());
            assert_eq!(
                fixture.read("events"),
                "lsappinfo\nsleep 0.1\nlsappinfo\nsleep 0.1\nlsappinfo\nopen\n"
            );
            assert_eq!(
                std::fs::read(fixture.directory.path().join("ls-args")).unwrap(),
                b"find\0bundleid=test.reader\0"
            );
            assert!(fixture
                .log()
                .contains("LaunchServices registration cleared"));
        }

        #[test]
        fn lsappinfo_failure_skips_wait_and_launches() {
            let fixture = Fixture::new();
            assert!(
                run(fixture.command(i32::MAX as u32, &[]).env("LS_FAIL", "1"))
                    .status
                    .success()
            );
            assert_eq!(fixture.read("events"), "lsappinfo\nopen\n");
            assert!(fixture.log().contains("lsappinfo exit=23"));
        }

        #[test]
        fn missing_lsappinfo_still_launches() {
            let fixture = Fixture::new();
            std::fs::remove_file(&fixture.lsappinfo).expect("lsappinfo fixture should be removed");
            assert!(run(&mut fixture.command(i32::MAX as u32, &[]))
                .status
                .success());
            assert_eq!(fixture.read("events"), "open\n");
            assert!(fixture.log().contains("lsappinfo exit=127"));
        }

        #[test]
        fn retries_normal_open_and_stops_before_fallback_on_success() {
            let fixture = Fixture::new();
            assert!(run(fixture
                .command(i32::MAX as u32, &[])
                .env("OPEN_FAILURES", "2"))
            .status
            .success());
            assert_eq!(fixture.read("open-count"), "3\n");
            assert_eq!(
                fixture.read("events"),
                "lsappinfo\nopen\nsleep 0.5\nopen\nsleep 0.5\nopen\n"
            );
            fixture.assert_open_args(3, &[fixture.bundle.clone().into_os_string()]);
            let log = fixture.log();
            assert!(log.contains("open mode=normal attempt=1 exit=17"));
            assert!(log.contains("stub open failed"));
            assert!(log.contains("open mode=normal attempt=3 exit=0"));
            assert!(!log.contains("fallback"));
        }

        #[test]
        fn exhausted_normal_attempts_use_one_fallback_and_preserve_arguments() {
            let fixture = Fixture::new();
            let args = vec![OsString::from("--reader argument")];
            assert!(run(fixture
                .command(i32::MAX as u32, &args)
                .env("OPEN_FAILURES", "5"))
            .status
            .success());
            assert_eq!(fixture.read("open-count"), "6\n");
            fixture.assert_open_args(
                5,
                &[
                    fixture.bundle.clone().into_os_string(),
                    "--args".into(),
                    args[0].clone(),
                ],
            );
            fixture.assert_open_args(
                6,
                &[
                    "-n".into(),
                    fixture.bundle.clone().into_os_string(),
                    "--args".into(),
                    args[0].clone(),
                ],
            );
            assert!(fixture
                .log()
                .contains("open mode=fallback attempt=1 exit=0"));
        }

        #[test]
        fn final_failure_returns_status_and_logs_it() {
            let fixture = Fixture::new();
            let output = run(fixture
                .command(i32::MAX as u32, &[])
                .env("OPEN_FAILURES", "99"));
            assert_eq!(output.status.code(), Some(17));
            assert_eq!(fixture.read("open-count"), "6\n");
            fixture.assert_open_args(6, &["-n".into(), fixture.bundle.clone().into_os_string()]);
            assert!(fixture.log().contains("relaunch finished; exit=17"));
        }

        #[test]
        fn oversized_log_is_truncated_before_new_diagnostics() {
            let fixture = Fixture::new();
            std::fs::write(&fixture.log, vec![b'x'; 262145])
                .expect("large log fixture should be written");
            assert!(run(&mut fixture.command(i32::MAX as u32, &[]))
                .status
                .success());
            let log = fixture.log();
            assert!(log
                .lines()
                .next()
                .is_some_and(|line| line.ends_with(" relaunch helper started; pid=2147483647")));
            assert!(log.len() < 262144);
        }

        #[test]
        fn log_below_limit_is_appended() {
            let fixture = Fixture::new();
            std::fs::write(&fixture.log, "previous log\n")
                .expect("existing log fixture should be written");
            assert!(run(&mut fixture.command(i32::MAX as u32, &[]))
                .status
                .success());
            let log = fixture.log();
            assert!(log.starts_with("previous log\n"));
            assert!(log.contains(" relaunch helper started; pid="));
        }

        #[test]
        fn unusable_log_path_does_not_prevent_relaunch_or_retry() {
            let mut fixture = Fixture::new();
            fixture.log = fixture
                .directory
                .path()
                .join("missing directory/relaunch.log");
            assert!(run(fixture
                .command(i32::MAX as u32, &[])
                .env("OPEN_FAILURES", "5"))
            .status
            .success());
            assert_eq!(fixture.read("open-count"), "6\n");
        }
    }
}
