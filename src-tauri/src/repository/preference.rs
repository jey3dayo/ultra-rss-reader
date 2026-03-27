use std::collections::HashMap;

use crate::domain::error::DomainResult;

pub trait PreferenceRepository {
    fn get_all(&self) -> DomainResult<HashMap<String, String>>;
    fn get(&self, key: &str) -> DomainResult<Option<String>>;
    fn set(&self, key: &str, value: &str) -> DomainResult<()>;
}
