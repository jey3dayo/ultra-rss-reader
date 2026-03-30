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
            uses_dev_file_credentials: true,
        },
        PlatformKind::Linux | PlatformKind::Unknown => PlatformCapabilities {
            supports_reading_list: false,
            supports_background_browser_open: false,
            supports_runtime_window_icon_replacement: false,
            supports_native_browser_navigation: false,
            uses_dev_file_credentials: false,
        },
    };

    PlatformInfo {
        kind,
        capabilities,
    }
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

        platform_info_for_kind(kind)
    }
}

#[cfg(test)]
mod tests {
    use super::{platform_info_for_kind, PlatformKind};

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
}
