import { Result } from "@praha/byethrow";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { type AppError, checkForUpdate, downloadAndInstallUpdate, restartApp } from "@/api/tauri-commands";
import i18n from "@/lib/i18n";
import { attachTauriListeners } from "@/lib/runtime/tauri-event-listeners";
import { useUiStore } from "@/stores/ui-store";

type UpdateInfo = { version: string; body: string | null };

/** Share a single in-flight update check across startup and manual triggers. */
let checkInFlight: Result.ResultAsync<UpdateInfo | null, AppError> | null = null;
let downloadInFlight = false;

export function showUpdateAvailableToast(version: string): void {
  const store = useUiStore.getState();
  store.showToast({
    message: i18n.t("updater.available", { version }),
    persistent: true,
    variant: "update",
    actions: [
      {
        label: i18n.t("updater.update_now"),
        onClick: () => {
          startDownload();
        },
      },
      {
        label: i18n.t("updater.later"),
        onClick: () => {
          store.clearToast();
        },
      },
    ],
  });
}

function showUpdateFailureToast(message: string): void {
  const store = useUiStore.getState();
  console.error("Update download failed:", message);
  store.showToast({
    message: i18n.t("updater.download_failed_keep_current"),
    persistent: true,
    variant: "update",
    actions: [
      {
        label: i18n.t("updater.check_again"),
        onClick: () => {
          void runManualUpdateCheck();
        },
      },
      {
        label: i18n.t("close"),
        onClick: () => {
          store.clearToast();
        },
      },
    ],
  });
}

function startDownload(): void {
  if (downloadInFlight) {
    return;
  }

  downloadInFlight = true;
  const store = useUiStore.getState();
  store.showToast({
    message: i18n.t("updater.downloading_percent", { percent: 0 }),
    persistent: true,
    progress: 0,
    variant: "update",
  });

  downloadAndInstallUpdate().then((result) =>
    Result.pipe(
      result,
      Result.inspectError((e) => {
        showUpdateFailureToast(e.message);
        downloadInFlight = false;
      }),
    ),
  );
}

export function normalizeDownloadProgressPercent(percent: number | null): number | null {
  if (percent === null) {
    return null;
  }

  if (!Number.isFinite(percent)) {
    return null;
  }

  return Math.min(100, Math.max(0, Math.round(percent)));
}

function readDownloadProgressPercent(payload: unknown): number | null | undefined {
  if (typeof payload !== "object" || payload === null || !("percent" in payload)) {
    return undefined;
  }

  const percent = payload.percent;
  if (percent === null || typeof percent === "number") {
    return normalizeDownloadProgressPercent(percent);
  }

  return undefined;
}

function restartPreparedUpdate(): void {
  const store = useUiStore.getState();
  void restartApp().then((result) =>
    Result.pipe(
      result,
      Result.inspectError((error) => {
        console.error("App restart failed:", error);
        store.showToast({
          message: i18n.t("updater.restart_failed_ready"),
          persistent: true,
          variant: "update",
          actions: [
            {
              label: i18n.t("updater.restart_again"),
              onClick: restartPreparedUpdate,
            },
            {
              label: i18n.t("updater.later"),
              onClick: () => {
                store.clearToast();
              },
            },
          ],
        });
      }),
    ),
  );
}

function isStartupUpdaterUnavailable(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.__DEV_BROWSER_MOCKS__ === true || window.__ULTRA_RSS_BROWSER_MOCKS__ === true)
  );
}

export function showRestartToast(): void {
  const store = useUiStore.getState();
  store.showToast({
    message: i18n.t("updater.ready"),
    persistent: true,
    variant: "update",
    actions: [
      {
        label: i18n.t("updater.restart"),
        onClick: restartPreparedUpdate,
      },
      {
        label: i18n.t("updater.later"),
        onClick: () => {
          store.clearToast();
        },
      },
    ],
  });
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

    // Startup check (silent on failure)
    if (!isStartupUpdaterUnavailable()) {
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
        listen("update-download-progress", (event) => {
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
        listen("update-ready", () => {
          downloadInFlight = false;
          showRestartToast();
        }),
      ],
      { onUnavailable: () => {} },
    );

    return () => {
      cancelled = true;
      disposeTauriListeners();
    };
  }, []);
}
