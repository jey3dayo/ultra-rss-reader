import { Result } from "@praha/byethrow";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import {
  UpdateDownloadProgressEventPayloadSchema,
  type UpdateInfoDto,
  UpdateReadyEventPayloadSchema,
} from "@/api/schemas/update-info";
import { type AppError, checkForUpdate, downloadAndInstallUpdate, restartApp } from "@/api/tauri-commands";
import i18n from "@/lib/i18n";
import { attachTauriListeners } from "@/lib/runtime/tauri-event-listeners";
import type { ToastData } from "@/lib/ui/toast.types";
import { useUiStore } from "@/stores/ui-store";

type UpdateInfo = UpdateInfoDto;

/** Share a single in-flight update check across startup and manual triggers. */
let checkInFlight: Result.ResultAsync<UpdateInfo | null, AppError> | null = null;
let downloadInFlight = false;
let activeDownloadSessionId: number | null = null;
let activeDownloadRequestId: number | null = null;
let nextDownloadRequestId = 0;
const staleDownloadSessionIds = new Set<number>();

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

  rememberStaleDownloadSession();
  downloadInFlight = false;
  activeDownloadSessionId = null;
  activeDownloadRequestId = null;
  showRestartToast();
}

export function showUpdateAvailableToast(version: string): void {
  const store = useUiStore.getState();
  const toast: ToastData = {
    message: i18n.t("updater.available", { version }),
    persistent: true,
    variant: "update",
    actions: [
      {
        label: i18n.t("updater.update_now"),
        onClick: () => {
          startDownload(toast);
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

function showUpdateFailureToast(message: string): void {
  const store = useUiStore.getState();
  console.error("Update download failed:", message);
  const toast: ToastData = {
    message: i18n.t("updater.download_failed_keep_current"),
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

function startDownload(ownerToast?: ToastData): void {
  if (ownerToast && !isCurrentToast(ownerToast)) {
    return;
  }

  if (downloadInFlight || checkInFlight) {
    return;
  }

  downloadInFlight = true;
  activeDownloadSessionId = null;
  activeDownloadRequestId = nextDownloadRequestId + 1;
  nextDownloadRequestId = activeDownloadRequestId;
  const downloadRequestId = activeDownloadRequestId;
  const store = useUiStore.getState();
  store.showToast({
    message: i18n.t("updater.downloading_percent", { percent: 0 }),
    persistent: true,
    progress: 0,
    variant: "update",
  });

  void downloadAndInstallUpdate()
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
          showUpdateFailureToast(e.message);
          downloadInFlight = false;
          activeDownloadSessionId = null;
          activeDownloadRequestId = null;
        }),
      ),
    )
    .catch((error: unknown) => {
      if (activeDownloadRequestId !== downloadRequestId) {
        return;
      }

      rememberStaleDownloadSession();
      showUpdateFailureToast(getErrorMessage(error));
      downloadInFlight = false;
      activeDownloadSessionId = null;
      activeDownloadRequestId = null;
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

  return normalizeDownloadProgressPercent(result.data.percent);
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

        console.error("App restart failed:", error);
        const failureToast: ToastData = {
          message: i18n.t("updater.restart_failed_ready"),
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

function requestPreparedUpdateRestart(ownerToast: ToastData): void {
  useUiStore.getState().showConfirm(
    i18n.t("updater.ready"),
    () => {
      restartPreparedUpdate(ownerToast);
    },
    {
      actionLabel: i18n.t("updater.restart"),
      variant: "warning",
    },
  );
}

function isUpdaterRuntimeUnavailable(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.__DEV_BROWSER_MOCKS__ === true || window.__ULTRA_RSS_BROWSER_MOCKS__ === true)
  );
}

export function showRestartToast(): void {
  const store = useUiStore.getState();
  const toast: ToastData = {
    message: i18n.t("updater.ready"),
    persistent: true,
    variant: "update",
    actions: [
      {
        label: i18n.t("updater.restart"),
        onClick: () => {
          if (!isCurrentToast(toast)) {
            return;
          }

          requestPreparedUpdateRestart(toast);
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

export async function performUpdateCheckResult(): Result.ResultAsync<UpdateInfo | null, AppError> {
  if (checkInFlight) return checkInFlight;

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
    showUpdateAvailableToast(info.version);
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

    // Startup check (silent on failure)
    if (!isUpdaterRuntimeUnavailable()) {
      performUpdateCheckResult().then((result) => {
        if (cancelled) {
          return;
        }

        Result.pipe(
          result,
          Result.inspect((info) => {
            if (info) {
              showUpdateAvailableToast(info.version);
            }
          }),
          Result.inspectError((error) => {
            console.warn("Startup update check failed (silent):", error);
          }),
        );
      });
    }

    const disposeTauriListeners = attachTauriListeners(
      [
        {
          owner: "updater:download-progress",
          subscription: listen("update-download-progress", (event) => {
            if (!listenerActive) {
              return;
            }

            const store = useUiStore.getState();
            const percent = readDownloadProgressPercent(event.payload);
            if (percent === undefined) {
              return;
            }
            const message =
              percent != null ? i18n.t("updater.downloading_percent", { percent }) : i18n.t("updater.downloading");
            store.showToast({
              message,
              persistent: true,
              progress: percent,
              variant: "update",
            });
          }),
        },
        {
          owner: "updater:ready",
          subscription: listen("update-ready", (event) => {
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
      disposeTauriListeners();
    };
  }, []);
}
