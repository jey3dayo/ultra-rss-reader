use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum PlatformKindDto {
    Macos,
    Windows,
    Linux,
    Unknown,
}

#[derive(Debug, Serialize, Clone)]
pub struct PlatformCapabilitiesDto {
    pub supports_reading_list: bool,
    pub supports_background_browser_open: bool,
    pub supports_runtime_window_icon_replacement: bool,
    pub supports_native_browser_navigation: bool,
    pub uses_dev_file_credentials: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct PlatformInfoDto {
    pub kind: PlatformKindDto,
    pub capabilities: PlatformCapabilitiesDto,
}

#[derive(Debug, Serialize, Clone)]
pub struct DevRuntimeOptionsDto {
    pub dev_intent: Option<String>,
    pub dev_web_url: Option<String>,
    pub dev_window_width: Option<u32>,
    pub dev_window_height: Option<u32>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PlatformPermissionDeniedSurfaceDto {
    File,
    Dialog,
    Keyring,
    Clipboard,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct PlatformPermissionDeniedRecoveryDto {
    pub surface: PlatformPermissionDeniedSurfaceDto,
    pub user_action_copy: String,
}

impl From<crate::platform::PlatformInfo> for PlatformInfoDto {
    fn from(info: crate::platform::PlatformInfo) -> Self {
        let kind = match info.kind {
            crate::platform::PlatformKind::Macos => PlatformKindDto::Macos,
            crate::platform::PlatformKind::Windows => PlatformKindDto::Windows,
            crate::platform::PlatformKind::Linux => PlatformKindDto::Linux,
            crate::platform::PlatformKind::Unknown => PlatformKindDto::Unknown,
        };

        let capabilities = PlatformCapabilitiesDto {
            supports_reading_list: info.capabilities.supports_reading_list,
            supports_background_browser_open: info.capabilities.supports_background_browser_open,
            supports_runtime_window_icon_replacement: info
                .capabilities
                .supports_runtime_window_icon_replacement,
            supports_native_browser_navigation: info
                .capabilities
                .supports_native_browser_navigation,
            uses_dev_file_credentials: info.capabilities.uses_dev_file_credentials,
        };

        Self { kind, capabilities }
    }
}

#[cfg(test)]
mod tests {
    use super::{PlatformCapabilitiesDto, PlatformInfoDto, PlatformKindDto};

    #[test]
    fn platform_info_dto_serializes_expected_ipc_shape() {
        let dto = PlatformInfoDto {
            kind: PlatformKindDto::Macos,
            capabilities: PlatformCapabilitiesDto {
                supports_reading_list: true,
                supports_background_browser_open: true,
                supports_runtime_window_icon_replacement: false,
                supports_native_browser_navigation: true,
                uses_dev_file_credentials: false,
            },
        };

        let value = serde_json::to_value(dto).expect("platform dto should serialize");

        assert_eq!(value["kind"], "macos");
        let capabilities = value["capabilities"]
            .as_object()
            .expect("capabilities should be an object");
        assert!(capabilities.contains_key("supports_reading_list"));
        assert!(capabilities.contains_key("supports_background_browser_open"));
        assert!(capabilities.contains_key("supports_runtime_window_icon_replacement"));
        assert!(capabilities.contains_key("supports_native_browser_navigation"));
        assert!(capabilities.contains_key("uses_dev_file_credentials"));
    }
}
