import { Result } from "@praha/byethrow";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { type AppError, checkForUpdate, downloadAndInstallUpdate, restartApp } from "@/api/tauri-commands";
import { attachTauriListeners } from "@/lib/runtime/tauri-event-listeners";
import { useUiStore } from "@/stores/ui-store";

type UpdateInfo = { version: string; body: string | null };

/** Share a single in-flight update check across startup and manual triggers. */
let checkInFlight: Result.ResultAsync<UpdateInfo | null, AppError> | null = null;

export function showUpdateAvailableToast(version: string): void {
  const store = useUiStore.getState();
  store.showToast({
    message: `v${version} が利用可能です`,
    persistent: true,
    variant: "update",
    actions: [
      {
        label: "今すぐ更新",
        onClick: () => {
          startDownload();
        },
      },
      {
        label: "後で",
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
    message: "アップデートに失敗しました。現在のバージョンを引き続き使用します。",
    persistent: true,
    variant: "update",
    actions: [
      {
        label: "もう一度確認",
        onClick: () => {
          void runManualUpdateCheck();
        },
      },
      {
        label: "閉じる",
        onClick: () => {
          store.clearToast();
        },
      },
    ],
  });
}

function startDownload(): void {
  const store = useUiStore.getState();
  store.showToast({
    message: "ダウンロード中… 0%",
    persistent: true,
    progress: 0,
    variant: "update",
  });

  downloadAndInstallUpdate().then((result) =>
    Result.pipe(
      result,
      Result.inspectError((e) => {
        showUpdateFailureToast(e.message);
      }),
    ),
  );
}

export function showRestartToast(): void {
  const store = useUiStore.getState();
  store.showToast({
    message: "更新の準備ができました",
    persistent: true,
    variant: "update",
    actions: [
      {
        label: "再起動",
        onClick: () => {
          void restartApp().then((result) =>
            Result.pipe(
              result,
              Result.inspectError((error) => {
                console.error("App restart failed:", error);
                store.showToast("再起動に失敗しました");
              }),
            ),
          );
        },
      },
      {
        label: "後で",
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
    store.showToast("アップデートの確認に失敗しました");
    return;
  }

  const info = Result.unwrap(result);
  if (info) {
    showUpdateAvailableToast(info.version);
    return;
  }
  store.showToast("最新バージョンです");
}

export function useUpdater(): void {
  useEffect(() => {
    // Startup check (silent on failure)
    performUpdateCheckResult().then((result) => {
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

    return attachTauriListeners(
      [
        listen<{ percent: number | null }>("update-download-progress", (event) => {
          const store = useUiStore.getState();
          const percent = event.payload.percent;
          const message = percent != null ? `ダウンロード中… ${percent}%` : "ダウンロード中…";
          store.showToast({
            message,
            persistent: true,
            progress: percent,
            variant: "update",
          });
        }),
        listen("update-ready", () => {
          showRestartToast();
        }),
      ],
      () => {},
    );
  }, []);
}
