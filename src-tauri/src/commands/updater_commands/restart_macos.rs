use std::path::{Path, PathBuf};

#[cfg(target_os = "macos")]
use std::process::Command;

#[cfg(target_os = "macos")]
use tauri::{AppHandle, Manager};

/// Restarts the macOS app using LaunchServices without the -n flag to preserve
/// the Dock icon association after updates.
///
/// The standard `app.restart()` uses `open -n` which creates a new app instance,
/// causing a duplicate Dock icon after updates. This implementation uses `open`
/// without `-n` and spawns a helper that waits for this process to exit before
/// relaunching.
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

    // Get current process ID to wait for
    let current_pid = std::process::id();

    // Collect args before spawning (app.env() must not be called after cleanup)
    // Use into_iter() to own the args, not borrow from temporary
    let args: Vec<std::ffi::OsString> = app.env().args_os.into_iter().skip(1).collect();

    // Build the relaunch script that:
    // 1. Waits for this PID to exit (with 10s timeout)
    // 2. Relaunches via LaunchServices without -n flag
    // Pass bundle path, PID, and args as positional parameters to avoid injection.
    let relaunch_script = r#"
        bundle="$1"
        pid="$2"
        shift 2
        
        # Wait for the old process to exit (max 10 seconds)
        timeout=100
        while [ $timeout -gt 0 ] && kill -0 "$pid" 2>/dev/null; do
            sleep 0.1
            timeout=$((timeout - 1))
        done
        
        # Relaunch without -n to preserve Dock icon association
        if [ $# -gt 0 ]; then
            exec /usr/bin/open "$bundle" --args "$@"
        else
            exec /usr/bin/open "$bundle"
        fi
    "#;

    let mut cmd = Command::new("/bin/sh");
    cmd.arg("-c")
        .arg(relaunch_script)
        .arg("sh") // $0
        .arg(&bundle_path) // $1
        .arg(current_pid.to_string()) // $2
        .args(args) // $3+ - forward all args including non-UTF-8
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
}
