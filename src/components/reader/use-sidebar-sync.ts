import { Result } from "@praha/byethrow";
import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AccountSyncWarning } from "@/api/schemas/sync-result";
import { triggerSync } from "@/api/tauri-commands";
import i18n from "@/lib/i18n";
import { resolveSyncFeedbackMessage, summarizeSyncResult, summarizeSyncWarnings } from "@/lib/sync-result-feedback";
import type { SyncProgressEvent, SyncProgressState } from "@/stores/ui-store";

type SyncWarningPayload = AccountSyncWarning[];

function formatScheduledRetryTime(retryAt: string | undefined, language: string): string | null {
  if (!retryAt) {
    return null;
  }

  const date = new Date(retryAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleTimeString(language, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

type UseSidebarSyncParams = {
  syncProgress: SyncProgressState;
  applySyncProgress: (event: SyncProgressEvent) => void;
  clearSyncProgress: () => void;
  showToast: (message: string) => void;
};

export function useSidebarSync({
  syncProgress,
  applySyncProgress,
  clearSyncProgress,
  showToast,
}: UseSidebarSyncParams) {
  const { t } = useTranslation("sidebar");
  const queryClient = useQueryClient();
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const invalidateAccountSyncStatuses = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["account-sync-status"] });
  }, [queryClient]);

  const lastSyncedLabel = useMemo(() => {
    if (!lastSyncedAt) {
      return t("not_synced_yet");
    }

    const hours = lastSyncedAt.getHours().toString().padStart(2, "0");
    const minutes = lastSyncedAt.getMinutes().toString().padStart(2, "0");
    const now = new Date();
    const isToday =
      lastSyncedAt.getFullYear() === now.getFullYear() &&
      lastSyncedAt.getMonth() === now.getMonth() &&
      lastSyncedAt.getDate() === now.getDate();

    if (isToday) {
      return t("today_at", { time: `${hours}:${minutes}` });
    }

    const dateLabel = lastSyncedAt.toLocaleDateString(i18n.language, { month: "short", day: "numeric" });
    return t("date_at", { date: dateLabel, time: `${hours}:${minutes}` });
  }, [lastSyncedAt, t]);

  useEffect(() => {
    let cancelled = false;
    let unlistenCompleted: (() => void) | undefined;
    let unlistenProgress: (() => void) | undefined;
    let unlistenWarning: (() => void) | undefined;

    listen("sync-progress", (event) => {
      const payload =
        typeof event === "object" && event !== null && "payload" in event
          ? (event.payload as SyncProgressEvent)
          : (event as SyncProgressEvent);
      applySyncProgress(payload);
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlistenProgress = fn;
      }
    });

    listen("sync-completed", () => {
      setLastSyncedAt(new Date());
      clearSyncProgress();
      invalidateAccountSyncStatuses();
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlistenCompleted = fn;
      }
    });

    listen("sync-warning", (event) => {
      const payload =
        typeof event === "object" && event !== null && "payload" in event
          ? (event.payload as SyncWarningPayload)
          : (event as SyncWarningPayload);
      if (payload.length > 0) {
        invalidateAccountSyncStatuses();
        const feedback = summarizeSyncWarnings(payload);
        showToast(
          resolveSyncFeedbackMessage(feedback, {
            alreadyInProgress: t("sync_already_in_progress"),
            partialFailure: (accounts) => t("sync_partial_failure", { accounts }),
            retryScheduled: (accounts, retryAt) => {
              const retryTime = formatScheduledRetryTime(retryAt, i18n.language);
              return retryTime
                ? t("sync_retry_scheduled", { accounts, time: retryTime })
                : t("sync_retry_scheduled_soon", { accounts });
            },
            retryPending: (accounts) => t("sync_completed_with_retry_pending", { accounts }),
            warnings: (accounts) => t("sync_completed_with_warnings", { accounts }),
            success: t("sync_completed"),
          }),
        );
      }
    }).then((fn) => {
      if (cancelled) {
        fn();
      } else {
        unlistenWarning = fn;
      }
    });

    return () => {
      cancelled = true;
      unlistenCompleted?.();
      unlistenProgress?.();
      unlistenWarning?.();
    };
  }, [applySyncProgress, clearSyncProgress, invalidateAccountSyncStatuses, showToast, t]);

  const handleSync = useCallback(async () => {
    if (syncProgress.active) {
      return;
    }

    const result = await triggerSync();
    Result.pipe(
      result,
      Result.inspect((syncResult) => {
        invalidateAccountSyncStatuses();
        showToast(
          resolveSyncFeedbackMessage(summarizeSyncResult(syncResult), {
            alreadyInProgress: t("sync_already_in_progress"),
            partialFailure: (accounts) => t("sync_partial_failure", { accounts }),
            retryScheduled: (accounts, retryAt) => {
              const retryTime = formatScheduledRetryTime(retryAt, i18n.language);
              return retryTime
                ? t("sync_retry_scheduled", { accounts, time: retryTime })
                : t("sync_retry_scheduled_soon", { accounts });
            },
            retryPending: (accounts) => t("sync_completed_with_retry_pending", { accounts }),
            warnings: (accounts) => t("sync_completed_with_warnings", { accounts }),
            success: t("sync_completed"),
          }),
        );
      }),
      Result.inspectError((error) => {
        console.error("Sync failed:", error);
        showToast(t("sync_failed"));
      }),
    );
  }, [invalidateAccountSyncStatuses, showToast, syncProgress.active, t]);

  return {
    handleSync,
    lastSyncedLabel,
  };
}
