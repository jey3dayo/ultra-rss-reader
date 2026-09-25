use chrono::{DateTime, Utc};

use crate::domain::provider::ProviderKind;

/// Allowed delay between a source publishing and the app holding the entry: one
/// FreshRSS crawl interval plus one app sync interval (both hourly by default).
const UPSTREAM_LATENCY_HOURS: i64 = 2;

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
}

impl Verdict {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Healthy => "healthy",
            Self::BehindSource => "behind_source",
            Self::SourceUnreachable => "source_unreachable",
            Self::SourceSkipped => "source_skipped",
            Self::NoArticles => "no_articles",
        }
    }

    /// Exit-code-7-worthy per this task's MUST: only `behind_source` and
    /// `source_unreachable` make a `feed diagnose` invocation unhealthy.
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
    /// Every fetched entry's date (published, falling back to updated), used
    /// only to count entries the last sync missed (see
    /// `missed_before_last_sync`). Empty whenever `source_status` is not
    /// `Fetched`.
    pub(crate) source_entry_dates: Vec<DateTime<Utc>>,
    pub(crate) app_newest_published_at: Option<DateTime<Utc>>,
    /// The FreshRSS account's own last successful sync completion
    /// (`account:greader:all`'s `last_success_at`). Only consulted for
    /// `ProviderKind::FreshRss` when deriving the `behind_source` hint.
    pub(crate) account_last_success_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct VerdictOutcome {
    pub(crate) verdict: Verdict,
    pub(crate) hint: Option<Hint>,
    /// Source entries newer than `app_newest + latency` and older than
    /// `account_last_success_at - latency`: the last sync should have received them.
    /// Always `0` for non-FreshRSS matches and when the verdict isn't `BehindSource`.
    pub(crate) missed_before_last_sync: usize,
}

fn count_missed_before_last_sync(
    source_entry_dates: &[DateTime<Utc>],
    app_newest: DateTime<Utc>,
    account_last_success_at: DateTime<Utc>,
) -> usize {
    let latency = chrono::Duration::hours(UPSTREAM_LATENCY_HOURS);
    let missed_after = app_newest + latency;
    let missed_before = account_last_success_at - latency;
    source_entry_dates
        .iter()
        .filter(|&&date| date > missed_after && date < missed_before)
        .count()
}

/// Pure verdict/hint derivation (design doc §6, this task's MUST #4, and the
/// `freshrss_not_delivering` correction in `cli-phase1-t2-fix`). Kept free of
/// DB/network access so it can be unit-tested with synthetic `DateTime`
/// inputs instead of a real fetch or fixture DB.
pub(crate) fn derive_verdict(input: &VerdictInput) -> VerdictOutcome {
    let no_hint = |verdict: Verdict| VerdictOutcome {
        verdict,
        hint: None,
        missed_before_last_sync: 0,
    };

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

    let Some(app_newest) = input.app_newest_published_at else {
        return no_hint(Verdict::NoArticles);
    };

    if source_newest <= app_newest + chrono::Duration::hours(UPSTREAM_LATENCY_HOURS) {
        return no_hint(Verdict::Healthy);
    }

    let (hint, missed_before_last_sync) = match &input.provider_kind {
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
        ProviderKind::Local | ProviderKind::Quarantined => (Hint::LocalFetchFailing, 0),
    };

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

    fn input(
        provider_kind: ProviderKind,
        source_status: SourceStatus,
        source_newest: Option<DateTime<Utc>>,
        source_entry_dates: Vec<DateTime<Utc>>,
        app_newest_published_at: Option<DateTime<Utc>>,
        account_last_success_at: Option<DateTime<Utc>>,
    ) -> VerdictInput {
        VerdictInput {
            provider_kind,
            source_status,
            source_newest,
            source_entry_dates,
            app_newest_published_at,
            account_last_success_at,
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
    fn no_articles_when_source_fetched_but_app_has_nothing() {
        let outcome = derive_verdict(&input(
            ProviderKind::Local,
            SourceStatus::Fetched,
            Some(at(10)),
            vec![at(10)],
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
    fn verdict_and_hint_strings_are_stable_snake_case() {
        assert_eq!(Verdict::Healthy.as_str(), "healthy");
        assert_eq!(Verdict::BehindSource.as_str(), "behind_source");
        assert_eq!(Verdict::SourceUnreachable.as_str(), "source_unreachable");
        assert_eq!(Verdict::SourceSkipped.as_str(), "source_skipped");
        assert_eq!(Verdict::NoArticles.as_str(), "no_articles");
        assert_eq!(
            Hint::FreshrssNotDelivering.as_str(),
            "freshrss_not_delivering"
        );
        assert_eq!(Hint::AwaitingSync.as_str(), "awaiting_sync");
        assert_eq!(Hint::LocalFetchFailing.as_str(), "local_fetch_failing");
    }
}
