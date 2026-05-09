import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useReducer, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { type AccountSyncWarning, AccountSyncWarningSchema } from "@/api/schemas/sync-result";
import { accountSyncStatusQueryKey, useAccountSyncStatus } from "@/hooks/use-account-sync-status";
import { formatAccountLastSuccessLabel } from "@/lib/account/account-sync-status-format";
import { getCurrentTimeMs } from "@/lib/datetime";
import i18n from "@/lib/i18n";
import { invalidateQueryKeysLogOnly } from "@/lib/query/query-invalidation";
import { attachTauriListeners } from "@/lib/runtime/tauri-event-listeners";
import {
  getManualSyncCooldownUntil,
  subscribeManualSyncCooldown,
  triggerManualSyncWithCooldown,
} from "@/lib/sync/manual-sync";
import type { SyncProgressEventDto } from "@/lib/sync/sync-progress-event.types";
import type { SyncProgressUiState } from "@/lib/sync/sync-progress-state.types";
import { summarizeSyncResult, summarizeSyncWarnings } from "@/lib/sync/sync-result-feedback";
import { resolveSidebarSyncFeedbackMessage } from "../../sidebar-sync-feedback";

export type SidebarSyncResult = {
  handleSync: () => Promise<void>;
  lastSyncedLabel: string;
  syncTooltipLabel: string | null;
  isSyncCoolingDown: boolean;
  isSyncDisabled: boolean;
};

type SidebarSyncProgressPayload = SyncProgressEventDto;
type SidebarSyncWarningPayload = AccountSyncWarning[];
type SidebarSyncCompletedPayload = null;

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

const SyncProgressEventSchema = z.object({
  stage: z.enum(["started", "account_started", "account_finished", "finished"]),
  kind: z.enum(["manual_all", "manual_account", "automatic"]),
  total: z.number().int().nonnegative().finite(),
  completed: z.number().int().nonnegative().finite(),
  account_id: z.string().nullable().optional(),
  account_name: z.string().nullable().optional(),
  success: z.boolean().nullable().optional(),
});

const SyncWarningPayloadSchema = z.array(AccountSyncWarningSchema);
const SyncCompletedPayloadSchema = z.null();

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
  const result = SyncProgressEventSchema.safeParse(extractTauriEventPayload(event));
  return result.success ? result.data : null;
}

export function resolveSidebarSyncWarningPayload(event: unknown): SidebarSyncWarningPayload | null {
  const result = SyncWarningPayloadSchema.safeParse(extractTauriEventPayload(event));
  return result.success ? result.data : null;
}

export function isSidebarSyncCompletedPayload(event: unknown): boolean {
  const result = SyncCompletedPayloadSchema.safeParse(extractTauriEventPayload(event));
  return result.success;
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
  const invalidateAccountSyncStatuses = useCallback(() => {
    invalidateQueryKeysLogOnly(queryClient, [accountSyncStatusQueryKey()]);
  }, [queryClient]);

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
    return attachTauriListeners([
      listen<SidebarSyncProgressPayload>("sync-progress", (event) => {
        const payload = resolveSidebarSyncProgressPayload(event);
        if (!payload) {
          return;
        }
        applySyncProgress(payload);
      }),
      listen<SidebarSyncCompletedPayload>("sync-completed", (event) => {
        if (!isSidebarSyncCompletedPayload(event)) {
          return;
        }
        clearSyncProgress();
        invalidateAccountSyncStatuses();
      }),
      listen<SidebarSyncWarningPayload>("sync-warning", (event) => {
        const payload = resolveSidebarSyncWarningPayload(event);
        if (!payload) {
          return;
        }
        if (payload.length > 0) {
          invalidateAccountSyncStatuses();
          showToast(resolveSidebarSyncFeedbackMessage(t, summarizeSyncWarnings(payload)));
        }
      }),
    ]);
  }, [applySyncProgress, clearSyncProgress, invalidateAccountSyncStatuses, showToast, t]);

  const handleSync = useCallback(async () => {
    if (syncProgress.active) {
      return;
    }

    await triggerManualSyncWithCooldown({
      onCooldown: () => {
        showToast(t("sync_cooldown_active"));
      },
      onSuccess: (syncResult) => {
        invalidateAccountSyncStatuses();
        showToast(resolveSidebarSyncFeedbackMessage(t, summarizeSyncResult(syncResult)));
      },
      onError: (error) => {
        invalidateAccountSyncStatuses();
        console.error("Sync failed:", error);
        showToast(t("sync_failed"));
      },
    });
  }, [invalidateAccountSyncStatuses, showToast, syncProgress.active, t]);

  return {
    handleSync,
    lastSyncedLabel,
    syncTooltipLabel,
    isSyncCoolingDown,
    isSyncDisabled: false,
  };
}
