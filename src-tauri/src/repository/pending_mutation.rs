use crate::domain::error::{DomainError, DomainResult};
use crate::domain::types::AccountId;
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PendingMutationType {
    MarkRead,
    MarkUnread,
    Star,
    Unstar,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PendingMutationAxis {
    ReadState,
    StarState,
}

impl PendingMutationType {
    pub fn parse(value: &str) -> DomainResult<Self> {
        match value {
            "mark_read" | "MarkRead" => Ok(Self::MarkRead),
            "mark_unread" | "MarkUnread" => Ok(Self::MarkUnread),
            "star" | "Star" | "set_starred" | "SetStarred" => Ok(Self::Star),
            "unstar" | "Unstar" | "unset_starred" | "UnsetStarred" => Ok(Self::Unstar),
            other => Err(DomainError::Validation(format!(
                "Unknown pending mutation type: {other}"
            ))),
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::MarkRead => "mark_read",
            Self::MarkUnread => "mark_unread",
            Self::Star => "star",
            Self::Unstar => "unstar",
        }
    }

    pub fn axis(self) -> PendingMutationAxis {
        match self {
            Self::MarkRead | Self::MarkUnread => PendingMutationAxis::ReadState,
            Self::Star | Self::Unstar => PendingMutationAxis::StarState,
        }
    }

    pub fn replacement_type_values(self) -> &'static [&'static str] {
        match self.axis() {
            PendingMutationAxis::ReadState => {
                &["mark_read", "MarkRead", "mark_unread", "MarkUnread"]
            }
            PendingMutationAxis::StarState => &[
                "star",
                "Star",
                "set_starred",
                "SetStarred",
                "unstar",
                "Unstar",
                "unset_starred",
                "UnsetStarred",
            ],
        }
    }
}

impl fmt::Display for PendingMutationType {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone)]
pub struct PendingMutation {
    pub id: Option<i64>,
    pub account_id: AccountId,
    pub mutation_type: PendingMutationType,
    pub remote_entry_id: String,
    pub created_at: String,
}

pub trait PendingMutationRepository {
    fn find_by_account(&self, account_id: &AccountId) -> DomainResult<Vec<PendingMutation>>;
    fn save(&self, mutation: &PendingMutation) -> DomainResult<()>;
    fn delete(&self, ids: &[i64]) -> DomainResult<()>;
    fn delete_by_account_remote_entry_ids_and_axis(
        &self,
        account_id: &AccountId,
        remote_entry_ids: &[String],
        axis: PendingMutationAxis,
    ) -> DomainResult<()>;
}
