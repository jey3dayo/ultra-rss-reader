use crate::platform::{PlatformInfo, PlatformKind};
use std::path::{Path, PathBuf};

pub(super) fn dev_credentials_path() -> Option<PathBuf> {
    let info = PlatformInfo::current();
    dev_credentials_path_for_platform(&info, |key| std::env::var(key).ok())
}

pub(super) fn dev_credentials_path_for_platform<F>(
    info: &PlatformInfo,
    get_env: F,
) -> Option<PathBuf>
where
    F: Fn(&str) -> Option<String>,
{
    dev_credentials_path_for_platform_with_fs(info, get_env, Path::exists)
}

pub(super) fn dev_credentials_path_for_platform_with_fs<F, E>(
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

    let preferred_dir = dev_credentials_dir_for_kind_from_env(info.kind, |key| get_env(key))?;
    let preferred_path = match info.kind {
        PlatformKind::Windows => join_platform_path(
            info.kind,
            preferred_dir.to_string_lossy().as_ref(),
            &["dev-credentials.json"],
        ),
        PlatformKind::Macos | PlatformKind::Linux | PlatformKind::Unknown => {
            preferred_dir.join("dev-credentials.json")
        }
    };
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

pub(super) fn dev_credentials_dir_for_kind_from_env<F>(
    kind: PlatformKind,
    get_env: F,
) -> Option<PathBuf>
where
    F: Fn(&str) -> Option<String>,
{
    match kind {
        PlatformKind::Windows => {
            if let Some(local_app_data) = get_env("LOCALAPPDATA") {
                return Some(join_platform_path(
                    kind,
                    &local_app_data,
                    &["ultra-rss-reader"],
                ));
            }

            if let Some(user_profile) = get_env("USERPROFILE") {
                return Some(join_platform_path(
                    kind,
                    &user_profile,
                    &["AppData", "Local", "ultra-rss-reader"],
                ));
            }

            let home_drive = get_env("HOMEDRIVE");
            let home_path = get_env("HOMEPATH");
            if let (Some(home_drive), Some(home_path)) = (home_drive, home_path) {
                return Some(join_platform_path(
                    kind,
                    &format!("{home_drive}{home_path}"),
                    &["AppData", "Local", "ultra-rss-reader"],
                ));
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

fn join_platform_path(kind: PlatformKind, base: &str, segments: &[&str]) -> PathBuf {
    match kind {
        PlatformKind::Windows => {
            let mut path = base.trim_end_matches(['\\', '/']).to_string();
            for segment in segments {
                if !path.is_empty() && !path.ends_with(['\\', '/']) {
                    path.push('\\');
                }
                path.push_str(segment.trim_matches(['\\', '/']));
            }
            PathBuf::from(path)
        }
        PlatformKind::Macos | PlatformKind::Linux | PlatformKind::Unknown => {
            let mut path = PathBuf::from(base);
            for segment in segments {
                path.push(segment);
            }
            path
        }
    }
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
