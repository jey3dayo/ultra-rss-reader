use serde::Serialize;

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
    pub icon_url: Option<String>,
    pub unread_count: i32,
    pub reader_mode: String,
    pub web_preview_mode: String,
}

fn normalize_feed_unread_count(count: i32) -> i32 {
    count.max(0)
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub orphaned_article_ids: Option<Vec<String>>,
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
                crate::domain::account::ConnectionVerificationStatus::Quarantined => "quarantined",
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
            icon_url: f.icon_url,
            unread_count: normalize_feed_unread_count(f.unread_count),
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

impl From<crate::domain::article::ArticleListItem> for ArticleDto {
    fn from(article: crate::domain::article::ArticleListItem) -> Self {
        Self {
            id: article.id.0,
            feed_id: article.feed_id.0,
            title: article.title,
            content_sanitized: String::new(),
            summary: article.summary,
            url: article.url,
            author: article.author,
            published_at: article.published_at.to_rfc3339(),
            thumbnail: article.thumbnail,
            is_read: article.is_read,
            is_starred: article.is_starred,
            viewed_at: None,
        }
    }
}

impl ArticleDto {
    pub fn list_item_from(article: crate::domain::article::Article) -> Self {
        Self {
            content_sanitized: String::new(),
            ..Self::from(article)
        }
    }

    pub fn list_item_from_summary(article: crate::domain::article::ArticleListItem) -> Self {
        Self::from(article)
    }

    pub fn list_item_from_view_history(
        item: crate::domain::article::ArticleViewHistoryItem,
    ) -> Self {
        let mut dto = Self::list_item_from(item.article);
        dto.viewed_at = Some(item.viewed_at.to_rfc3339());
        dto
    }

    pub fn list_item_from_summary_view_history(
        item: crate::domain::article::ArticleListHistoryItem,
    ) -> Self {
        let mut dto = Self::list_item_from_summary(item.article);
        dto.viewed_at = Some(item.viewed_at.to_rfc3339());
        dto
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
mod article_dto_list_tests {
    use chrono::Utc;

    use super::ArticleDto;
    use crate::domain::article::Article;
    use crate::domain::types::{ArticleId, FeedId};

    fn test_article() -> Article {
        Article {
            id: ArticleId("article-1".to_string()),
            feed_id: FeedId("feed-1".to_string()),
            remote_id: None,
            title: "Article".to_string(),
            content_raw: "<p>Raw body</p>".to_string(),
            content_sanitized: "<p>Sanitized body</p>".to_string(),
            sanitizer_version: 1,
            summary: Some("Summary".to_string()),
            url: None,
            author: None,
            thumbnail: None,
            published_at: Utc::now(),
            is_read: false,
            is_starred: false,
            fetched_at: Utc::now(),
        }
    }

    #[test]
    fn list_item_from_omits_sanitized_content() {
        let dto = ArticleDto::list_item_from(test_article());

        assert_eq!(dto.content_sanitized, "");
        assert_eq!(dto.title, "Article");
    }
}

#[cfg(test)]
mod tests {
    use super::{AccountDto, AccountProviderCapabilitiesDto, FeedDto};

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
            icon_url: None,
            unread_count: 3,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        };

        let value = serde_json::to_value(FeedDto::from(feed)).expect("feed dto should serialize");

        assert_eq!(value["remote_id"], "feed/https://example.com/rss.xml");
    }

    #[test]
    fn feed_dto_normalizes_negative_unread_count() {
        let feed = crate::domain::feed::Feed {
            id: crate::domain::types::FeedId("feed-1".to_string()),
            account_id: crate::domain::types::AccountId("acc-1".to_string()),
            folder_id: None,
            remote_id: None,
            title: "Example".to_string(),
            url: "https://example.com/rss.xml".to_string(),
            site_url: "https://example.com".to_string(),
            icon: None,
            icon_url: None,
            unread_count: -1,
            reader_mode: "inherit".to_string(),
            web_preview_mode: "inherit".to_string(),
        };

        let value = serde_json::to_value(FeedDto::from(feed)).expect("feed dto should serialize");

        assert_eq!(value["unread_count"], 0);
    }
}
