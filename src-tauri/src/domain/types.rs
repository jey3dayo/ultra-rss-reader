use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AccountId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct FeedId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct FolderId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ArticleId(pub String);

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TagId(pub String);

impl Default for AccountId {
    fn default() -> Self {
        Self::new()
    }
}

impl AccountId {
    pub fn new() -> Self {
        Self(uuid::Uuid::new_v4().to_string())
    }
}

impl Default for FeedId {
    fn default() -> Self {
        Self::new()
    }
}

impl FeedId {
    pub fn new() -> Self {
        Self(uuid::Uuid::new_v4().to_string())
    }
}

impl Default for FolderId {
    fn default() -> Self {
        Self::new()
    }
}

impl FolderId {
    pub fn new() -> Self {
        Self(uuid::Uuid::new_v4().to_string())
    }
}

impl std::fmt::Display for AccountId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::fmt::Display for FeedId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::fmt::Display for FolderId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Default for TagId {
    fn default() -> Self {
        Self::new()
    }
}

impl TagId {
    pub fn new() -> Self {
        Self(uuid::Uuid::new_v4().to_string())
    }
}

impl std::fmt::Display for ArticleId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::fmt::Display for TagId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl AsRef<str> for AccountId {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl AsRef<str> for FeedId {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl AsRef<str> for FolderId {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl AsRef<str> for ArticleId {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl AsRef<str> for TagId {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_ids_are_unique() {
        let a = AccountId::new();
        let b = AccountId::new();
        assert_ne!(a, b);
    }

    #[test]
    fn display_returns_inner_string() {
        let id = AccountId("test-123".to_string());
        assert_eq!(id.to_string(), "test-123");
    }
}
