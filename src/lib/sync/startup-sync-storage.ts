import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from "@/constants/storage";
import { STARTUP_SYNC_THROTTLE_MS } from "@/constants/ui-runtime";
import { getCurrentTimeMs } from "@/lib/datetime";

type StartupSyncStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;
const startupSyncStorageKeys = [
  STORAGE_KEYS.startupSyncLastTriggeredAt,
  LEGACY_STORAGE_KEYS.startupSyncLastTriggeredAt,
] as const;

function readStartupSyncStorage(): StartupSyncStorage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function migrateLegacyStartupSyncTimestamp(storage: StartupSyncStorage, rawValue: string): void {
  try {
    storage.setItem(STORAGE_KEYS.startupSyncLastTriggeredAt, rawValue);
  } catch {
    return;
  }

  try {
    storage.removeItem(LEGACY_STORAGE_KEYS.startupSyncLastTriggeredAt);
  } catch {
    // Keep the throttling decision based on the valid legacy timestamp even if cleanup fails.
  }
}

export function getLastStartupSyncTriggeredAt(
  storage = readStartupSyncStorage(),
  now = getCurrentTimeMs(),
): number | null {
  if (!storage) {
    return null;
  }

  try {
    for (const storageKey of startupSyncStorageKeys) {
      const rawValue = storage.getItem(storageKey);
      if (!rawValue) {
        continue;
      }

      const timestamp = Number(rawValue);
      if (!Number.isFinite(timestamp) || timestamp < 0 || timestamp > now) {
        storage.removeItem(storageKey);
        continue;
      }

      if (storageKey === LEGACY_STORAGE_KEYS.startupSyncLastTriggeredAt) {
        migrateLegacyStartupSyncTimestamp(storage, rawValue);
      }

      return timestamp;
    }

    return null;
  } catch {
    return null;
  }
}

export function shouldThrottleStartupSync(storage = readStartupSyncStorage(), now = getCurrentTimeMs()): boolean {
  const lastTriggeredAt = getLastStartupSyncTriggeredAt(storage, now);
  return lastTriggeredAt != null && now - lastTriggeredAt < STARTUP_SYNC_THROTTLE_MS;
}

export function markStartupSyncTriggered(storage = readStartupSyncStorage(), now = getCurrentTimeMs()): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(STORAGE_KEYS.startupSyncLastTriggeredAt, String(now));
  } catch {
    // Ignore storage failures and fall back to process-local guarding only.
  }
}
