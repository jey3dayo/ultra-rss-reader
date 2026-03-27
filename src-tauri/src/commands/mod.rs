pub mod account_commands;
pub mod article_commands;
pub mod dto;
pub mod feed_commands;
pub mod opml_commands;
pub mod preference_commands;

use std::sync::Mutex;

use crate::infra::db::connection::DbManager;

pub struct AppState {
    pub db: Mutex<DbManager>,
}
