use serde::Serialize;

use crate::domain::error::DomainError;

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type")]
pub enum AppError {
    UserVisible { message: String },
    Retryable { message: String },
}

fn non_empty_app_error_message(message: String) -> String {
    if message.trim().is_empty() {
        "An application error occurred".to_string()
    } else {
        message
    }
}

impl From<DomainError> for AppError {
    fn from(e: DomainError) -> Self {
        let message = non_empty_app_error_message(e.to_string());
        match &e {
            DomainError::Network(_) | DomainError::RateLimit(_) => AppError::Retryable { message },
            _ => AppError::UserVisible { message },
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

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct FeedArticleSummaryDto {
    pub feed_id: String,
    pub latest_article_at: Option<String>,
    pub starred_count: i32,
}

#[derive(Debug, Serialize, Clone)]
pub struct DevRuntimeOptionsDto {
    pub dev_intent: Option<String>,
    pub dev_web_url: Option<String>,
    pub dev_window_width: Option<u32>,
    pub dev_window_height: Option<u32>,
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
pub struct AccountSyncStatus {
    pub last_success_at: Option<String>,
    pub last_error: Option<String>,
    pub error_count: i32,
    pub next_retry_at: Option<String>,
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
    pub kind: AccountSyncWarningKind,
    pub message: String,
    pub retry_at: Option<String>,
    pub retry_in_seconds: Option<u64>,
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AccountSyncWarningKind {
    Generic,
    RetryPending,
    RetryScheduled,
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
    pub display_name: String,
    pub icon_url: Option<String>,
    pub capabilities: AccountProviderCapabilitiesDto,
    pub server_url: Option<String>,
    pub username: Option<String>,
    pub sync_interval_secs: i64,
    pub sync_on_startup: bool,
    pub sync_on_wake: bool,
    pub keep_read_items_days: i64,
    pub connection_verification_status: String,
    pub connection_verified_at: Option<String>,
    pub connection_verification_error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AccountProviderCapabilitiesDto {
    pub supports_folders: bool,
    pub supports_starring: bool,
    pub supports_search: bool,
    pub supports_delta_sync: bool,
    pub supports_remote_state: bool,
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
    pub remote_id: Option<String>,
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
    pub viewed_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FeedIntegrityIssueDto {
    pub missing_feed_id: String,
    pub article_count: i64,
    pub latest_article_title: Option<String>,
    pub latest_article_published_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FeedIntegrityReportDto {
    pub orphaned_article_count: i64,
    pub orphaned_feeds: Vec<FeedIntegrityIssueDto>,
}

#[derive(Debug, Serialize)]
pub struct FeedIntegrityCleanupDto {
    pub dry_run: bool,
    pub orphaned_article_count: i64,
    pub deleted_article_count: i64,
}

#[derive(Debug, Serialize)]
pub struct TagDto {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MuteKeywordDto {
    pub id: String,
    pub keyword: String,
    pub scope: String,
    pub created_at: String,
    pub updated_at: String,
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

impl From<crate::domain::mute_keyword::MuteKeyword> for MuteKeywordDto {
    fn from(rule: crate::domain::mute_keyword::MuteKeyword) -> Self {
        Self {
            id: rule.id,
            keyword: rule.keyword,
            scope: rule.scope.as_str().to_string(),
            created_at: rule.created_at,
            updated_at: rule.updated_at,
        }
    }
}

impl From<crate::domain::account::Account> for AccountDto {
    fn from(a: crate::domain::account::Account) -> Self {
        let capabilities = a.kind.capabilities();
        let display_name = a.name.clone();
        Self {
            id: a.id.0,
            kind: format!("{:?}", a.kind),
            name: a.name,
            display_name,
            icon_url: None,
            capabilities: AccountProviderCapabilitiesDto {
                supports_folders: capabilities.supports_folders,
                supports_starring: capabilities.supports_starring,
                supports_search: capabilities.supports_search,
                supports_delta_sync: capabilities.supports_delta_sync,
                supports_remote_state: capabilities.supports_remote_state,
            },
            server_url: a.server_url,
            username: a.username,
            sync_interval_secs: a.sync_interval_secs,
            sync_on_startup: a.sync_on_startup,
            sync_on_wake: a.sync_on_wake,
            keep_read_items_days: a.keep_read_items_days,
            connection_verification_status: match a.connection_verification_status {
                crate::domain::account::ConnectionVerificationStatus::Verified => "verified",
                crate::domain::account::ConnectionVerificationStatus::Unverified => "unverified",
                crate::domain::account::ConnectionVerificationStatus::Error => "error",
            }
            .to_string(),
            connection_verified_at: a.connection_verified_at,
            connection_verification_error: a.connection_verification_error,
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
            remote_id: f.remote_id,
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
            viewed_at: None,
        }
    }
}

impl From<crate::domain::article::ArticleViewHistoryItem> for ArticleDto {
    fn from(item: crate::domain::article::ArticleViewHistoryItem) -> Self {
        let mut dto = ArticleDto::from(item.article);
        dto.viewed_at = Some(item.viewed_at.to_rfc3339());
        dto
    }
}

#[cfg(test)]
mod tests {
    use super::{
        AccountDto, AccountProviderCapabilitiesDto, AppError, FeedDto, PlatformCapabilitiesDto,
        PlatformInfoDto, PlatformKindDto,
    };
    use crate::domain::error::DomainError;

    #[test]
    fn domain_network_error_maps_to_retryable_app_error() {
        let app_error = AppError::from(DomainError::Network("timeout".to_string()));

        match app_error {
            AppError::Retryable { message } => {
                assert_eq!(message, "Network error: timeout");
            }
            AppError::UserVisible { message } => {
                panic!("network errors should be retryable, got user-visible: {message}");
            }
        }
    }

    #[test]
    fn domain_non_network_errors_map_to_user_visible_app_errors() {
        let errors = [
            DomainError::Parse("bad feed".to_string()),
            DomainError::Persistence("database locked".to_string()),
            DomainError::Auth("unauthorized".to_string()),
            DomainError::Validation("missing url".to_string()),
            DomainError::Keychain("missing secret".to_string()),
            DomainError::Migration("failed migration".to_string()),
        ];

        for domain_error in errors {
            let expected_message = domain_error.to_string();
            let app_error = AppError::from(domain_error);

            match app_error {
                AppError::UserVisible { message } => {
                    assert_eq!(message, expected_message);
                }
                AppError::Retryable { message } => {
                    panic!("non-network errors should be user-visible, got retryable: {message}");
                }
            }
        }
    }

    #[test]
    fn domain_error_conversion_never_returns_blank_app_error_messages() {
        let errors = [
            DomainError::Network(String::new()),
            DomainError::RateLimit("   ".to_string()),
            DomainError::Parse(String::new()),
            DomainError::Persistence("   ".to_string()),
            DomainError::Auth(String::new()),
            DomainError::Validation("   ".to_string()),
            DomainError::Keychain(String::new()),
            DomainError::Migration("   ".to_string()),
        ];

        for domain_error in errors {
            let app_error = AppError::from(domain_error);
            let message = match app_error {
                AppError::UserVisible { message } | AppError::Retryable { message } => message,
            };

            assert!(
                !message.trim().is_empty(),
                "AppError message should not be blank"
            );
        }
    }

    #[test]
    fn app_error_message_normalizer_falls_back_for_blank_messages() {
        assert_eq!(
            super::non_empty_app_error_message(String::new()),
            "An application error occurred"
        );
        assert_eq!(
            super::non_empty_app_error_message("   ".to_string()),
            "An application error occurred"
        );
        assert_eq!(
            super::non_empty_app_error_message("visible message".to_string()),
            "visible message"
        );
    }

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

    #[test]
    fn account_dto_serializes_provider_display_contract() {
        let account = crate::domain::account::Account {
            id: crate::domain::types::AccountId("acc-1".to_string()),
            kind: crate::domain::provider::ProviderKind::FreshRss,
            name: "Work FreshRSS".to_string(),
            server_url: Some("https://freshrss.example.com".to_string()),
            username: Some("reader".to_string()),
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
            connection_verification_status:
                crate::domain::account::ConnectionVerificationStatus::Verified,
            connection_verified_at: Some("2026-04-15T01:00:00Z".to_string()),
            connection_verification_error: None,
        };

        let value =
            serde_json::to_value(AccountDto::from(account)).expect("account dto should serialize");

        assert_eq!(value["display_name"], "Work FreshRSS");
        assert_eq!(value["icon_url"], serde_json::Value::Null);
        let capabilities = value["capabilities"]
            .as_object()
            .expect("account capabilities should be an object");
        assert_eq!(capabilities["supports_folders"], true);
        assert_eq!(capabilities["supports_starring"], true);
        assert_eq!(capabilities["supports_search"], true);
        assert_eq!(capabilities["supports_delta_sync"], true);
        assert_eq!(capabilities["supports_remote_state"], true);
    }

    #[test]
    fn account_dto_serializes_provider_specific_capabilities() {
        let fixtures = [
            (
                crate::domain::provider::ProviderKind::Local,
                AccountProviderCapabilitiesDto {
                    supports_folders: false,
                    supports_starring: false,
                    supports_search: false,
                    supports_delta_sync: false,
                    supports_remote_state: false,
                },
            ),
            (
                crate::domain::provider::ProviderKind::FreshRss,
                AccountProviderCapabilitiesDto {
                    supports_folders: true,
                    supports_starring: true,
                    supports_search: true,
                    supports_delta_sync: true,
                    supports_remote_state: true,
                },
            ),
        ];

        for (kind, expected_capabilities) in fixtures {
            let kind_name = format!("{kind:?}");
            let account = crate::domain::account::Account {
                id: crate::domain::types::AccountId(format!("acc-{kind_name}")),
                kind,
                name: format!("{kind_name} Account"),
                server_url: None,
                username: None,
                sync_interval_secs: 3600,
                sync_on_startup: true,
                sync_on_wake: false,
                keep_read_items_days: 30,
                connection_verification_status:
                    crate::domain::account::ConnectionVerificationStatus::Unverified,
                connection_verified_at: None,
                connection_verification_error: None,
            };

            let value = serde_json::to_value(AccountDto::from(account))
                .expect("account dto should serialize");

            assert_eq!(
                value["capabilities"],
                serde_json::to_value(expected_capabilities)
                    .expect("expected capabilities should serialize")
            );
        }
    }

    #[test]
    fn feed_dto_exposes_remote_id() {
        let feed = crate::domain::feed::Feed {
            id: crate::domain::types::FeedId("feed-1".to_string()),
            account_id: crate::domain::types::AccountId("acc-1".to_string()),
            folder_id: None,
            remote_id: Some("feed/https://example.com/rss.xml".to_string()),
            title: "Example".to_string(),
            url: "https://example.com/rss.xml".to_string(),
            site_url: "https://example.com".to_string(),
            icon: None,
            unread_count: 3,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        };

        let value = serde_json::to_value(FeedDto::from(feed)).expect("feed dto should serialize");

        assert_eq!(value["remote_id"], "feed/https://example.com/rss.xml");
    }
}
