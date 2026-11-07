import { Result } from "@praha/byethrow";
import { useEffect } from "react";
import { safeParse } from "valibot";
import {
  UpdateDownloadProgressEventPayloadSchema,
  type UpdateInfoDto,
  UpdateReadyEventPayloadSchema,
} from "@/api/schemas/update-info";
import { type AppError, checkForUpdate, downloadUpdate } from "@/api/tauri-commands";
import { cancelPendingUpdate, isUpdatePending, startPendingUpdate } from "@/hooks/updater/updater-pending-coordinator";
import {
  clearActiveDownload,
  rememberStaleDownloadSession,
  staleDownloadSessionIds,
  updaterState,
} from "@/hooks/updater/updater-state";
import {
  getDownloadProgressToastMessage,
  showRestartToast,
  showUpdateFailureToast,
} from "@/hooks/updater/updater-toasts";
import i18n from "@/lib/i18n";
import { attachTauriListeners, listenTauriEvent } from "@/lib/runtime/tauri-event-listeners";
import { isDatabaseMaintenanceBusyMessage } from "@/lib/ui/localize-app-error-message";
import { useUiStore } from "@/stores/ui-store";

export { showRestartToast } from "@/hooks/updater/updater-toasts";

type UpdateInfo = UpdateInfoDto;

const STARTUP_UPDATE_CHECK_DELAY_MS = 1_500;
let pendingDownloadIsActive: (() => boolean) | undefined;

function completeActiveDownloadAsReady(downloadRequestId: number): void {
  if (updaterState.activeDownloadRequestId !== downloadRequestId) {
    return;
  }

  const version = updaterState.activeDownloadVersion ?? "";
  rememberStaleDownloadSession();
  clearActiveDownload();
  showRestartToast(version);
}

function onUpdateFailureCheckAgain(): void {
  void runManualUpdateCheck();
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
async function startDownload(
  version: string,
  options: { silent: boolean; isPending?: () => boolean },
): Promise<boolean> {
  if (updaterState.downloadInFlight || updaterState.checkInFlight) return true;

  pendingDownloadIsActive = options.isPending;
  updaterState.downloadInFlight = true;
  updaterState.activeDownloadSessionId = null;
  updaterState.activeDownloadProgressPercent = 0;
  updaterState.activeDownloadRequestId = updaterState.nextDownloadRequestId + 1;
  updaterState.nextDownloadRequestId = updaterState.activeDownloadRequestId;
  const downloadRequestId = updaterState.activeDownloadRequestId;
  updaterState.activeDownloadVersion = version;
  updaterState.activeDownloadSilent = options.silent;

  // Retries from the pending state skip the initial 0% toast; progress events
  // still surface the progress toast once the transfer actually starts.
  if (!options.silent && !options.isPending) {
    useUiStore.getState().showToast({
      message: i18n.t("updater.downloading_percent", { percent: 0 }),
      persistent: true,
      progress: 0,
      variant: "update",
    });
  }

  let failure: string | null = null;
  try {
    const result = await downloadUpdate();
    if (updaterState.activeDownloadRequestId !== downloadRequestId) return false;
    if (Result.isFailure(result)) failure = Result.unwrapError(result).message;
    else {
      if (!options.isPending || options.isPending()) completeActiveDownloadAsReady(downloadRequestId);
      else clearActiveDownload();
      return false;
    }
  } catch (error: unknown) {
    if (updaterState.activeDownloadRequestId !== downloadRequestId) return false;
    failure = getErrorMessage(error);
  }
  rememberStaleDownloadSession();
  clearActiveDownload();
  if (options.isPending && !options.isPending()) return false;
  if (options.silent) {
    console.warn("Silent update download failed:", failure);
  } else if (isDatabaseMaintenanceBusyMessage(failure)) {
    const toast = useUiStore.getState().toastMessage;
    if (toast?.variant === "update" && toast.progress !== undefined) useUiStore.getState().clearToast();
    if (!options.isPending) {
      startPendingUpdate(
        {
          kind: "download",
          version,
          onRetry: onUpdateFailureCheckAgain,
          run: async (isCurrent) => {
            const busy = await startDownload(version, { silent: false, isPending: isCurrent });
            return busy ? { type: "busy" } : { type: "done" };
          },
        },
        true,
      );
    }
    return true;
  } else if (options.isPending) {
    console.error("Update download failed:", failure);
    throw new Error(failure);
  } else {
    showUpdateFailureToast(failure, onUpdateFailureCheckAgain);
  }
  return false;
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

function trackDownloadProgressPercent(payload: unknown): number | null | undefined {
  const result = safeParse(UpdateDownloadProgressEventPayloadSchema, payload);
  if (!result.success) {
    return undefined;
  }

  if (!updaterState.downloadInFlight || (pendingDownloadIsActive && !pendingDownloadIsActive())) {
    return undefined;
  }

  if (staleDownloadSessionIds.has(result.output.session_id)) {
    return undefined;
  }

  if (updaterState.activeDownloadSessionId === null) {
    updaterState.activeDownloadSessionId = result.output.session_id;
  }

  if (result.output.session_id !== updaterState.activeDownloadSessionId) {
    return undefined;
  }

  const percent = normalizeDownloadProgressPercent(result.output.percent);
  if (percent === updaterState.activeDownloadProgressPercent) {
    return undefined;
  }

  if (percent === null) {
    updaterState.activeDownloadProgressPercent = null;
    return null;
  }

  if (updaterState.activeDownloadProgressPercent !== null && percent < updaterState.activeDownloadProgressPercent) {
    return undefined;
  }

  updaterState.activeDownloadProgressPercent = percent;
  return percent;
}

function claimCurrentDownloadReady(payload: unknown): boolean {
  const result = safeParse(UpdateReadyEventPayloadSchema, payload);
  if (!result.success || !updaterState.downloadInFlight || (pendingDownloadIsActive && !pendingDownloadIsActive())) {
    return false;
  }

  if (staleDownloadSessionIds.has(result.output.session_id)) {
    return false;
  }

  if (
    updaterState.activeDownloadSessionId !== null &&
    result.output.session_id !== updaterState.activeDownloadSessionId
  ) {
    return false;
  }

  updaterState.activeDownloadSessionId = result.output.session_id;
  return true;
}

function isUpdaterRuntimeUnavailable(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.__DEV_BROWSER_MOCKS__ === true || window.__ULTRA_RSS_BROWSER_MOCKS__ === true)
  );
}

export async function performUpdateCheckResult(): Result.ResultAsync<UpdateInfo | null, AppError> {
  if (isUpdatePending()) return Result.succeed(null);
  if (updaterState.checkInFlight) return updaterState.checkInFlight;

  updaterState.updateCheckGeneration += 1;
  updaterState.checkInFlight = (async () => {
    return await checkForUpdate();
  })();

  try {
    return await updaterState.checkInFlight;
  } finally {
    updaterState.checkInFlight = null;
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

  if (updaterState.downloadInFlight || isUpdatePending()) {
    return;
  }
  // A new check replaces a failed pending request; its pending update handle on
  // the native side is reset by the check anyway.
  cancelPendingUpdate();

  const store = useUiStore.getState();

  const result = await performUpdateCheckResult();
  if (Result.isFailure(result)) {
    console.error("Manual update check failed:", Result.unwrapError(result));
    store.showToast({ message: i18n.t("updater.check_failed"), severity: "error" });
    return;
  }

  const info = Result.unwrap(result);
  if (info) {
    void startDownload(info.version, { silent: false });
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
    const startupCheckGeneration = updaterState.updateCheckGeneration;

    // Startup check (silent on failure). Delay it so a freshly reloaded app
    // does not surface an actionable update toast while the shell is still settling.
    // A detected update starts a fully silent background download: no "update
    // available" toast, no progress toast. Only the one-time ready toast surfaces.
    const startupCheckTimer = isUpdaterRuntimeUnavailable()
      ? null
      : window.setTimeout(() => {
          if (isUpdatePending() || startupCheckGeneration !== updaterState.updateCheckGeneration) {
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
                    void startDownload(info.version, { silent: true });
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

            const percent = trackDownloadProgressPercent(event.payload);
            if (percent === undefined) {
              return;
            }
            if (updaterState.activeDownloadSilent) {
              return;
            }
            const message = getDownloadProgressToastMessage(percent);
            useUiStore.getState().showToast({
              message,
              persistent: true,
              progress: percent === 100 ? null : percent,
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

            if (!claimCurrentDownloadReady(event.payload)) {
              return;
            }
            if (updaterState.activeDownloadRequestId === null) {
              return;
            }
            completeActiveDownloadAsReady(updaterState.activeDownloadRequestId);
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
