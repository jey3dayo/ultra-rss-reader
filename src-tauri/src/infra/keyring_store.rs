use crate::domain::error::{DomainError, DomainResult};
use crate::platform::{PlatformInfo, PlatformKind};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

const SERVICE: &str = "ultra-rss-reader";

// ---------------------------------------------------------------------------
// Dev file-based credential store (bypasses OS Keychain)
// ---------------------------------------------------------------------------

fn dev_credentials_path() -> Option<PathBuf> {
    let info = PlatformInfo::current();
    dev_credentials_path_for_platform(&info, |key| std::env::var(key).ok())
}

fn dev_credentials_path_for_platform<F>(info: &PlatformInfo, get_env: F) -> Option<PathBuf>
where
    F: Fn(&str) -> Option<String>,
{
    dev_credentials_path_for_platform_with_fs(info, get_env, Path::exists)
}

fn dev_credentials_path_for_platform_with_fs<F, E>(
    info: &PlatformInfo,
    get_env: F,
    file_exists: E,
) -> Option<PathBuf>
where
    F: Fn(&str) -> Option<String>,
    E: Fn(&Path) -> bool,
{
    if !info.capabilities.uses_dev_file_credentials {
        return None;
    }

    let preferred_path = dev_credentials_dir_for_kind_from_env(info.kind, |key| get_env(key))?
        .join("dev-credentials.json");
    if info.kind == PlatformKind::Windows {
        return Some(preferred_path);
    }

    let legacy_path = legacy_dev_credentials_path_from_env(|key| get_env(key));
    if let Some(legacy_path) = legacy_path {
        if legacy_path != preferred_path
            && file_exists(legacy_path.as_path())
            && !file_exists(preferred_path.as_path())
        {
            return Some(legacy_path);
        }
    }

    Some(preferred_path)
}

fn dev_credentials_dir_for_kind_from_env<F>(kind: PlatformKind, get_env: F) -> Option<PathBuf>
where
    F: Fn(&str) -> Option<String>,
{
    match kind {
        PlatformKind::Windows => {
            if let Some(local_app_data) = get_env("LOCALAPPDATA") {
                return Some(PathBuf::from(local_app_data).join("ultra-rss-reader"));
            }

            if let Some(user_profile) = get_env("USERPROFILE") {
                return Some(
                    PathBuf::from(user_profile)
                        .join("AppData")
                        .join("Local")
                        .join("ultra-rss-reader"),
                );
            }

            let home_drive = get_env("HOMEDRIVE");
            let home_path = get_env("HOMEPATH");
            if let (Some(home_drive), Some(home_path)) = (home_drive, home_path) {
                return Some(
                    PathBuf::from(format!("{home_drive}{home_path}"))
                        .join("AppData")
                        .join("Local")
                        .join("ultra-rss-reader"),
                );
            }
        }
        PlatformKind::Macos | PlatformKind::Linux | PlatformKind::Unknown => {
            if let Some(data_home) = get_env("XDG_DATA_HOME") {
                return Some(PathBuf::from(data_home).join("ultra-rss-reader"));
            }
        }
    }

    let home = get_env("HOME")?;
    Some(
        PathBuf::from(home)
            .join(".local")
            .join("share")
            .join("ultra-rss-reader"),
    )
}

fn legacy_dev_credentials_path_from_env<F>(get_env: F) -> Option<PathBuf>
where
    F: Fn(&str) -> Option<String>,
{
    let home = get_env("HOME")?;
    Some(
        PathBuf::from(home)
            .join(".local")
            .join("share")
            .join("ultra-rss-reader")
            .join("dev-credentials.json"),
    )
}

fn read_dev_store(path: &PathBuf) -> HashMap<String, String> {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_dev_store(path: &PathBuf, store: &HashMap<String, String>) -> DomainResult<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| DomainError::Keychain(format!("Failed to create dev store dir: {e}")))?;
    }
    let json = serde_json::to_string_pretty(store)
        .map_err(|e| DomainError::Keychain(format!("Failed to serialize dev store: {e}")))?;
    std::fs::write(path, &json)
        .map_err(|e| DomainError::Keychain(format!("Failed to write dev store: {e}")))?;
    // Restrict file permissions to owner-only (0600) on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let perms = std::fs::Permissions::from_mode(0o600);
        let _ = std::fs::set_permissions(path, perms);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// OS Keychain helpers
// ---------------------------------------------------------------------------

/// Delete a keychain entry via the `security` CLI, bypassing ACL restrictions
/// that prevent the keyring crate from deleting entries created by a differently-signed binary.
#[cfg(target_os = "macos")]
fn force_delete_keychain_entry(account_id: &str) {
    let _ = std::process::Command::new("security")
        .args(["delete-generic-password", "-s", SERVICE, "-a", account_id])
        .output();
}

#[cfg(not(target_os = "macos"))]
fn force_delete_keychain_entry(_account_id: &str) {}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

fn missing_password_error() -> DomainError {
    DomainError::Validation(
        "Password is not configured. Re-enter your password in account settings, save it, and try again.".to_string(),
    )
}

pub fn set_password(account_id: &str, password: &str) -> DomainResult<()> {
    if let Some(path) = dev_credentials_path() {
        let mut store = read_dev_store(&path);
        store.insert(account_id.to_string(), password.to_string());
        return write_dev_store(&path, &store);
    }

    let entry = keyring::Entry::new(SERVICE, account_id)
        .map_err(|e| DomainError::Keychain(format!("Failed to access credential store: {e}")))?;
    match entry.set_password(password) {
        Ok(()) => Ok(()),
        Err(_) => {
            // ACL mismatch from re-signed dev builds: force-delete via CLI, then retry
            force_delete_keychain_entry(account_id);
            entry
                .set_password(password)
                .map_err(|e| DomainError::Keychain(format!("Failed to save password: {e}")))
        }
    }
}

pub fn get_password(account_id: &str) -> DomainResult<String> {
    if let Some(path) = dev_credentials_path() {
        let store = read_dev_store(&path);
        return store
            .get(account_id)
            .cloned()
            .ok_or_else(missing_password_error);
    }

    let entry = keyring::Entry::new(SERVICE, account_id)
        .map_err(|e| DomainError::Keychain(format!("Failed to access credential store: {e}")))?;
    match entry.get_password() {
        Ok(password) => Ok(password),
        Err(keyring::Error::NoEntry) => Err(missing_password_error()),
        Err(e) => Err(DomainError::Keychain(format!(
            "Failed to retrieve password: {e}"
        ))),
    }
}

pub fn delete_password(account_id: &str) -> DomainResult<()> {
    if let Some(path) = dev_credentials_path() {
        let mut store = read_dev_store(&path);
        store.remove(account_id);
        return write_dev_store(&path, &store);
    }

    let entry = keyring::Entry::new(SERVICE, account_id)
        .map_err(|e| DomainError::Keychain(format!("Failed to access credential store: {e}")))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already gone, not an error
        Err(e) => Err(DomainError::Keychain(format!(
            "Failed to delete password: {e}"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        dev_credentials_dir_for_kind_from_env, dev_credentials_path_for_platform,
        dev_credentials_path_for_platform_with_fs,
    };
    use crate::domain::error::DomainError;
    use crate::platform::{platform_info_for_kind, PlatformKind};
    use std::collections::HashMap;
    use std::path::{Path, PathBuf};

    fn env_map(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs
            .iter()
            .map(|(key, value)| ((*key).to_string(), (*value).to_string()))
            .collect()
    }

    #[test]
    fn dev_credentials_dir_prefers_local_app_data_on_windows() {
        let env = env_map(&[
            ("LOCALAPPDATA", r"C:\Users\alice\AppData\Local"),
            ("USERPROFILE", r"C:\Users\alice"),
            ("HOME", r"C:\Users\alice"),
        ]);

        let path = dev_credentials_dir_for_kind_from_env(PlatformKind::Windows, |key| {
            env.get(key).cloned()
        });

        assert_eq!(
            path,
            Some(PathBuf::from(
                r"C:\Users\alice\AppData\Local\ultra-rss-reader"
            ))
        );
    }

    #[test]
    fn dev_credentials_dir_falls_back_to_user_profile_on_windows() {
        let env = env_map(&[
            ("USERPROFILE", r"C:\Users\alice"),
            ("HOME", r"C:\Users\alice"),
        ]);

        let path = dev_credentials_dir_for_kind_from_env(PlatformKind::Windows, |key| {
            env.get(key).cloned()
        });

        assert_eq!(
            path,
            Some(PathBuf::from(
                r"C:\Users\alice\AppData\Local\ultra-rss-reader"
            ))
        );
    }

    #[test]
    fn dev_credentials_dir_falls_back_to_home_drive_and_home_path_on_windows() {
        let env = env_map(&[
            ("HOMEDRIVE", "C:"),
            ("HOMEPATH", r"\Users\alice"),
            ("HOME", r"C:\Users\alice"),
        ]);

        let path = dev_credentials_dir_for_kind_from_env(PlatformKind::Windows, |key| {
            env.get(key).cloned()
        });

        assert_eq!(
            path,
            Some(PathBuf::from(
                r"C:\Users\alice\AppData\Local\ultra-rss-reader"
            ))
        );
    }

    #[test]
    fn dev_credentials_dir_prefers_xdg_data_home_on_linux() {
        let env = env_map(&[
            ("XDG_DATA_HOME", "/tmp/data-home"),
            ("HOME", "/Users/alice"),
        ]);

        let path =
            dev_credentials_dir_for_kind_from_env(PlatformKind::Linux, |key| env.get(key).cloned());

        assert_eq!(path, Some(PathBuf::from("/tmp/data-home/ultra-rss-reader")));
    }

    #[test]
    fn dev_credentials_dir_falls_back_to_home_on_unknown_platform() {
        let env = env_map(&[("HOME", "/Users/alice")]);

        let path = dev_credentials_dir_for_kind_from_env(PlatformKind::Unknown, |key| {
            env.get(key).cloned()
        });

        assert_eq!(
            path,
            Some(PathBuf::from("/Users/alice/.local/share/ultra-rss-reader"))
        );
    }

    #[test]
    fn dev_credentials_path_is_disabled_when_capability_is_off() {
        let info = platform_info_for_kind(PlatformKind::Windows);
        let env = env_map(&[
            ("ULTRA_RSS_DEV_CREDENTIALS", "1"),
            ("LOCALAPPDATA", r"C:\Users\alice\AppData\Local"),
        ]);

        let path = dev_credentials_path_for_platform(&info, |key| env.get(key).cloned());

        assert_eq!(path, None);
    }

    #[test]
    fn dev_credentials_path_uses_platform_dir_when_capability_is_on() {
        let mut info = platform_info_for_kind(PlatformKind::Linux);
        info.capabilities.uses_dev_file_credentials = true;
        let env = env_map(&[
            ("ULTRA_RSS_DEV_CREDENTIALS", "1"),
            ("XDG_DATA_HOME", "/tmp/data-home"),
            ("HOME", "/Users/alice"),
        ]);

        let path = dev_credentials_path_for_platform(&info, |key| env.get(key).cloned());

        assert_eq!(
            path,
            Some(PathBuf::from(
                "/tmp/data-home/ultra-rss-reader/dev-credentials.json"
            ))
        );
    }

    #[test]
    fn non_windows_uses_legacy_path_when_legacy_exists_and_preferred_is_missing() {
        let mut info = platform_info_for_kind(PlatformKind::Linux);
        info.capabilities.uses_dev_file_credentials = true;
        let env = env_map(&[
            ("ULTRA_RSS_DEV_CREDENTIALS", "1"),
            ("XDG_DATA_HOME", "/tmp/new-data-home"),
            ("HOME", "/Users/alice"),
        ]);
        let legacy = Path::new("/Users/alice/.local/share/ultra-rss-reader/dev-credentials.json");

        let path = dev_credentials_path_for_platform_with_fs(
            &info,
            |key| env.get(key).cloned(),
            |candidate| candidate == legacy,
        );

        assert_eq!(path, Some(legacy.to_path_buf()));
    }

    #[test]
    fn non_windows_keeps_preferred_path_when_preferred_exists() {
        let mut info = platform_info_for_kind(PlatformKind::Linux);
        info.capabilities.uses_dev_file_credentials = true;
        let env = env_map(&[
            ("ULTRA_RSS_DEV_CREDENTIALS", "1"),
            ("XDG_DATA_HOME", "/tmp/new-data-home"),
            ("HOME", "/Users/alice"),
        ]);
        let preferred = Path::new("/tmp/new-data-home/ultra-rss-reader/dev-credentials.json");
        let legacy = Path::new("/Users/alice/.local/share/ultra-rss-reader/dev-credentials.json");

        let path = dev_credentials_path_for_platform_with_fs(
            &info,
            |key| env.get(key).cloned(),
            |candidate| candidate == preferred || candidate == legacy,
        );

        assert_eq!(path, Some(preferred.to_path_buf()));
    }

    #[test]
    fn windows_keeps_preferred_path_even_if_legacy_file_exists() {
        let mut info = platform_info_for_kind(PlatformKind::Windows);
        info.capabilities.uses_dev_file_credentials = true;
        let env = env_map(&[
            ("ULTRA_RSS_DEV_CREDENTIALS", "1"),
            ("LOCALAPPDATA", r"C:\Users\alice\AppData\Local"),
            ("HOME", r"C:\Users\alice"),
        ]);

        let path = dev_credentials_path_for_platform_with_fs(
            &info,
            |key| env.get(key).cloned(),
            |_candidate| true,
        );

        assert_eq!(
            path,
            Some(PathBuf::from(
                r"C:\Users\alice\AppData\Local\ultra-rss-reader\dev-credentials.json"
            ))
        );
    }

    #[test]
    fn missing_password_error_guides_user_to_reenter_credentials() {
        let error = super::missing_password_error();

        assert!(matches!(error, DomainError::Validation(_)));
        assert_eq!(
            error.to_string(),
            "Validation error: Password is not configured. Re-enter your password in account settings, save it, and try again."
        );
    }
}
