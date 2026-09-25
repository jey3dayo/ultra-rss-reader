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

fn unresolvable_dir_error(what: &str) -> CliError {
    CliError::failed(format!(
        "cannot resolve the application {what} directory; pass --db to specify the database path directly"
    ))
}

/// Mirrors Tauri's `PathResolver::app_data_dir` (tauri 2.11.5 `src/path/desktop.rs`): `dirs::data_dir()/<identifier>`.
pub(crate) fn app_data_dir(identifier: &str) -> Result<PathBuf, CliError> {
    Ok(dirs::data_dir()
        .ok_or_else(|| unresolvable_dir_error("data"))?
        .join(identifier))
}

/// Mirrors Tauri's `PathResolver::app_log_dir` on macOS (tauri 2.11.5 `src/path/desktop.rs`): `dirs::home_dir()/Library/Logs/<identifier>`.
#[cfg(target_os = "macos")]
pub(crate) fn app_log_dir(identifier: &str) -> Result<PathBuf, CliError> {
    Ok(dirs::home_dir()
        .ok_or_else(|| unresolvable_dir_error("log"))?
        .join("Library/Logs")
        .join(identifier))
}

/// Mirrors Tauri's `PathResolver::app_log_dir` on non-macOS (tauri 2.11.5 `src/path/desktop.rs`): `dirs::data_local_dir()/<identifier>/logs`.
#[cfg(not(target_os = "macos"))]
pub(crate) fn app_log_dir(identifier: &str) -> Result<PathBuf, CliError> {
    Ok(dirs::data_local_dir()
        .ok_or_else(|| unresolvable_dir_error("log"))?
        .join(identifier)
        .join("logs"))
}

pub(crate) fn default_db_path(profile: Profile) -> Result<PathBuf, CliError> {
    Ok(app_data_dir(profile.identifier())?.join(DB_FILE_NAME))
}

/// Home directory for display-only path shortening; unlike `app_data_dir`,
/// a missing value just disables shortening instead of erroring.
pub(crate) fn home_dir_for_display() -> Option<PathBuf> {
    dirs::home_dir()
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

    #[test]
    fn app_data_dir_matches_tauris_app_data_dir_rule() {
        let resolved = app_data_dir("com.example.test").expect("app_data_dir should resolve");
        let expected = dirs::data_dir()
            .expect("dirs::data_dir should resolve while running tests")
            .join("com.example.test");
        assert_eq!(resolved, expected);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn app_log_dir_matches_tauris_macos_app_log_dir_rule() {
        let resolved = app_log_dir("com.example.test").expect("app_log_dir should resolve");
        let expected = dirs::home_dir()
            .expect("dirs::home_dir should resolve while running tests")
            .join("Library/Logs")
            .join("com.example.test");
        assert_eq!(resolved, expected);
    }

    #[cfg(not(target_os = "macos"))]
    #[test]
    fn app_log_dir_matches_tauris_non_macos_app_log_dir_rule() {
        let resolved = app_log_dir("com.example.test").expect("app_log_dir should resolve");
        let expected = dirs::data_local_dir()
            .expect("dirs::data_local_dir should resolve while running tests")
            .join("com.example.test")
            .join("logs");
        assert_eq!(resolved, expected);
    }

    #[test]
    fn default_db_path_joins_the_db_file_name() {
        let resolved = default_db_path(Profile::Prod).expect("default_db_path should resolve");
        let expected = app_data_dir(PROD_IDENTIFIER)
            .expect("app_data_dir should resolve")
            .join(DB_FILE_NAME);
        assert_eq!(resolved, expected);
    }
}
