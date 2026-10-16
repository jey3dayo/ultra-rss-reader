//! Scheduler task lifecycle: start bookkeeping, shutdown requests, and drain.

use super::*;

#[derive(Clone)]
pub(super) struct SchedulerShutdown {
    pub(super) requested: Arc<AtomicBool>,
    pub(super) notify: Arc<tokio::sync::Notify>,
}

impl SchedulerShutdown {
    pub(super) fn new() -> Self {
        Self {
            requested: Arc::new(AtomicBool::new(false)),
            notify: Arc::new(tokio::sync::Notify::new()),
        }
    }

    pub(super) fn request(&self) {
        self.requested.store(true, Ordering::SeqCst);
        self.notify.notify_waiters();
    }

    pub(super) fn is_requested(&self) -> bool {
        self.requested.load(Ordering::SeqCst)
    }

    pub(super) async fn wait(&self) {
        loop {
            let notified = self.notify.notified();
            tokio::pin!(notified);
            // Register the waiter before checking the flag so a request()
            // that lands between the check and the await cannot be missed.
            notified.as_mut().enable();
            if self.is_requested() {
                return;
            }
            notified.await;
        }
    }
}

pub(super) struct SchedulerLifecycle {
    pub(super) task: Option<JoinHandle<()>>,
    pub(super) shutdown: SchedulerShutdown,
    pub(super) running: Arc<AtomicBool>,
}

impl Default for SchedulerLifecycle {
    fn default() -> Self {
        Self {
            task: None,
            shutdown: SchedulerShutdown::new(),
            running: Arc::new(AtomicBool::new(false)),
        }
    }
}

pub(super) struct SchedulerStart {
    pub(super) shutdown: SchedulerShutdown,
    pub(super) running: Arc<AtomicBool>,
}

pub(super) struct SchedulerTaskRunningGuard(pub(super) Arc<AtomicBool>);

impl Drop for SchedulerTaskRunningGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

pub(super) fn scheduler_lifecycle() -> &'static Mutex<SchedulerLifecycle> {
    SCHEDULER_LIFECYCLE.get_or_init(|| Mutex::new(SchedulerLifecycle::default()))
}

pub(super) fn clear_inactive_scheduler_task(lifecycle: &mut SchedulerLifecycle) {
    if lifecycle.task.is_some() && !lifecycle.running.load(Ordering::SeqCst) {
        lifecycle.task = None;
    }
}

pub(super) fn prepare_scheduler_start(
    lifecycle: &mut SchedulerLifecycle,
) -> Option<SchedulerStart> {
    clear_inactive_scheduler_task(lifecycle);

    if lifecycle
        .running
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return None;
    }

    lifecycle.shutdown = SchedulerShutdown::new();
    Some(SchedulerStart {
        shutdown: lifecycle.shutdown.clone(),
        running: lifecycle.running.clone(),
    })
}

pub(super) fn register_scheduler_task(lifecycle: &mut SchedulerLifecycle, task: JoinHandle<()>) {
    lifecycle.task = Some(task);
}

pub fn request_sync_scheduler_shutdown() {
    let Ok(mut lifecycle) = scheduler_lifecycle().lock() else {
        tracing::warn!("Background sync scheduler shutdown skipped: lifecycle lock poisoned");
        return;
    };
    clear_inactive_scheduler_task(&mut lifecycle);
    lifecycle.shutdown.request();
}

pub async fn drain_sync_scheduler_shutdown(timeout: Duration) -> bool {
    let task = {
        let Ok(mut lifecycle) = scheduler_lifecycle().lock() else {
            tracing::warn!(
                "Background sync scheduler shutdown drain skipped: lifecycle lock poisoned"
            );
            return false;
        };
        clear_inactive_scheduler_task(&mut lifecycle);
        lifecycle.shutdown.request();
        lifecycle.task.take()
    };

    let Some(task) = task else {
        return true;
    };

    match tokio::time::timeout(timeout, task).await {
        Ok(Ok(())) => true,
        Ok(Err(error)) => {
            tracing::warn!("Background sync scheduler shutdown drain failed: {error}");
            false
        }
        Err(_) => {
            tracing::warn!("Background sync scheduler shutdown drain timed out");
            false
        }
    }
}
