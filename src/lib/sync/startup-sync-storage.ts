import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from "@/constants/storage";
import { STARTUP_SYNC_THROTTLE_MS } from "@/constants/ui-runtime";
import { getCurrentTimeMs } from "@/lib/datetime";

type StartupSyncStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;
type StartupSyncStorageFailureKind = "unavailable" | "migrate" | "cleanup" | "read" | "write";

const startupSyncStorageKeys = [
  STORAGE_KEYS.startupSyncLastTriggeredAt,
  LEGACY_STORAGE_KEYS.startupSyncLastTriggeredAt,
] as const;
const warnedStartupSyncStorageFailureKinds = new Set<StartupSyncStorageFailureKind>();

function resetStartupSyncStorageFailure(kind: StartupSyncStorageFailureKind): void {
  warnedStartupSyncStorageFailureKinds.delete(kind);
}

export function resetStartupSyncStorageFailureWarnings(): void {
  warnedStartupSyncStorageFailureKinds.clear();
}

function logStartupSyncStorageFailure(message: string, error: unknown): void {
  console.warn(message, error);
}

function warnStartupSyncStorageFailureOnce(
  kind: StartupSyncStorageFailureKind,
  message: string,
  error: unknown,
): void {
  if (warnedStartupSyncStorageFailureKinds.has(kind)) {
    return;
  }

  warnedStartupSyncStorageFailureKinds.add(kind);
  logStartupSyncStorageFailure(message, error);
}

function readStartupSyncStorage(): StartupSyncStorage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const storage = window.localStorage;
    resetStartupSyncStorageFailure("unavailable");
    return storage;
  } catch (error) {
    warnStartupSyncStorageFailureOnce("unavailable", "Startup sync localStorage is unavailable.", error);
    return null;
  }
}

function startupSyncAccountStorageKey(accountId: string): string {
  return `${STORAGE_KEYS.startupSyncLastTriggeredAt}:${accountId}`;
}

function storageKeysForStartupSync(accountId?: string): readonly string[] {
  if (!accountId) {
    return startupSyncStorageKeys;
  }

  return [startupSyncAccountStorageKey(accountId)];
}

function migrateLegacyStartupSyncTimestamp(storage: StartupSyncStorage, rawValue: string): void {
  try {
    storage.setItem(STORAGE_KEYS.startupSyncLastTriggeredAt, rawValue);
    resetStartupSyncStorageFailure("migrate");
  } catch (error) {
    warnStartupSyncStorageFailureOnce("migrate", "Failed to migrate startup sync metadata to localStorage.", error);
    return;
  }

  try {
    storage.removeItem(LEGACY_STORAGE_KEYS.startupSyncLastTriggeredAt);
    resetStartupSyncStorageFailure("cleanup");
  } catch (error) {
    warnStartupSyncStorageFailureOnce(
      "cleanup",
      "Failed to remove legacy startup sync metadata from localStorage.",
      error,
    );
    // Keep the throttling decision based on the valid legacy timestamp even if cleanup fails.
  }
}

export function getLastStartupSyncTriggeredAt(
  storage = readStartupSyncStorage(),
  now = getCurrentTimeMs(),
  accountId?: string,
): number | null {
  if (!storage) {
    return null;
  }

  try {
    for (const storageKey of storageKeysForStartupSync(accountId)) {
      const rawValue = storage.getItem(storageKey);
      resetStartupSyncStorageFailure("read");
      if (!rawValue) {
        continue;
      }

      const timestamp = Number(rawValue);
      if (!Number.isFinite(timestamp) || timestamp < 0 || timestamp > now) {
        try {
          storage.removeItem(storageKey);
          resetStartupSyncStorageFailure("cleanup");
        } catch (error) {
          warnStartupSyncStorageFailureOnce(
            "cleanup",
            "Failed to remove invalid startup sync metadata from localStorage.",
            error,
          );
        }
        continue;
      }

      if (!accountId && storageKey === LEGACY_STORAGE_KEYS.startupSyncLastTriggeredAt) {
        migrateLegacyStartupSyncTimestamp(storage, rawValue);
      }

      return timestamp;
    }

    return null;
  } catch (error) {
    warnStartupSyncStorageFailureOnce("read", "Failed to read startup sync metadata from localStorage.", error);
    return null;
  }
}

export function shouldThrottleStartupSync(
  storage = readStartupSyncStorage(),
  now = getCurrentTimeMs(),
  accountId?: string,
): boolean {
  const lastTriggeredAt = getLastStartupSyncTriggeredAt(storage, now, accountId);
  return lastTriggeredAt != null && now - lastTriggeredAt < STARTUP_SYNC_THROTTLE_MS;
}

export function markStartupSyncTriggered(
  storage = readStartupSyncStorage(),
  now = getCurrentTimeMs(),
  accountId?: string,
): void {
  if (!storage) {
    return;
  }

  try {
    const storageKey = accountId ? startupSyncAccountStorageKey(accountId) : STORAGE_KEYS.startupSyncLastTriggeredAt;
    storage.setItem(storageKey, String(now));
    resetStartupSyncStorageFailure("write");
  } catch (error) {
    warnStartupSyncStorageFailureOnce("write", "Failed to write startup sync metadata to localStorage.", error);
    // Ignore storage failures and fall back to process-local guarding only.
  }
}
