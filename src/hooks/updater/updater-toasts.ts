import { Result } from "@praha/byethrow";
import { restartApp } from "@/api/tauri-commands";
import { getAddFeedDialogRestartBlockerSnapshot } from "@/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions";
import { getSettingsDirtyStateSnapshot } from "@/components/settings/hooks/settings-dirty-state-registry";
import { isWaitingForSyncRetry, waitForSyncRetry } from "@/hooks/updater/retry-after-sync";
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

let restartInFlight = false;

function restartPreparedUpdate(version: string, ownerToast?: ToastData): void {
  restartInFlight = true;
  void restartApp()
    .then((result) =>
      Result.pipe(
        result,
        Result.inspectError((error) => {
          if (ownerToast && !isCurrentToast(ownerToast)) {
            return;
          }

          if (isDatabaseMaintenanceBusyMessage(error.message)) {
            waitForSyncRetry({
              message: i18n.t("updater.restart_pending_after_sync"),
              onCancel: () => showRestartToast(version),
              retry: async (isPending) => {
                if (isPreparedUpdateRestartBlocked()) {
                  showBlockedRestartToast(version);
                  return false;
                }
                const retryResult = await restartApp();
                if (!isPending()) return false;
                if (Result.isFailure(retryResult)) {
                  const retryError = Result.unwrapError(retryResult);
                  if (isDatabaseMaintenanceBusyMessage(retryError.message)) return true;
                  showRestartFailureToast(version, retryError.message);
                }
                return false;
              },
            });
            return;
          }
          showRestartFailureToast(version, error.message);
        }),
      ),
    )
    .catch((error: unknown) => {
      console.error("App restart failed:", error);
      if (!ownerToast || isCurrentToast(ownerToast)) showRestartFailureToast(version, String(error));
    })
    .finally(() => {
      restartInFlight = false;
    });
}

function showRestartFailureToast(version: string, errorMessage: string): void {
  const message = isLocalizableUserVisibleAppErrorMessage(errorMessage)
    ? localizeUserVisibleAppErrorMessage(errorMessage)
    : i18n.t("updater.restart_failed_ready");
  console.error("App restart failed:", errorMessage);
  const failureToast: ToastData = {
    message,
    severity: "error",
    persistent: true,
    variant: "update",
    actions: [
      {
        label: i18n.t("updater.restart_again"),
        onClick: () => {
          requestPreparedUpdateRestart(version, failureToast);
        },
      },
      {
        label: i18n.t("updater.later"),
        onClick: () => {
          clearToastIfCurrent(failureToast);
        },
      },
    ],
  };
  useUiStore.getState().showToast(failureToast);
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
          requestPreparedUpdateRestart(version, blockedToast);
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

function requestPreparedUpdateRestart(version: string, ownerToast: ToastData): void {
  if (restartInFlight || isWaitingForSyncRetry()) return;
  if (isPreparedUpdateRestartBlocked()) {
    showBlockedRestartToast(version);
    return;
  }
  restartPreparedUpdate(version, ownerToast);
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

          requestPreparedUpdateRestart(version, toast);
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
