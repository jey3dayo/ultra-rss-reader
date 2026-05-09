#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlatformKind {
    Macos,
    Windows,
    Linux,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlatformCapabilities {
    pub supports_reading_list: bool,
    pub supports_background_browser_open: bool,
    pub supports_runtime_window_icon_replacement: bool,
    pub supports_native_browser_navigation: bool,
    pub uses_dev_file_credentials: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlatformInfo {
    pub kind: PlatformKind,
    pub capabilities: PlatformCapabilities,
}

pub fn platform_info_for_kind(kind: PlatformKind) -> PlatformInfo {
    let capabilities = match kind {
        PlatformKind::Macos => PlatformCapabilities {
            supports_reading_list: true,
            supports_background_browser_open: true,
            supports_runtime_window_icon_replacement: false,
            supports_native_browser_navigation: true,
            uses_dev_file_credentials: false,
        },
        PlatformKind::Windows => PlatformCapabilities {
            supports_reading_list: false,
            supports_background_browser_open: false,
            supports_runtime_window_icon_replacement: true,
            supports_native_browser_navigation: true,
            uses_dev_file_credentials: false,
        },
        PlatformKind::Linux | PlatformKind::Unknown => PlatformCapabilities {
            supports_reading_list: false,
            supports_background_browser_open: false,
            supports_runtime_window_icon_replacement: false,
            supports_native_browser_navigation: false,
            uses_dev_file_credentials: false,
        },
    };

    PlatformInfo { kind, capabilities }
}

fn uses_dev_file_credentials_from_env<F>(get_env: F) -> bool
where
    F: Fn(&str) -> Option<String>,
{
    fn is_truthy(value: &str) -> bool {
        matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        )
    }

    get_env("DEV_CREDENTIALS").is_some_and(|value| is_truthy(&value))
        || get_env("ULTRA_RSS_DEV_CREDENTIALS").is_some_and(|value| is_truthy(&value))
}

impl PlatformInfo {
    pub fn current() -> Self {
        let kind = if cfg!(target_os = "macos") {
            PlatformKind::Macos
        } else if cfg!(target_os = "windows") {
            PlatformKind::Windows
        } else if cfg!(target_os = "linux") {
            PlatformKind::Linux
        } else {
            PlatformKind::Unknown
        };

        let mut info = platform_info_for_kind(kind);
        info.capabilities.uses_dev_file_credentials =
            uses_dev_file_credentials_from_env(|key| std::env::var(key).ok());
        info
    }
}

#[cfg(test)]
mod tests {
    use super::{platform_info_for_kind, uses_dev_file_credentials_from_env, PlatformKind};

    #[test]
    fn macos_capabilities_enable_reading_list_and_background_open() {
        let info = platform_info_for_kind(PlatformKind::Macos);

        assert!(info.capabilities.supports_reading_list);
        assert!(info.capabilities.supports_background_browser_open);
    }

    #[test]
    fn windows_capabilities_enable_native_navigation_but_not_reading_list() {
        let info = platform_info_for_kind(PlatformKind::Windows);

        assert!(!info.capabilities.supports_reading_list);
        assert!(info.capabilities.supports_native_browser_navigation);
    }

    #[test]
    fn non_windows_non_macos_falls_back_to_safe_defaults() {
        let linux = platform_info_for_kind(PlatformKind::Linux);
        let unknown = platform_info_for_kind(PlatformKind::Unknown);

        for info in [linux, unknown] {
            assert!(!info.capabilities.supports_reading_list);
            assert!(!info.capabilities.supports_background_browser_open);
            assert!(!info.capabilities.supports_runtime_window_icon_replacement);
            assert!(!info.capabilities.supports_native_browser_navigation);
            assert!(!info.capabilities.uses_dev_file_credentials);
        }
    }

    #[test]
    fn platform_capabilities_are_owned_by_native_platform_kind() {
        let cases = [
            (PlatformKind::Macos, (true, true, false, true, false)),
            (PlatformKind::Windows, (false, false, true, true, false)),
            (PlatformKind::Linux, (false, false, false, false, false)),
            (PlatformKind::Unknown, (false, false, false, false, false)),
        ];

        for (
            kind,
            (
                supports_reading_list,
                supports_background_browser_open,
                supports_runtime_window_icon_replacement,
                supports_native_browser_navigation,
                uses_dev_file_credentials,
            ),
        ) in cases
        {
            let info = platform_info_for_kind(kind);

            assert_eq!(info.kind, kind);
            assert_eq!(
                info.capabilities.supports_reading_list,
                supports_reading_list
            );
            assert_eq!(
                info.capabilities.supports_background_browser_open,
                supports_background_browser_open
            );
            assert_eq!(
                info.capabilities.supports_runtime_window_icon_replacement,
                supports_runtime_window_icon_replacement
            );
            assert_eq!(
                info.capabilities.supports_native_browser_navigation,
                supports_native_browser_navigation
            );
            assert_eq!(
                info.capabilities.uses_dev_file_credentials,
                uses_dev_file_credentials
            );
        }
    }

    #[test]
    fn dev_file_credentials_flag_is_enabled_only_for_truthy_env_values() {
        for value in ["1", "true", " TRUE ", "yes", "on"] {
            let enabled = uses_dev_file_credentials_from_env(|key| {
                if key == "DEV_CREDENTIALS" {
                    Some(value.to_string())
                } else {
                    None
                }
            });
            assert!(enabled, "DEV_CREDENTIALS={value:?} should be enabled");
        }

        for value in ["0", "false", " FALSE ", "", " ", "no", "off"] {
            let disabled = uses_dev_file_credentials_from_env(|key| {
                if key == "DEV_CREDENTIALS" {
                    Some(value.to_string())
                } else {
                    None
                }
            });
            assert!(!disabled, "DEV_CREDENTIALS={value:?} should be disabled");
        }

        let legacy_enabled = uses_dev_file_credentials_from_env(|key| {
            if key == "ULTRA_RSS_DEV_CREDENTIALS" {
                Some("true".to_string())
            } else {
                None
            }
        });
        assert!(legacy_enabled);
        assert!(!uses_dev_file_credentials_from_env(|_| None));
    }
}
