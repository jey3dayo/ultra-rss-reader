use serde::{Deserialize, Serialize};

use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: AccountId,
    pub kind: ProviderKind,
    pub name: String,
    pub server_url: Option<String>,
    pub username: Option<String>,
    pub sync_interval_secs: i64,
    pub sync_on_wake: bool,
    pub keep_read_items_days: i64,
}
