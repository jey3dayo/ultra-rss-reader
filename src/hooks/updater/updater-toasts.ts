import { Result } from "@praha/byethrow";
import { restartApp } from "@/api/tauri-commands";
import { getAddFeedDialogRestartBlockerSnapshot } from "@/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions";
import { getSettingsDirtyStateSnapshot } from "@/components/settings/hooks/settings-dirty-state-registry";
import { isUpdatePending, startPendingUpdate } from "@/hooks/updater/updater-pending-coordinator";
import i18n from "@/lib/i18n";
import {
  isDatabaseMaintenanceBusyMessage,
  isLocalizableUserVisibleAppErrorMessage,
  localizeUserVisibleAppErrorMessage,
} from "@/lib/ui/localize-app-error-message";
import type { ToastData } from "@/lib/ui/toast.types";
import { useUiStore } from "@/stores/ui-store";

function isCurrentToast(toast: ToastData): boolean {
  return useUiStore.getState().toastMessage === toast;
}

function clearToastIfCurrent(toast: ToastData): void {
  if (!isCurrentToast(toast)) {
    return;
  }

  useUiStore.getState().clearToast();
}

function getUpdateFailureToastMessage(message: string): string {
  return isLocalizableUserVisibleAppErrorMessage(message)
    ? localizeUserVisibleAppErrorMessage(message)
    : i18n.t("updater.download_failed_keep_current");
}

export function getDownloadProgressToastMessage(percent: number | null): string {
  if (percent === 100) {
    return i18n.t("updater.installing");
  }

  return percent != null ? i18n.t("updater.downloading_percent", { percent }) : i18n.t("updater.downloading");
}

export function showUpdateFailureToast(message: string, onCheckAgain: () => void): void {
  const store = useUiStore.getState();
  console.error("Update download failed:", message);
  const toast: ToastData = {
    message: getUpdateFailureToastMessage(message),
    severity: "error",
    persistent: true,
    variant: "update",
    actions: [
      {
        label: i18n.t("updater.check_again"),
        onClick: () => {
          if (!isCurrentToast(toast)) {
            return;
          }

          onCheckAgain();
        },
      },
      {
        label: i18n.t("updater.later"),
        onClick: () => {
          clearToastIfCurrent(toast);
        },
      },
    ],
  };
  store.showToast(toast);
}

function restartPreparedUpdate(version: string): void {
  startPendingUpdate({
    kind: "restart",
    version,
    onCancel: () => showRestartToast(version),
    onBlocked: () => showBlockedRestartToast(version),
    run: async () => {
      if (isPreparedUpdateRestartBlocked()) return { type: "blocked" };
      const result = await restartApp();
      if (Result.isSuccess(result)) return { type: "done" };
      const message = Result.unwrapError(result).message;
      return isDatabaseMaintenanceBusyMessage(message) ? { type: "busy" } : { type: "failed", reason: message };
    },
  });
}

function isPreparedUpdateRestartBlocked(): boolean {
  const store = useUiStore.getState();
  const settingsDirtyState = getSettingsDirtyStateSnapshot();
  const addFeedRestartBlocker = getAddFeedDialogRestartBlockerSnapshot();
  const setupSyncPending =
    store.accountSetupSession?.state === "verifying" || store.accountSetupSession?.state === "syncing";

  return (
    (store.settingsOpen && (settingsDirtyState.dirty || settingsDirtyState.pending || setupSyncPending)) ||
    (store.isAddFeedDialogOpen && (addFeedRestartBlocker.dirty || addFeedRestartBlocker.pending))
  );
}

function showBlockedRestartToast(version: string): void {
  const blockedToast: ToastData = {
    message: i18n.t("updater.restart_blocked_dirty_or_pending"),
    persistent: true,
    variant: "update",
    actions: [
      {
        label: i18n.t("updater.restart"),
        onClick: () => {
          requestPreparedUpdateRestart(version);
        },
      },
      {
        label: i18n.t("updater.later"),
        onClick: () => {
          clearToastIfCurrent(blockedToast);
        },
      },
    ],
  };
  useUiStore.getState().showToast(blockedToast);
}

function requestPreparedUpdateRestart(version: string): void {
  if (isUpdatePending()) return;
  if (isPreparedUpdateRestartBlocked()) {
    showBlockedRestartToast(version);
    return;
  }
  useUiStore.getState().clearToast();
  restartPreparedUpdate(version);
}

export function showRestartToast(version: string): void {
  const store = useUiStore.getState();
  const toast: ToastData = {
    message: i18n.t("updater.ready_next_launch", { version }),
    persistent: true,
    variant: "update",
    actions: [
      {
        label: i18n.t("updater.restart_now"),
        onClick: () => {
          if (!isCurrentToast(toast)) {
            return;
          }

          requestPreparedUpdateRestart(version);
        },
      },
      {
        label: i18n.t("updater.later"),
        onClick: () => {
          clearToastIfCurrent(toast);
        },
      },
    ],
  };
  store.showToast(toast);
}
