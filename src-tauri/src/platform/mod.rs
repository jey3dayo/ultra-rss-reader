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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EnvSnapshot<'a> {
    values: Vec<(&'a str, Option<String>)>,
}

impl<'a> EnvSnapshot<'a> {
    pub fn capture<F>(keys: &'a [&'a str], get_env: F) -> Self
    where
        F: Fn(&str) -> Option<String>,
    {
        Self {
            values: keys.iter().map(|key| (*key, get_env(key))).collect(),
        }
    }

    pub fn first_non_empty(&self) -> Option<String> {
        self.values.iter().find_map(|(_, value)| {
            value
                .as_deref()
                .map(str::trim)
                .filter(|trimmed| !trimmed.is_empty())
                .map(ToOwned::to_owned)
        })
    }

    pub fn first_truthy(&self) -> bool {
        self.first_non_empty()
            .is_some_and(|value| is_truthy_env_value(&value))
    }

    pub fn first_valid<F>(&self, is_valid: F) -> Option<String>
    where
        F: Fn(&str) -> bool,
    {
        self.values.iter().find_map(|(_, value)| {
            value
                .as_deref()
                .map(str::trim)
                .filter(|trimmed| !trimmed.is_empty() && is_valid(trimmed))
                .map(ToOwned::to_owned)
        })
    }
}

pub fn is_truthy_env_value(value: &str) -> bool {
    matches!(
        value.trim().to_ascii_lowercase().as_str(),
        "1" | "true" | "yes" | "on"
    )
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
    EnvSnapshot::capture(&["DEV_CREDENTIALS", "ULTRA_RSS_DEV_CREDENTIALS"], get_env).first_truthy()
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
    use super::{
        platform_info_for_kind, uses_dev_file_credentials_from_env, EnvSnapshot, PlatformKind,
    };

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

    #[test]
    fn env_snapshot_uses_alias_order_for_truthy_values() {
        let disabled_by_primary = uses_dev_file_credentials_from_env(|key| match key {
            "DEV_CREDENTIALS" => Some("false".to_string()),
            "ULTRA_RSS_DEV_CREDENTIALS" => Some("true".to_string()),
            _ => None,
        });
        assert!(!disabled_by_primary);

        let enabled_by_alias_after_blank_primary =
            uses_dev_file_credentials_from_env(|key| match key {
                "DEV_CREDENTIALS" => Some("   ".to_string()),
                "ULTRA_RSS_DEV_CREDENTIALS" => Some("yes".to_string()),
                _ => None,
            });
        assert!(enabled_by_alias_after_blank_primary);
    }

    #[test]
    fn env_snapshot_falls_through_until_valid_value() {
        let snapshot = EnvSnapshot::capture(&["PRIMARY_URL", "ALIAS_URL"], |key| match key {
            "PRIMARY_URL" => Some("file:///tmp/article.html".to_string()),
            "ALIAS_URL" => Some(" https://example.com/preview ".to_string()),
            _ => None,
        });

        assert_eq!(
            snapshot.first_valid(|value| value.starts_with("https://")),
            Some("https://example.com/preview".to_string())
        );
    }
}
