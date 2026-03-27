use serde::{Deserialize, Serialize};

use crate::domain::types::TagId;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: TagId,
    pub name: String,
    pub color: Option<String>,
}
