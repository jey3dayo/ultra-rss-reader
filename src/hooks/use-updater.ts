import { Result } from "@praha/byethrow";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { checkForUpdate, downloadAndInstallUpdate, restartApp } from "@/api/tauri-commands";
import { useUiStore } from "@/stores/ui-store";

/** Guard against concurrent check_for_update calls. */
let checkInFlight = false;

export function showUpdateAvailableToast(version: string): void {
  const store = useUiStore.getState();
  store.showToast({
    message: `v${version} が利用可能です`,
    persistent: true,
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

function startDownload(): void {
  const store = useUiStore.getState();
  store.showToast({
    message: "ダウンロード中... 0%",
    persistent: true,
    progress: 0,
  });

  downloadAndInstallUpdate().then((result) =>
    Result.pipe(
      result,
      Result.inspectError((e) => {
        console.error("Update download failed:", e);
        store.showToast(`アップデートのダウンロードに失敗しました: ${e.message}`);
      }),
    ),
  );
}

function showRestartToast(): void {
  const store = useUiStore.getState();
  store.showToast({
    message: "更新の準備ができました",
    persistent: true,
    actions: [
      {
        label: "再起動",
        onClick: () => {
          restartApp();
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

/**
 * Perform an update check with concurrency guard.
 * Returns the update info if available, null otherwise.
 * Rejects if the check fails.
 */
export async function performUpdateCheck(): Promise<{ version: string; body: string | null } | null> {
  if (checkInFlight) return null;
  checkInFlight = true;
  try {
    const result = await checkForUpdate();
    return Result.pipe(
      result,
      Result.map((info) => info),
      Result.unwrap(),
    );
  } finally {
    checkInFlight = false;
  }
}

export function useUpdater(): void {
  useEffect(() => {
    // Startup check (silent on failure)
    performUpdateCheck()
      .then((info) => {
        if (info) {
          showUpdateAvailableToast(info.version);
        }
      })
      .catch((e: unknown) => {
        console.warn("Startup update check failed (silent):", e);
      });

    // Listen for download progress events
    const progressUnlisten = listen<{ percent: number | null }>("update-download-progress", (event) => {
      const store = useUiStore.getState();
      const percent = event.payload.percent;
      const message = percent != null ? `ダウンロード中... ${percent}%` : "ダウンロード中...";
      store.showToast({
        message,
        persistent: true,
        progress: percent,
      });
    });

    // Listen for update-ready events
    const readyUnlisten = listen("update-ready", () => {
      showRestartToast();
    });

    return () => {
      progressUnlisten.then((fn) => fn()).catch(() => {});
      readyUnlisten.then((fn) => fn()).catch(() => {});
    };
  }, []);
}
