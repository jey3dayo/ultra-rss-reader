use std::collections::{BTreeMap, BTreeSet};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::domain::error::{DomainError, DomainResult};

pub const LOCAL_ACCOUNT_SYNC_SCHEMA_VERSION: u32 = 1;
pub const LOCAL_ACCOUNT_SYNC_OPERATION_CONTENT_TYPE: &str =
    "application/vnd.ultra-rss-reader.local-account-sync-operation+json";

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct LocalSyncAccountId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct LocalSyncDeviceId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct LocalSyncOperationId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
pub struct LocalSyncArticleKey(pub String);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalSyncEntryIdentity {
    pub guid: Option<String>,
    pub url: Option<String>,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LocalSyncEntryIdentityKind {
    Guid,
    Url,
    Title,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GeneratedLocalSyncArticleKey {
    pub key: LocalSyncArticleKey,
    pub identity_kind: LocalSyncEntryIdentityKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LocalAccountSyncOperationFile {
    pub version: u32,
    pub content_type: String,
    pub operation: LocalAccountSyncOperation,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LocalAccountSyncOperation {
    pub sync_account_id: LocalSyncAccountId,
    pub device_id: LocalSyncDeviceId,
    pub operation_id: LocalSyncOperationId,
    pub occurred_at: DateTime<Utc>,
    pub entity_key: LocalSyncEntityKey,
    pub action: LocalSyncAction,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash, PartialOrd, Ord)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum LocalSyncEntityKey {
    Feed {
        normalized_feed_url: String,
    },
    Folder {
        normalized_name: String,
    },
    Article {
        article_key: LocalSyncArticleKey,
    },
    Tag {
        normalized_name: String,
    },
    ArticleTag {
        article_key: LocalSyncArticleKey,
        normalized_tag_name: String,
    },
    MuteKeyword {
        normalized_keyword: String,
        scope: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum LocalSyncAction {
    UpsertFeed {
        title: String,
        site_url: String,
        folder_name: Option<String>,
    },
    UpsertFolder {
        display_name: String,
        sort_order: i32,
    },
    SetRead {
        is_read: bool,
    },
    SetStarred {
        is_starred: bool,
    },
    AddTag {
        display_name: String,
    },
    RemoveTag,
    AddArticleTag,
    RemoveArticleTag,
    UpsertMuteKeyword,
    RemoveMuteKeyword,
    ReportFeedFolderConflict {
        reason: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalAccountSyncMergeResult {
    pub projection: LocalAccountSyncProjection,
    pub applied_operations: usize,
    pub rejected_operations: Vec<RejectedLocalSyncOperation>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct LocalAccountSyncProjection {
    pub feeds: BTreeMap<String, LocalSyncFeedState>,
    pub folders: BTreeMap<String, LocalSyncFolderState>,
    pub articles: BTreeMap<LocalSyncArticleKey, LocalSyncArticleState>,
    pub tags: BTreeMap<String, LocalSyncTagState>,
    pub article_tags: BTreeSet<(LocalSyncArticleKey, String)>,
    pub article_tag_tombstones: BTreeMap<(LocalSyncArticleKey, String), DateTime<Utc>>,
    pub mute_keywords: BTreeMap<(String, String), LocalSyncMuteKeywordState>,
    pub mute_keyword_tombstones: BTreeMap<(String, String), DateTime<Utc>>,
    pub feed_folder_conflicts: Vec<LocalSyncFeedFolderConflict>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalSyncFeedState {
    pub title: String,
    pub site_url: String,
    pub folder_name: Option<String>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalSyncFolderState {
    pub display_name: String,
    pub sort_order: i32,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct LocalSyncArticleState {
    pub is_read: Option<bool>,
    pub read_updated_at: Option<DateTime<Utc>>,
    pub is_starred: Option<bool>,
    pub starred_updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalSyncTagState {
    pub display_name: String,
    pub updated_at: DateTime<Utc>,
    pub removed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalSyncMuteKeywordState {
    pub keyword: String,
    pub scope: String,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalSyncFeedFolderConflict {
    pub entity_key: LocalSyncEntityKey,
    pub reason: String,
    pub occurred_at: DateTime<Utc>,
    pub operation_id: LocalSyncOperationId,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RejectedLocalSyncOperation {
    pub operation_id: LocalSyncOperationId,
    pub reason: String,
}

impl LocalSyncAccountId {
    pub fn new() -> Self {
        Self(uuid::Uuid::new_v4().to_string())
    }
}

impl Default for LocalSyncAccountId {
    fn default() -> Self {
        Self::new()
    }
}

impl LocalSyncDeviceId {
    pub fn new() -> Self {
        Self(uuid::Uuid::new_v4().to_string())
    }
}

impl Default for LocalSyncDeviceId {
    fn default() -> Self {
        Self::new()
    }
}

impl LocalSyncOperationId {
    pub fn new() -> Self {
        Self(uuid::Uuid::new_v4().to_string())
    }
}

impl Default for LocalSyncOperationId {
    fn default() -> Self {
        Self::new()
    }
}

pub fn operation_file(operation: LocalAccountSyncOperation) -> LocalAccountSyncOperationFile {
    LocalAccountSyncOperationFile {
        version: LOCAL_ACCOUNT_SYNC_SCHEMA_VERSION,
        content_type: LOCAL_ACCOUNT_SYNC_OPERATION_CONTENT_TYPE.to_string(),
        operation,
    }
}

pub fn parse_operation_file(content: &str) -> DomainResult<LocalAccountSyncOperationFile> {
    let file: LocalAccountSyncOperationFile = serde_json::from_str(content).map_err(|error| {
        DomainError::Parse(format!("Failed to parse local sync operation: {error}"))
    })?;
    if file.version != LOCAL_ACCOUNT_SYNC_SCHEMA_VERSION {
        return Err(DomainError::Parse(format!(
            "Unsupported local sync operation version: {}",
            file.version
        )));
    }
    if file.content_type != LOCAL_ACCOUNT_SYNC_OPERATION_CONTENT_TYPE {
        return Err(DomainError::Parse(
            "Unsupported local sync operation content type".to_string(),
        ));
    }
    Ok(file)
}

pub fn generate_local_sync_article_key(
    sync_account_id: &LocalSyncAccountId,
    feed_url: &str,
    identity: LocalSyncEntryIdentity,
) -> DomainResult<GeneratedLocalSyncArticleKey> {
    let feed_url = normalize_feed_url(feed_url)?;
    let (kind, value) = choose_entry_identity(identity)?;
    let kind_label = match kind {
        LocalSyncEntryIdentityKind::Guid => "guid",
        LocalSyncEntryIdentityKind::Url => "url",
        LocalSyncEntryIdentityKind::Title => "title",
    };
    let digest = sha256_hex(&format!(
        "{}|{feed_url}|{kind_label}|{value}",
        sync_account_id.0
    ));
    Ok(GeneratedLocalSyncArticleKey {
        key: LocalSyncArticleKey(digest),
        identity_kind: kind,
    })
}

pub fn normalize_feed_url(feed_url: &str) -> DomainResult<String> {
    let trimmed = feed_url.trim();
    if trimmed.is_empty() {
        return Err(DomainError::Validation(
            "Local sync feed URL cannot be empty".to_string(),
        ));
    }
    let mut url = reqwest::Url::parse(trimmed).map_err(|error| {
        DomainError::Validation(format!("Invalid local sync feed URL: {error}"))
    })?;
    url.set_fragment(None);
    Ok(url.to_string())
}

pub fn normalize_tag_name(name: &str) -> DomainResult<String> {
    let normalized = name.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return Err(DomainError::Validation(
            "Local sync tag name cannot be empty".to_string(),
        ));
    }
    Ok(normalized)
}

pub fn normalize_mute_keyword(keyword: &str) -> DomainResult<String> {
    let normalized = keyword.trim().to_ascii_lowercase();
    if normalized.is_empty() {
        return Err(DomainError::Validation(
            "Local sync mute keyword cannot be empty".to_string(),
        ));
    }
    Ok(normalized)
}

pub fn merge_local_account_sync_operations<I>(operations: I) -> LocalAccountSyncMergeResult
where
    I: IntoIterator<Item = LocalAccountSyncOperation>,
{
    let mut projection = LocalAccountSyncProjection::default();
    let mut applied_operations = 0;
    let mut rejected_operations = Vec::new();

    let mut sorted_operations: Vec<LocalAccountSyncOperation> = operations.into_iter().collect();
    sorted_operations.sort_by(|left, right| {
        left.occurred_at
            .cmp(&right.occurred_at)
            .then_with(|| left.operation_id.0.cmp(&right.operation_id.0))
    });

    for operation in sorted_operations {
        match apply_operation(&mut projection, &operation) {
            Ok(()) => applied_operations += 1,
            Err(reason) => rejected_operations.push(RejectedLocalSyncOperation {
                operation_id: operation.operation_id,
                reason,
            }),
        }
    }

    LocalAccountSyncMergeResult {
        projection,
        applied_operations,
        rejected_operations,
    }
}

fn choose_entry_identity(
    identity: LocalSyncEntryIdentity,
) -> DomainResult<(LocalSyncEntryIdentityKind, String)> {
    if let Some(guid) = non_empty_trimmed(identity.guid) {
        return Ok((LocalSyncEntryIdentityKind::Guid, guid));
    }
    if let Some(url) = non_empty_trimmed(identity.url) {
        return Ok((LocalSyncEntryIdentityKind::Url, url));
    }
    if let Some(title) = non_empty_trimmed(identity.title) {
        return Ok((LocalSyncEntryIdentityKind::Title, title));
    }
    Err(DomainError::Validation(
        "Local sync article identity requires guid, url, or title".to_string(),
    ))
}

fn non_empty_trimmed(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn apply_operation(
    projection: &mut LocalAccountSyncProjection,
    operation: &LocalAccountSyncOperation,
) -> Result<(), String> {
    match (&operation.entity_key, &operation.action) {
        (
            LocalSyncEntityKey::Feed {
                normalized_feed_url,
            },
            LocalSyncAction::UpsertFeed {
                title,
                site_url,
                folder_name,
            },
        ) => {
            let should_apply = projection
                .feeds
                .get(normalized_feed_url)
                .is_none_or(|state| operation.occurred_at >= state.updated_at);
            if should_apply {
                projection.feeds.insert(
                    normalized_feed_url.clone(),
                    LocalSyncFeedState {
                        title: title.trim().to_string(),
                        site_url: site_url.trim().to_string(),
                        folder_name: folder_name.as_ref().map(|name| name.trim().to_string()),
                        updated_at: operation.occurred_at,
                    },
                );
            }
            Ok(())
        }
        (
            LocalSyncEntityKey::Folder { normalized_name },
            LocalSyncAction::UpsertFolder {
                display_name,
                sort_order,
            },
        ) => {
            let should_apply = projection
                .folders
                .get(normalized_name)
                .is_none_or(|state| operation.occurred_at >= state.updated_at);
            if should_apply {
                projection.folders.insert(
                    normalized_name.clone(),
                    LocalSyncFolderState {
                        display_name: display_name.trim().to_string(),
                        sort_order: *sort_order,
                        updated_at: operation.occurred_at,
                    },
                );
            }
            Ok(())
        }
        (LocalSyncEntityKey::Article { article_key }, LocalSyncAction::SetRead { is_read }) => {
            let state = projection.articles.entry(article_key.clone()).or_default();
            if state
                .read_updated_at
                .is_none_or(|current| operation.occurred_at >= current)
            {
                state.is_read = Some(*is_read);
                state.read_updated_at = Some(operation.occurred_at);
            }
            Ok(())
        }
        (
            LocalSyncEntityKey::Article { article_key },
            LocalSyncAction::SetStarred { is_starred },
        ) => {
            let state = projection.articles.entry(article_key.clone()).or_default();
            if state
                .starred_updated_at
                .is_none_or(|current| operation.occurred_at >= current)
            {
                state.is_starred = Some(*is_starred);
                state.starred_updated_at = Some(operation.occurred_at);
            }
            Ok(())
        }
        (LocalSyncEntityKey::Tag { normalized_name }, LocalSyncAction::AddTag { display_name }) => {
            let should_apply = projection
                .tags
                .get(normalized_name)
                .is_none_or(|state| operation.occurred_at >= state.updated_at);
            if should_apply {
                projection.tags.insert(
                    normalized_name.clone(),
                    LocalSyncTagState {
                        display_name: display_name.trim().to_string(),
                        updated_at: operation.occurred_at,
                        removed_at: None,
                    },
                );
            }
            Ok(())
        }
        (LocalSyncEntityKey::Tag { normalized_name }, LocalSyncAction::RemoveTag) => {
            let should_apply = projection
                .tags
                .get(normalized_name)
                .is_none_or(|state| operation.occurred_at >= state.updated_at);
            if should_apply {
                projection.tags.insert(
                    normalized_name.clone(),
                    LocalSyncTagState {
                        display_name: normalized_name.clone(),
                        updated_at: operation.occurred_at,
                        removed_at: Some(operation.occurred_at),
                    },
                );
            }
            Ok(())
        }
        (
            LocalSyncEntityKey::ArticleTag {
                article_key,
                normalized_tag_name,
            },
            LocalSyncAction::AddArticleTag,
        ) => {
            let key = (article_key.clone(), normalized_tag_name.clone());
            let tombstone_is_newer = projection
                .article_tag_tombstones
                .get(&key)
                .is_some_and(|removed_at| *removed_at > operation.occurred_at);
            if !tombstone_is_newer {
                projection.article_tags.insert(key);
            }
            Ok(())
        }
        (
            LocalSyncEntityKey::ArticleTag {
                article_key,
                normalized_tag_name,
            },
            LocalSyncAction::RemoveArticleTag,
        ) => {
            let key = (article_key.clone(), normalized_tag_name.clone());
            projection.article_tags.remove(&key);
            projection
                .article_tag_tombstones
                .insert(key, operation.occurred_at);
            Ok(())
        }
        (
            LocalSyncEntityKey::MuteKeyword {
                normalized_keyword,
                scope,
            },
            LocalSyncAction::UpsertMuteKeyword,
        ) => {
            let key = (normalized_keyword.clone(), scope.trim().to_string());
            let tombstone_is_newer = projection
                .mute_keyword_tombstones
                .get(&key)
                .is_some_and(|removed_at| *removed_at > operation.occurred_at);
            let should_apply = !tombstone_is_newer
                && projection
                    .mute_keywords
                    .get(&key)
                    .is_none_or(|state| operation.occurred_at >= state.updated_at);
            if should_apply {
                projection.mute_keywords.insert(
                    key,
                    LocalSyncMuteKeywordState {
                        keyword: normalized_keyword.clone(),
                        scope: scope.trim().to_string(),
                        updated_at: operation.occurred_at,
                    },
                );
            }
            Ok(())
        }
        (
            LocalSyncEntityKey::MuteKeyword {
                normalized_keyword,
                scope,
            },
            LocalSyncAction::RemoveMuteKeyword,
        ) => {
            let key = (normalized_keyword.clone(), scope.trim().to_string());
            projection.mute_keywords.remove(&key);
            projection
                .mute_keyword_tombstones
                .insert(key, operation.occurred_at);
            Ok(())
        }
        (entity_key, LocalSyncAction::ReportFeedFolderConflict { reason }) => {
            projection
                .feed_folder_conflicts
                .push(LocalSyncFeedFolderConflict {
                    entity_key: entity_key.clone(),
                    reason: reason.trim().to_string(),
                    occurred_at: operation.occurred_at,
                    operation_id: operation.operation_id.clone(),
                });
            Ok(())
        }
        _ => Err("Local sync operation action does not match entity key".to_string()),
    }
}

fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ts(seconds: i64) -> DateTime<Utc> {
        DateTime::from_timestamp(seconds, 0).expect("test timestamp should be valid")
    }

    fn op(
        id: &str,
        occurred_at: DateTime<Utc>,
        entity_key: LocalSyncEntityKey,
        action: LocalSyncAction,
    ) -> LocalAccountSyncOperation {
        LocalAccountSyncOperation {
            sync_account_id: LocalSyncAccountId("sync-account-a".to_string()),
            device_id: LocalSyncDeviceId("device-a".to_string()),
            operation_id: LocalSyncOperationId(id.to_string()),
            occurred_at,
            entity_key,
            action,
        }
    }

    fn article_key() -> LocalSyncArticleKey {
        LocalSyncArticleKey("article-a".to_string())
    }

    #[test]
    fn sync_article_key_uses_sync_account_and_normalized_feed_url() {
        let sync_account = LocalSyncAccountId("sync-account-a".to_string());
        let key = generate_local_sync_article_key(
            &sync_account,
            " https://example.com/feed.xml#fragment ",
            LocalSyncEntryIdentity {
                guid: Some(" guid-1 ".to_string()),
                url: Some("https://example.com/ignored".to_string()),
                title: Some("Ignored".to_string()),
            },
        )
        .expect("sync article key should be generated");
        let same_key = generate_local_sync_article_key(
            &sync_account,
            "https://example.com/feed.xml",
            LocalSyncEntryIdentity {
                guid: Some("guid-1".to_string()),
                url: None,
                title: None,
            },
        )
        .expect("sync article key should normalize same feed URL");

        assert_eq!(key.identity_kind, LocalSyncEntryIdentityKind::Guid);
        assert_eq!(key.key, same_key.key);
        assert_eq!(key.key.0.len(), 64);
    }

    #[test]
    fn sync_article_key_falls_back_from_guid_to_url_to_title() {
        let sync_account = LocalSyncAccountId("sync-account-a".to_string());
        let url_key = generate_local_sync_article_key(
            &sync_account,
            "https://example.com/feed.xml",
            LocalSyncEntryIdentity {
                guid: Some("  ".to_string()),
                url: Some("https://example.com/post".to_string()),
                title: Some("Title".to_string()),
            },
        )
        .expect("url fallback should generate key");
        let title_key = generate_local_sync_article_key(
            &sync_account,
            "https://example.com/feed.xml",
            LocalSyncEntryIdentity {
                guid: None,
                url: None,
                title: Some("Title".to_string()),
            },
        )
        .expect("title fallback should generate key");

        assert_eq!(url_key.identity_kind, LocalSyncEntryIdentityKind::Url);
        assert_eq!(title_key.identity_kind, LocalSyncEntryIdentityKind::Title);
        assert_ne!(url_key.key, title_key.key);
    }

    #[test]
    fn read_and_star_merge_uses_latest_operation_per_field() {
        let key = article_key();
        let result = merge_local_account_sync_operations([
            op(
                "read-new",
                ts(30),
                LocalSyncEntityKey::Article {
                    article_key: key.clone(),
                },
                LocalSyncAction::SetRead { is_read: true },
            ),
            op(
                "read-old",
                ts(10),
                LocalSyncEntityKey::Article {
                    article_key: key.clone(),
                },
                LocalSyncAction::SetRead { is_read: false },
            ),
            op(
                "star",
                ts(20),
                LocalSyncEntityKey::Article {
                    article_key: key.clone(),
                },
                LocalSyncAction::SetStarred { is_starred: true },
            ),
        ]);

        let article = result
            .projection
            .articles
            .get(&key)
            .expect("merged article should exist");
        assert_eq!(article.is_read, Some(true));
        assert_eq!(article.is_starred, Some(true));
        assert_eq!(result.applied_operations, 3);
        assert!(result.rejected_operations.is_empty());
    }

    #[test]
    fn feed_and_folder_merge_uses_latest_operations_without_db_ids() {
        let feed_url =
            normalize_feed_url("https://example.com/feed.xml").expect("feed URL should normalize");
        let folder_name = normalize_tag_name(" Tech ").expect("folder name should normalize");
        let result = merge_local_account_sync_operations([
            op(
                "folder-old",
                ts(10),
                LocalSyncEntityKey::Folder {
                    normalized_name: folder_name.clone(),
                },
                LocalSyncAction::UpsertFolder {
                    display_name: "Tech".to_string(),
                    sort_order: 0,
                },
            ),
            op(
                "folder-new",
                ts(20),
                LocalSyncEntityKey::Folder {
                    normalized_name: folder_name.clone(),
                },
                LocalSyncAction::UpsertFolder {
                    display_name: "Engineering".to_string(),
                    sort_order: 1,
                },
            ),
            op(
                "feed-old",
                ts(10),
                LocalSyncEntityKey::Feed {
                    normalized_feed_url: feed_url.clone(),
                },
                LocalSyncAction::UpsertFeed {
                    title: "Old".to_string(),
                    site_url: "https://example.com".to_string(),
                    folder_name: Some("Tech".to_string()),
                },
            ),
            op(
                "feed-new",
                ts(20),
                LocalSyncEntityKey::Feed {
                    normalized_feed_url: feed_url.clone(),
                },
                LocalSyncAction::UpsertFeed {
                    title: "New".to_string(),
                    site_url: "https://example.com/blog".to_string(),
                    folder_name: None,
                },
            ),
        ]);

        let folder = result
            .projection
            .folders
            .get(&folder_name)
            .expect("folder should merge by normalized name");
        assert_eq!(folder.display_name, "Engineering");
        assert_eq!(folder.sort_order, 1);
        let feed = result
            .projection
            .feeds
            .get(&feed_url)
            .expect("feed should merge by normalized feed URL");
        assert_eq!(feed.title, "New");
        assert_eq!(feed.folder_name, None);
    }

    #[test]
    fn tag_and_article_tag_merge_preserves_remove_tombstones() {
        let key = article_key();
        let tag = normalize_tag_name(" Tech ").expect("tag name should normalize");
        let result = merge_local_account_sync_operations([
            op(
                "tag-add",
                ts(10),
                LocalSyncEntityKey::Tag {
                    normalized_name: tag.clone(),
                },
                LocalSyncAction::AddTag {
                    display_name: "Tech".to_string(),
                },
            ),
            op(
                "article-tag-add",
                ts(20),
                LocalSyncEntityKey::ArticleTag {
                    article_key: key.clone(),
                    normalized_tag_name: tag.clone(),
                },
                LocalSyncAction::AddArticleTag,
            ),
            op(
                "article-tag-remove",
                ts(30),
                LocalSyncEntityKey::ArticleTag {
                    article_key: key.clone(),
                    normalized_tag_name: tag.clone(),
                },
                LocalSyncAction::RemoveArticleTag,
            ),
            op(
                "article-tag-stale-add",
                ts(25),
                LocalSyncEntityKey::ArticleTag {
                    article_key: key.clone(),
                    normalized_tag_name: tag.clone(),
                },
                LocalSyncAction::AddArticleTag,
            ),
        ]);

        assert!(result.projection.tags.contains_key(&tag));
        assert!(!result
            .projection
            .article_tags
            .contains(&(key.clone(), tag.clone())));
        assert_eq!(
            result
                .projection
                .article_tag_tombstones
                .get(&(key, tag))
                .copied(),
            Some(ts(30))
        );
    }

    #[test]
    fn mute_keyword_merge_preserves_remove_tombstones() {
        let keyword = normalize_mute_keyword(" Kindle ").expect("keyword should normalize");
        let scope = "title".to_string();
        let result = merge_local_account_sync_operations([
            op(
                "mute-add",
                ts(10),
                LocalSyncEntityKey::MuteKeyword {
                    normalized_keyword: keyword.clone(),
                    scope: scope.clone(),
                },
                LocalSyncAction::UpsertMuteKeyword,
            ),
            op(
                "mute-remove",
                ts(20),
                LocalSyncEntityKey::MuteKeyword {
                    normalized_keyword: keyword.clone(),
                    scope: scope.clone(),
                },
                LocalSyncAction::RemoveMuteKeyword,
            ),
            op(
                "mute-stale-add",
                ts(15),
                LocalSyncEntityKey::MuteKeyword {
                    normalized_keyword: keyword.clone(),
                    scope: scope.clone(),
                },
                LocalSyncAction::UpsertMuteKeyword,
            ),
        ]);

        let key = (keyword, scope);
        assert!(!result.projection.mute_keywords.contains_key(&key));
        assert_eq!(
            result.projection.mute_keyword_tombstones.get(&key).copied(),
            Some(ts(20))
        );
    }

    #[test]
    fn feed_folder_conflicts_are_kept_in_projection() {
        let feed_url =
            normalize_feed_url("https://example.com/feed.xml").expect("feed URL should normalize");
        let result = merge_local_account_sync_operations([op(
            "conflict",
            ts(10),
            LocalSyncEntityKey::Feed {
                normalized_feed_url: feed_url.clone(),
            },
            LocalSyncAction::ReportFeedFolderConflict {
                reason: "feed moved while folder was removed".to_string(),
            },
        )]);

        assert_eq!(result.projection.feed_folder_conflicts.len(), 1);
        assert_eq!(
            result.projection.feed_folder_conflicts[0].entity_key,
            LocalSyncEntityKey::Feed {
                normalized_feed_url: feed_url,
            }
        );
    }

    #[test]
    fn parse_operation_rejects_schema_mismatch_before_merge() {
        let operation = op(
            "op-1",
            ts(10),
            LocalSyncEntityKey::Article {
                article_key: article_key(),
            },
            LocalSyncAction::SetRead { is_read: true },
        );
        let mut file = operation_file(operation);
        file.version = LOCAL_ACCOUNT_SYNC_SCHEMA_VERSION + 1;
        let content =
            serde_json::to_string(&file).expect("test operation file should serialize to JSON");

        let error = parse_operation_file(&content)
            .expect_err("schema mismatch should reject operation before merge");
        assert!(error
            .to_string()
            .contains("Unsupported local sync operation version"));
    }
}
