use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use crate::domain::account::Account;

use super::DEFAULT_SYNC_INTERVAL_SECS;

/// Per-account scheduling state kept in memory.
pub(super) struct AccountSchedule {
    pub(super) next_sync: Instant,
    pub(super) interval: Duration,
}

pub(super) struct SchedulerSyncGuard<'a>(&'a AtomicBool);

impl Drop for SchedulerSyncGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

pub(super) fn account_interval(account: &Account) -> Duration {
    let secs = if account.sync_interval_secs > 0 {
        account.sync_interval_secs as u64
    } else {
        DEFAULT_SYNC_INTERVAL_SECS
    };
    Duration::from_secs(secs)
}

pub(super) fn acquire_scheduler_sync_guard(syncing: &AtomicBool) -> Option<SchedulerSyncGuard<'_>> {
    syncing
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .ok()
        .map(|_| SchedulerSyncGuard(syncing))
}

pub(super) fn upsert_account_schedule(
    schedules: &mut HashMap<String, AccountSchedule>,
    account_id: String,
    account: &Account,
    now: Instant,
    persisted_retry_next_sync: Option<Instant>,
) {
    let interval = account_interval(account);
    let next_sync = persisted_retry_next_sync.unwrap_or(now + interval);
    match schedules.get_mut(&account_id) {
        Some(schedule) if schedule.interval != interval => {
            schedule.interval = interval;
            schedule.next_sync = next_sync;
        }
        Some(schedule) if schedule.next_sync > next_sync => {
            schedule.next_sync = next_sync;
        }
        Some(_) => {}
        None => {
            schedules.insert(
                account_id,
                AccountSchedule {
                    next_sync,
                    interval,
                },
            );
        }
    }
}

pub(super) fn prune_deleted_account_schedules(
    schedules: &mut HashMap<String, AccountSchedule>,
    accounts: &[Account],
) {
    let account_ids: HashSet<&str> = accounts.iter().map(|a| a.id.as_ref()).collect();
    schedules.retain(|id, _| account_ids.contains(id.as_str()));
}

pub(super) fn select_due_accounts_for_tick<'a>(
    accounts: &'a [Account],
    schedules: &HashMap<String, AccountSchedule>,
    now: Instant,
    max_accounts: usize,
) -> Vec<&'a Account> {
    if max_accounts == 0 {
        return Vec::new();
    }

    let mut due_accounts = accounts
        .iter()
        .filter_map(|account| {
            schedules
                .get(account.id.as_ref())
                .filter(|schedule| now >= schedule.next_sync)
                .map(|schedule| (account, schedule.next_sync))
        })
        .collect::<Vec<_>>();
    due_accounts.sort_by_key(|(account, next_sync)| (*next_sync, account.id.as_ref().to_string()));
    due_accounts
        .into_iter()
        .take(max_accounts)
        .map(|(account, _)| account)
        .collect()
}

pub(super) fn schedule_completed_account_sync(
    schedules: &mut HashMap<String, AccountSchedule>,
    account: &Account,
    now: Instant,
) {
    let interval = account_interval(account);
    let account_id = account.id.as_ref().to_string();
    schedules
        .entry(account_id)
        .and_modify(|schedule| {
            schedule.interval = interval;
            schedule.next_sync = now + interval;
        })
        .or_insert(AccountSchedule {
            next_sync: now + interval,
            interval,
        });
}

pub(super) fn schedule_failed_account_sync(
    schedules: &mut HashMap<String, AccountSchedule>,
    account: &Account,
    now: Instant,
    backoff: Duration,
) {
    let interval = account_interval(account);
    let account_id = account.id.as_ref().to_string();
    schedules
        .entry(account_id)
        .and_modify(|schedule| {
            schedule.interval = interval;
            schedule.next_sync = now + backoff;
        })
        .or_insert(AccountSchedule {
            next_sync: now + backoff,
            interval,
        });
}
