use serde::{Deserialize, Serialize};

use crate::domain::types::{AccountId, FolderId};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub id: FolderId,
    pub account_id: AccountId,
    pub remote_id: Option<String>,
    pub name: String,
    pub sort_order: i32,
}
