use super::*;

#[test]
fn sync_progress_completed_is_monotonic_and_clamped_to_total() {
    let completed = AtomicUsize::new(0);

    assert_eq!(next_sync_progress_completed(&completed, 2), 1);
    assert_eq!(next_sync_progress_completed(&completed, 2), 2);
    assert_eq!(next_sync_progress_completed(&completed, 2), 2);
    assert_eq!(completed.load(Ordering::SeqCst), 2);
}

#[test]
fn sync_progress_session_id_advances_per_reporter() {
    SYNC_PROGRESS_SESSION_ID.store(0, Ordering::SeqCst);

    assert_eq!(next_sync_progress_session_id(), 1);
    assert_eq!(next_sync_progress_session_id(), 2);
}
#[test]
fn sync_event_emit_warning_names_failed_event_without_failing_sync() {
    let warning = sync_event_emit_warning(SYNC_COMPLETED_EVENT, &"listener unavailable");

    assert_eq!(
        warning,
        "Failed to emit sync-completed event after sync: listener unavailable"
    );
}
