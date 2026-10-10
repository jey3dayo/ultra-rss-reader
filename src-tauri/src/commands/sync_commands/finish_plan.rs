use crate::commands::dto::SyncResult;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum SyncEntry {
    ManualAll,
    ManualAccount,
    ManualFeed,
    Automatic,
    Startup,
    SchedulerLoop,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct FinishInput {
    pub(crate) synced: bool,
    pub(crate) succeeded: usize,
    pub(crate) has_failures: bool,
    pub(crate) has_warnings: bool,
    pub(crate) all_succeeded: bool,
    pub(crate) has_startup_targets: bool,
}

impl FinishInput {
    pub(crate) fn from_result(result: &SyncResult) -> Self {
        Self {
            synced: result.synced,
            succeeded: result.succeeded,
            has_failures: !result.failed.is_empty(),
            has_warnings: !result.warnings.is_empty(),
            all_succeeded: result.failed.is_empty(),
            has_startup_targets: false,
        }
    }

    fn completed_cleanly(&self) -> bool {
        self.succeeded > 0 && !self.has_failures && !self.has_warnings
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct FinishPlan {
    pub(crate) emit_warning: bool,
    pub(crate) emit_completed: bool,
    pub(crate) emit_succeeded: bool,
    pub(crate) purge: bool,
    pub(crate) enable_automatic: bool,
}

// Manual entries report completion only after a succeeded account; the other entries follow `synced`.
pub(crate) fn plan_finish(input: &FinishInput, entry: SyncEntry) -> FinishPlan {
    let synced = input.synced;
    match entry {
        SyncEntry::ManualAll => {
            let reported = synced && input.succeeded > 0;
            FinishPlan {
                emit_warning: synced && input.has_warnings,
                emit_completed: reported,
                emit_succeeded: synced && input.completed_cleanly(),
                purge: reported,
                enable_automatic: reported,
            }
        }
        SyncEntry::ManualAccount | SyncEntry::ManualFeed => {
            let reported = synced && input.succeeded > 0;
            FinishPlan {
                emit_warning: reported && input.has_warnings,
                emit_completed: reported,
                emit_succeeded: reported && input.completed_cleanly(),
                purge: false,
                enable_automatic: reported && entry == SyncEntry::ManualAccount,
            }
        }
        SyncEntry::Automatic => FinishPlan {
            emit_warning: synced && input.has_warnings,
            emit_completed: synced,
            emit_succeeded: synced && input.completed_cleanly(),
            purge: synced,
            enable_automatic: false,
        },
        SyncEntry::Startup => FinishPlan {
            emit_warning: synced && input.has_warnings,
            emit_completed: synced,
            emit_succeeded: synced && input.completed_cleanly(),
            purge: synced,
            enable_automatic: synced && input.has_startup_targets,
        },
        SyncEntry::SchedulerLoop => FinishPlan {
            emit_warning: input.has_warnings,
            emit_completed: synced,
            emit_succeeded: synced && input.all_succeeded && !input.has_warnings,
            purge: synced,
            enable_automatic: false,
        },
    }
}
