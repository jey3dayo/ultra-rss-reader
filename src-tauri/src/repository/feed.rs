use crate::domain::error::DomainResult;
use crate::domain::feed::Feed;
use crate::domain::types::{AccountId, FeedId, FolderId};

pub trait FeedRepository {
    fn find_by_account(&self, account_id: &AccountId) -> DomainResult<Vec<Feed>>;
    fn save(&self, feed: &Feed) -> DomainResult<()>;
    fn update_unread_count(&self, feed_id: &FeedId, count: i32) -> DomainResult<()>;
    fn recalculate_unread_count(&self, feed_id: &FeedId) -> DomainResult<i32>;
    fn find_by_remote_id(
        &self,
        account_id: &AccountId,
        remote_id: &str,
    ) -> DomainResult<Option<Feed>>;
    fn find_by_url(&self, account_id: &AccountId, url: &str) -> DomainResult<Option<Feed>>;
    fn delete(&self, feed_id: &FeedId) -> DomainResult<()>;
    fn rename(&self, feed_id: &FeedId, title: &str) -> DomainResult<()>;
    fn update_folder(&self, feed_id: &FeedId, folder_id: Option<&FolderId>) -> DomainResult<()>;
}
