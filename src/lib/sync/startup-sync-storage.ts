import { STORAGE_KEYS } from "@/constants/storage";
import { STARTUP_SYNC_THROTTLE_MS } from "@/constants/ui-runtime";
import { getCurrentTimeMs } from "@/lib/datetime";

type StartupSyncStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

function readStartupSyncStorage(): StartupSyncStorage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

export function getLastStartupSyncTriggeredAt(
  storage = readStartupSyncStorage(),
  now = getCurrentTimeMs(),
): number | null {
  if (!storage) {
    return null;
  }

  try {
    const rawValue = storage.getItem(STORAGE_KEYS.startupSyncLastTriggeredAt);
    if (!rawValue) {
      return null;
    }

    const timestamp = Number(rawValue);
    if (!Number.isFinite(timestamp) || timestamp > now) {
      storage.removeItem(STORAGE_KEYS.startupSyncLastTriggeredAt);
      return null;
    }

    return timestamp;
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
