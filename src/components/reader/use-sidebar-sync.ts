import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useAccountSyncStatus } from "@/hooks/use-account-sync-status";
import i18n from "@/lib/i18n";
import {
  getManualSyncCooldownUntil,
  subscribeManualSyncCooldown,
  triggerManualSyncWithCooldown,
} from "@/lib/manual-sync";
import { summarizeSyncResult, summarizeSyncWarnings } from "@/lib/sync-result-feedback";
import { attachTauriListeners } from "@/lib/tauri-event-listeners";
import type {
  SidebarSyncParams,
  SidebarSyncProgressPayload,
  SidebarSyncResult,
  SidebarSyncWarningPayload,
} from "./sidebar-sync.types";
import { resolveSidebarSyncFeedbackMessage } from "./sidebar-sync-feedback";

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
  const [cooldownTick, setCooldownTick] = useState(() => Date.now());
  const invalidateAccountSyncStatuses = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["account-sync-status"] });
  }, [queryClient]);

  useEffect(() => {
    if (manualSyncCooldownUntil <= Date.now()) {
      return;
    }

    setCooldownTick(Date.now());

    const timer = window.setInterval(() => {
      setCooldownTick(Date.now());
    }, 1_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [manualSyncCooldownUntil]);

  const lastSyncedLabel = useMemo(() => {
    const lastSuccessAt = syncStatusQuery.data?.last_success_at;
    if (lastSuccessAt) {
      const date = new Date(lastSuccessAt);
      if (!Number.isNaN(date.getTime())) {
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const now = new Date();
        const isToday =
          date.getFullYear() === now.getFullYear() &&
          date.getMonth() === now.getMonth() &&
          date.getDate() === now.getDate();

        if (isToday) {
          return t("today_at", { time: `${hours}:${minutes}` });
        }

        const dateLabel = date.toLocaleDateString(i18n.language, { month: "short", day: "numeric" });
        return t("date_at", { date: dateLabel, time: `${hours}:${minutes}` });
      }
    }

    if (selectedAccountId && syncStatusQuery.isPending && syncStatusQuery.data === undefined) {
      return t("checking_sync_status");
    }

    if (!selectedAccountId) {
      return t("not_synced_yet");
    }
    return t("not_synced_yet");
  }, [selectedAccountId, syncStatusQuery.data, syncStatusQuery.isPending, t]);

  const cooldownRemainingMs = manualSyncCooldownUntil - cooldownTick;
  const isSyncCoolingDown = cooldownRemainingMs > 0;
  const syncTooltipLabel = isSyncCoolingDown
    ? t("sync_cooldown_remaining", { seconds: Math.ceil(cooldownRemainingMs / 1_000) })
    : null;

  useEffect(() => {
    return attachTauriListeners([
      listen("sync-progress", (event) => {
        const payload =
          typeof event === "object" && event !== null && "payload" in event
            ? (event.payload as SidebarSyncProgressPayload)
            : (event as SidebarSyncProgressPayload);
        applySyncProgress(payload);
      }),
      listen("sync-completed", () => {
        clearSyncProgress();
        invalidateAccountSyncStatuses();
      }),
      listen("sync-warning", (event) => {
        const payload =
          typeof event === "object" && event !== null && "payload" in event
            ? (event.payload as SidebarSyncWarningPayload)
            : (event as SidebarSyncWarningPayload);
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
