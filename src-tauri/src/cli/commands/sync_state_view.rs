use serde::Serialize;

use crate::repository::sync_state::SyncState;

/// Shared shape for a single `sync_state` row across `status`, `feed
/// diagnose`, and (with extra fields layered on) `sync-state show`. Never
/// exposes the raw `last_error` message, `continuation`, or `etag` value —
/// only presence/counts, per this task's "no secrets" contract.
#[derive(Serialize, Clone)]
pub(super) struct SyncStateView {
    pub(super) last_success_at: Option<String>,
    pub(super) has_last_error: bool,
    pub(super) error_count: i32,
    pub(super) next_retry_at: Option<String>,
}

impl From<SyncState> for SyncStateView {
    fn from(state: SyncState) -> Self {
        Self {
            last_success_at: state.last_success_at,
            has_last_error: state.last_error.is_some(),
            error_count: state.error_count,
            next_retry_at: state.next_retry_at,
        }
    }
}

/// Renders a GReader `timestamp_usec` (microseconds since the Unix epoch) as
/// RFC3339. Returns `None` for a value chrono cannot represent instead of
/// panicking, since this reads untrusted historical DB content.
pub(super) fn timestamp_usec_to_rfc3339(usec: i64) -> Option<String> {
    let secs = usec.div_euclid(1_000_000);
    let micros_remainder = usec.rem_euclid(1_000_000);
    let nanos = u32::try_from(micros_remainder * 1000).ok()?;
    chrono::DateTime::from_timestamp(secs, nanos).map(|dt| dt.to_rfc3339())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sync_state_view_never_carries_the_raw_last_error_message() {
        let state = SyncState {
            account_id: crate::domain::types::AccountId("acct-1".to_string()),
            scope_key: "scheduler".to_string(),
            timestamp_usec: None,
            continuation: Some("secret-continuation".to_string()),
            etag: Some("secret-etag".to_string()),
            last_modified: None,
            last_success_at: Some("2026-09-25T00:00:00Z".to_string()),
            last_error: Some("connection refused to internal-host:8080".to_string()),
            error_count: 3,
            next_retry_at: Some("2026-09-25T01:00:00Z".to_string()),
        };

        let view = SyncStateView::from(state);
        let json = serde_json::to_string(&view).expect("view should serialize");

        assert!(view.has_last_error);
        assert_eq!(view.error_count, 3);
        assert!(!json.contains("connection refused"));
        assert!(!json.contains("secret-continuation"));
        assert!(!json.contains("secret-etag"));
    }

    #[test]
    fn timestamp_usec_to_rfc3339_renders_a_known_value() {
        // 2026-09-25T00:00:00Z in microseconds since the epoch.
        let usec = 1790294400_i64 * 1_000_000;
        let rendered = timestamp_usec_to_rfc3339(usec).expect("known value should render");
        assert!(rendered.starts_with("2026-09-25T00:00:00"));
    }

    #[test]
    fn timestamp_usec_to_rfc3339_rejects_out_of_range_values() {
        assert_eq!(timestamp_usec_to_rfc3339(i64::MAX), None);
    }
}
