import { Result } from "@praha/byethrow";
import type { SyncResultDto } from "@/api/schemas";
import { type AppError, triggerSync } from "@/api/tauri-commands";
import { getCurrentTimeMs } from "@/lib/datetime";

const MANUAL_SYNC_COOLDOWN_MS = 15_000;

let manualSyncCooldownUntil = 0;
let manualSyncCooldownTimer: ReturnType<typeof setTimeout> | null = null;
const manualSyncCooldownListeners = new Set<() => void>();
let manualSyncCooldownListenerErrorReporter: (errors: readonly unknown[]) => void =
  reportManualSyncCooldownListenerErrors;

function reportManualSyncCooldownListenerErrors(errors: readonly unknown[]) {
  console.error("Manual sync cooldown listeners failed:", errors);
}

export function notifyManualSyncCooldownListeners(
  listeners: Iterable<() => void>,
  onListenerErrors: (errors: readonly unknown[]) => void = reportManualSyncCooldownListenerErrors,
) {
  const errors: unknown[] = [];

  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length > 0) {
    onListenerErrors(errors);
  }
}

function emitManualSyncCooldownChanged() {
  notifyManualSyncCooldownListeners(manualSyncCooldownListeners, manualSyncCooldownListenerErrorReporter);
}

function setManualSyncCooldownUntil(nextCooldownUntil: number) {
  manualSyncCooldownUntil = nextCooldownUntil;

  if (manualSyncCooldownTimer) {
    clearTimeout(manualSyncCooldownTimer);
    manualSyncCooldownTimer = null;
  }

  const remainingMs = Math.max(nextCooldownUntil - getCurrentTimeMs(), 0);
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

export function setManualSyncCooldownListenerErrorReporterForDiagnostics(
  reporter: (errors: readonly unknown[]) => void,
) {
  manualSyncCooldownListenerErrorReporter = reporter;
  return () => {
    manualSyncCooldownListenerErrorReporter = reportManualSyncCooldownListenerErrors;
  };
}

export function isManualSyncCoolingDown() {
  return manualSyncCooldownTimer !== null;
}

type TriggerManualSyncWithCooldownParams = {
  onRequestStart?: () => void;
  onCooldown: () => void;
  onSuccess: (syncResult: SyncResultDto) => void;
  onError: (error: AppError) => void;
};

export type TriggerManualSyncWithCooldownError = AppError | { type: "cooling_down" };

function shouldStartManualSyncCooldown(result: Result.Result<SyncResultDto, AppError>) {
  // Retryable failures still mean native sync accepted user intent and may have
  // scheduled provider backoff. Keep cooldown aligned with successful triggers
  // to avoid tight manual retry loops.
  return Result.isSuccess(result) || Result.unwrapError(result).type === "Retryable";
}

export async function triggerManualSyncWithCooldownResult(
  onRequestStart?: () => void,
): Result.ResultAsync<SyncResultDto, TriggerManualSyncWithCooldownError> {
  if (isManualSyncCoolingDown()) {
    return Result.fail({ type: "cooling_down" });
  }

  onRequestStart?.();
  const result = await triggerSync();
  if (shouldStartManualSyncCooldown(result)) {
    setManualSyncCooldownUntil(getCurrentTimeMs() + MANUAL_SYNC_COOLDOWN_MS);
  }
  return result;
}

export async function triggerManualSyncWithCooldown({
  onRequestStart,
  onCooldown,
  onSuccess,
  onError,
}: TriggerManualSyncWithCooldownParams) {
  const result = await triggerManualSyncWithCooldownResult(onRequestStart);

  if (Result.isFailure(result)) {
    const error = Result.unwrapError(result);
    if (error.type === "cooling_down") {
      onCooldown();
      return;
    }

    onError(error);
    return;
  }

  onSuccess(Result.unwrap(result));
}

export function resetManualSyncCooldownForTests() {
  if (manualSyncCooldownTimer) {
    clearTimeout(manualSyncCooldownTimer);
    manualSyncCooldownTimer = null;
  }
  manualSyncCooldownUntil = 0;
  manualSyncCooldownListeners.clear();
  manualSyncCooldownListenerErrorReporter = reportManualSyncCooldownListenerErrors;
}
