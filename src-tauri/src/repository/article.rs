use chrono::{DateTime, Utc};

use crate::domain::article::{Article, ArticleViewHistoryItem};
use crate::domain::error::DomainResult;
use crate::domain::types::{AccountId, ArticleId, FeedId, FolderId};

pub struct Pagination {
    pub offset: usize,
    pub limit: usize,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ArticleListMode {
    All,
    Unread,
    Starred,
}

impl ArticleListMode {
    pub fn from_optional_str(value: Option<&str>) -> Result<Self, String> {
        match value.unwrap_or("all") {
            "all" => Ok(Self::All),
            "unread" => Ok(Self::Unread),
            "starred" => Ok(Self::Starred),
            other => Err(format!("Invalid article list mode: {other}")),
        }
    }

    pub fn sql_filter(self, article_alias: &str) -> Option<String> {
        match self {
            Self::All => None,
            Self::Unread => Some(format!("{article_alias}.is_read = 0")),
            Self::Starred => Some(format!("{article_alias}.is_starred = 1")),
        }
    }
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
    fn find_unread_by_feed(
        &self,
        feed_id: &FeedId,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>>;
    fn find_starred_by_feed(
        &self,
        feed_id: &FeedId,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>>;
    fn find_by_account(
        &self,
        account_id: &AccountId,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>>;
    fn find_unread_by_account(
        &self,
        account_id: &AccountId,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>>;
    fn find_by_folder(
        &self,
        folder_id: &FolderId,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>>;
    fn find_unread_by_folder(
        &self,
        folder_id: &FolderId,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>>;
    fn find_starred_by_folder(
        &self,
        folder_id: &FolderId,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>>;
    fn find_starred_by_account(
        &self,
        account_id: &AccountId,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>>;
    fn find_recently_viewed_by_account(
        &self,
        account_id: &AccountId,
        pagination: &Pagination,
        mode: ArticleListMode,
    ) -> DomainResult<Vec<ArticleViewHistoryItem>>;
    fn count_unread_by_account(&self, account_id: &AccountId) -> DomainResult<i32>;
    fn count_starred_by_account(&self, account_id: &AccountId) -> DomainResult<i32>;
    fn record_view(&self, account_id: &AccountId, article_id: &ArticleId) -> DomainResult<()>;
    fn clear_view_history(&self, account_id: &AccountId) -> DomainResult<u64>;
    fn upsert(&self, articles: &[Article]) -> DomainResult<()>;
    fn mark_as_read(&self, id: &ArticleId, read: bool) -> DomainResult<()>;
    fn mark_many_as_read(&self, ids: &[ArticleId]) -> DomainResult<()>;
    fn mark_muted_unread_as_read(
        &self,
        account_id: &AccountId,
        candidate_ids: Option<&[ArticleId]>,
    ) -> DomainResult<usize>;
    fn mark_feed_as_read(&self, feed_id: &FeedId) -> DomainResult<u64>;
    fn mark_folder_as_read(&self, folder_id: &FolderId) -> DomainResult<u64>;
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
        pending_read_remote_ids: &[String],
        pending_starred_remote_ids: &[String],
    ) -> DomainResult<()>;
    fn search(
        &self,
        account_id: &AccountId,
        query: &str,
        pagination: &Pagination,
    ) -> DomainResult<Vec<Article>>;
}
