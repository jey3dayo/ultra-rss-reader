// Local-only diagnostics for `mark_article_read`, added to narrow down reports of
// auto-mark-as-read never completing. This module intentionally never logs article,
// feed, or account identifiers, raw error messages, or SQL: only enum-shaped
// classifications, durations in milliseconds, and an opaque per-request id supplied
// by the frontend (or generated here for callers that do not supply one).
//
// The 100ms / 250ms / 1000ms thresholds below are provisional operating values picked
// to catch outliers without being derived from measured production latency; treat them
// as diagnostic tuning knobs, not an SLO.
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use crate::commands::dto::{is_valid_read_diagnostic_request_id, ReadDiagnosticContextArg};

/// Lock-wait warning threshold, in milliseconds. Provisional operating value (see module docs).
pub(crate) const LOCK_WAIT_WARN_THRESHOLD_MS: u64 = 100;
/// Transaction-duration warning threshold, in milliseconds. Provisional operating value.
pub(crate) const TRANSACTION_WARN_THRESHOLD_MS: u64 = 250;
/// Total (lock wait + transaction) warning threshold, in milliseconds. Provisional operating value.
pub(crate) const TOTAL_WARN_THRESHOLD_MS: u64 = 1000;

/// Minimum gap between repeated backend diagnostic emissions of the same kind before they
/// collapse into a periodic count summary, in milliseconds. Mirrors the frontend sink's own
/// flush cadence (see `src/components/reader/hooks/article/read-state-diagnostics.ts`) so both
/// sides describe "how often can this class of event resurface" with the same number.
pub(crate) const BACKEND_DIAGNOSTIC_SUMMARY_WINDOW_MS: u64 = 10_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ReadDiagnosticSource {
    Auto,
    Manual,
}

impl ReadDiagnosticSource {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            ReadDiagnosticSource::Auto => "auto",
            ReadDiagnosticSource::Manual => "manual",
        }
    }
}

#[derive(Debug, Clone)]
pub(crate) struct ReadDiagnosticContext {
    pub(crate) request_id: String,
    pub(crate) source: ReadDiagnosticSource,
}

impl ReadDiagnosticContext {
    /// Backend-generated context for manual (or otherwise context-less) callers, so every
    /// `mark_article_read` invocation is identifiable in logs even without a frontend request id.
    pub(crate) fn backend_generated() -> Self {
        Self {
            request_id: uuid::Uuid::new_v4().to_string(),
            source: ReadDiagnosticSource::Manual,
        }
    }

    /// Converts a frontend-supplied context, falling back to a backend-generated one when the
    /// argument is absent or its request id fails validation. This never fails and never logs
    /// the rejected raw value; an unrecognized `source` string is treated as manual.
    pub(crate) fn from_arg_or_backend_generated(arg: Option<ReadDiagnosticContextArg>) -> Self {
        match arg {
            Some(arg) if is_valid_read_diagnostic_request_id(&arg.request_id) => Self {
                request_id: arg.request_id,
                source: if arg.source == "auto" {
                    ReadDiagnosticSource::Auto
                } else {
                    ReadDiagnosticSource::Manual
                },
            },
            _ => Self::backend_generated(),
        }
    }
}

/// The five stages `mark_article_read_with_conn` moves through. The `SELECT feed_id` lookup
/// that precedes `recalculate_unread_count` is folded into `RecalculateCount` (it exists only to
/// feed that call), and the outer mutex acquisition plus the (rare) failure to open the
/// transaction are folded into `Lock` (both are "could not get exclusive access to the DB" cases).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum MarkArticleReadStage {
    Lock,
    UpdateRead,
    RecalculateCount,
    QueueMutation,
    Commit,
}

impl MarkArticleReadStage {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            MarkArticleReadStage::Lock => "lock",
            MarkArticleReadStage::UpdateRead => "update_read",
            MarkArticleReadStage::RecalculateCount => "recalculate_count",
            MarkArticleReadStage::QueueMutation => "queue_mutation",
            MarkArticleReadStage::Commit => "commit",
        }
    }
}

/// Safe (non-message) classification of a failure at a `mark_article_read` stage. Built from the
/// SQLite error code where one is available, never from the error's `Display` text.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ReadDbErrorClass {
    Busy,
    Locked,
    Constraint,
    Other,
}

impl ReadDbErrorClass {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            ReadDbErrorClass::Busy => "busy",
            ReadDbErrorClass::Locked => "locked",
            ReadDbErrorClass::Constraint => "constraint",
            ReadDbErrorClass::Other => "other",
        }
    }
}

pub(crate) fn classify_rusqlite_error(error: &rusqlite::Error) -> ReadDbErrorClass {
    match error {
        rusqlite::Error::SqliteFailure(sqlite_error, _) => match sqlite_error.code {
            rusqlite::ErrorCode::DatabaseBusy => ReadDbErrorClass::Busy,
            rusqlite::ErrorCode::DatabaseLocked => ReadDbErrorClass::Locked,
            rusqlite::ErrorCode::ConstraintViolation => ReadDbErrorClass::Constraint,
            _ => ReadDbErrorClass::Other,
        },
        _ => ReadDbErrorClass::Other,
    }
}

/// A repository call already collapsed its failure into `DomainError` before we see it, so the
/// original SQLite code (if any) is gone. Classifying by domain error kind alone (never by its
/// message) is coarser than `classify_rusqlite_error` but stays within the "type only" contract.
pub(crate) fn classify_domain_error(
    _error: &crate::domain::error::DomainError,
) -> ReadDbErrorClass {
    ReadDbErrorClass::Other
}

/// Pure timing classification: which of the three provisional thresholds this operation tripped.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub(crate) struct MarkArticleReadTimingWarning {
    pub(crate) lock_wait_slow: bool,
    pub(crate) transaction_slow: bool,
    pub(crate) total_slow: bool,
}

impl MarkArticleReadTimingWarning {
    pub(crate) fn any(&self) -> bool {
        self.lock_wait_slow || self.transaction_slow || self.total_slow
    }
}

pub(crate) fn classify_mark_article_read_timing(
    lock_wait: Duration,
    transaction: Duration,
) -> MarkArticleReadTimingWarning {
    let total = lock_wait + transaction;
    MarkArticleReadTimingWarning {
        lock_wait_slow: lock_wait >= Duration::from_millis(LOCK_WAIT_WARN_THRESHOLD_MS),
        transaction_slow: transaction >= Duration::from_millis(TRANSACTION_WARN_THRESHOLD_MS),
        total_slow: total >= Duration::from_millis(TOTAL_WARN_THRESHOLD_MS),
    }
}

/// Decision returned by `DiagnosticRateLimiter::observe` for a given event kind at a given time.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RateLimitDecision {
    /// First sighting of this kind (or the summary window has elapsed): emit normally.
    Emit,
    /// Emit, and also report how many occurrences were suppressed since the last emission.
    EmitWithSuppressedCount(u32),
    /// Suppress. A future call (after the window elapses) will report the accumulated count.
    Suppress,
}

#[derive(Debug, Clone, Copy)]
struct RateLimiterEntry {
    window_start: Instant,
    suppressed_since_emit: u32,
}

/// Collapses repeated occurrences of the same diagnostic kind within `window` into a single
/// emission followed by a periodic suppressed-count summary, so a burst of identical
/// failures/warnings cannot flood app.log. Pure and clock-injectable: production code supplies
/// `Instant::now()`, tests supply arithmetic on a fixed `Instant`.
pub(crate) struct DiagnosticRateLimiter {
    window: Duration,
    entries: HashMap<&'static str, RateLimiterEntry>,
}

impl DiagnosticRateLimiter {
    pub(crate) fn new(window: Duration) -> Self {
        Self {
            window,
            entries: HashMap::new(),
        }
    }

    pub(crate) fn observe(&mut self, kind: &'static str, now: Instant) -> RateLimitDecision {
        match self.entries.get_mut(kind) {
            None => {
                self.entries.insert(
                    kind,
                    RateLimiterEntry {
                        window_start: now,
                        suppressed_since_emit: 0,
                    },
                );
                RateLimitDecision::Emit
            }
            Some(entry) => {
                if now.duration_since(entry.window_start) >= self.window {
                    let suppressed = entry.suppressed_since_emit;
                    entry.window_start = now;
                    entry.suppressed_since_emit = 0;
                    if suppressed > 0 {
                        RateLimitDecision::EmitWithSuppressedCount(suppressed)
                    } else {
                        RateLimitDecision::Emit
                    }
                } else {
                    entry.suppressed_since_emit = entry.suppressed_since_emit.saturating_add(1);
                    RateLimitDecision::Suppress
                }
            }
        }
    }
}

fn backend_diagnostic_rate_limiter() -> &'static Mutex<DiagnosticRateLimiter> {
    static LIMITER: OnceLock<Mutex<DiagnosticRateLimiter>> = OnceLock::new();
    LIMITER.get_or_init(|| {
        Mutex::new(DiagnosticRateLimiter::new(Duration::from_millis(
            BACKEND_DIAGNOSTIC_SUMMARY_WINDOW_MS,
        )))
    })
}

fn observe_backend_diagnostic(kind: &'static str) -> RateLimitDecision {
    match backend_diagnostic_rate_limiter().lock() {
        Ok(mut limiter) => limiter.observe(kind, Instant::now()),
        // A poisoned rate limiter must not block or fail the read mutation; fail open to "emit".
        Err(_) => RateLimitDecision::Emit,
    }
}

/// Pure (no I/O, no clock read) computation of everything `log_mark_article_read_failure` would
/// log for a given stage/error/timing combination. Kept separate from the actual `tracing::warn!`
/// call so the wiring -- in particular "a long lock wait combined with a fast transaction failure
/// still reports lock_wait_slow=true" -- is directly unit-testable with injected `Duration`
/// values, without needing a tracing subscriber to capture output.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct MarkArticleReadFailureLogFields {
    pub(crate) stage: &'static str,
    pub(crate) error_class: &'static str,
    pub(crate) lock_wait_ms: u64,
    pub(crate) transaction_ms: u64,
    pub(crate) total_ms: u64,
    pub(crate) lock_wait_slow: bool,
    pub(crate) transaction_slow: bool,
    pub(crate) total_slow: bool,
}

pub(crate) fn build_mark_article_read_failure_log_fields(
    stage: MarkArticleReadStage,
    error_class: ReadDbErrorClass,
    lock_wait: Duration,
    transaction_elapsed: Duration,
) -> MarkArticleReadFailureLogFields {
    let warning = classify_mark_article_read_timing(lock_wait, transaction_elapsed);
    let total = lock_wait + transaction_elapsed;
    MarkArticleReadFailureLogFields {
        stage: stage.as_str(),
        error_class: error_class.as_str(),
        lock_wait_ms: lock_wait.as_millis() as u64,
        transaction_ms: transaction_elapsed.as_millis() as u64,
        total_ms: total.as_millis() as u64,
        lock_wait_slow: warning.lock_wait_slow,
        transaction_slow: warning.transaction_slow,
        total_slow: warning.total_slow,
    }
}

/// Single consolidated failure log for `mark_article_read`: stage, safe error classification,
/// and the full lock_wait/transaction/total timing breakdown in one line, so a slow lock followed
/// by a fast transaction failure is never misread as "just a fast failure". This replaces
/// separately emitting a "failure" line (stage only) and a "slow" line (timing only) for the same
/// call, which would double-count both the log volume and the rate limiter's suppression window.
pub(crate) fn log_mark_article_read_failure(
    context: &ReadDiagnosticContext,
    stage: MarkArticleReadStage,
    error_class: ReadDbErrorClass,
    lock_wait: Duration,
    transaction_elapsed: Duration,
) {
    let fields = build_mark_article_read_failure_log_fields(
        stage,
        error_class,
        lock_wait,
        transaction_elapsed,
    );
    let kind = fields.stage;
    match observe_backend_diagnostic(kind) {
        RateLimitDecision::Suppress => {}
        RateLimitDecision::Emit => {
            tracing::warn!(
                target: "read_diagnostics",
                event = "failure",
                stage = fields.stage,
                error_class = fields.error_class,
                source = context.source.as_str(),
                request_id = %context.request_id,
                lock_wait_ms = fields.lock_wait_ms,
                transaction_ms = fields.transaction_ms,
                total_ms = fields.total_ms,
                lock_wait_slow = fields.lock_wait_slow,
                transaction_slow = fields.transaction_slow,
                total_slow = fields.total_slow,
                "mark_article_read failed"
            );
        }
        RateLimitDecision::EmitWithSuppressedCount(suppressed) => {
            tracing::warn!(
                target: "read_diagnostics",
                event = "failure",
                stage = fields.stage,
                error_class = fields.error_class,
                source = context.source.as_str(),
                request_id = %context.request_id,
                lock_wait_ms = fields.lock_wait_ms,
                transaction_ms = fields.transaction_ms,
                total_ms = fields.total_ms,
                lock_wait_slow = fields.lock_wait_slow,
                transaction_slow = fields.transaction_slow,
                total_slow = fields.total_slow,
                suppressed_count = suppressed,
                "mark_article_read failed (repeated)"
            );
        }
    }
}

pub(crate) fn log_mark_article_read_timing(
    context: &ReadDiagnosticContext,
    lock_wait: Duration,
    transaction: Duration,
) {
    let warning = classify_mark_article_read_timing(lock_wait, transaction);
    if !warning.any() {
        return;
    }

    match observe_backend_diagnostic("slow") {
        RateLimitDecision::Suppress => {}
        RateLimitDecision::Emit => {
            tracing::warn!(
                target: "read_diagnostics",
                event = "slow",
                source = context.source.as_str(),
                request_id = %context.request_id,
                lock_wait_ms = lock_wait.as_millis() as u64,
                transaction_ms = transaction.as_millis() as u64,
                lock_wait_slow = warning.lock_wait_slow,
                transaction_slow = warning.transaction_slow,
                total_slow = warning.total_slow,
                "mark_article_read exceeded a diagnostic timing threshold"
            );
        }
        RateLimitDecision::EmitWithSuppressedCount(suppressed) => {
            tracing::warn!(
                target: "read_diagnostics",
                event = "slow",
                source = context.source.as_str(),
                request_id = %context.request_id,
                lock_wait_ms = lock_wait.as_millis() as u64,
                transaction_ms = transaction.as_millis() as u64,
                lock_wait_slow = warning.lock_wait_slow,
                transaction_slow = warning.transaction_slow,
                total_slow = warning.total_slow,
                suppressed_count = suppressed,
                "mark_article_read exceeded a diagnostic timing threshold (repeated)"
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        build_mark_article_read_failure_log_fields, classify_mark_article_read_timing,
        classify_rusqlite_error, DiagnosticRateLimiter, MarkArticleReadStage, RateLimitDecision,
        ReadDbErrorClass, ReadDiagnosticContext, ReadDiagnosticSource, LOCK_WAIT_WARN_THRESHOLD_MS,
        TOTAL_WARN_THRESHOLD_MS, TRANSACTION_WARN_THRESHOLD_MS,
    };
    use crate::commands::dto::ReadDiagnosticContextArg;
    use std::time::{Duration, Instant};

    #[test]
    fn from_arg_uses_the_supplied_valid_request_id_and_source() {
        let context =
            ReadDiagnosticContext::from_arg_or_backend_generated(Some(ReadDiagnosticContextArg {
                request_id: "5b978598-36b8-4bd4-8ee4-1bf25f4773c2".to_string(),
                source: "auto".to_string(),
            }));

        assert_eq!(context.request_id, "5b978598-36b8-4bd4-8ee4-1bf25f4773c2");
        assert_eq!(context.source, ReadDiagnosticSource::Auto);
    }

    #[test]
    fn from_arg_treats_unknown_source_strings_as_manual() {
        let context =
            ReadDiagnosticContext::from_arg_or_backend_generated(Some(ReadDiagnosticContextArg {
                request_id: "req-1".to_string(),
                source: "something-else".to_string(),
            }));

        assert_eq!(context.source, ReadDiagnosticSource::Manual);
    }

    #[test]
    fn from_arg_falls_back_to_backend_generated_when_request_id_is_invalid() {
        let context =
            ReadDiagnosticContext::from_arg_or_backend_generated(Some(ReadDiagnosticContextArg {
                request_id: "id with spaces".to_string(),
                source: "auto".to_string(),
            }));

        assert_eq!(context.source, ReadDiagnosticSource::Manual);
        assert_ne!(context.request_id, "id with spaces");
        assert!(!context.request_id.is_empty());
    }

    #[test]
    fn from_arg_falls_back_to_backend_generated_when_absent() {
        let context = ReadDiagnosticContext::from_arg_or_backend_generated(None);

        assert_eq!(context.source, ReadDiagnosticSource::Manual);
        assert!(!context.request_id.is_empty());
    }

    #[test]
    fn stage_as_str_covers_all_five_stages_with_stable_names() {
        assert_eq!(MarkArticleReadStage::Lock.as_str(), "lock");
        assert_eq!(MarkArticleReadStage::UpdateRead.as_str(), "update_read");
        assert_eq!(
            MarkArticleReadStage::RecalculateCount.as_str(),
            "recalculate_count"
        );
        assert_eq!(
            MarkArticleReadStage::QueueMutation.as_str(),
            "queue_mutation"
        );
        assert_eq!(MarkArticleReadStage::Commit.as_str(), "commit");
    }

    #[test]
    fn backend_generated_context_is_manual_and_random() {
        let a = ReadDiagnosticContext::backend_generated();
        let b = ReadDiagnosticContext::backend_generated();

        assert_eq!(a.source, ReadDiagnosticSource::Manual);
        assert_ne!(a.request_id, b.request_id);
        assert!(!a.request_id.is_empty());
    }

    #[test]
    fn classify_rusqlite_error_maps_known_sqlite_codes() {
        use rusqlite::ffi;

        let busy = rusqlite::Error::SqliteFailure(ffi::Error::new(ffi::SQLITE_BUSY), None);
        assert_eq!(classify_rusqlite_error(&busy), ReadDbErrorClass::Busy);

        let locked = rusqlite::Error::SqliteFailure(ffi::Error::new(ffi::SQLITE_LOCKED), None);
        assert_eq!(classify_rusqlite_error(&locked), ReadDbErrorClass::Locked);

        let constraint =
            rusqlite::Error::SqliteFailure(ffi::Error::new(ffi::SQLITE_CONSTRAINT), None);
        assert_eq!(
            classify_rusqlite_error(&constraint),
            ReadDbErrorClass::Constraint
        );

        assert_eq!(
            classify_rusqlite_error(&rusqlite::Error::QueryReturnedNoRows),
            ReadDbErrorClass::Other
        );
    }

    #[test]
    fn classify_rusqlite_error_never_needs_the_error_message() {
        // Regression guard: classification must be derivable without ever formatting the error,
        // which would risk leaking raw SQL/bind-value text into a diagnostic log.
        let error = rusqlite::Error::QueryReturnedNoRows;
        let _ = classify_rusqlite_error(&error);
        let _ = error.to_string(); // Display still works; classification just never calls it.
    }

    #[test]
    fn timing_classification_uses_named_thresholds_as_the_boundary() {
        let just_under = classify_mark_article_read_timing(
            Duration::from_millis(LOCK_WAIT_WARN_THRESHOLD_MS - 1),
            Duration::from_millis(TRANSACTION_WARN_THRESHOLD_MS - 1),
        );
        assert!(!just_under.any());

        let lock_only = classify_mark_article_read_timing(
            Duration::from_millis(LOCK_WAIT_WARN_THRESHOLD_MS),
            Duration::ZERO,
        );
        assert!(lock_only.lock_wait_slow);
        assert!(!lock_only.transaction_slow);
        assert!(lock_only.any());

        let transaction_only = classify_mark_article_read_timing(
            Duration::ZERO,
            Duration::from_millis(TRANSACTION_WARN_THRESHOLD_MS),
        );
        assert!(transaction_only.transaction_slow);
        assert!(transaction_only.any());

        // The total threshold (1000ms) is larger than the sum of the lock-wait (100ms) and
        // transaction (250ms) thresholds, so any input that trips `total_slow` necessarily also
        // trips at least one of the other two flags; this only pins the boundary for `total_slow`
        // itself, not exclusivity.
        let total_only = classify_mark_article_read_timing(
            Duration::from_millis(TOTAL_WARN_THRESHOLD_MS / 2),
            Duration::from_millis(TOTAL_WARN_THRESHOLD_MS / 2),
        );
        assert!(total_only.total_slow);
        assert!(
            !classify_mark_article_read_timing(
                Duration::from_millis(TOTAL_WARN_THRESHOLD_MS / 2 - 1),
                Duration::from_millis(TOTAL_WARN_THRESHOLD_MS / 2 - 1),
            )
            .total_slow
        );
    }

    #[test]
    fn failure_log_fields_report_lock_contention_even_when_the_transaction_fails_fast() {
        // Regression: a failure log must fold lock_wait into its timing classification. Before the
        // fix, a failed transaction only ever logged its own (short) elapsed time, so a slow lock
        // wait followed by a fast transaction failure looked like "just a fast failure" instead of
        // a lock-contention failure.
        let long_lock_wait = Duration::from_millis(LOCK_WAIT_WARN_THRESHOLD_MS + 50);
        let fast_transaction_failure = Duration::from_millis(10);

        let fields = build_mark_article_read_failure_log_fields(
            MarkArticleReadStage::QueueMutation,
            ReadDbErrorClass::Other,
            long_lock_wait,
            fast_transaction_failure,
        );

        assert!(fields.lock_wait_slow, "long lock wait must be flagged slow");
        assert!(!fields.transaction_slow);
        assert_eq!(fields.lock_wait_ms, long_lock_wait.as_millis() as u64);
        assert_eq!(
            fields.transaction_ms,
            fast_transaction_failure.as_millis() as u64
        );
        assert_eq!(
            fields.total_ms,
            (long_lock_wait + fast_transaction_failure).as_millis() as u64
        );
        assert_eq!(fields.stage, "queue_mutation");
        assert_eq!(fields.error_class, "other");
    }

    #[test]
    fn failure_log_fields_do_not_fabricate_transaction_time_when_only_the_lock_failed() {
        // When lock acquisition itself fails, no transaction was ever attempted; transaction_ms
        // must be exactly zero, not some nonzero placeholder.
        let fields = build_mark_article_read_failure_log_fields(
            MarkArticleReadStage::Lock,
            ReadDbErrorClass::Other,
            Duration::from_millis(5),
            Duration::ZERO,
        );

        assert_eq!(fields.transaction_ms, 0);
        assert_eq!(fields.total_ms, 5);
        assert_eq!(fields.stage, "lock");
    }

    #[test]
    fn rate_limiter_emits_first_sighting_then_suppresses_within_window() {
        let mut limiter = DiagnosticRateLimiter::new(Duration::from_millis(10_000));
        let t0 = Instant::now();

        assert_eq!(limiter.observe("commit", t0), RateLimitDecision::Emit);
        assert_eq!(
            limiter.observe("commit", t0 + Duration::from_millis(1)),
            RateLimitDecision::Suppress
        );
        assert_eq!(
            limiter.observe("commit", t0 + Duration::from_millis(9_999)),
            RateLimitDecision::Suppress
        );
    }

    #[test]
    fn rate_limiter_reports_suppressed_count_after_the_window_elapses() {
        let mut limiter = DiagnosticRateLimiter::new(Duration::from_millis(10_000));
        let t0 = Instant::now();

        assert_eq!(limiter.observe("slow", t0), RateLimitDecision::Emit);
        assert_eq!(
            limiter.observe("slow", t0 + Duration::from_millis(1)),
            RateLimitDecision::Suppress
        );
        assert_eq!(
            limiter.observe("slow", t0 + Duration::from_millis(2)),
            RateLimitDecision::Suppress
        );
        assert_eq!(
            limiter.observe("slow", t0 + Duration::from_millis(10_000)),
            RateLimitDecision::EmitWithSuppressedCount(2)
        );
        // The window resets from the emission above.
        assert_eq!(
            limiter.observe("slow", t0 + Duration::from_millis(10_001)),
            RateLimitDecision::Suppress
        );
    }

    #[test]
    fn rate_limiter_tracks_kinds_independently() {
        let mut limiter = DiagnosticRateLimiter::new(Duration::from_millis(10_000));
        let t0 = Instant::now();

        assert_eq!(limiter.observe("lock", t0), RateLimitDecision::Emit);
        assert_eq!(limiter.observe("commit", t0), RateLimitDecision::Emit);
        assert_eq!(
            limiter.observe("lock", t0 + Duration::from_millis(1)),
            RateLimitDecision::Suppress
        );
        assert_eq!(
            limiter.observe("commit", t0 + Duration::from_millis(1)),
            RateLimitDecision::Suppress
        );
    }
}
