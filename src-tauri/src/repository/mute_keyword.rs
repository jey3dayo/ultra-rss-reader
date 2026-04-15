use crate::domain::error::DomainResult;
use crate::domain::mute_keyword::{MuteKeyword, MuteKeywordScope};

pub trait MuteKeywordRepository {
    fn find_all(&self) -> DomainResult<Vec<MuteKeyword>>;
    fn create(&self, keyword: &str, scope: MuteKeywordScope) -> DomainResult<MuteKeyword>;
    fn update_scope(
        &self,
        mute_keyword_id: &str,
        scope: MuteKeywordScope,
    ) -> DomainResult<MuteKeyword>;
    fn delete(&self, mute_keyword_id: &str) -> DomainResult<()>;
    fn has_any(&self) -> DomainResult<bool>;
}
