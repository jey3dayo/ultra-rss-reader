use std::collections::{BTreeMap, BTreeSet};

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::domain::error::{DomainError, DomainResult};

mod apply;

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
        #[serde(default)]
        icon_url: Option<String>,
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
    pub icon_url: Option<String>,
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
        match apply::apply_operation(&mut projection, &operation) {
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

fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests;
