use std::path::PathBuf;

use super::error::CliError;

/// Matches `tauri.conf.json`'s `identifier`. Pinned against that file in
/// `identifiers_match_tauri_conf_json`.
pub(crate) const PROD_IDENTIFIER: &str = "com.jey3dayo.ultra-rss-reader";
/// Matches `tauri.dev.conf.json`'s `identifier`. Pinned against that file in
/// `identifiers_match_tauri_dev_conf_json`.
pub(crate) const DEV_IDENTIFIER: &str = "com.ultra-rss-reader.dev";

/// See `lib.rs`'s `db_path` construction (`app_data_dir.join("ultra-rss-reader.db")`).
pub(crate) const DB_FILE_NAME: &str = "ultra-rss-reader.db";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Profile {
    Prod,
    Dev,
}

impl Profile {
    pub(crate) fn identifier(self) -> &'static str {
        match self {
            Self::Prod => PROD_IDENTIFIER,
            Self::Dev => DEV_IDENTIFIER,
        }
    }

    pub(crate) fn label(self) -> &'static str {
        match self {
            Self::Prod => "prod",
            Self::Dev => "dev",
        }
    }
}

fn required_env_path(name: &str) -> Result<PathBuf, CliError> {
    std::env::var_os(name)
        .map(PathBuf::from)
        .filter(|path| !path.as_os_str().is_empty())
        .ok_or_else(|| CliError::failed(format!("environment variable {name} is not set")))
}

/// Mirrors Tauri 2's `PathResolver::app_data_dir` (`tauri-2.11.5/src/path/desktop.rs`):
/// `dirs::data_dir().join(identifier)`, which on macOS/Windows/Linux resolves to
/// `$HOME/Library/Application Support`, `%APPDATA%`, and `$XDG_DATA_HOME` (or
/// `$HOME/.local/share`) respectively. Re-implemented without the `dirs` crate
/// per this task's dependency constraint (only `clap` may be added).
#[cfg(target_os = "macos")]
pub(crate) fn app_data_dir(identifier: &str) -> Result<PathBuf, CliError> {
    Ok(required_env_path("HOME")?
        .join("Library/Application Support")
        .join(identifier))
}

#[cfg(windows)]
pub(crate) fn app_data_dir(identifier: &str) -> Result<PathBuf, CliError> {
    Ok(required_env_path("APPDATA")?.join(identifier))
}

#[cfg(all(unix, not(target_os = "macos")))]
pub(crate) fn app_data_dir(identifier: &str) -> Result<PathBuf, CliError> {
    Ok(xdg_data_home()?.join(identifier))
}

/// Mirrors Tauri 2's `PathResolver::app_log_dir`: macOS uses
/// `$HOME/Library/Logs/<identifier>` (a different base than `app_data_dir`),
/// while Windows and other Unix resolve to `<local-data-dir>/<identifier>/logs`.
#[cfg(target_os = "macos")]
pub(crate) fn app_log_dir(identifier: &str) -> Result<PathBuf, CliError> {
    Ok(required_env_path("HOME")?
        .join("Library/Logs")
        .join(identifier))
}

#[cfg(windows)]
pub(crate) fn app_log_dir(identifier: &str) -> Result<PathBuf, CliError> {
    Ok(required_env_path("LOCALAPPDATA")?
        .join(identifier)
        .join("logs"))
}

#[cfg(all(unix, not(target_os = "macos")))]
pub(crate) fn app_log_dir(identifier: &str) -> Result<PathBuf, CliError> {
    Ok(xdg_data_home()?.join(identifier).join("logs"))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn xdg_data_home() -> Result<PathBuf, CliError> {
    if let Ok(value) = std::env::var("XDG_DATA_HOME") {
        if !value.is_empty() {
            return Ok(PathBuf::from(value));
        }
    }
    Ok(required_env_path("HOME")?.join(".local/share"))
}

pub(crate) fn default_db_path(profile: Profile) -> Result<PathBuf, CliError> {
    Ok(app_data_dir(profile.identifier())?.join(DB_FILE_NAME))
}

/// The home directory used to shorten a displayed path to `~/...`. This is a
/// display-only convenience (design doc §5): unlike `app_data_dir`, it is not
/// part of any resolution contract, so a missing/unset value simply disables
/// shortening rather than becoming a hard error.
#[cfg(unix)]
pub(crate) fn home_dir_for_display() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

#[cfg(windows)]
pub(crate) fn home_dir_for_display() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE").map(PathBuf::from)
}

pub(crate) fn shorten_home_prefix(path: &std::path::Path) -> String {
    match home_dir_for_display() {
        Some(home) if !home.as_os_str().is_empty() => match path.strip_prefix(&home) {
            Ok(rest) if rest.as_os_str().is_empty() => "~".to_string(),
            Ok(rest) => format!("~/{}", rest.display()),
            Err(_) => path.display().to_string(),
        },
        _ => path.display().to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identifiers_match_tauri_conf_json() {
        let raw = include_str!("../../tauri.conf.json");
        let value: serde_json::Value =
            serde_json::from_str(raw).expect("tauri.conf.json should be valid JSON");
        assert_eq!(
            value["identifier"].as_str(),
            Some(PROD_IDENTIFIER),
            "PROD_IDENTIFIER should match tauri.conf.json's identifier"
        );
    }

    #[test]
    fn identifiers_match_tauri_dev_conf_json() {
        let raw = include_str!("../../tauri.dev.conf.json");
        let value: serde_json::Value =
            serde_json::from_str(raw).expect("tauri.dev.conf.json should be valid JSON");
        assert_eq!(
            value["identifier"].as_str(),
            Some(DEV_IDENTIFIER),
            "DEV_IDENTIFIER should match tauri.dev.conf.json's identifier"
        );
    }

    #[test]
    fn profile_label_is_lowercase() {
        assert_eq!(Profile::Prod.label(), "prod");
        assert_eq!(Profile::Dev.label(), "dev");
    }

    #[test]
    fn shorten_home_prefix_replaces_the_home_directory_with_a_tilde() {
        if let Some(home) = home_dir_for_display() {
            let path = home.join("Library/Application Support/example");
            let shortened = shorten_home_prefix(&path);
            assert!(shortened.starts_with('~'));
            assert!(!shortened.contains(home.to_string_lossy().as_ref()));
        }
    }

    #[test]
    fn shorten_home_prefix_leaves_unrelated_paths_untouched() {
        let path = std::path::Path::new("/var/db/example.db");
        assert_eq!(shorten_home_prefix(path), "/var/db/example.db");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_data_dir_uses_application_support() {
        let home = required_env_path("HOME").expect("HOME should be set while running tests");
        let resolved = app_data_dir("com.example.test").expect("app_data_dir should resolve");
        assert_eq!(
            resolved,
            home.join("Library/Application Support/com.example.test")
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_log_dir_uses_library_logs() {
        let home = required_env_path("HOME").expect("HOME should be set while running tests");
        let resolved = app_log_dir("com.example.test").expect("app_log_dir should resolve");
        assert_eq!(resolved, home.join("Library/Logs/com.example.test"));
    }

    #[cfg(windows)]
    #[test]
    fn windows_data_dir_uses_appdata() {
        let appdata =
            required_env_path("APPDATA").expect("APPDATA should be set while running tests");
        let resolved = app_data_dir("com.example.test").expect("app_data_dir should resolve");
        assert_eq!(resolved, appdata.join("com.example.test"));
    }

    #[cfg(windows)]
    #[test]
    fn windows_log_dir_uses_localappdata_logs() {
        let local_appdata = required_env_path("LOCALAPPDATA")
            .expect("LOCALAPPDATA should be set while running tests");
        let resolved = app_log_dir("com.example.test").expect("app_log_dir should resolve");
        assert_eq!(
            resolved,
            local_appdata.join("com.example.test").join("logs")
        );
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    #[test]
    fn linux_data_dir_prefers_xdg_data_home() {
        let resolved = app_data_dir("com.example.test").expect("app_data_dir should resolve");
        if let Ok(xdg) = std::env::var("XDG_DATA_HOME") {
            if !xdg.is_empty() {
                assert_eq!(resolved, PathBuf::from(xdg).join("com.example.test"));
                return;
            }
        }
        let home = required_env_path("HOME").expect("HOME should be set while running tests");
        assert_eq!(resolved, home.join(".local/share/com.example.test"));
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    #[test]
    fn linux_log_dir_is_under_the_data_dir() {
        let data = app_data_dir("com.example.test").expect("app_data_dir should resolve");
        let log = app_log_dir("com.example.test").expect("app_log_dir should resolve");
        assert_eq!(log, data.join("logs"));
    }
}
