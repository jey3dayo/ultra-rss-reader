use async_trait::async_trait;
use serde::Serialize;
use serde_json::json;

use crate::domain::feed::Feed;
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::repository::account::AccountRepository;
use crate::repository::feed::FeedRepository;

use crate::cli::command::{CliCommand, CommandOutput};
use crate::cli::error::CliResult;
use crate::cli::route::{Capability, NetworkAccess, Route};

const CAPABILITIES: &[Capability] = &[Capability::DbRead];

pub(crate) struct FeedListCommand {
    pub(crate) account: Option<String>,
    pub(crate) folder: Option<String>,
}

#[derive(Serialize)]
struct FeedListItem {
    id: String,
    account: String,
    folder: Option<String>,
    title: String,
    url: String,
    unread_count: i32,
    latest_published_at: Option<String>,
    latest_fetched_at: Option<String>,
}

#[async_trait(?Send)]
impl CliCommand for FeedListCommand {
    fn capabilities(&self) -> &'static [Capability] {
        CAPABILITIES
    }

    async fn run(&self, route: Route, _network: NetworkAccess) -> CliResult<CommandOutput> {
        let Route::ReadOnly(db) = route else {
            unreachable!(
                "FeedListCommand declares Capability::DbRead; dispatcher must route ReadOnly"
            );
        };

        let now = chrono::Utc::now();
        let items: Vec<FeedListItem> = db.with_conn(|conn| {
            let account_repo = SqliteAccountRepository::new(conn);
            let feed_repo = SqliteFeedRepository::new(conn);
            let article_repo = SqliteArticleRepository::new(conn);

            let accounts = account_repo.find_all()?;
            let mut items = Vec::new();
            for account in accounts
                .iter()
                .filter(|account| self.account.as_deref().is_none_or(|id| id == account.id.0))
            {
                let feeds: Vec<Feed> = feed_repo
                    .find_by_account(&account.id)?
                    .into_iter()
                    .filter(|feed| {
                        self.folder.as_deref().is_none_or(|folder_id| {
                            feed.folder_id.as_ref().is_some_and(|id| id.0 == folder_id)
                        })
                    })
                    .collect();
                if feeds.is_empty() {
                    continue;
                }

                let stats = article_repo.feed_article_stats_by_account(&account.id, now)?;
                for feed in feeds {
                    let feed_stats = stats.get(&feed.id).cloned().unwrap_or_default();
                    items.push(FeedListItem {
                        id: feed.id.0.clone(),
                        account: account.id.0.clone(),
                        folder: feed.folder_id.as_ref().map(|id| id.0.clone()),
                        title: feed.title,
                        url: feed.url,
                        unread_count: feed.unread_count,
                        latest_published_at: feed_stats
                            .latest_published_at
                            .map(|dt| dt.to_rfc3339()),
                        latest_fetched_at: feed_stats.latest_fetched_at.map(|dt| dt.to_rfc3339()),
                    });
                }
            }
            Ok(items)
        })?;

        let human = if items.is_empty() {
            "no feeds matched".to_string()
        } else {
            items
                .iter()
                .map(|item| {
                    format!(
                        "{} [{}] {} unread={} latest_published_at={:?}",
                        item.id,
                        item.account,
                        item.title,
                        item.unread_count,
                        item.latest_published_at
                    )
                })
                .collect::<Vec<_>>()
                .join("\n")
        };

        let json_data = json!({ "feeds": items });

        Ok(CommandOutput {
            human,
            json_data,
            exit_code: None,
        })
    }
}
