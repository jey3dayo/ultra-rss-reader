import { Result } from "@praha/byethrow";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { checkForUpdate, downloadAndInstallUpdate, restartApp } from "@/api/tauri-commands";
import { useUiStore } from "@/stores/ui-store";

type UpdateInfo = { version: string; body: string | null };

/** Share a single in-flight update check across startup and manual triggers. */
let checkInFlight: Promise<UpdateInfo | null> | null = null;

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

function showUpdateFailureToast(message: string): void {
  const store = useUiStore.getState();
  console.error("Update download failed:", message);
  store.showToast({
    message: "アップデートに失敗しました。現在のバージョンを引き続き使用します。",
    persistent: true,
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

/**
 * Perform an update check with concurrency guard.
 * Returns the update info if available, null otherwise.
 * Rejects if the check fails.
 */
export async function performUpdateCheck(): Promise<UpdateInfo | null> {
  if (checkInFlight) return checkInFlight;

  checkInFlight = (async () => {
    const result = await checkForUpdate();
    return Result.pipe(
      result,
      Result.map((info) => info),
      Result.unwrap(),
    );
  })();

  try {
    return await checkInFlight;
  } finally {
    checkInFlight = null;
  }
}

export async function runManualUpdateCheck(): Promise<void> {
  const store = useUiStore.getState();

  try {
    const info = await performUpdateCheck();
    if (info) {
      showUpdateAvailableToast(info.version);
      return;
    }
    store.showToast("最新バージョンです");
  } catch (e: unknown) {
    console.error("Manual update check failed:", e);
    store.showToast("アップデートの確認に失敗しました");
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
      const message = percent != null ? `ダウンロード中… ${percent}%` : "ダウンロード中…";
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
