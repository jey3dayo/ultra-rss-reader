use std::sync::atomic::{AtomicU64, Ordering};

use serde::Serialize;
use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

use crate::commands::dto::{
    is_valid_read_diagnostic_request_id, AppError, ReadDiagnosticCancelReasonArg,
    ReadDiagnosticErrorClassArg, ReadDiagnosticEventArg, ReadDiagnosticOutcomeArg,
    ReadDiagnosticSkipReasonArg, READ_DIAGNOSTICS_BATCH_MAX_BYTES,
    READ_DIAGNOSTICS_BATCH_MAX_EVENTS, READ_DIAGNOSTICS_SESSION_MAX_BYTES,
};

fn log_dir_error_message(_action: &str, _error: impl std::fmt::Display) -> String {
    "Check OS permissions and try again.".to_string()
}

#[cfg(test)]
fn log_dir_privacy_checklist() -> &'static [&'static str] {
    &[
        "Share only the relevant app.log excerpt.",
        "Remove account names, feed URLs, article URLs, and local user paths before sharing.",
        "Delete stale support/debug logs and support dumps after the incident is resolved.",
        "Do not share private, unencrypted backup database files unless explicitly requested for support.",
        "Treat OPML exports as private subscription lists because feed titles and URLs may be sensitive.",
    ]
}

fn ensure_log_dir(dir: &std::path::Path) -> Result<(), AppError> {
    std::fs::create_dir_all(dir).map_err(|e| AppError::UserVisible {
        message: log_dir_error_message("create", e),
    })
}

fn log_dir_opener_arg(dir: &std::path::Path) -> Result<String, AppError> {
    dir.to_str()
        .map(String::from)
        .ok_or_else(|| AppError::UserVisible {
            message: log_dir_error_message("open", "log directory path is not valid UTF-8"),
        })
}

fn log_dir_opener_app_arg() -> Option<String> {
    None
}

#[cfg(test)]
fn diagnostics_size_policy() -> DiagnosticsSizePolicy {
    DiagnosticsSizePolicy {
        total_log_cap_bytes: 35_000_000,
        per_log_file_cap_bytes: 5_000_000,
        retention_days: 7,
        diagnostics_event_cap_bytes: 16 * 1024,
        diagnostics_ring_buffer_cap_bytes: 256 * 1024,
        emergency_truncation_marker: "[ultra-rss-reader:diagnostics-truncated]",
        copy_failure_fallback: "Share a manually redacted app.log excerpt instead.",
    }
}

#[cfg(test)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct DiagnosticsSizePolicy {
    total_log_cap_bytes: u64,
    per_log_file_cap_bytes: u64,
    retention_days: u64,
    diagnostics_event_cap_bytes: usize,
    diagnostics_ring_buffer_cap_bytes: usize,
    emergency_truncation_marker: &'static str,
    copy_failure_fallback: &'static str,
}

#[tauri::command]
pub fn open_log_dir(app: tauri::AppHandle) -> Result<(), AppError> {
    let dir = app
        .path()
        .app_log_dir()
        .map_err(|e| AppError::UserVisible {
            message: log_dir_error_message("resolve", e),
        })?;

    ensure_log_dir(&dir)?;
    let opener_arg = log_dir_opener_arg(&dir)?;

    app.opener()
        .open_path(opener_arg, log_dir_opener_app_arg())
        .map_err(|e| AppError::UserVisible {
            message: log_dir_error_message("open", e),
        })?;

    Ok(())
}

const READ_DIAGNOSTICS_BATCH_REJECTED_MESSAGE: &str = "Diagnostics batch rejected.";

/// Cumulative bytes accepted from `record_read_diagnostics_batch` across this process's
/// lifetime. Deliberately process-global (not per-account or per-window) since diagnostics never
/// carry account-scoped data; a fresh app launch resets it.
static READ_DIAGNOSTICS_SESSION_BYTES_ACCEPTED: AtomicU64 = AtomicU64::new(0);

/// A batch is valid when it carries something worth accepting (events, a dropped count, or both),
/// stays within the count/byte caps, and every event id is well-formed. An empty-events batch
/// with `dropped_count > 0` is accepted so the suppressed count can still reach app.log even when
/// every recent event was itself dropped locally.
fn read_diagnostics_batch_is_valid(
    events: &[ReadDiagnosticEventArg],
    dropped_count: u32,
    serialized_bytes: usize,
) -> bool {
    (!events.is_empty() || dropped_count > 0)
        && events.len() <= READ_DIAGNOSTICS_BATCH_MAX_EVENTS
        && serialized_bytes <= READ_DIAGNOSTICS_BATCH_MAX_BYTES
        && events
            .iter()
            .all(|event| is_valid_read_diagnostic_request_id(event.request_id()))
}

/// Local-only helper for measuring the serialized size of a batch (events plus the dropped
/// count) the same way the caller will actually send it, without needing a real `events` +
/// `dropped_count` pair of arguments at every call site.
#[derive(Serialize)]
struct ReadDiagnosticsBatchSizeCalc<'a> {
    events: &'a [ReadDiagnosticEventArg],
    dropped_count: u32,
}

/// Reserves `serialized_bytes` against `budget` if doing so would not exceed `cap`. Takes the
/// counter and cap as parameters so the accept/reject boundary (including "already at cap") can
/// be exercised against a fresh, test-local `AtomicU64` instead of the process-global counter,
/// which would otherwise race across parallel test threads.
fn reserve_diagnostics_budget(budget: &AtomicU64, cap: u64, serialized_bytes: u64) -> bool {
    budget
        .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |accepted| {
            let next = accepted.saturating_add(serialized_bytes);
            (next <= cap).then_some(next)
        })
        .is_ok()
}

fn try_reserve_read_diagnostics_session_budget(serialized_bytes: u64) -> bool {
    reserve_diagnostics_budget(
        &READ_DIAGNOSTICS_SESSION_BYTES_ACCEPTED,
        READ_DIAGNOSTICS_SESSION_MAX_BYTES,
        serialized_bytes,
    )
}

fn read_diagnostic_skip_reason_str(reason: ReadDiagnosticSkipReasonArg) -> &'static str {
    match reason {
        ReadDiagnosticSkipReasonArg::AlreadyRead => "already_read",
        ReadDiagnosticSkipReasonArg::NotReading => "not_reading",
        ReadDiagnosticSkipReasonArg::PreferenceNever => "preference_never",
        ReadDiagnosticSkipReasonArg::ManualUnreadSuppressed => "manual_unread_suppressed",
        ReadDiagnosticSkipReasonArg::AlreadyRequested => "already_requested",
    }
}

fn read_diagnostic_cancel_reason_str(reason: ReadDiagnosticCancelReasonArg) -> &'static str {
    match reason {
        ReadDiagnosticCancelReasonArg::ArticleChanged => "article_changed",
        ReadDiagnosticCancelReasonArg::AccountChanged => "account_changed",
        ReadDiagnosticCancelReasonArg::PreferenceChanged => "preference_changed",
        ReadDiagnosticCancelReasonArg::EngagementChanged => "engagement_changed",
        ReadDiagnosticCancelReasonArg::EffectCleanup => "effect_cleanup",
    }
}

fn read_diagnostic_outcome_str(outcome: ReadDiagnosticOutcomeArg) -> &'static str {
    match outcome {
        ReadDiagnosticOutcomeArg::Success => "success",
        ReadDiagnosticOutcomeArg::Failure => "failure",
    }
}

fn read_diagnostic_error_class_str(
    error_class: Option<ReadDiagnosticErrorClassArg>,
) -> &'static str {
    match error_class {
        Some(ReadDiagnosticErrorClassArg::UserVisible) => "user_visible",
        Some(ReadDiagnosticErrorClassArg::Retryable) => "retryable",
        Some(ReadDiagnosticErrorClassArg::Unknown) | None => "unknown",
    }
}

fn log_read_diagnostic_event(event: &ReadDiagnosticEventArg) {
    match event {
        ReadDiagnosticEventArg::Scheduled {
            request_id,
            generation,
            delay_ms,
        } => {
            tracing::info!(
                target: "read_diagnostics",
                event = "scheduled",
                request_id = %request_id,
                generation,
                delay_ms,
                "auto-mark scheduled"
            );
        }
        ReadDiagnosticEventArg::Skipped {
            request_id,
            generation,
            reason,
        } => {
            tracing::info!(
                target: "read_diagnostics",
                event = "skipped",
                request_id = %request_id,
                generation,
                reason = read_diagnostic_skip_reason_str(*reason),
                "auto-mark skipped"
            );
        }
        ReadDiagnosticEventArg::Cancelled {
            request_id,
            generation,
            reason,
        } => {
            tracing::info!(
                target: "read_diagnostics",
                event = "cancelled",
                request_id = %request_id,
                generation,
                reason = read_diagnostic_cancel_reason_str(*reason),
                "auto-mark cancelled"
            );
        }
        ReadDiagnosticEventArg::Dispatched {
            request_id,
            generation,
            drift_ms,
            saturated,
        } => {
            tracing::info!(
                target: "read_diagnostics",
                event = "dispatched",
                request_id = %request_id,
                generation,
                drift_ms,
                saturated,
                "auto-mark dispatched"
            );
        }
        ReadDiagnosticEventArg::Settled {
            request_id,
            generation,
            outcome,
            duration_ms,
            saturated,
            error_class,
            stale_owner,
        } => {
            let outcome_str = read_diagnostic_outcome_str(*outcome);
            let error_class_str = read_diagnostic_error_class_str(*error_class);
            if matches!(outcome, ReadDiagnosticOutcomeArg::Failure) {
                tracing::warn!(
                    target: "read_diagnostics",
                    event = "settled",
                    request_id = %request_id,
                    generation,
                    outcome = outcome_str,
                    duration_ms,
                    saturated,
                    error_class = error_class_str,
                    stale_owner,
                    "auto-mark settled"
                );
            } else {
                tracing::info!(
                    target: "read_diagnostics",
                    event = "settled",
                    request_id = %request_id,
                    generation,
                    outcome = outcome_str,
                    duration_ms,
                    saturated,
                    error_class = error_class_str,
                    stale_owner,
                    "auto-mark settled"
                );
            }
        }
        ReadDiagnosticEventArg::PendingSlow {
            request_id,
            generation,
            elapsed_ms,
            saturated,
        } => {
            tracing::warn!(
                target: "read_diagnostics",
                event = "pending_slow",
                request_id = %request_id,
                generation,
                elapsed_ms,
                saturated,
                "auto-mark still pending"
            );
        }
    }
}

fn log_read_diagnostics_dropped_count(dropped_count: u32) {
    if dropped_count == 0 {
        return;
    }
    // A typed count, never free text: how many events this batch's sender could not keep (ring
    // eviction while full, a single event too large to ever fit, or a non-finite time value).
    tracing::warn!(
        target: "read_diagnostics",
        event = "dropped",
        dropped_count,
        "read diagnostics events dropped before send"
    );
}

/// Accepts a bounded batch of already-validated (frontend schema, then here) read-state
/// diagnostic events and forwards each to the existing `tracing`/tauri-plugin-log app.log sink.
/// Never touches the database and never affects any read/unread result; a rejected batch is
/// simply dropped, both here and by the frontend caller (which does not retry or await this
/// call). See `src/components/reader/hooks/article/read-state-diagnostics.ts` for the sender.
#[tauri::command]
pub fn record_read_diagnostics_batch(
    events: Vec<ReadDiagnosticEventArg>,
    dropped_count: u32,
) -> Result<(), AppError> {
    let serialized_bytes = serde_json::to_vec(&ReadDiagnosticsBatchSizeCalc {
        events: &events,
        dropped_count,
    })
    .map(|bytes| bytes.len())
    .unwrap_or(usize::MAX);

    if !read_diagnostics_batch_is_valid(&events, dropped_count, serialized_bytes) {
        return Err(AppError::UserVisible {
            message: READ_DIAGNOSTICS_BATCH_REJECTED_MESSAGE.to_string(),
        });
    }

    if !try_reserve_read_diagnostics_session_budget(serialized_bytes as u64) {
        return Err(AppError::UserVisible {
            message: READ_DIAGNOSTICS_BATCH_REJECTED_MESSAGE.to_string(),
        });
    }

    log_read_diagnostics_dropped_count(dropped_count);
    for event in &events {
        log_read_diagnostic_event(event);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{
        diagnostics_size_policy, ensure_log_dir, log_dir_error_message, log_dir_opener_app_arg,
        log_dir_opener_arg, log_dir_privacy_checklist, read_diagnostics_batch_is_valid,
        record_read_diagnostics_batch, reserve_diagnostics_budget, ReadDiagnosticsBatchSizeCalc,
    };
    use crate::commands::dto::ReadDiagnosticEventArg;
    use std::sync::atomic::AtomicU64;

    fn assert_user_visible_recovery_message(result: Result<(), crate::commands::dto::AppError>) {
        match result {
            Err(crate::commands::dto::AppError::UserVisible { message }) => {
                assert_eq!(message, "Check OS permissions and try again.");
            }
            other => panic!("expected user-visible error, got {other:?}"),
        }
    }

    #[test]
    fn log_dir_errors_keep_only_recovery_copy() {
        for action in ["resolve", "create", "open"] {
            let message = log_dir_error_message(action, "permission denied");

            assert_eq!(message, "Check OS permissions and try again.");
            assert!(!message.contains("Failed to open log directory"));
            assert!(!message.contains("permission denied"));
            assert!(!message.contains("debug trace"));
            assert!(!message.contains("raw-key"));
            assert!(!message.contains("browser-geometry"));
            assert!(!message.contains("sync-error"));
        }
    }

    #[test]
    fn log_dir_privacy_checklist_covers_sensitive_diagnostics() {
        let checklist = log_dir_privacy_checklist().join("\n");

        assert!(checklist.contains("app.log excerpt"));
        assert!(checklist.contains("account names"));
        assert!(checklist.contains("feed URLs"));
        assert!(checklist.contains("article URLs"));
        assert!(checklist.contains("local user paths"));
        assert!(checklist.contains("stale support/debug logs"));
        assert!(checklist.contains("support dumps"));
        assert!(checklist.contains("private, unencrypted"));
        assert!(checklist.contains("backup database files"));
        assert!(checklist.contains("OPML exports"));
        assert!(checklist.contains("subscription lists"));
    }

    #[test]
    fn diagnostics_storage_boundary_contract_matches_support_docs() {
        let policy = diagnostics_size_policy();
        let incident_runbook = include_str!("../../../docs/incident-runbook.md");
        let privacy_doc = include_str!("../../../docs/feed-content-privacy.md");

        assert_eq!(policy.total_log_cap_bytes, 35_000_000);
        assert_eq!(policy.per_log_file_cap_bytes, 5_000_000);
        assert_eq!(policy.retention_days, 7);
        assert_eq!(policy.diagnostics_event_cap_bytes, 16 * 1024);
        assert_eq!(policy.diagnostics_ring_buffer_cap_bytes, 256 * 1024);
        assert_eq!(
            policy.emergency_truncation_marker,
            "[ultra-rss-reader:diagnostics-truncated]"
        );
        assert_eq!(
            policy.copy_failure_fallback,
            "Share a manually redacted app.log excerpt instead."
        );

        for required in [
            "35 MB",
            "5 MB",
            "7 days",
            "16 KiB",
            "256 KiB",
            "[ultra-rss-reader:diagnostics-truncated]",
            "manually redacted app.log excerpt",
            "over 2048 user-visible characters",
            "over 8192 UTF-8 bytes",
            "Newlines, carriage returns, tabs, and NUL/control characters are rejected",
            "Clipboard permission denial",
            "Browser storage quota exhaustion",
            "Preferences, sidebar expanded-folder state, command history, and debug diagnostics",
        ] {
            assert!(
                incident_runbook.contains(required) || privacy_doc.contains(required),
                "missing diagnostics size policy text: {required}"
            );
        }
    }

    #[test]
    fn support_privacy_decisions_match_docs_contract() {
        let docs = [
            include_str!("../../../docs/incident-runbook.md"),
            include_str!("../../../docs/feed-content-privacy.md"),
        ]
        .join("\n")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

        for required in [
            "must not include a stable app or environment fingerprint by default",
            "explicit user consent and a redaction preview",
            "support dump generation must fail closed",
            "stale support/debug logs and support dumps",
            "Tooltips and `title` attributes must not reveal credentials, tokens, cookies, full local paths, or full private URLs",
            "do not save feed parser response samples in support-safe diagnostics",
            "Support-safe diagnostics may record only parse failure class",
            "must not persist raw response prefixes",
            "user-opt-in export after the support dump consent and redaction preview flow",
        ] {
            assert!(
                docs.contains(required),
                "missing support privacy contract text: {required}"
            );
        }
    }

    #[test]
    fn log_dir_opener_arg_uses_exact_utf8_path_without_arguments() {
        let dir = Path::new("/tmp/Ultra RSS Reader Logs");

        assert_eq!(
            log_dir_opener_arg(dir).unwrap(),
            "/tmp/Ultra RSS Reader Logs"
        );
        assert_eq!(log_dir_opener_app_arg(), None);
    }

    #[cfg(unix)]
    #[test]
    fn log_dir_opener_arg_rejects_non_utf8_paths_instead_of_lossy_conversion() {
        use std::ffi::OsString;
        use std::os::unix::ffi::OsStringExt;
        use std::path::PathBuf;

        let path = PathBuf::from(OsString::from_vec(b"/tmp/ultra-rss-\xFF-logs".to_vec()));
        let result = log_dir_opener_arg(&path);

        match result {
            Err(crate::commands::dto::AppError::UserVisible { message }) => {
                assert_eq!(message, "Check OS permissions and try again.");
            }
            other => panic!("expected user-visible error, got {other:?}"),
        }
    }

    #[test]
    fn ensure_log_dir_allows_existing_directory() {
        let temp_dir = tempfile::tempdir().unwrap();
        let log_dir = temp_dir.path().join("logs");

        ensure_log_dir(&log_dir).unwrap();
        ensure_log_dir(&log_dir).unwrap();

        assert!(log_dir.is_dir());
    }

    #[test]
    fn ensure_log_dir_rejects_file_collision() {
        let temp_dir = tempfile::tempdir().unwrap();
        let log_dir = temp_dir.path().join("logs");
        std::fs::write(&log_dir, b"not a directory").unwrap();

        assert_user_visible_recovery_message(ensure_log_dir(&log_dir));
        assert!(log_dir.is_file());
    }

    #[cfg(unix)]
    #[test]
    fn ensure_log_dir_allows_symlink_to_existing_directory() {
        let temp_dir = tempfile::tempdir().unwrap();
        let target_dir = temp_dir.path().join("actual-logs");
        let log_dir = temp_dir.path().join("logs-link");
        std::fs::create_dir(&target_dir).unwrap();
        std::os::unix::fs::symlink(&target_dir, &log_dir).unwrap();

        ensure_log_dir(&log_dir).unwrap();

        assert!(log_dir.is_dir());
    }

    #[cfg(unix)]
    #[test]
    fn ensure_log_dir_rejects_symlink_to_file_collision() {
        let temp_dir = tempfile::tempdir().unwrap();
        let target_file = temp_dir.path().join("actual-log-file");
        let log_dir = temp_dir.path().join("logs-link");
        std::fs::write(&target_file, b"not a directory").unwrap();
        std::os::unix::fs::symlink(&target_file, &log_dir).unwrap();

        assert_user_visible_recovery_message(ensure_log_dir(&log_dir));
        assert!(log_dir.is_file());
    }

    fn scheduled_event(request_id: &str) -> ReadDiagnosticEventArg {
        ReadDiagnosticEventArg::Scheduled {
            request_id: request_id.to_string(),
            generation: 1,
            delay_ms: 300,
        }
    }

    #[test]
    fn read_diagnostics_batch_is_valid_rejects_empty_batches_with_no_dropped_count() {
        assert!(!read_diagnostics_batch_is_valid(&[], 0, 0));
    }

    #[test]
    fn read_diagnostics_batch_is_valid_accepts_empty_events_when_dropped_count_is_positive() {
        // A batch that carries only a suppressed-count report (every recent event was itself
        // dropped locally) must still be accepted so the count reaches app.log.
        assert!(read_diagnostics_batch_is_valid(&[], 3, 1));
    }

    #[test]
    fn read_diagnostics_batch_is_valid_rejects_more_than_the_max_event_count() {
        let events: Vec<_> = (0..65).map(|_| scheduled_event("req-1")).collect();
        assert!(!read_diagnostics_batch_is_valid(&events, 0, 1));
    }

    #[test]
    fn read_diagnostics_batch_is_valid_accepts_exactly_the_max_event_count() {
        let events: Vec<_> = (0..64).map(|_| scheduled_event("req-1")).collect();
        assert!(read_diagnostics_batch_is_valid(&events, 0, 1));
    }

    #[test]
    fn read_diagnostics_batch_is_valid_rejects_oversized_serialized_batches() {
        let events = vec![scheduled_event("req-1")];
        assert!(!read_diagnostics_batch_is_valid(&events, 0, 16 * 1024 + 1));
        assert!(read_diagnostics_batch_is_valid(&events, 0, 16 * 1024));
    }

    #[test]
    fn read_diagnostics_batch_is_valid_rejects_an_invalid_request_id() {
        let events = vec![scheduled_event("id with spaces")];
        assert!(!read_diagnostics_batch_is_valid(&events, 0, 1));
    }

    #[test]
    fn reserve_diagnostics_budget_accepts_until_the_cap_then_rejects() {
        let budget = AtomicU64::new(0);
        assert!(reserve_diagnostics_budget(&budget, 100, 40));
        assert!(reserve_diagnostics_budget(&budget, 100, 40));
        // 80 + 40 = 120 > 100: rejected, and the counter must not have moved.
        assert!(!reserve_diagnostics_budget(&budget, 100, 40));
        assert!(reserve_diagnostics_budget(&budget, 100, 20));
    }

    #[test]
    fn reserve_diagnostics_budget_rejects_a_single_batch_larger_than_the_cap() {
        let budget = AtomicU64::new(0);
        assert!(!reserve_diagnostics_budget(&budget, 100, 101));
        // The cap itself is inclusive.
        assert!(reserve_diagnostics_budget(&budget, 100, 100));
    }

    #[test]
    fn record_read_diagnostics_batch_rejects_an_empty_batch_without_logging() {
        let result = record_read_diagnostics_batch(vec![], 0);
        assert_user_visible_recovery_message_with(result, "Diagnostics batch rejected.");
    }

    #[test]
    fn record_read_diagnostics_batch_rejects_an_invalid_request_id() {
        let result =
            record_read_diagnostics_batch(vec![scheduled_event("bad id; drop table articles")], 0);
        assert_user_visible_recovery_message_with(result, "Diagnostics batch rejected.");
    }

    #[test]
    fn record_read_diagnostics_batch_accepts_a_small_valid_batch() {
        let result = record_read_diagnostics_batch(
            vec![scheduled_event("5b978598-36b8-4bd4-8ee4-1bf25f4773c2")],
            0,
        );
        assert!(result.is_ok());
    }

    #[test]
    fn record_read_diagnostics_batch_accepts_an_empty_events_batch_carrying_only_a_dropped_count() {
        let result = record_read_diagnostics_batch(vec![], 5);
        assert!(result.is_ok());
    }

    #[test]
    fn read_diagnostics_batch_size_calc_counts_the_dropped_count_field_itself() {
        // The size check must measure events + dropped_count together, the same shape the
        // command actually serializes, so a large dropped_count cannot silently ride along
        // uncounted.
        let events = vec![scheduled_event("req-1")];
        let without_drops = serde_json::to_vec(&ReadDiagnosticsBatchSizeCalc {
            events: &events,
            dropped_count: 0,
        })
        .unwrap();
        let with_drops = serde_json::to_vec(&ReadDiagnosticsBatchSizeCalc {
            events: &events,
            dropped_count: 4_000_000_000,
        })
        .unwrap();
        assert!(with_drops.len() > without_drops.len());
    }

    fn assert_user_visible_recovery_message_with(
        result: Result<(), crate::commands::dto::AppError>,
        expected: &str,
    ) {
        match result {
            Err(crate::commands::dto::AppError::UserVisible { message }) => {
                assert_eq!(message, expected);
            }
            other => panic!("expected user-visible error, got {other:?}"),
        }
    }
}
