use crate::domain::article::Article;
use crate::domain::error::DomainResult;
use crate::domain::tag::Tag;
use crate::domain::types::{ArticleId, TagId};
use crate::repository::article::Pagination;

pub trait TagRepository {
    fn find_all(&self) -> DomainResult<Vec<Tag>>;
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
    ) -> DomainResult<Vec<Article>>;
    /// Returns article counts per tag as (tag_id, count) pairs.
    fn count_articles_per_tag(&self) -> DomainResult<Vec<(TagId, usize)>>;
}
