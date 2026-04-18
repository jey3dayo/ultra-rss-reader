use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProviderKind {
    Local,
    FreshRss,
}

#[derive(Debug, Clone)]
pub enum FeedIdentifier {
    Local { feed_url: String },
    Remote { remote_id: String },
}

#[derive(Debug, Clone)]
pub enum PullScope {
    Feed(FeedIdentifier),
    All,
    Unread,
    Starred,
}

#[derive(Debug, Clone, Default)]
pub struct SyncCursor {
    pub continuation: Option<String>,
    pub since: Option<DateTime<Utc>>,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
}

#[derive(Debug, Clone)]
pub struct PullResult {
    pub entries: Vec<RemoteEntry>,
    pub next_cursor: Option<SyncCursor>,
    pub has_more: bool,
    pub not_modified: bool,
    pub skipped_entries: usize,
}

#[derive(Debug, Clone)]
pub struct RemoteEntry {
    pub id: Option<String>,
    pub source_feed_id: FeedIdentifier,
    pub title: String,
    pub content: String,
    pub summary: Option<String>,
    pub url: Option<String>,
    pub published_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub thumbnail: Option<String>,
    pub author: Option<String>,
    pub is_read: Option<bool>,
    pub is_starred: Option<bool>,
}

#[derive(Debug, Clone)]
pub struct RemoteSubscription {
    pub remote_id: String,
    pub title: String,
    pub url: String,
    pub site_url: String,
    pub folder_remote_id: Option<String>,
    pub icon_url: Option<String>,
}

#[derive(Debug, Clone)]
pub struct RemoteFolder {
    pub remote_id: String,
    pub name: String,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Clone, Default)]
pub struct RemoteState {
    pub read_ids: Vec<String>,
    pub starred_ids: Vec<String>,
}

#[derive(Debug, Clone)]
pub enum Mutation {
    MarkRead {
        remote_entry_id: String,
    },
    MarkUnread {
        remote_entry_id: String,
    },
    SetStarred {
        remote_entry_id: String,
        starred: bool,
    },
}

#[derive(Debug, Clone)]
pub struct ProviderCapabilities {
    pub supports_folders: bool,
    pub supports_starring: bool,
    pub supports_search: bool,
    pub supports_delta_sync: bool,
    pub supports_remote_state: bool,
}
