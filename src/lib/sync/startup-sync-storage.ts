import { LEGACY_STORAGE_KEYS, STORAGE_KEYS } from "@/constants/storage";
import { STARTUP_SYNC_THROTTLE_MS } from "@/constants/ui-runtime";
import { getCurrentTimeMs } from "@/lib/datetime";

type StartupSyncStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;
const startupSyncStorageKeys = [
  STORAGE_KEYS.startupSyncLastTriggeredAt,
  LEGACY_STORAGE_KEYS.startupSyncLastTriggeredAt,
] as const;

function logStartupSyncStorageFailure(message: string, error: unknown): void {
  console.warn(message, error);
}

function readStartupSyncStorage(): StartupSyncStorage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch (error) {
    logStartupSyncStorageFailure("Startup sync localStorage is unavailable.", error);
    return null;
  }
}

function migrateLegacyStartupSyncTimestamp(storage: StartupSyncStorage, rawValue: string): void {
  try {
    storage.setItem(STORAGE_KEYS.startupSyncLastTriggeredAt, rawValue);
  } catch (error) {
    logStartupSyncStorageFailure("Failed to migrate startup sync metadata to localStorage.", error);
    return;
  }

  try {
    storage.removeItem(LEGACY_STORAGE_KEYS.startupSyncLastTriggeredAt);
  } catch (error) {
    logStartupSyncStorageFailure("Failed to remove legacy startup sync metadata from localStorage.", error);
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
        try {
          storage.removeItem(storageKey);
        } catch (error) {
          logStartupSyncStorageFailure("Failed to remove invalid startup sync metadata from localStorage.", error);
        }
        continue;
      }

      if (storageKey === LEGACY_STORAGE_KEYS.startupSyncLastTriggeredAt) {
        migrateLegacyStartupSyncTimestamp(storage, rawValue);
      }

      return timestamp;
    }

    return null;
  } catch (error) {
    logStartupSyncStorageFailure("Failed to read startup sync metadata from localStorage.", error);
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
  } catch (error) {
    logStartupSyncStorageFailure("Failed to write startup sync metadata to localStorage.", error);
    // Ignore storage failures and fall back to process-local guarding only.
  }
}
