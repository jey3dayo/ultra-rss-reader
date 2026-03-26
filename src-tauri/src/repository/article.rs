use chrono::{DateTime, Utc};

use crate::domain::article::Article;
use crate::domain::error::DomainResult;
use crate::domain::types::{AccountId, ArticleId, FeedId};

pub struct Pagination {
    pub offset: usize,
    pub limit: usize,
}

impl Default for Pagination {
    fn default() -> Self {
        Self {
            offset: 0,
            limit: 50,
        }
    }
}

pub trait ArticleRepository {
    fn find_by_feed(&self, feed_id: &FeedId, pagination: &Pagination)
        -> DomainResult<Vec<Article>>;
    fn upsert(&self, articles: &[Article]) -> DomainResult<()>;
    fn mark_as_read(&self, id: &ArticleId) -> DomainResult<()>;
    fn mark_as_starred(&self, id: &ArticleId, starred: bool) -> DomainResult<()>;
    fn purge_old_read(&self, before: DateTime<Utc>) -> DomainResult<u64>;
    fn update_sanitized(&self, id: &ArticleId, sanitized: &str, version: u32) -> DomainResult<()>;
    fn find_by_sanitizer_version_below(
        &self,
        version: u32,
        limit: usize,
    ) -> DomainResult<Vec<Article>>;
    fn apply_remote_state(
        &self,
        account_id: &AccountId,
        read_remote_ids: &[String],
        starred_remote_ids: &[String],
        pending_remote_ids: &[String],
    ) -> DomainResult<()>;
}
