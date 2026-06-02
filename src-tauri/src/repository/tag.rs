use crate::domain::article::{Article, ArticleListItem};
use crate::domain::error::DomainResult;
use crate::domain::tag::Tag;
use crate::domain::types::{AccountId, ArticleId, TagId};
use crate::repository::article::{ArticleListMode, Pagination};

pub trait TagRepository {
    fn find_all(&self) -> DomainResult<Vec<Tag>>;
    /// Finds tags using SQLite NOCASE semantics.
    /// This is intentionally ASCII case-insensitive; Unicode folding is not applied.
    fn find_by_name(&self, name: &str) -> DomainResult<Option<Tag>>;
    fn save(&self, tag: &Tag) -> DomainResult<()>;
    fn find_or_create(&self, tag: &Tag) -> DomainResult<Tag>;
    fn delete(&self, tag_id: &TagId) -> DomainResult<()>;
    fn find_tags_for_article(&self, article_id: &ArticleId) -> DomainResult<Vec<Tag>>;
    fn tag_article(&self, article_id: &ArticleId, tag_id: &TagId) -> DomainResult<()>;
    fn untag_article(&self, article_id: &ArticleId, tag_id: &TagId) -> DomainResult<()>;
    fn find_articles_by_tag(
        &self,
        tag_id: &TagId,
        pagination: &Pagination,
        account_id: Option<&AccountId>,
        mode: ArticleListMode,
    ) -> DomainResult<Vec<Article>>;
    fn list_articles_by_tag(
        &self,
        tag_id: &TagId,
        pagination: &Pagination,
        account_id: Option<&AccountId>,
        mode: ArticleListMode,
    ) -> DomainResult<Vec<ArticleListItem>>;
    /// Returns article counts per tag as (tag_id, count) pairs.
    /// When `account_id` is Some, only counts articles belonging to feeds of that account.
    fn count_articles_per_tag(
        &self,
        account_id: Option<&AccountId>,
    ) -> DomainResult<Vec<(TagId, usize)>>;
}
