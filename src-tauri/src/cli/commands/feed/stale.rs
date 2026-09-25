use async_trait::async_trait;
use serde::Serialize;
use serde_json::json;

use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::repository::account::AccountRepository;
use crate::repository::feed::FeedRepository;

use crate::cli::command::{CliCommand, CommandOutput};
use crate::cli::error::CliResult;
use crate::cli::route::{Capability, NetworkAccess, Route};

use super::super::provider_kind_label;
use super::stale_rule::assess_staleness;

const CAPABILITIES: &[Capability] = &[Capability::DbRead];
const SAMPLE_SIZE: usize = 20;

pub(crate) struct FeedStaleCommand {
    pub(crate) account: Option<String>,
    pub(crate) min_hours: f64,
}

#[derive(Serialize)]
struct StaleFeedItem {
    id: String,
    account: String,
    kind: &'static str,
    title: String,
    url: String,
    expected_interval_hours: f64,
    age_hours: f64,
    ratio: f64,
}

#[async_trait(?Send)]
impl CliCommand for FeedStaleCommand {
    fn capabilities(&self) -> &'static [Capability] {
        CAPABILITIES
    }

    async fn run(&self, route: Route, _network: NetworkAccess) -> CliResult<CommandOutput> {
        let Route::ReadOnly(db) = route else {
            unreachable!(
                "FeedStaleCommand declares Capability::DbRead; dispatcher must route ReadOnly"
            );
        };

        let now = chrono::Utc::now();
        let mut items: Vec<StaleFeedItem> = db.with_conn(|conn| {
            let account_repo = SqliteAccountRepository::new(conn);
            let feed_repo = SqliteFeedRepository::new(conn);
            let article_repo = SqliteArticleRepository::new(conn);

            let accounts = account_repo.find_all()?;
            let mut items = Vec::new();
            for account in accounts
                .iter()
                .filter(|account| self.account.as_deref().is_none_or(|id| id == account.id.0))
            {
                for feed in feed_repo.find_by_account(&account.id)? {
                    let published_at_desc =
                        article_repo.latest_published_ats_by_feed(&feed.id, SAMPLE_SIZE)?;
                    let Some(assessment) =
                        assess_staleness(now, &published_at_desc, self.min_hours)
                    else {
                        continue;
                    };
                    if !assessment.is_stale {
                        continue;
                    }

                    items.push(StaleFeedItem {
                        id: feed.id.0.clone(),
                        account: account.id.0.clone(),
                        kind: provider_kind_label(&account.kind),
                        title: feed.title.clone(),
                        url: feed.url.clone(),
                        expected_interval_hours: assessment.expected_interval_hours,
                        age_hours: assessment.age_hours,
                        ratio: assessment.ratio,
                    });
                }
            }
            Ok(items)
        })?;

        items.sort_by(|a, b| {
            b.ratio
                .partial_cmp(&a.ratio)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let human = if items.is_empty() {
            "no stale feeds".to_string()
        } else {
            items
                .iter()
                .map(|item| {
                    format!(
                        "{} [{}] {} expected_interval={:.1}h age={:.1}h ratio={:.1}",
                        item.id,
                        item.kind,
                        item.title,
                        item.expected_interval_hours,
                        item.age_hours,
                        item.ratio
                    )
                })
                .collect::<Vec<_>>()
                .join("\n")
        };

        let json_data = json!({ "stale_feeds": items });

        Ok(CommandOutput {
            human,
            json_data,
            exit_code: None,
        })
    }
}
