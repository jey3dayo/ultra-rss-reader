import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useReducer, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { accountSyncStatusQueryKey, useAccountSyncStatus } from "@/hooks/use-account-sync-status";
import { formatAccountLastSuccessLabel } from "@/lib/account/account-sync-status-format";
import { getCurrentTimeMs } from "@/lib/datetime";
import i18n from "@/lib/i18n";
import { attachTauriListeners } from "@/lib/runtime/tauri-event-listeners";
import {
  getManualSyncCooldownUntil,
  subscribeManualSyncCooldown,
  triggerManualSyncWithCooldown,
} from "@/lib/sync/manual-sync";
import { summarizeSyncResult, summarizeSyncWarnings } from "@/lib/sync/sync-result-feedback";
import type {
  SidebarSyncParams,
  SidebarSyncProgressPayload,
  SidebarSyncResult,
  SidebarSyncWarningPayload,
} from "../../sidebar-sync.types";
import { resolveSidebarSyncFeedbackMessage } from "../../sidebar-sync-feedback";

type SidebarSyncState = {
  cooldownTick: number;
};

type SidebarSyncAction = { type: "set-cooldown-tick"; value: number };
type TauriPayloadEvent<T> = { payload: T };

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

function extractTauriEventPayload<T>(event: T | TauriPayloadEvent<T>): T {
  return typeof event === "object" && event !== null && "payload" in event ? event.payload : event;
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
    void queryClient.invalidateQueries({
      queryKey: accountSyncStatusQueryKey(),
    });
  }, [queryClient]);

  useEffect(() => {
    if (manualSyncCooldownUntil <= getCurrentTimeMs()) {
      return;
    }

    dispatch({ type: "set-cooldown-tick", value: getCurrentTimeMs() });

    const timer = window.setInterval(() => {
      dispatch({ type: "set-cooldown-tick", value: getCurrentTimeMs() });
    }, 1_000);

    return () => {
      window.clearInterval(timer);
    };
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
        const payload = extractTauriEventPayload<SidebarSyncProgressPayload>(event);
        applySyncProgress(payload);
      }),
      listen("sync-completed", () => {
        clearSyncProgress();
        invalidateAccountSyncStatuses();
      }),
      listen<SidebarSyncWarningPayload>("sync-warning", (event) => {
        const payload = extractTauriEventPayload<SidebarSyncWarningPayload>(event);
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
