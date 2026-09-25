use std::collections::{HashMap, HashSet};

use async_trait::async_trait;
use serde_json::{json, Value};

use crate::domain::account::Account;
use crate::domain::error::DomainError;
use crate::domain::feed::Feed;
use crate::domain::provider::{FeedIdentifier, ProviderKind, PullScope};
use crate::infra::db::sqlite_account::SqliteAccountRepository;
use crate::infra::db::sqlite_article::SqliteArticleRepository;
use crate::infra::db::sqlite_feed::SqliteFeedRepository;
use crate::infra::db::sqlite_sync_state::SqliteSyncStateRepository;
use crate::infra::provider::local::LocalProvider;
use crate::infra::provider::traits::FeedProvider;
use crate::repository::account::AccountRepository;
use crate::repository::feed::FeedRepository;
use crate::repository::sync_state::{SyncStateRepository, SyncStateScopeKey};

use crate::cli::command::{CliCommand, CommandOutput};
use crate::cli::error::{CliError, CliResult};
use crate::cli::exit_code::CliExitCode;
use crate::cli::route::{Capability, NetworkAccess, Route};

use super::super::provider_kind_label;
use super::super::sync_state_view::{timestamp_usec_to_rfc3339, SyncStateView};
use super::verdict::{derive_verdict, Hint, SourceStatus, VerdictInput};

struct SourceOutcome {
    status: SourceStatus,
    newest: Option<chrono::DateTime<chrono::Utc>>,
    entry_dates: Vec<chrono::DateTime<chrono::Utc>>,
    json: Value,
}

const CAPABILITIES: &[Capability] = &[Capability::DbRead, Capability::Network];

pub(crate) struct FeedDiagnoseCommand {
    pub(crate) query: String,
    pub(crate) account: Option<String>,
}

struct MatchDbData {
    account: Account,
    feed: Feed,
    app_article_count: i64,
    app_newest_published_at: Option<chrono::DateTime<chrono::Utc>>,
    app_newest_fetched_at: Option<chrono::DateTime<chrono::Utc>>,
    feed_scope: Option<SyncStateView>,
    account_greader_all: Option<SyncStateView>,
    account_greader_all_timestamp_rfc3339: Option<String>,
    account_greader_all_last_success_at: Option<chrono::DateTime<chrono::Utc>>,
    account_greader_remote_state_full: Option<SyncStateView>,
    scheduler: Option<SyncStateView>,
    local_feed_scope: Option<SyncStateView>,
}

fn error_class(error: &DomainError) -> &'static str {
    match error {
        DomainError::Network(_) => "network",
        DomainError::RateLimit(_) | DomainError::RateLimitWithRetryAfter { .. } => "rate_limit",
        DomainError::Parse(_) => "parse",
        DomainError::Persistence(_) => "persistence",
        DomainError::Auth(_) => "auth",
        DomainError::Validation(_) => "validation",
        DomainError::Keychain(_) => "keychain",
        DomainError::Migration(_) => "migration",
    }
}

#[async_trait(?Send)]
impl CliCommand for FeedDiagnoseCommand {
    fn capabilities(&self) -> &'static [Capability] {
        CAPABILITIES
    }

    async fn run(&self, route: Route, network: NetworkAccess) -> CliResult<CommandOutput> {
        let Route::ReadOnly(db) = route else {
            unreachable!(
                "FeedDiagnoseCommand declares Capability::DbRead; dispatcher must route ReadOnly"
            );
        };

        let matches: Vec<MatchDbData> = db.with_conn(|conn| self.load_matches(conn))?;
        if matches.is_empty() {
            return Err(CliError::not_found(format!(
                "no feed matched id or url {:?}",
                self.query
            )));
        }

        // Source layer: fetched with no DB connection open (design doc's WAL
        // read-mark constraint, this task's MUST #1). Distinct URLs are
        // fetched once each; an id match is always a single URL, and a url
        // match's candidates all share the queried URL by construction.
        let mut source_by_url: HashMap<String, SourceOutcome> = HashMap::new();
        if matches!(network, NetworkAccess::Allowed) {
            let provider = LocalProvider::try_new()?;
            let distinct_urls: HashSet<String> =
                matches.iter().map(|m| m.feed.url.clone()).collect();
            for url in distinct_urls {
                let outcome = match provider
                    .pull_entries(
                        PullScope::Feed(FeedIdentifier::Local {
                            feed_url: url.clone(),
                        }),
                        None,
                    )
                    .await
                {
                    Ok(result) => {
                        let entry_dates: Vec<chrono::DateTime<chrono::Utc>> = result
                            .entries
                            .iter()
                            .filter_map(|entry| entry.published_at.or(entry.updated_at))
                            .collect();
                        let newest = entry_dates.iter().copied().max();
                        SourceOutcome {
                            status: SourceStatus::Fetched,
                            newest,
                            entry_dates,
                            json: json!({
                                "status": "fetched",
                                "entry_count": result.entries.len(),
                                "newest_entry_at": newest.map(|dt| dt.to_rfc3339()),
                            }),
                        }
                    }
                    Err(error) => SourceOutcome {
                        status: SourceStatus::Unreachable,
                        newest: None,
                        entry_dates: Vec::new(),
                        json: json!({
                            "status": "unreachable",
                            "error_class": error_class(&error),
                            "message": error.to_string(),
                        }),
                    },
                };
                source_by_url.insert(url, outcome);
            }
        }

        let mut sections = Vec::with_capacity(matches.len());
        let mut any_unhealthy = false;
        for data in matches {
            let is_freshrss = data.account.kind == ProviderKind::FreshRss;
            let (source_json, source_status, source_newest, source_entry_dates) = if matches!(
                network,
                NetworkAccess::Allowed
            ) {
                match source_by_url.get(&data.feed.url) {
                    Some(outcome) => (
                        outcome.json.clone(),
                        outcome.status,
                        outcome.newest,
                        outcome.entry_dates.clone(),
                    ),
                    None => (
                        json!({ "status": "unreachable", "error_class": "network", "message": "source fetch did not run" }),
                        SourceStatus::Unreachable,
                        None,
                        Vec::new(),
                    ),
                }
            } else {
                (
                    json!({ "status": "skipped" }),
                    SourceStatus::Skipped,
                    None,
                    Vec::new(),
                )
            };

            let outcome = derive_verdict(&VerdictInput {
                provider_kind: data.account.kind.clone(),
                source_status,
                source_newest,
                source_entry_dates,
                app_newest_published_at: data.app_newest_published_at,
                account_last_success_at: data.account_greader_all_last_success_at,
            });
            if outcome.verdict.is_unhealthy() {
                any_unhealthy = true;
            }

            let mut section = json!({
                "account_id": data.account.id.0,
                "feed_id": data.feed.id.0,
                "feed_url": data.feed.url,
                "provider_kind": provider_kind_label(&data.account.kind),
                "source": source_json,
                "app": {
                    "article_count": data.app_article_count,
                    "newest_published_at": data.app_newest_published_at.map(|dt| dt.to_rfc3339()),
                    "newest_fetched_at": data.app_newest_fetched_at.map(|dt| dt.to_rfc3339()),
                },
                "sync_state": {
                    "feed": data.feed_scope,
                    "account_greader_all": data.account_greader_all,
                    "account_greader_all_timestamp": data.account_greader_all_timestamp_rfc3339,
                    "account_greader_remote_state_full": data.account_greader_remote_state_full,
                    "scheduler": data.scheduler,
                    "local_feed": data.local_feed_scope,
                },
                "verdict": outcome.verdict.as_str(),
                "hint": outcome.hint.map(Hint::as_str),
            });
            if is_freshrss {
                section["missed_before_last_sync"] = json!(outcome.missed_before_last_sync);
            }
            sections.push(section);
        }

        let human = sections
            .iter()
            .map(|section| {
                format!(
                    "{} ({}) verdict={} hint={}",
                    section["feed_id"],
                    section["provider_kind"],
                    section["verdict"],
                    section["hint"]
                )
            })
            .collect::<Vec<_>>()
            .join("\n");

        Ok(CommandOutput {
            human,
            json_data: json!({ "matches": sections }),
            exit_code: any_unhealthy.then_some(CliExitCode::DiagnosisUnhealthy),
        })
    }
}

impl FeedDiagnoseCommand {
    fn load_matches(&self, conn: &rusqlite::Connection) -> CliResult<Vec<MatchDbData>> {
        let account_repo = SqliteAccountRepository::new(conn);
        let feed_repo = SqliteFeedRepository::new(conn);
        let article_repo = SqliteArticleRepository::new(conn);
        let sync_state_repo = SqliteSyncStateRepository::new(conn);

        let accounts = account_repo.find_all()?;
        let mut matches = Vec::new();
        for account in accounts
            .into_iter()
            .filter(|account| self.account.as_deref().is_none_or(|id| id == account.id.0))
        {
            let feeds = feed_repo.find_by_account(&account.id)?;
            let stats = article_repo.feed_article_stats_by_account(&account.id)?;
            for feed in feeds
                .into_iter()
                .filter(|feed| feed.id.0 == self.query || feed.url == self.query)
            {
                let feed_stats = stats.get(&feed.id).cloned().unwrap_or_default();

                let scheduler = sync_state_repo
                    .get(&account.id, SyncStateScopeKey::scheduler())?
                    .map(SyncStateView::from);

                let (
                    feed_scope,
                    account_greader_all,
                    account_greader_all_timestamp_rfc3339,
                    account_greader_all_last_success_at,
                    account_greader_remote_state_full,
                    local_feed_scope,
                ) = if account.kind == ProviderKind::FreshRss {
                    let account_greader_all_state = sync_state_repo
                        .get(&account.id, SyncStateScopeKey::greader_account_all())?;
                    let account_greader_all_timestamp_rfc3339 = account_greader_all_state
                        .as_ref()
                        .and_then(|state| state.timestamp_usec)
                        .and_then(timestamp_usec_to_rfc3339);
                    let account_greader_all_last_success_at = account_greader_all_state
                        .as_ref()
                        .and_then(|state| state.last_success_at.as_deref())
                        .and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok())
                        .map(|dt| dt.with_timezone(&chrono::Utc));
                    let feed_scope = match feed.remote_id.as_deref() {
                        Some(remote_id) => sync_state_repo
                            .get(&account.id, SyncStateScopeKey::feed(remote_id))?
                            .map(SyncStateView::from),
                        None => None,
                    };
                    let account_greader_remote_state_full = sync_state_repo
                        .get(&account.id, SyncStateScopeKey::greader_remote_state_full())?
                        .map(SyncStateView::from);
                    (
                        feed_scope,
                        account_greader_all_state.map(SyncStateView::from),
                        account_greader_all_timestamp_rfc3339,
                        account_greader_all_last_success_at,
                        account_greader_remote_state_full,
                        None,
                    )
                } else {
                    let local_feed_scope = sync_state_repo
                        .get(&account.id, SyncStateScopeKey::local_feed(feed.url.clone()))?
                        .map(SyncStateView::from);
                    (None, None, None, None, None, local_feed_scope)
                };

                matches.push(MatchDbData {
                    account: account.clone(),
                    feed,
                    app_article_count: feed_stats.article_count,
                    app_newest_published_at: feed_stats.latest_published_at,
                    app_newest_fetched_at: feed_stats.latest_fetched_at,
                    feed_scope,
                    account_greader_all,
                    account_greader_all_timestamp_rfc3339,
                    account_greader_all_last_success_at,
                    account_greader_remote_state_full,
                    scheduler,
                    local_feed_scope,
                });
            }
        }
        Ok(matches)
    }
}
