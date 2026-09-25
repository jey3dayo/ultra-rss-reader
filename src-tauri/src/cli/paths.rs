use std::path::PathBuf;

use super::error::CliError;

/// Matches `tauri.conf.json`'s `identifier`.
pub(crate) const PROD_IDENTIFIER: &str = "com.jey3dayo.ultra-rss-reader";
/// Matches `tauri.dev.conf.json`'s `identifier`.
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

/// Shared wording for a missing HOME/APPDATA/LOCALAPPDATA error, so every
/// caller points the user to the same next step.
fn missing_env_var_error(name: &str) -> CliError {
    CliError::failed(format!(
        "environment variable {name} is not set; pass --db to specify the database path directly"
    ))
}

fn required_env_path(name: &str) -> Result<PathBuf, CliError> {
    std::env::var_os(name)
        .map(PathBuf::from)
        .filter(|path| !path.as_os_str().is_empty())
        .ok_or_else(|| missing_env_var_error(name))
}

/// Matches `dirs::data_dir` on macOS: `$HOME/Library/Application Support`.
#[cfg(target_os = "macos")]
pub(crate) fn app_data_dir(identifier: &str) -> Result<PathBuf, CliError> {
    Ok(required_env_path("HOME")?
        .join("Library/Application Support")
        .join(identifier))
}

/// Matches `dirs::data_dir` on Windows: `%APPDATA%`.
#[cfg(windows)]
pub(crate) fn app_data_dir(identifier: &str) -> Result<PathBuf, CliError> {
    Ok(required_env_path("APPDATA")?.join(identifier))
}

#[cfg(all(unix, not(target_os = "macos")))]
pub(crate) fn app_data_dir(identifier: &str) -> Result<PathBuf, CliError> {
    Ok(xdg_data_home()?.join(identifier))
}

/// Matches `dirs`' log dir on macOS: `$HOME/Library/Logs`, a different base
/// than `app_data_dir`.
#[cfg(target_os = "macos")]
pub(crate) fn app_log_dir(identifier: &str) -> Result<PathBuf, CliError> {
    Ok(required_env_path("HOME")?
        .join("Library/Logs")
        .join(identifier))
}

/// Matches `dirs`' log dir on Windows: `%LOCALAPPDATA%/<identifier>/logs`.
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

/// Matches `dirs::data_dir` on Linux: `XDG_DATA_HOME` only if absolute,
/// otherwise `$HOME/.local/share`.
///
/// Takes explicit `Option<&str>` env values instead of reading
/// `std::env::var` directly so tests can inject values without mutating the
/// real process environment.
///
/// Also compiled under `test`: its only non-test caller is unix/non-macOS
/// gated, so this would otherwise be dead code on every other target.
#[cfg(any(all(unix, not(target_os = "macos")), test))]
fn xdg_data_home_from_env(
    xdg_data_home: Option<&str>,
    home: Option<&str>,
) -> Result<PathBuf, CliError> {
    if let Some(candidate) = xdg_data_home
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .filter(|path| path.is_absolute())
    {
        return Ok(candidate);
    }

    let home = home
        .filter(|value| !value.is_empty())
        .ok_or_else(|| missing_env_var_error("HOME"))?;
    Ok(PathBuf::from(home).join(".local/share"))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn xdg_data_home() -> Result<PathBuf, CliError> {
    xdg_data_home_from_env(
        std::env::var("XDG_DATA_HOME").ok().as_deref(),
        std::env::var("HOME").ok().as_deref(),
    )
}

pub(crate) fn default_db_path(profile: Profile) -> Result<PathBuf, CliError> {
    Ok(app_data_dir(profile.identifier())?.join(DB_FILE_NAME))
}

/// Home directory for display-only path shortening; unlike `app_data_dir`,
/// a missing value just disables shortening instead of erroring.
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

    #[test]
    fn linux_xdg_data_home_ignores_a_relative_value() {
        let resolved = xdg_data_home_from_env(Some("relative/xdg-data"), Some("/home/example"))
            .expect("HOME fallback should resolve");
        assert_eq!(
            resolved,
            PathBuf::from("/home/example/.local/share"),
            "a relative XDG_DATA_HOME must be ignored, falling back to $HOME/.local/share"
        );
    }

    #[test]
    fn xdg_data_home_uses_an_absolute_value_when_set() {
        let resolved = xdg_data_home_from_env(Some("/mnt/data"), Some("/home/example"))
            .expect("absolute XDG_DATA_HOME should resolve");
        assert_eq!(resolved, PathBuf::from("/mnt/data"));
    }

    #[test]
    fn xdg_data_home_ignores_an_empty_value() {
        let resolved = xdg_data_home_from_env(Some(""), Some("/home/example"))
            .expect("HOME fallback should resolve");
        assert_eq!(resolved, PathBuf::from("/home/example/.local/share"));
    }

    #[test]
    fn xdg_data_home_errors_with_db_flag_guidance_when_home_is_missing() {
        let error = xdg_data_home_from_env(None, None)
            .expect_err("missing HOME with no XDG_DATA_HOME should be a clear error");
        assert!(error.message.contains("HOME"));
        assert!(error.message.contains("--db"));
    }
}
