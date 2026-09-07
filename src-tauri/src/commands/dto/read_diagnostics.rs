// DTOs for the local-only read-state diagnostics IPC boundary. Every field here is either a
// bounded enum, a small bounded number, or an opaque per-request id; none of them may ever carry
// an article id, feed id, account id, title, URL, body text, search string, token, local path,
// SQL, or a raw error message. See tmp/read-state/design-contract.md for the full contract.
use serde::{Deserialize, Serialize};

/// Bound on the per-request diagnostic id (a `crypto.randomUUID()`-shaped string). Any longer or
/// differently-charset value is treated as invalid and discarded rather than rejecting the whole
/// command it rides along with.
pub const READ_DIAGNOSTIC_REQUEST_ID_MAX_CHARS: usize = 64;

/// Optional diagnostic context threaded through `mark_article_read`. Both fields are plain
/// strings (not a strict enum) so a malformed value can never fail the surrounding command's
/// argument deserialization; validation happens after parsing and simply substitutes a
/// backend-generated context when the value does not pass.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadDiagnosticContextArg {
    pub request_id: String,
    pub source: String,
}

/// True only for an opaque, bounded-length id built from ASCII letters, digits, and hyphens
/// (the shape of `crypto.randomUUID()`). This check never logs the rejected value.
pub fn is_valid_read_diagnostic_request_id(value: &str) -> bool {
    !value.is_empty()
        && value.chars().count() <= READ_DIAGNOSTIC_REQUEST_ID_MAX_CHARS
        && value.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

/// Maximum number of events accepted in a single `record_read_diagnostics_batch` call. Mirrors
/// the frontend sink's own ring buffer capacity so the two ends of the boundary agree.
pub const READ_DIAGNOSTICS_BATCH_MAX_EVENTS: usize = 64;
/// Maximum serialized size, in bytes, accepted for a single batch. Reuses the existing
/// `diagnostics_event_cap_bytes` policy value pinned in `log_commands.rs` rather than inventing a
/// new number.
pub const READ_DIAGNOSTICS_BATCH_MAX_BYTES: usize = 16 * 1024;
/// Cumulative cap, in bytes, on how much this process will accept across every batch in its
/// lifetime. Reuses the existing `diagnostics_ring_buffer_cap_bytes` policy value. Once reached,
/// further batches are dropped for the rest of the session; this is a known, documented limit.
pub const READ_DIAGNOSTICS_SESSION_MAX_BYTES: u64 = 256 * 1024;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReadDiagnosticSkipReasonArg {
    AlreadyRead,
    NotReading,
    PreferenceNever,
    ManualUnreadSuppressed,
    AlreadyRequested,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReadDiagnosticCancelReasonArg {
    ArticleChanged,
    AccountChanged,
    PreferenceChanged,
    EngagementChanged,
    EffectCleanup,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReadDiagnosticOutcomeArg {
    Success,
    Failure,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReadDiagnosticErrorClassArg {
    UserVisible,
    Retryable,
    Unknown,
}

/// One diagnostic event reported by the reader-local auto-mark sink
/// (`src/components/reader/hooks/article/read-state-diagnostics.ts`). `request_id` is an opaque
/// per-operation id; `generation` disambiguates repeated timer (re)scheduling for the same
/// article/account/view owner. Neither ever carries an article, feed, or account identifier.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(
    tag = "event",
    rename_all = "snake_case",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum ReadDiagnosticEventArg {
    Scheduled {
        request_id: String,
        generation: u32,
        delay_ms: u32,
    },
    Skipped {
        request_id: String,
        generation: u32,
        reason: ReadDiagnosticSkipReasonArg,
    },
    Cancelled {
        request_id: String,
        generation: u32,
        reason: ReadDiagnosticCancelReasonArg,
    },
    Dispatched {
        request_id: String,
        generation: u32,
        drift_ms: i32,
        /// True only when the frontend had to clamp an out-of-range drift value before sending
        /// it; lets a reader tell "drift was exactly at the bound" apart from "drift was
        /// truncated and the real value is unknown".
        saturated: bool,
    },
    Settled {
        request_id: String,
        generation: u32,
        outcome: ReadDiagnosticOutcomeArg,
        duration_ms: u32,
        /// See `Dispatched::saturated`; true when duration_ms was clamped from an out-of-range
        /// value (e.g. an IPC/DB stall past 60s).
        saturated: bool,
        error_class: Option<ReadDiagnosticErrorClassArg>,
        stale_owner: bool,
    },
    PendingSlow {
        request_id: String,
        generation: u32,
        elapsed_ms: u32,
        /// See `Dispatched::saturated`; true when elapsed_ms was clamped from an out-of-range
        /// value.
        saturated: bool,
    },
}

impl ReadDiagnosticEventArg {
    pub fn request_id(&self) -> &str {
        match self {
            ReadDiagnosticEventArg::Scheduled { request_id, .. }
            | ReadDiagnosticEventArg::Skipped { request_id, .. }
            | ReadDiagnosticEventArg::Cancelled { request_id, .. }
            | ReadDiagnosticEventArg::Dispatched { request_id, .. }
            | ReadDiagnosticEventArg::Settled { request_id, .. }
            | ReadDiagnosticEventArg::PendingSlow { request_id, .. } => request_id,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::is_valid_read_diagnostic_request_id;

    #[test]
    fn accepts_uuid_shaped_ids() {
        assert!(is_valid_read_diagnostic_request_id(
            "5b978598-36b8-4bd4-8ee4-1bf25f4773c2"
        ));
    }

    #[test]
    fn rejects_blank_oversized_and_unsafe_charset_ids() {
        assert!(!is_valid_read_diagnostic_request_id(""));
        assert!(!is_valid_read_diagnostic_request_id(&"a".repeat(65)));
        assert!(!is_valid_read_diagnostic_request_id("id;DROP TABLE"));
        assert!(!is_valid_read_diagnostic_request_id("id\nwith\nnewlines"));
        assert!(!is_valid_read_diagnostic_request_id("id with spaces"));
    }

    #[test]
    fn accepts_exactly_the_max_length() {
        assert!(is_valid_read_diagnostic_request_id(&"a".repeat(64)));
    }
}
