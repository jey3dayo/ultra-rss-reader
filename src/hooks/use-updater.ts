import { Result } from "@praha/byethrow";
import { useEffect } from "react";
import {
  UpdateDownloadProgressEventPayloadSchema,
  type UpdateInfoDto,
  UpdateReadyEventPayloadSchema,
} from "@/api/schemas/update-info";
import { type AppError, checkForUpdate, downloadUpdate, restartApp } from "@/api/tauri-commands";
import { getAddFeedDialogRestartBlockerSnapshot } from "@/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions";
import { getSettingsDirtyStateSnapshot } from "@/components/settings/hooks/settings-dirty-state-registry";
import i18n from "@/lib/i18n";
import { attachTauriListeners, listenTauriEvent } from "@/lib/runtime/tauri-event-listeners";
import {
  isLocalizableUserVisibleAppErrorMessage,
  localizeUserVisibleAppErrorMessage,
} from "@/lib/ui/localize-app-error-message";
import type { ToastData } from "@/lib/ui/toast.types";
import { useUiStore } from "@/stores/ui-store";

type UpdateInfo = UpdateInfoDto;

/** Share a single in-flight update check across startup and manual triggers. */
let checkInFlight: Result.ResultAsync<UpdateInfo | null, AppError> | null = null;
let downloadInFlight = false;
let activeDownloadSessionId: number | null = null;
let activeDownloadProgressPercent: number | null = null;
let activeDownloadRequestId: number | null = null;
let activeDownloadVersion: string | null = null;
/** Whether the active download was started silently (startup check). Silent
 * downloads suppress progress and failure toasts; the ready toast still fires. */
let activeDownloadSilent = false;
let nextDownloadRequestId = 0;
let updateCheckGeneration = 0;
const staleDownloadSessionIds = new Set<number>();
const STARTUP_UPDATE_CHECK_DELAY_MS = 1_500;

function isCurrentToast(toast: ToastData): boolean {
  return useUiStore.getState().toastMessage === toast;
}

function clearToastIfCurrent(toast: ToastData): void {
  if (!isCurrentToast(toast)) {
    return;
  }

  useUiStore.getState().clearToast();
}

function rememberStaleDownloadSession(): void {
  if (activeDownloadSessionId !== null) {
    staleDownloadSessionIds.add(activeDownloadSessionId);
  }
}

function completeActiveDownloadAsReady(downloadRequestId: number): void {
  if (activeDownloadRequestId !== downloadRequestId) {
    return;
  }

  const version = activeDownloadVersion ?? "";
  rememberStaleDownloadSession();
  downloadInFlight = false;
  activeDownloadSessionId = null;
  activeDownloadProgressPercent = null;
  activeDownloadRequestId = null;
  activeDownloadVersion = null;
  activeDownloadSilent = false;
  showRestartToast(version);
}

function getUpdateFailureToastMessage(message: string): string {
  return isLocalizableUserVisibleAppErrorMessage(message)
    ? localizeUserVisibleAppErrorMessage(message)
    : i18n.t("updater.download_failed_keep_current");
}

function getDownloadProgressToastMessage(percent: number | null): string {
  if (percent === 100) {
    return i18n.t("updater.installing");
  }

  return percent != null ? i18n.t("updater.downloading_percent", { percent }) : i18n.t("updater.downloading");
}

function showUpdateFailureToast(message: string): void {
  const store = useUiStore.getState();
  console.error("Update download failed:", message);
  const toast: ToastData = {
    message: getUpdateFailureToastMessage(message),
    persistent: true,
    variant: "update",
    actions: [
      {
        label: i18n.t("updater.check_again"),
        onClick: () => {
          if (!isCurrentToast(toast)) {
            return;
          }

          void runManualUpdateCheck();
        },
      },
      {
        label: i18n.t("close"),
        onClick: () => {
          clearToastIfCurrent(toast);
        },
      },
    ],
  };
  store.showToast(toast);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown update download failure";
}

/**
 * Start a background update download.
 *
 * `silent` downloads (startup check) suppress progress and failure toasts;
 * failures are logged only, since the next startup check will retry. Manual
 * checks pass `silent: false` to surface the existing progress/failure UX.
 * The ready toast fires exactly once regardless of trigger.
 */
function startDownload(version: string, options: { silent: boolean }): void {
  if (downloadInFlight || checkInFlight) {
    return;
  }

  downloadInFlight = true;
  activeDownloadSessionId = null;
  activeDownloadProgressPercent = 0;
  activeDownloadRequestId = nextDownloadRequestId + 1;
  nextDownloadRequestId = activeDownloadRequestId;
  const downloadRequestId = activeDownloadRequestId;
  activeDownloadVersion = version;
  activeDownloadSilent = options.silent;

  if (!options.silent) {
    useUiStore.getState().showToast({
      message: i18n.t("updater.downloading_percent", { percent: 0 }),
      persistent: true,
      progress: 0,
      variant: "update",
    });
  }

  void downloadUpdate()
    .then((result) =>
      Result.pipe(
        result,
        Result.inspect(() => {
          completeActiveDownloadAsReady(downloadRequestId);
        }),
        Result.inspectError((e) => {
          if (activeDownloadRequestId !== downloadRequestId) {
            return;
          }

          rememberStaleDownloadSession();
          if (activeDownloadSilent) {
            console.warn("Silent update download failed:", e.message);
          } else {
            showUpdateFailureToast(e.message);
          }
          downloadInFlight = false;
          activeDownloadSessionId = null;
          activeDownloadProgressPercent = null;
          activeDownloadRequestId = null;
          activeDownloadVersion = null;
          activeDownloadSilent = false;
        }),
      ),
    )
    .catch((error: unknown) => {
      if (activeDownloadRequestId !== downloadRequestId) {
        return;
      }

      rememberStaleDownloadSession();
      if (activeDownloadSilent) {
        console.warn("Silent update download failed:", getErrorMessage(error));
      } else {
        showUpdateFailureToast(getErrorMessage(error));
      }
      downloadInFlight = false;
      activeDownloadSessionId = null;
      activeDownloadProgressPercent = null;
      activeDownloadRequestId = null;
      activeDownloadVersion = null;
      activeDownloadSilent = false;
    });
}

function normalizeDownloadProgressPercent(percent: number | null): number | null {
  if (percent === null) {
    return null;
  }

  if (!Number.isFinite(percent)) {
    return null;
  }

  return Math.min(100, Math.max(0, Math.round(percent)));
}

function readDownloadProgressPercent(payload: unknown): number | null | undefined {
  const result = UpdateDownloadProgressEventPayloadSchema.safeParse(payload);
  if (!result.success) {
    return undefined;
  }

  if (!downloadInFlight) {
    return undefined;
  }

  if (staleDownloadSessionIds.has(result.data.session_id)) {
    return undefined;
  }

  if (activeDownloadSessionId === null) {
    activeDownloadSessionId = result.data.session_id;
  }

  if (result.data.session_id !== activeDownloadSessionId) {
    return undefined;
  }

  const percent = normalizeDownloadProgressPercent(result.data.percent);
  if (percent === null) {
    return percent;
  }

  if (activeDownloadProgressPercent !== null && percent < activeDownloadProgressPercent) {
    return undefined;
  }

  activeDownloadProgressPercent = percent;
  return percent;
}

function isCurrentDownloadReady(payload: unknown): boolean {
  const result = UpdateReadyEventPayloadSchema.safeParse(payload);
  if (!result.success || !downloadInFlight) {
    return false;
  }

  if (staleDownloadSessionIds.has(result.data.session_id)) {
    return false;
  }

  if (activeDownloadSessionId !== null && result.data.session_id !== activeDownloadSessionId) {
    return false;
  }

  activeDownloadSessionId = result.data.session_id;
  return true;
}

function restartPreparedUpdate(ownerToast?: ToastData): void {
  const store = useUiStore.getState();
  void restartApp().then((result) =>
    Result.pipe(
      result,
      Result.inspectError((error) => {
        if (ownerToast && !isCurrentToast(ownerToast)) {
          return;
        }

        const message = isLocalizableUserVisibleAppErrorMessage(error.message)
          ? localizeUserVisibleAppErrorMessage(error.message)
          : i18n.t("updater.restart_failed_ready");
        console.error("App restart failed:", error);
        const failureToast: ToastData = {
          message,
          persistent: true,
          variant: "update",
          actions: [
            {
              label: i18n.t("updater.restart_again"),
              onClick: () => {
                requestPreparedUpdateRestart(failureToast);
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
        store.showToast(failureToast);
      }),
    ),
  );
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

function requestPreparedUpdateRestart(ownerToast: ToastData): void {
  if (isPreparedUpdateRestartBlocked()) {
    const blockedToast: ToastData = {
      message: i18n.t("updater.restart_blocked_dirty_or_pending"),
      persistent: true,
      variant: "update",
      actions: [
        {
          label: i18n.t("updater.restart"),
          onClick: () => {
            requestPreparedUpdateRestart(blockedToast);
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
    return;
  }

  restartPreparedUpdate(ownerToast);
}

function isUpdaterRuntimeUnavailable(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.__DEV_BROWSER_MOCKS__ === true || window.__ULTRA_RSS_BROWSER_MOCKS__ === true)
  );
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

          requestPreparedUpdateRestart(toast);
        },
      },
      {
        label: i18n.t("close"),
        onClick: () => {
          clearToastIfCurrent(toast);
        },
      },
    ],
  };
  store.showToast(toast);
}

export async function performUpdateCheckResult(): Result.ResultAsync<UpdateInfo | null, AppError> {
  if (checkInFlight) return checkInFlight;

  updateCheckGeneration += 1;
  checkInFlight = (async () => {
    return await checkForUpdate();
  })();

  try {
    return await checkInFlight;
  } finally {
    checkInFlight = null;
  }
}

/**
 * Perform an update check with concurrency guard.
 * Returns the update info if available, null otherwise.
 * Rejects if the check fails.
 */
export async function performUpdateCheck(): Promise<UpdateInfo | null> {
  const result = await performUpdateCheckResult();
  if (Result.isFailure(result)) {
    throw Result.unwrapError(result);
  }

  return Result.unwrap(result);
}

export async function runManualUpdateCheck(): Promise<void> {
  if (isUpdaterRuntimeUnavailable()) {
    return;
  }

  if (downloadInFlight) {
    return;
  }

  const store = useUiStore.getState();

  const result = await performUpdateCheckResult();
  if (Result.isFailure(result)) {
    console.error("Manual update check failed:", Result.unwrapError(result));
    store.showToast(i18n.t("updater.check_failed"));
    return;
  }

  const info = Result.unwrap(result);
  if (info) {
    startDownload(info.version, { silent: false });
    return;
  }
  store.showToast(i18n.t("updater.up_to_date"));
}

export function useUpdater(): void {
  // Keep this separate from sidebar/browser lifecycle hooks: this effect owns the
  // updater startup check and Tauri event listener disposal, not shared UI state.
  useEffect(() => {
    let cancelled = false;
    let listenerActive = true;
    const startupCheckGeneration = updateCheckGeneration;

    // Startup check (silent on failure). Delay it so a freshly reloaded app
    // does not surface an actionable update toast while the shell is still settling.
    // A detected update starts a fully silent background download: no "update
    // available" toast, no progress toast. Only the one-time ready toast surfaces.
    const startupCheckTimer = isUpdaterRuntimeUnavailable()
      ? null
      : window.setTimeout(() => {
          if (startupCheckGeneration !== updateCheckGeneration) {
            return;
          }

          void performUpdateCheckResult()
            .then((result) => {
              if (cancelled) {
                return;
              }

              Result.pipe(
                result,
                Result.inspect((info) => {
                  if (info) {
                    startDownload(info.version, { silent: true });
                  }
                }),
                Result.inspectError((error) => {
                  console.warn("Startup update check failed (silent):", error);
                }),
              );
            })
            .catch((error: unknown) => {
              if (!cancelled) {
                console.warn("Startup update check failed (silent):", error);
              }
            });
        }, STARTUP_UPDATE_CHECK_DELAY_MS);

    const disposeTauriListeners = attachTauriListeners(
      [
        {
          owner: "updater:download-progress",
          subscription: listenTauriEvent("update-download-progress", (event) => {
            if (!listenerActive) {
              return;
            }

            const percent = readDownloadProgressPercent(event.payload);
            if (percent === undefined) {
              return;
            }
            if (activeDownloadSilent) {
              return;
            }
            const message = getDownloadProgressToastMessage(percent);
            useUiStore.getState().showToast({
              message,
              persistent: true,
              progress: percent,
              variant: "update",
            });
          }),
        },
        {
          owner: "updater:ready",
          subscription: listenTauriEvent("update-ready", (event) => {
            if (!listenerActive) {
              return;
            }

            if (!isCurrentDownloadReady(event.payload)) {
              return;
            }
            if (activeDownloadRequestId === null) {
              return;
            }
            completeActiveDownloadAsReady(activeDownloadRequestId);
          }),
        },
      ],
      { onUnavailable: () => {} },
    );

    return () => {
      cancelled = true;
      listenerActive = false;
      if (startupCheckTimer !== null) {
        window.clearTimeout(startupCheckTimer);
      }
      disposeTauriListeners();
    };
  }, []);
}
