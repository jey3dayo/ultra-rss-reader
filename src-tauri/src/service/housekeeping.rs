use chrono::{DateTime, Utc};

use crate::domain::error::DomainResult;
use crate::repository::article::ArticleRepository;

pub fn purge_old_articles(
    repo: &dyn ArticleRepository,
    before: DateTime<Utc>,
) -> DomainResult<u64> {
    repo.purge_old_read(before)
}
