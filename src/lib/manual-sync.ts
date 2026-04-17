import { Result } from "@praha/byethrow";
import type { SyncResultDto } from "@/api/schemas";
import { type AppError, triggerSync } from "@/api/tauri-commands";

const MANUAL_SYNC_COOLDOWN_MS = 15_000;

let manualSyncCooldownUntil = 0;
let manualSyncCooldownTimer: ReturnType<typeof setTimeout> | null = null;
const manualSyncCooldownListeners = new Set<() => void>();

function emitManualSyncCooldownChanged() {
  for (const listener of manualSyncCooldownListeners) {
    listener();
  }
}

function setManualSyncCooldownUntil(nextCooldownUntil: number) {
  manualSyncCooldownUntil = nextCooldownUntil;

  if (manualSyncCooldownTimer) {
    clearTimeout(manualSyncCooldownTimer);
    manualSyncCooldownTimer = null;
  }

  const remainingMs = Math.max(nextCooldownUntil - Date.now(), 0);
  if (remainingMs === 0) {
    emitManualSyncCooldownChanged();
    return;
  }

  manualSyncCooldownTimer = setTimeout(() => {
    manualSyncCooldownUntil = 0;
    manualSyncCooldownTimer = null;
    emitManualSyncCooldownChanged();
  }, remainingMs);

  emitManualSyncCooldownChanged();
}

export function getManualSyncCooldownUntil() {
  return manualSyncCooldownUntil;
}

export function subscribeManualSyncCooldown(listener: () => void) {
  manualSyncCooldownListeners.add(listener);
  return () => {
    manualSyncCooldownListeners.delete(listener);
  };
}

export function isManualSyncCoolingDown() {
  return manualSyncCooldownUntil > Date.now();
}

type TriggerManualSyncWithCooldownParams = {
  onRequestStart?: () => void;
  onCooldown: () => void;
  onSuccess: (syncResult: SyncResultDto) => void;
  onError: (error: AppError) => void;
};

export async function triggerManualSyncWithCooldown({
  onRequestStart,
  onCooldown,
  onSuccess,
  onError,
}: TriggerManualSyncWithCooldownParams) {
  if (isManualSyncCoolingDown()) {
    onCooldown();
    return;
  }

  onRequestStart?.();
  const result = await triggerSync();
  setManualSyncCooldownUntil(Date.now() + MANUAL_SYNC_COOLDOWN_MS);

  Result.pipe(result, Result.inspect(onSuccess), Result.inspectError(onError));
}

export function resetManualSyncCooldownForTests() {
  if (manualSyncCooldownTimer) {
    clearTimeout(manualSyncCooldownTimer);
    manualSyncCooldownTimer = null;
  }
  manualSyncCooldownUntil = 0;
  emitManualSyncCooldownChanged();
}
