import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useReducer, useRef, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import type { IssuePathItem } from "valibot";
import { safeParse } from "valibot";
import { type SyncProgressEventDto, SyncProgressEventSchema } from "@/api/schemas/sync-progress";
import {
  type SyncCompletedPayload,
  SyncCompletedPayloadSchema,
  type SyncWarningPayload,
  SyncWarningPayloadSchema,
} from "@/api/schemas/sync-result";
import { accountSyncStatusQueryKey, useAccountSyncStatus } from "@/hooks/use-account-sync-status";
import { formatAccountLastSuccessLabel } from "@/lib/account/account-sync-status-format";
import { getCurrentTimeMs } from "@/lib/datetime";
import i18n from "@/lib/i18n";
import { invalidateQueryKeysLogOnly, invalidateSyncCompletedQueries } from "@/lib/query/query-invalidation";
import { attachTauriListeners, listenTauriEvent } from "@/lib/runtime/tauri-event-listeners";
import {
  getManualSyncCooldownUntil,
  setManualSyncCooldownListenerErrorReporterForDiagnostics,
  subscribeManualSyncCooldown,
  triggerManualSyncWithCooldown,
} from "@/lib/sync/manual-sync";
import { summarizeSyncResult, summarizeSyncWarnings } from "@/lib/sync/sync-result-feedback";
import type { SyncProgressUiState } from "@/stores/ui-store";
import { resolveSidebarSyncFeedbackMessage } from "../../sidebar-sync-feedback";

export type SidebarSyncResult = {
  handleSync: () => Promise<void>;
  lastSyncedLabel: string;
  syncTooltipLabel: string | null;
  isSyncCoolingDown: boolean;
  isSyncDisabled: boolean;
};

type SidebarSyncProgressPayload = SyncProgressEventDto;
type SidebarSyncWarningPayload = SyncWarningPayload;
type SidebarSyncCompletedPayload = SyncCompletedPayload;
type SidebarSyncStatusInvalidationOwner = "background-sync-completed" | "manual-sync-completed";

type SidebarSyncParams = {
  selectedAccountId: string | null;
  syncProgress: SyncProgressUiState;
  applySyncProgress: (event: SyncProgressEventDto) => void;
  clearSyncProgress: () => void;
  showToast: (message: string) => void;
};

type SidebarSyncState = {
  cooldownTick: number;
};

type SidebarSyncAction = { type: "set-cooldown-tick"; value: number };

const SYNC_PROGRESS_STUCK_RECOVERY_MS = 10 * 60_000;
const MANUAL_SYNC_COMPLETION_FALLBACK_MS = 3_000;
const malformedSyncEventWarnings = new Set<string>();

function createInitialSidebarSyncState() {
  return {
    cooldownTick: getCurrentTimeMs(),
  } satisfies SidebarSyncState;
}

function sidebarSyncReducer(state: SidebarSyncState, action: SidebarSyncAction): SidebarSyncState {
  switch (action.type) {
    case "set-cooldown-tick":
      return { ...state, cooldownTick: action.value };
    default:
      return state;
  }
}

function extractTauriEventPayload(event: unknown): unknown {
  return typeof event === "object" && event !== null && "payload" in event ? event.payload : event;
}

function getPayloadType(payload: unknown) {
  if (payload === null) {
    return "null";
  }
  if (Array.isArray(payload)) {
    return "array";
  }
  return typeof payload;
}

function reportMalformedSyncEventOnce(
  eventName: string,
  payload: unknown,
  error: { issues: ReadonlyArray<{ path?: readonly IssuePathItem[] }> },
) {
  const issuePath = error.issues[0]?.path?.map((item) => String(item.key)).join(".");
  const issue = issuePath ? issuePath : "payload";
  const warningKey = `${eventName}:${issue}`;
  if (malformedSyncEventWarnings.has(warningKey)) {
    return;
  }
  malformedSyncEventWarnings.add(warningKey);
  console.warn(`Ignored malformed ${eventName} payload: payloadType=${getPayloadType(payload)} issue=${issue}`);
}

function reportStuckSyncProgressRecovery(syncProgress: SyncProgressUiState) {
  console.warn("Cleared stuck sync progress after missing sync-completed event:", {
    kind: syncProgress.kind,
    stage: syncProgress.stage,
    total: syncProgress.total,
    completed: syncProgress.completed,
    activeAccountCount: syncProgress.activeAccountIds.size,
  });
}

function reportManualSyncCooldownListenerDiagnostics(errors: readonly unknown[]) {
  console.warn("Manual sync cooldown listener diagnostics:", {
    errorCount: errors.length,
    errors,
  });
}

function startSidebarCooldownInterval(onTick: () => void) {
  if (typeof window === "undefined") {
    return undefined;
  }

  const setIntervalFn = window.setInterval;
  const clearIntervalFn = window.clearInterval;
  if (typeof setIntervalFn !== "function" || typeof clearIntervalFn !== "function") {
    return undefined;
  }

  try {
    const timer = setIntervalFn(onTick, 1_000);
    return () => {
      clearIntervalFn(timer);
    };
  } catch (error) {
    console.warn("Sidebar sync cooldown interval unavailable:", error);
    return undefined;
  }
}

export function resolveSidebarSyncProgressPayload(event: unknown): SidebarSyncProgressPayload | null {
  const payload = extractTauriEventPayload(event);
  const result = safeParse(SyncProgressEventSchema, payload);
  if (!result.success) {
    reportMalformedSyncEventOnce("sync-progress", payload, result);
    return null;
  }
  return result.output;
}

export function resolveSidebarSyncWarningPayload(event: unknown): SidebarSyncWarningPayload | null {
  const payload = extractTauriEventPayload(event);
  const result = safeParse(SyncWarningPayloadSchema, payload);
  if (!result.success) {
    reportMalformedSyncEventOnce("sync-warning", payload, result);
    return null;
  }
  return result.output;
}

export function isSidebarSyncCompletedPayload(event: unknown): boolean {
  const payload = extractTauriEventPayload(event);
  const result = safeParse(SyncCompletedPayloadSchema, payload);
  if (!result.success) {
    reportMalformedSyncEventOnce("sync-completed", payload, result);
    return false;
  }
  return true;
}

export function resetSidebarSyncDiagnosticsForTests() {
  malformedSyncEventWarnings.clear();
}

export function resolveSidebarLastSyncedLabel({
  selectedAccountId,
  lastSuccessAt,
  isPending,
  isError,
  language,
  labels,
}: {
  selectedAccountId: string | null;
  lastSuccessAt: string | null | undefined;
  isPending: boolean;
  isError: boolean;
  language: string;
  labels: {
    todayAt: (time: string) => string;
    dateAt: (date: string, time: string) => string;
    checkingSyncStatus: string;
    syncStatusUnavailable: string;
    notSyncedYet: string;
  };
}): string {
  const lastSuccessLabel = formatAccountLastSuccessLabel(lastSuccessAt ?? undefined, language);
  if (lastSuccessLabel) {
    if (lastSuccessLabel.isToday) {
      return labels.todayAt(lastSuccessLabel.time);
    }

    return labels.dateAt(lastSuccessLabel.date, lastSuccessLabel.time);
  }

  if (selectedAccountId && isPending) {
    return labels.checkingSyncStatus;
  }

  if (selectedAccountId && isError) {
    return labels.syncStatusUnavailable;
  }

  return labels.notSyncedYet;
}

export function useSidebarSync({
  selectedAccountId,
  syncProgress,
  applySyncProgress,
  clearSyncProgress,
  showToast,
}: SidebarSyncParams): SidebarSyncResult {
  const { t } = useTranslation("sidebar");
  const queryClient = useQueryClient();
  const syncStatusQuery = useAccountSyncStatus(selectedAccountId);
  const manualSyncCooldownUntil = useSyncExternalStore(
    subscribeManualSyncCooldown,
    getManualSyncCooldownUntil,
    getManualSyncCooldownUntil,
  );
  const [state, dispatch] = useReducer(sidebarSyncReducer, undefined, createInitialSidebarSyncState);
  const { cooldownTick } = state;
  const invalidateAccountSyncStatuses = useCallback(
    (actionOwner: SidebarSyncStatusInvalidationOwner) => {
      invalidateQueryKeysLogOnly(queryClient, [accountSyncStatusQueryKey()], { actionOwner });
    },
    [queryClient],
  );
  const manualSyncCompletionObservedRef = useRef(false);
  const manualSyncCompletionFallbackTimerRef = useRef<number | null>(null);
  const manualSyncRunAccountIdRef = useRef<string | null>(null);
  const manualSyncRunActiveRef = useRef(false);
  const clearManualSyncCompletionFallbackTimer = useCallback(() => {
    const timer = manualSyncCompletionFallbackTimerRef.current;
    if (timer === null) {
      return;
    }

    clearTimeout(timer);
    manualSyncCompletionFallbackTimerRef.current = null;
  }, []);
  const startManualSyncRun = useCallback(() => {
    clearManualSyncCompletionFallbackTimer();
    manualSyncCompletionObservedRef.current = false;
    manualSyncRunAccountIdRef.current = selectedAccountId;
    manualSyncRunActiveRef.current = true;
  }, [clearManualSyncCompletionFallbackTimer, selectedAccountId]);
  const markManualSyncCompletionObserved = useCallback(() => {
    manualSyncCompletionObservedRef.current = true;
    clearManualSyncCompletionFallbackTimer();
  }, [clearManualSyncCompletionFallbackTimer]);
  const scheduleManualSyncCompletionFallback = useCallback(
    (accountId: string | null) => {
      if (
        !manualSyncRunActiveRef.current ||
        manualSyncRunAccountIdRef.current !== accountId ||
        manualSyncCompletionObservedRef.current ||
        manualSyncCompletionFallbackTimerRef.current !== null ||
        typeof window === "undefined"
      ) {
        return;
      }

      const timer = window.setTimeout(() => {
        if (manualSyncCompletionFallbackTimerRef.current !== timer) {
          return;
        }

        manualSyncCompletionFallbackTimerRef.current = null;
        if (manualSyncCompletionObservedRef.current) {
          return;
        }

        invalidateSyncCompletedQueries(queryClient, { actionOwner: "manual-sync-completed" });
      }, MANUAL_SYNC_COMPLETION_FALLBACK_MS);
      manualSyncCompletionFallbackTimerRef.current = timer;
    },
    [queryClient],
  );

  useEffect(() => {
    if (manualSyncCooldownUntil <= getCurrentTimeMs()) {
      return;
    }

    dispatch({ type: "set-cooldown-tick", value: getCurrentTimeMs() });

    return startSidebarCooldownInterval(() => {
      dispatch({ type: "set-cooldown-tick", value: getCurrentTimeMs() });
    });
  }, [manualSyncCooldownUntil]);

  const lastSyncedLabel = useMemo(() => {
    return resolveSidebarLastSyncedLabel({
      selectedAccountId,
      lastSuccessAt: syncStatusQuery.data?.last_success_at,
      isPending: syncStatusQuery.isPending && syncStatusQuery.data === undefined,
      isError: syncStatusQuery.isError,
      language: i18n.language,
      labels: {
        todayAt: (time) => t("today_at", { time }),
        dateAt: (date, time) => t("date_at", { date, time }),
        checkingSyncStatus: t("checking_sync_status"),
        syncStatusUnavailable: t("sync_failed"),
        notSyncedYet: t("not_synced_yet"),
      },
    });
  }, [selectedAccountId, syncStatusQuery.data, syncStatusQuery.isError, syncStatusQuery.isPending, t]);

  const cooldownRemainingMs = manualSyncCooldownUntil - cooldownTick;
  const isSyncCoolingDown = cooldownRemainingMs > 0;
  const syncTooltipLabel = isSyncCoolingDown
    ? t("sync_cooldown_remaining", {
        seconds: Math.ceil(cooldownRemainingMs / 1_000),
      })
    : null;

  useEffect(() => {
    const restoreReporter = setManualSyncCooldownListenerErrorReporterForDiagnostics(
      reportManualSyncCooldownListenerDiagnostics,
    );
    return restoreReporter;
  }, []);

  useEffect(() => {
    if (!syncProgress.active || typeof window === "undefined") {
      return;
    }

    const timer = window.setTimeout(() => {
      reportStuckSyncProgressRecovery(syncProgress);
      clearSyncProgress();
      invalidateAccountSyncStatuses("background-sync-completed");
    }, SYNC_PROGRESS_STUCK_RECOVERY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [clearSyncProgress, invalidateAccountSyncStatuses, syncProgress]);

  useEffect(() => {
    const accountIdAtEffect = selectedAccountId;
    return () => {
      if (manualSyncRunAccountIdRef.current === accountIdAtEffect) {
        clearManualSyncCompletionFallbackTimer();
        manualSyncCompletionObservedRef.current = false;
        manualSyncRunAccountIdRef.current = null;
        manualSyncRunActiveRef.current = false;
      }
    };
  }, [clearManualSyncCompletionFallbackTimer, selectedAccountId]);

  useEffect(() => {
    return attachTauriListeners([
      listenTauriEvent<SidebarSyncProgressPayload>("sync-progress", (event) => {
        const payload = resolveSidebarSyncProgressPayload(event);
        if (!payload) {
          return;
        }
        applySyncProgress(payload);
      }),
      listenTauriEvent<SidebarSyncCompletedPayload>("sync-completed", (event) => {
        if (!isSidebarSyncCompletedPayload(event)) {
          return;
        }
        markManualSyncCompletionObserved();
        clearSyncProgress();
        invalidateAccountSyncStatuses("background-sync-completed");
      }),
      listenTauriEvent<SidebarSyncWarningPayload>("sync-warning", (event) => {
        const payload = resolveSidebarSyncWarningPayload(event);
        if (!payload) {
          return;
        }
        if (payload.length > 0) {
          invalidateAccountSyncStatuses("background-sync-completed");
          showToast(resolveSidebarSyncFeedbackMessage(t, summarizeSyncWarnings(payload)));
        }
      }),
    ]);
  }, [
    applySyncProgress,
    clearSyncProgress,
    invalidateAccountSyncStatuses,
    markManualSyncCompletionObserved,
    showToast,
    t,
  ]);

  const handleSync = useCallback(async () => {
    if (syncProgress.active) {
      return;
    }

    await triggerManualSyncWithCooldown({
      selectedAccountId,
      onRequestStart: startManualSyncRun,
      onCooldown: () => {
        showToast(t("sync_cooldown_active"));
      },
      onSuccess: (syncResult) => {
        invalidateAccountSyncStatuses("manual-sync-completed");
        // This fallback is defense in depth for abnormal native emit or listener
        // registration failures, not the primary fix for the visible refetch
        // lag (the sync button stays syncing until feeds refetch settles).
        // Native intentionally suppresses sync-completed for zero-success or
        // unsynced results, so those results must not trigger this fallback.
        if (syncResult.synced && syncResult.succeeded > 0) {
          scheduleManualSyncCompletionFallback(selectedAccountId);
        }
        showToast(resolveSidebarSyncFeedbackMessage(t, summarizeSyncResult(syncResult)));
      },
      onError: (error) => {
        invalidateAccountSyncStatuses("manual-sync-completed");
        console.error("Sync failed:", error);
        showToast(t("sync_failed"));
      },
    });
  }, [
    invalidateAccountSyncStatuses,
    scheduleManualSyncCompletionFallback,
    selectedAccountId,
    showToast,
    startManualSyncRun,
    syncProgress.active,
    t,
  ]);

  return {
    handleSync,
    lastSyncedLabel,
    syncTooltipLabel,
    isSyncCoolingDown,
    isSyncDisabled: false,
  };
}
