use serde::Serialize;

use crate::domain::error::DomainError;

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type")]
pub enum AppError {
    UserVisible { message: String },
    Retryable { message: String },
}

impl From<DomainError> for AppError {
    fn from(e: DomainError) -> Self {
        match &e {
            DomainError::Network(_) => AppError::Retryable {
                message: e.to_string(),
            },
            _ => AppError::UserVisible {
                message: e.to_string(),
            },
        }
    }
}

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

#[derive(Debug, Serialize, Clone)]
pub struct SyncResult {
    /// Whether any sync actually ran (false = skipped because already in progress)
    pub synced: bool,
    pub total: usize,
    pub succeeded: usize,
    pub failed: Vec<AccountSyncError>,
    pub warnings: Vec<AccountSyncWarning>,
}

#[derive(Debug, Serialize, Clone)]
pub struct AccountSyncError {
    pub account_id: String,
    pub account_name: String,
    pub message: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct AccountSyncWarning {
    pub account_id: String,
    pub account_name: String,
    pub message: String,
}

#[derive(Debug, Serialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum SyncProgressStage {
    Started,
    AccountStarted,
    AccountFinished,
    Finished,
}

#[derive(Debug, Serialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum SyncProgressKind {
    ManualAll,
    ManualAccount,
    Automatic,
}

#[derive(Debug, Serialize, Clone)]
pub struct SyncProgressEvent {
    pub stage: SyncProgressStage,
    pub kind: SyncProgressKind,
    pub total: usize,
    pub completed: usize,
    pub account_id: Option<String>,
    pub account_name: Option<String>,
    pub success: Option<bool>,
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::UserVisible { message } | AppError::Retryable { message } => {
                write!(f, "{}", message)
            }
        }
    }
}

#[derive(Debug, Serialize)]
pub struct AccountDto {
    pub id: String,
    pub kind: String,
    pub name: String,
    pub server_url: Option<String>,
    pub username: Option<String>,
    pub sync_interval_secs: i64,
    pub sync_on_wake: bool,
    pub keep_read_items_days: i64,
}

#[derive(Debug, Serialize)]
pub struct FolderDto {
    pub id: String,
    pub account_id: String,
    pub name: String,
    pub sort_order: i32,
}

#[derive(Debug, Serialize)]
pub struct FeedDto {
    pub id: String,
    pub account_id: String,
    pub folder_id: Option<String>,
    pub title: String,
    pub url: String,
    pub site_url: String,
    pub unread_count: i32,
    pub reader_mode: String,
    pub web_preview_mode: String,
}

#[derive(Debug, Serialize)]
pub struct ArticleDto {
    pub id: String,
    pub feed_id: String,
    pub title: String,
    pub content_sanitized: String,
    pub summary: Option<String>,
    pub url: Option<String>,
    pub author: Option<String>,
    pub published_at: String,
    pub thumbnail: Option<String>,
    pub is_read: bool,
    pub is_starred: bool,
}

#[derive(Debug, Serialize)]
pub struct TagDto {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DiscoveredFeedDto {
    pub url: String,
    pub title: String,
}

impl From<crate::infra::feed_discovery::DiscoveredFeed> for DiscoveredFeedDto {
    fn from(f: crate::infra::feed_discovery::DiscoveredFeed) -> Self {
        Self {
            url: f.url,
            title: f.title,
        }
    }
}

impl From<crate::domain::tag::Tag> for TagDto {
    fn from(t: crate::domain::tag::Tag) -> Self {
        Self {
            id: t.id.0,
            name: t.name,
            color: t.color,
        }
    }
}

impl From<crate::domain::account::Account> for AccountDto {
    fn from(a: crate::domain::account::Account) -> Self {
        Self {
            id: a.id.0,
            kind: format!("{:?}", a.kind),
            name: a.name,
            server_url: a.server_url,
            username: a.username,
            sync_interval_secs: a.sync_interval_secs,
            sync_on_wake: a.sync_on_wake,
            keep_read_items_days: a.keep_read_items_days,
        }
    }
}

impl From<crate::domain::folder::Folder> for FolderDto {
    fn from(f: crate::domain::folder::Folder) -> Self {
        Self {
            id: f.id.0,
            account_id: f.account_id.0,
            name: f.name,
            sort_order: f.sort_order,
        }
    }
}

impl From<crate::domain::feed::Feed> for FeedDto {
    fn from(f: crate::domain::feed::Feed) -> Self {
        Self {
            id: f.id.0,
            account_id: f.account_id.0,
            folder_id: f.folder_id.map(|id| id.0),
            title: f.title,
            url: f.url,
            site_url: f.site_url,
            unread_count: f.unread_count,
            reader_mode: f.reader_mode,
            web_preview_mode: f.web_preview_mode,
        }
    }
}

impl From<crate::domain::article::Article> for ArticleDto {
    fn from(a: crate::domain::article::Article) -> Self {
        Self {
            id: a.id.0,
            feed_id: a.feed_id.0,
            title: a.title,
            content_sanitized: a.content_sanitized,
            summary: a.summary,
            url: a.url,
            author: a.author,
            published_at: a.published_at.to_rfc3339(),
            thumbnail: a.thumbnail,
            is_read: a.is_read,
            is_starred: a.is_starred,
        }
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
