//! macOS unattended work never opens the OS credential store. Only a successful
//! explicit connection grants a bounded, process-local credential lease.
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use zeroize::Zeroizing;

use super::cloudflare_access::CloudflareAccess;
pub(crate) use super::NEEDS_AUTH;
use crate::domain::account::Account;
use crate::domain::error::{DomainError, DomainResult};

const MAX_ACCOUNTS: usize = 16;
const LEASE: Duration = Duration::from_secs(8 * 60 * 60);

#[derive(Clone)]
pub(crate) struct SessionCredentials {
    pub(crate) password: Zeroizing<String>,
    pub(crate) access: Option<CloudflareAccess>,
}

struct Lease {
    generation: u64,
    server_url: Option<String>,
    username: Option<String>,
    expires: Instant,
    credentials: SessionCredentials,
}

#[derive(Default)]
struct SessionCache {
    generation: u64,
    generations: HashMap<String, u64>,
    leases: HashMap<String, Lease>,
}

impl SessionCache {
    fn invalidate(&mut self, id: &str) -> u64 {
        self.generation = self.generation.wrapping_add(1);
        self.leases.remove(id);
        if self.generations.len() >= MAX_ACCOUNTS * 2 && !self.generations.contains_key(id) {
            if let Some(oldest) = self
                .generations
                .iter()
                .min_by_key(|(_, generation)| *generation)
                .map(|(id, _)| id.clone())
            {
                self.generations.remove(&oldest);
                self.leases.remove(&oldest);
            }
        }
        self.generations.insert(id.to_string(), self.generation);
        self.generation
    }

    fn get(&mut self, account: &Account, now: Instant) -> Option<SessionCredentials> {
        self.get_leased(account, now)
            .map(|(credentials, _)| credentials)
    }

    // A mismatch only refuses this caller: its account snapshot may be older than a newer lease.
    fn get_leased(&mut self, account: &Account, now: Instant) -> Option<(SessionCredentials, u64)> {
        self.leases.retain(|_, lease| lease.expires > now);
        let lease = self.leases.get(account.id.as_ref())?;
        if lease.server_url != account.server_url || lease.username != account.username {
            return None;
        }
        Some((lease.credentials.clone(), lease.generation))
    }

    fn has_lease(&mut self, id: &str, now: Instant) -> bool {
        self.leases.retain(|_, lease| lease.expires > now);
        self.leases.contains_key(id)
    }

    fn invalidate_if_generation(&mut self, id: &str, generation: u64) -> bool {
        let current = self
            .leases
            .get(id)
            .is_some_and(|lease| lease.generation == generation);
        if current {
            self.invalidate(id);
        }
        current
    }

    fn grant(
        &mut self,
        account: &Account,
        generation: u64,
        credentials: SessionCredentials,
        now: Instant,
    ) {
        // A save, deletion, or newer explicit attempt supersedes in-flight reads.
        if generation
            != self
                .generations
                .get(account.id.as_ref())
                .copied()
                .unwrap_or(0)
        {
            return;
        }
        self.leases.retain(|_, lease| lease.expires > now);
        if self.leases.len() >= MAX_ACCOUNTS {
            if let Some(oldest) = self
                .leases
                .iter()
                .min_by_key(|(_, lease)| lease.expires)
                .map(|(id, _)| id.clone())
            {
                self.leases.remove(&oldest);
            }
        }
        self.leases.insert(
            account.id.as_ref().to_string(),
            Lease {
                generation,
                server_url: account.server_url.clone(),
                username: account.username.clone(),
                expires: now + LEASE,
                credentials,
            },
        );
    }
}

static CACHE: LazyLock<Mutex<SessionCache>> = LazyLock::new(|| Mutex::new(SessionCache::default()));

pub(crate) fn needs_auth() -> DomainError {
    DomainError::Keychain(NEEDS_AUTH.into())
}

pub(crate) fn invalidate(id: &str) -> DomainResult<u64> {
    CACHE
        .lock()
        .map_err(|_| needs_auth())
        .map(|mut cache| cache.invalidate(id))
}

pub(crate) fn get(account: &Account) -> DomainResult<SessionCredentials> {
    CACHE
        .lock()
        .map_err(|_| needs_auth())?
        .get(account, Instant::now())
        .ok_or_else(needs_auth)
}

/// Returns the credentials with the generation of the lease that produced them.
pub(crate) fn get_leased(account: &Account) -> DomainResult<(SessionCredentials, u64)> {
    CACHE
        .lock()
        .map_err(|_| needs_auth())?
        .get_leased(account, Instant::now())
        .ok_or_else(needs_auth)
}

pub(crate) fn has_lease(id: &str) -> bool {
    CACHE
        .lock()
        .is_ok_and(|mut cache| cache.has_lease(id, Instant::now()))
}

/// Drops the lease only if it is still the one read at `generation`.
pub(crate) fn invalidate_if_generation(id: &str, generation: u64) -> DomainResult<bool> {
    CACHE
        .lock()
        .map_err(|_| needs_auth())
        .map(|mut cache| cache.invalidate_if_generation(id, generation))
}

pub(crate) fn grant(
    account: &Account,
    generation: u64,
    credentials: SessionCredentials,
) -> DomainResult<()> {
    CACHE
        .lock()
        .map_err(|_| needs_auth())?
        .grant(account, generation, credentials, Instant::now());
    Ok(())
}

#[cfg(test)]
#[path = "session_cache/tests.rs"]
mod tests;
