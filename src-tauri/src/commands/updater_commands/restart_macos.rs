use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::AppHandle;

/// Restarts the macOS app using LaunchServices without the -n flag to preserve
/// the Dock icon association after updates.
///
/// The standard `app.restart()` uses `open -n` which creates a new app instance,
/// causing a duplicate Dock icon after updates. This implementation uses `open`
/// without `-n` and spawns a delayed relaunch helper to avoid that issue.
pub fn restart_preserving_dock_icon(app: &AppHandle) -> ! {
    use std::os::unix::process::CommandExt;

    let current_exe = match tauri::utils::platform::current_exe() {
        Ok(exe) => exe,
        Err(e) => {
            tracing::error!("failed to get current exe path: {e}");
            std::process::exit(1);
        }
    };

    if let Some(bundle_path) = find_app_bundle(&current_exe) {
        // Spawn a helper process that waits briefly for this process to exit,
        // then relaunches the app via LaunchServices (open without -n).
        // This preserves the Dock icon association.
        let relaunch_script = format!(
            "sleep 0.3 && /usr/bin/open '{}'",
            bundle_path.display()
        );

        match Command::new("/bin/sh")
            .arg("-c")
            .arg(&relaunch_script)
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .process_group(0) // Create new process group
            .spawn()
        {
            Ok(_) => {
                tracing::debug!("spawned delayed relaunch helper for {}", bundle_path.display());
            }
            Err(e) => {
                tracing::error!("failed to spawn relaunch helper: {e}");
            }
        }
    } else {
        tracing::warn!(
            "could not determine .app bundle path from {}; using fallback restart",
            current_exe.display()
        );
        // Fall back to Tauri's restart if we can't find the bundle
        return app.restart();
    }

    std::process::exit(0);
}

/// Finds the .app bundle path from a binary path.
/// Returns the path to the .app directory (e.g., /Applications/Ultra RSS Reader.app).
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
        let binary_path = Path::new("/Applications/Ultra RSS Reader.app/Contents/MacOS/ultra-rss-reader");
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
