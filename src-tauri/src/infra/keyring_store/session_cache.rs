//! macOS unattended work never opens the OS credential store. Only a successful
//! explicit connection grants a bounded, process-local credential lease.
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use zeroize::Zeroizing;

use super::cloudflare_access::CloudflareAccess;
use crate::domain::account::Account;
use crate::domain::error::{DomainError, DomainResult};

const MAX_ACCOUNTS: usize = 16;
const LEASE: Duration = Duration::from_secs(8 * 60 * 60);
pub(crate) const NEEDS_AUTH: &str = "Credential access needs attention. Open account settings and choose Save and test connection to allow access for this app session (up to 8 hours). Automatic sync will not open Keychain dialogs.";

#[derive(Clone)]
pub(crate) struct SessionCredentials {
    pub(crate) password: Zeroizing<String>,
    pub(crate) access: Option<CloudflareAccess>,
}

struct Lease {
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
        self.leases.retain(|_, lease| lease.expires > now);
        let lease = self.leases.get(account.id.as_ref())?;
        if lease.server_url != account.server_url || lease.username != account.username {
            self.invalidate(account.id.as_ref());
            return None;
        }
        Some(lease.credentials.clone())
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
