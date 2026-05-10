use serde::{Deserialize, Serialize};

use crate::domain::error::{DomainError, DomainResult};
use crate::domain::types::{AccountId, FolderId};

pub const FOLDER_NAME_MAX_CHARS: usize = 100;

pub fn normalize_folder_name(name: &str) -> DomainResult<String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(DomainError::Validation(
            "Folder name cannot be empty".to_string(),
        ));
    }
    if name.chars().count() > FOLDER_NAME_MAX_CHARS {
        return Err(DomainError::Validation(format!(
            "Folder name must be {FOLDER_NAME_MAX_CHARS} characters or less"
        )));
    }
    Ok(name.to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub id: FolderId,
    pub account_id: AccountId,
    pub remote_id: Option<String>,
    pub name: String,
    pub sort_order: i32,
}

#[cfg(test)]
mod tests {
    use super::{normalize_folder_name, FOLDER_NAME_MAX_CHARS};

    #[test]
    fn normalize_folder_name_matches_feed_and_tag_trim_policy() {
        assert_eq!(normalize_folder_name("  News  ").unwrap(), "News");
        assert_eq!(
            normalize_folder_name("\u{3000}News\u{00a0}").unwrap(),
            "News"
        );
        assert_eq!(
            normalize_folder_name("Dev\u{3000}\tNews").unwrap(),
            "Dev\u{3000}\tNews"
        );
        assert_eq!(normalize_folder_name("Ｆｅｅｄ").unwrap(), "Ｆｅｅｄ");
    }

    #[test]
    fn normalize_folder_name_validates_after_trim() {
        assert!(normalize_folder_name(" \u{3000}\t ").is_err());
        assert!(normalize_folder_name(&"a".repeat(FOLDER_NAME_MAX_CHARS + 1)).is_err());
        assert_eq!(
            normalize_folder_name(&format!(" {} ", "a".repeat(FOLDER_NAME_MAX_CHARS))).unwrap(),
            "a".repeat(FOLDER_NAME_MAX_CHARS)
        );
    }
}
