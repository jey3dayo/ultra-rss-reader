use chrono::{DateTime, Duration, Utc};

use crate::domain::provider::ProviderKind;

/// Allowance for the upstream publish-to-fetch gap (crawl time), applied to
/// both provider kinds. The account's own sync interval is added on top for
/// the `behind_source` threshold.
const FRESHRSS_CRAWL_ALLOWANCE_HOURS: i64 = 1;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SourceStatus {
    Fetched,
    Unreachable,
    Skipped,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Verdict {
    Healthy,
    BehindSource,
    SourceUnreachable,
    SourceSkipped,
    NoArticles,
    AccountQuarantined,
    AwaitingFirstSync,
}

impl Verdict {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Healthy => "healthy",
            Self::BehindSource => "behind_source",
            Self::SourceUnreachable => "source_unreachable",
            Self::SourceSkipped => "source_skipped",
            Self::NoArticles => "no_articles",
            Self::AccountQuarantined => "account_quarantined",
            Self::AwaitingFirstSync => "awaiting_first_sync",
        }
    }

    /// Only `behind_source` and `source_unreachable` are unhealthy (exit 7).
    pub(crate) fn is_unhealthy(self) -> bool {
        matches!(self, Self::BehindSource | Self::SourceUnreachable)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Hint {
    FreshrssNotDelivering,
    AwaitingSync,
    LocalFetchFailing,
}

impl Hint {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::FreshrssNotDelivering => "freshrss_not_delivering",
            Self::AwaitingSync => "awaiting_sync",
            Self::LocalFetchFailing => "local_fetch_failing",
        }
    }
}

pub(crate) struct VerdictInput {
    pub(crate) provider_kind: ProviderKind,
    pub(crate) source_status: SourceStatus,
    pub(crate) source_newest: Option<DateTime<Utc>>,
    /// Every fetched entry's date (published, falling back to updated).
    /// Callers must drop future-dated entries before computing
    /// `source_newest` from this. Empty whenever `source_status` is not
    /// `Fetched`.
    pub(crate) source_entry_dates: Vec<DateTime<Utc>>,
    pub(crate) app_newest_published_at: Option<DateTime<Utc>>,
    /// The FreshRSS account's own last successful sync completion
    /// (`account:greader:all`'s `last_success_at`). Only consulted for
    /// `ProviderKind::FreshRss` when deriving the `behind_source` hint.
    pub(crate) account_last_success_at: Option<DateTime<Utc>>,
    /// `accounts.sync_interval_secs`. Added to the crawl allowance for the
    /// `behind_source` threshold: publishing sooner than one sync interval
    /// after the app's newest item isn't "behind" yet.
    pub(crate) account_sync_interval: Duration,
    /// Whether the feed-level sync_state row (`feed:<remote_id>` for
    /// FreshRSS, `local_feed:<url>` for Local) exists at all.
    pub(crate) feed_scope_synced: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct VerdictOutcome {
    pub(crate) verdict: Verdict,
    pub(crate) hint: Option<Hint>,
    /// Source entries older than `account_last_success_at - crawl_allowance`
    /// (and, if the app has articles, newer than `app_newest +
    /// crawl_allowance`). Always `0` outside FreshRSS `BehindSource`.
    pub(crate) missed_before_last_sync: usize,
}

fn count_missed_before_last_sync(
    source_entry_dates: &[DateTime<Utc>],
    app_newest: Option<DateTime<Utc>>,
    account_last_success_at: DateTime<Utc>,
) -> usize {
    let crawl_allowance = Duration::hours(FRESHRSS_CRAWL_ALLOWANCE_HOURS);
    let missed_after = app_newest.map(|date| date + crawl_allowance);
    let missed_before = account_last_success_at - crawl_allowance;
    source_entry_dates
        .iter()
        .filter(|&&date| missed_after.is_none_or(|after| date > after) && date < missed_before)
        .count()
}

/// `app_newest` is `None` when the app has zero articles: the FreshRSS
/// missed-count then drops its lower bound; Local always reports
/// `LocalFetchFailing`.
fn derive_behind_source_hint(
    input: &VerdictInput,
    app_newest: Option<DateTime<Utc>>,
) -> (Hint, usize) {
    match &input.provider_kind {
        ProviderKind::FreshRss => match input.account_last_success_at {
            Some(last_success) => {
                let missed = count_missed_before_last_sync(
                    &input.source_entry_dates,
                    app_newest,
                    last_success,
                );
                if missed >= 1 {
                    (Hint::FreshrssNotDelivering, missed)
                } else {
                    (Hint::AwaitingSync, 0)
                }
            }
            None => (Hint::AwaitingSync, 0),
        },
        ProviderKind::Local => (Hint::LocalFetchFailing, 0),
        ProviderKind::Quarantined => {
            unreachable!("account_quarantined short-circuits before this")
        }
    }
}

/// Pure verdict/hint derivation, free of DB/network access so it can be
/// unit-tested with synthetic `DateTime` inputs instead of a real fetch or
/// fixture DB.
pub(crate) fn derive_verdict(input: &VerdictInput) -> VerdictOutcome {
    let no_hint = |verdict: Verdict| VerdictOutcome {
        verdict,
        hint: None,
        missed_before_last_sync: 0,
    };

    if input.provider_kind == ProviderKind::Quarantined {
        return no_hint(Verdict::AccountQuarantined);
    }

    match input.source_status {
        SourceStatus::Skipped => return no_hint(Verdict::SourceSkipped),
        SourceStatus::Unreachable => return no_hint(Verdict::SourceUnreachable),
        SourceStatus::Fetched => {}
    }

    let Some(source_newest) = input.source_newest else {
        return match input.app_newest_published_at {
            Some(_) => no_hint(Verdict::Healthy),
            None => no_hint(Verdict::NoArticles),
        };
    };

    // No app timestamp to compare against, so any dated source entry means
    // this feed is unconditionally behind, not `NoArticles` -- unless the
    // feed has never completed its first sync at all.
    let Some(app_newest) = input.app_newest_published_at else {
        if !input.feed_scope_synced {
            return no_hint(Verdict::AwaitingFirstSync);
        }
        let (hint, missed_before_last_sync) = derive_behind_source_hint(input, None);
        return VerdictOutcome {
            verdict: Verdict::BehindSource,
            hint: Some(hint),
            missed_before_last_sync,
        };
    };

    let crawl_allowance = Duration::hours(FRESHRSS_CRAWL_ALLOWANCE_HOURS);
    if source_newest <= app_newest + crawl_allowance + input.account_sync_interval {
        return no_hint(Verdict::Healthy);
    }

    let (hint, missed_before_last_sync) = derive_behind_source_hint(input, Some(app_newest));
    VerdictOutcome {
        verdict: Verdict::BehindSource,
        hint: Some(hint),
        missed_before_last_sync,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(hour: u32) -> DateTime<Utc> {
        "2026-09-25T00:00:00Z".parse::<DateTime<Utc>>().unwrap()
            + chrono::Duration::hours(hour.into())
    }

    /// Defaults to 1h so tests keep their original 2h-slack expectations
    /// (1h crawl allowance + 1h interval).
    fn default_interval() -> Duration {
        Duration::hours(1)
    }

    fn input(
        provider_kind: ProviderKind,
        source_status: SourceStatus,
        source_newest: Option<DateTime<Utc>>,
        source_entry_dates: Vec<DateTime<Utc>>,
        app_newest_published_at: Option<DateTime<Utc>>,
        account_last_success_at: Option<DateTime<Utc>>,
    ) -> VerdictInput {
        input_with_interval(
            provider_kind,
            source_status,
            source_newest,
            source_entry_dates,
            app_newest_published_at,
            account_last_success_at,
            default_interval(),
        )
    }

    #[allow(clippy::too_many_arguments)]
    fn input_with_interval(
        provider_kind: ProviderKind,
        source_status: SourceStatus,
        source_newest: Option<DateTime<Utc>>,
        source_entry_dates: Vec<DateTime<Utc>>,
        app_newest_published_at: Option<DateTime<Utc>>,
        account_last_success_at: Option<DateTime<Utc>>,
        account_sync_interval: Duration,
    ) -> VerdictInput {
        VerdictInput {
            provider_kind,
            source_status,
            source_newest,
            source_entry_dates,
            app_newest_published_at,
            account_last_success_at,
            account_sync_interval,
            feed_scope_synced: true,
        }
    }

    #[test]
    fn healthy_when_app_is_within_the_upstream_latency_of_source() {
        let outcome = derive_verdict(&input(
            ProviderKind::FreshRss,
            SourceStatus::Fetched,
            Some(at(10)),
            vec![at(10)],
            Some(at(9)),
            None,
        ));
        assert_eq!(outcome.verdict, Verdict::Healthy);
        assert_eq!(outcome.hint, None);
    }

    #[test]
    fn healthy_at_exactly_the_upstream_latency_boundary() {
        let outcome = derive_verdict(&input(
            ProviderKind::FreshRss,
            SourceStatus::Fetched,
            Some(at(10)),
            vec![at(10)],
            Some(at(8)),
            None,
        ));
        assert_eq!(outcome.verdict, Verdict::Healthy);
    }

    #[test]
    fn healthy_when_source_published_just_before_a_sync_freshrss_had_not_crawled_yet() {
        let outcome = derive_verdict(&input(
            ProviderKind::FreshRss,
            SourceStatus::Fetched,
            Some(at(5) + chrono::Duration::minutes(4)),
            vec![at(5) + chrono::Duration::minutes(4), at(3)],
            Some(at(4)),
            Some(at(5) + chrono::Duration::minutes(5)),
        ));
        assert_eq!(outcome.verdict, Verdict::Healthy);
        assert_eq!(outcome.hint, None);
    }

    #[test]
    fn freshrss_behind_source_hints_not_delivering_when_entries_predate_the_last_sync() {
        let outcome = derive_verdict(&input(
            ProviderKind::FreshRss,
            SourceStatus::Fetched,
            Some(at(10)),
            vec![at(10), at(4), at(3)],
            Some(at(0)),
            Some(at(8)),
        ));
        assert_eq!(outcome.verdict, Verdict::BehindSource);
        assert_eq!(outcome.hint, Some(Hint::FreshrssNotDelivering));
        assert_eq!(outcome.missed_before_last_sync, 2);
    }

    #[test]
    fn freshrss_behind_source_hints_awaiting_sync_when_all_newer_entries_are_after_last_sync() {
        let outcome = derive_verdict(&input(
            ProviderKind::FreshRss,
            SourceStatus::Fetched,
            Some(at(10)),
            vec![at(10), at(8)],
            Some(at(0)),
            Some(at(5)),
        ));
        assert_eq!(outcome.verdict, Verdict::BehindSource);
        assert_eq!(outcome.hint, Some(Hint::AwaitingSync));
        assert_eq!(outcome.missed_before_last_sync, 0);
    }

    #[test]
    fn freshrss_behind_source_hints_awaiting_sync_when_last_sync_is_unknown() {
        let outcome = derive_verdict(&input(
            ProviderKind::FreshRss,
            SourceStatus::Fetched,
            Some(at(10)),
            vec![at(10)],
            Some(at(0)),
            None,
        ));
        assert_eq!(outcome.verdict, Verdict::BehindSource);
        assert_eq!(outcome.hint, Some(Hint::AwaitingSync));
        assert_eq!(outcome.missed_before_last_sync, 0);
    }

    #[test]
    fn local_behind_source_hints_local_fetch_failing() {
        let outcome = derive_verdict(&input(
            ProviderKind::Local,
            SourceStatus::Fetched,
            Some(at(10)),
            vec![at(10)],
            Some(at(0)),
            None,
        ));
        assert_eq!(outcome.verdict, Verdict::BehindSource);
        assert_eq!(outcome.hint, Some(Hint::LocalFetchFailing));
        assert_eq!(outcome.missed_before_last_sync, 0);
    }

    #[test]
    fn source_unreachable_overrides_app_state_and_is_unhealthy() {
        let outcome = derive_verdict(&input(
            ProviderKind::Local,
            SourceStatus::Unreachable,
            None,
            vec![],
            Some(at(0)),
            None,
        ));
        assert_eq!(outcome.verdict, Verdict::SourceUnreachable);
        assert_eq!(outcome.hint, None);
        assert!(outcome.verdict.is_unhealthy());
    }

    #[test]
    fn source_skipped_is_reported_and_not_unhealthy() {
        let outcome = derive_verdict(&input(
            ProviderKind::FreshRss,
            SourceStatus::Skipped,
            None,
            vec![],
            Some(at(0)),
            None,
        ));
        assert_eq!(outcome.verdict, Verdict::SourceSkipped);
        assert_eq!(outcome.hint, None);
        assert!(!outcome.verdict.is_unhealthy());
    }

    #[test]
    fn behind_source_when_app_has_no_articles_but_freshrss_source_has_entries() {
        let outcome = derive_verdict(&input(
            ProviderKind::FreshRss,
            SourceStatus::Fetched,
            Some(at(10)),
            vec![at(10), at(4), at(3)],
            None,
            Some(at(8)),
        ));
        assert_eq!(outcome.verdict, Verdict::BehindSource);
        assert_eq!(outcome.hint, Some(Hint::FreshrssNotDelivering));
        // Entries at/after (last_success - crawl_allowance) don't count as missed.
        assert_eq!(outcome.missed_before_last_sync, 2);
    }

    #[test]
    fn behind_source_when_app_has_no_articles_but_local_source_has_entries() {
        let outcome = derive_verdict(&input(
            ProviderKind::Local,
            SourceStatus::Fetched,
            Some(at(10)),
            vec![at(10)],
            None,
            None,
        ));
        assert_eq!(outcome.verdict, Verdict::BehindSource);
        assert_eq!(outcome.hint, Some(Hint::LocalFetchFailing));
        assert_eq!(outcome.missed_before_last_sync, 0);
    }

    #[test]
    fn no_articles_stays_healthy_when_source_has_no_dated_entries_and_app_is_empty() {
        let outcome = derive_verdict(&input(
            ProviderKind::Local,
            SourceStatus::Fetched,
            None,
            vec![],
            None,
            None,
        ));
        assert_eq!(outcome.verdict, Verdict::NoArticles);
        assert_eq!(outcome.hint, None);
        assert!(!outcome.verdict.is_unhealthy());
    }

    #[test]
    fn healthy_when_source_has_no_entries_but_app_already_has_articles() {
        let outcome = derive_verdict(&input(
            ProviderKind::Local,
            SourceStatus::Fetched,
            None,
            vec![],
            Some(at(0)),
            None,
        ));
        assert_eq!(outcome.verdict, Verdict::Healthy);
        assert_eq!(outcome.hint, None);
    }

    #[test]
    fn healthy_when_source_is_within_crawl_allowance_plus_a_long_sync_interval() {
        let outcome = derive_verdict(&input_with_interval(
            ProviderKind::FreshRss,
            SourceStatus::Fetched,
            Some(at(5)),
            vec![at(5)],
            Some(at(0)),
            None,
            Duration::hours(12),
        ));
        assert_eq!(outcome.verdict, Verdict::Healthy);
    }

    #[test]
    fn behind_source_when_source_exceeds_crawl_allowance_plus_a_short_sync_interval() {
        let outcome = derive_verdict(&input_with_interval(
            ProviderKind::FreshRss,
            SourceStatus::Fetched,
            Some(at(3)),
            vec![at(3)],
            Some(at(0)),
            None,
            Duration::hours(1),
        ));
        assert_eq!(outcome.verdict, Verdict::BehindSource);
    }

    #[test]
    fn quarantined_account_is_healthy_regardless_of_source_state() {
        let outcome = derive_verdict(&input(
            ProviderKind::Quarantined,
            SourceStatus::Skipped,
            None,
            vec![],
            None,
            None,
        ));
        assert_eq!(outcome.verdict, Verdict::AccountQuarantined);
        assert_eq!(outcome.hint, None);
        assert!(!outcome.verdict.is_unhealthy());
    }

    #[test]
    fn awaiting_first_sync_when_app_is_empty_and_feed_scope_has_never_synced() {
        let outcome = derive_verdict(&VerdictInput {
            feed_scope_synced: false,
            ..input(
                ProviderKind::FreshRss,
                SourceStatus::Fetched,
                Some(at(10)),
                vec![at(10), at(4), at(3)],
                None,
                Some(at(8)),
            )
        });
        assert_eq!(outcome.verdict, Verdict::AwaitingFirstSync);
        assert_eq!(outcome.hint, None);
        assert!(!outcome.verdict.is_unhealthy());
    }

    #[test]
    fn behind_source_when_app_is_empty_but_feed_scope_has_synced_before() {
        let outcome = derive_verdict(&VerdictInput {
            feed_scope_synced: true,
            ..input(
                ProviderKind::FreshRss,
                SourceStatus::Fetched,
                Some(at(10)),
                vec![at(10), at(4), at(3)],
                None,
                Some(at(8)),
            )
        });
        assert_eq!(outcome.verdict, Verdict::BehindSource);
        assert_eq!(outcome.hint, Some(Hint::FreshrssNotDelivering));
    }

    #[test]
    fn verdict_and_hint_strings_are_stable_snake_case() {
        assert_eq!(Verdict::Healthy.as_str(), "healthy");
        assert_eq!(Verdict::BehindSource.as_str(), "behind_source");
        assert_eq!(Verdict::SourceUnreachable.as_str(), "source_unreachable");
        assert_eq!(Verdict::SourceSkipped.as_str(), "source_skipped");
        assert_eq!(Verdict::NoArticles.as_str(), "no_articles");
        assert_eq!(Verdict::AccountQuarantined.as_str(), "account_quarantined");
        assert_eq!(Verdict::AwaitingFirstSync.as_str(), "awaiting_first_sync");
        assert_eq!(
            Hint::FreshrssNotDelivering.as_str(),
            "freshrss_not_delivering"
        );
        assert_eq!(Hint::AwaitingSync.as_str(), "awaiting_sync");
        assert_eq!(Hint::LocalFetchFailing.as_str(), "local_fetch_failing");
    }
}
