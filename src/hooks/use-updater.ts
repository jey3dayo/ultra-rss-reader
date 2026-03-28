import { Result } from "@praha/byethrow";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { checkForUpdate, downloadAndInstallUpdate, restartApp } from "@/api/tauri-commands";
import { useUiStore } from "@/stores/ui-store";

function showUpdateAvailableToast(version: string): void {
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

export function useUpdater(): void {
  useEffect(() => {
    // Startup check (silent on failure)
    checkForUpdate().then((result) =>
      Result.pipe(
        result,
        Result.inspect((info) => {
          if (info) {
            showUpdateAvailableToast(info.version);
          }
        }),
        Result.inspectError((e) => {
          console.warn("Startup update check failed (silent):", e);
        }),
      ),
    );

    // Listen for download progress events
    const progressUnlisten = listen<{ percent: number }>("update-download-progress", (event) => {
      const store = useUiStore.getState();
      const percent = event.payload.percent;
      store.showToast({
        message: `ダウンロード中... ${percent}%`,
        persistent: true,
        progress: percent,
      });
    });

    // Listen for update-ready events
    const readyUnlisten = listen("update-ready", () => {
      showRestartToast();
    });

    // Listen for manual update check results from executeAction
    const handleUpdateAvailable = (event: Event) => {
      const detail = (event as CustomEvent<{ version: string }>).detail;
      showUpdateAvailableToast(detail.version);
    };
    window.addEventListener("ultra-rss:update-available", handleUpdateAvailable);

    return () => {
      progressUnlisten.then((fn) => fn()).catch(() => {});
      readyUnlisten.then((fn) => fn()).catch(() => {});
      window.removeEventListener("ultra-rss:update-available", handleUpdateAvailable);
    };
  }, []);
}
