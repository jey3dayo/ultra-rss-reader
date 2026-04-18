use serde::{Deserialize, Serialize};

use crate::domain::provider::ProviderKind;
use crate::domain::types::AccountId;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionVerificationStatus {
    Verified,
    #[default]
    Unverified,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: AccountId,
    pub kind: ProviderKind,
    pub name: String,
    pub server_url: Option<String>,
    pub username: Option<String>,
    pub sync_interval_secs: i64,
    pub sync_on_startup: bool,
    pub sync_on_wake: bool,
    pub keep_read_items_days: i64,
    pub connection_verification_status: ConnectionVerificationStatus,
    pub connection_verified_at: Option<String>,
    pub connection_verification_error: Option<String>,
}
