import { Result } from "@praha/byethrow";
import type { SyncResultDto } from "@/api/schemas";
import { type AppError, triggerSync } from "@/api/tauri-commands";
import { getCurrentTimeMs } from "@/lib/datetime";
import { logRuntimeDiagnostic } from "@/lib/runtime/diagnostics";

const MANUAL_SYNC_COOLDOWN_MS = 15_000;
const MANUAL_SYNC_COOLDOWN_SUBSCRIBER_ID_PREFIX = "manual-sync-cooldown-listener";

let manualSyncCooldownUntil = 0;
let manualSyncCooldownTimer: ReturnType<typeof setTimeout> | null = null;
let manualSyncCooldownListenerSequence = 0;
const manualSyncCooldownListeners = new Set<ManualSyncCooldownListenerEntry>();
let manualSyncCooldownListenerDiagnosticsReporter: ((
  reports: readonly ManualSyncCooldownListenerErrorReport[],
) => void) | null = null;

type ManualSyncCooldownListenerEntry = {
  id: string;
  listener: () => void;
};

export type ManualSyncCooldownListenerErrorReport = {
  subscriberId: string;
  error: unknown;
};

function reportManualSyncCooldownListenerErrors(
  reports: readonly ManualSyncCooldownListenerErrorReport[],
) {
  logRuntimeDiagnostic(
    "manual-sync-cooldown-listener",
    "Manual sync cooldown listeners failed:",
    reports,
  );
  manualSyncCooldownListenerDiagnosticsReporter?.(reports);
}

export function notifyManualSyncCooldownListeners(
  listeners: Iterable<ManualSyncCooldownListenerEntry | (() => void)>,
  onListenerErrors: (
    reports: readonly ManualSyncCooldownListenerErrorReport[],
  ) => void = reportManualSyncCooldownListenerErrors,
) {
  const reports: ManualSyncCooldownListenerErrorReport[] = [];

  for (const [index, listenerEntry] of Array.from(listeners).entries()) {
    const entry =
      typeof listenerEntry === "function"
        ? {
            id: `${MANUAL_SYNC_COOLDOWN_SUBSCRIBER_ID_PREFIX}:ad-hoc-${index + 1}`,
            listener: listenerEntry,
          }
        : listenerEntry;
    try {
      entry.listener();
    } catch (error) {
      reports.push({
        subscriberId: entry.id,
        error,
      });
    }
  }

  if (reports.length > 0) {
    onListenerErrors(reports);
  }
}

function emitManualSyncCooldownChanged() {
  notifyManualSyncCooldownListeners(manualSyncCooldownListeners);
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
  manualSyncCooldownListenerSequence += 1;
  const entry = {
    id: `${MANUAL_SYNC_COOLDOWN_SUBSCRIBER_ID_PREFIX}:${manualSyncCooldownListenerSequence}`,
    listener,
  };
  manualSyncCooldownListeners.add(entry);
  return () => {
    manualSyncCooldownListeners.delete(entry);
  };
}

export function setManualSyncCooldownListenerErrorReporterForDiagnostics(
  reporter: (reports: readonly ManualSyncCooldownListenerErrorReport[]) => void,
) {
  manualSyncCooldownListenerDiagnosticsReporter = reporter;
  return () => {
    manualSyncCooldownListenerDiagnosticsReporter = null;
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
  manualSyncCooldownListenerSequence = 0;
  manualSyncCooldownListeners.clear();
  manualSyncCooldownListenerDiagnosticsReporter = null;
}
