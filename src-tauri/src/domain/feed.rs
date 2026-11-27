use serde::{Deserialize, Serialize};

use crate::domain::types::{AccountId, FeedId, FolderId};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Feed {
    pub id: FeedId,
    pub account_id: AccountId,
    pub folder_id: Option<FolderId>,
    pub remote_id: Option<String>,
    pub title: String,
    pub url: String,
    pub site_url: String,
    pub icon: Option<Vec<u8>>,
    pub icon_url: Option<String>,
    pub unread_count: i32,
    pub reader_mode: String,
    pub web_preview_mode: String,
    /// Assigned by the database on insert and never overwritten, so callers pass `None`.
    /// Approximation: a feed recreated by import or re-subscription starts a new clock, and
    /// feeds that predate the column start at the migration time.
    pub created_at: Option<String>,
}
