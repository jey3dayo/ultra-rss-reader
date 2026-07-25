import { Result } from "@praha/byethrow";
import { QueryClient } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { type TestUserVisibleAppError, testRetryableAppError, testUserVisibleAppError } from "@tests/helpers/app-error";
import { flushMicrotasksAndRealTimer } from "@tests/helpers/async-flush";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { resetTauriRuntimeFlags, setTauriRuntimePresent } from "@tests/helpers/tauri-runtime";
import { createElement, type PropsWithChildren, StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TAURI_EVENT_LISTENER_FAILURE_EVENT } from "@/lib/runtime/tauri-event-listeners";

const mockCheckForUpdate = vi.hoisted(() => vi.fn());
const mockDownloadUpdate = vi.hoisted(() => vi.fn());
const mockRestartApp = vi.hoisted(() => vi.fn());
const mockListen = vi.hoisted(() => vi.fn());

vi.mock("@/api/tauri-commands", () => ({
  checkForUpdate: mockCheckForUpdate,
  downloadUpdate: mockDownloadUpdate,
  restartApp: mockRestartApp,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: mockListen,
}));

setupBrowserTestDom();

type UpdateInfo = {
  version: string;
  body: string | null;
  channel: "stable";
  prerelease: false;
  source: string;
} | null;

const sharedOperationBusyMessage = "Database maintenance is unavailable while syncing. Try again after sync completes.";
const sharedOperationBusyMessageJa =
  "同期中はデータベースのメンテナンスを実行できません。同期が完了してから再試行してください。";
const startupUpdateCheckDelayMs = 1_500;

function updateInfo(version: string): NonNullable<UpdateInfo> {
  return {
    version,
    body: null,
    channel: "stable",
    prerelease: false,
    source: "github-latest-json",
  };
}

async function getUiStore() {
  const { useUiStore } = await import("@/stores/ui-store");
  return useUiStore;
}

async function getUpdaterModuleAndUiStore() {
  const [updaterModule, useUiStore] = await Promise.all([import("@/hooks/use-updater"), getUiStore()]);
  return { updaterModule, useUiStore };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

async function changeTestLanguage(language: "en" | "ja"): Promise<void> {
  const { default: i18n } = await import("@/lib/i18n");
  await i18n.changeLanguage(language);
}

describe("use-updater background download flow", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockCheckForUpdate.mockReset();
    mockDownloadUpdate.mockReset();
    mockRestartApp.mockReset();
    mockListen.mockReset().mockResolvedValue(() => {});
    delete window.__DEV_BROWSER_MOCKS__;
    delete window.__ULTRA_RSS_BROWSER_MOCKS__;
    resetTauriRuntimeFlags();
    await changeTestLanguage("ja");
  });

  describe("performUpdateCheck", () => {
    it("reuses the in-flight update check result for concurrent callers", async () => {
      const deferred = createDeferred<ReturnType<typeof Result.succeed<UpdateInfo>>>();
      mockCheckForUpdate.mockReturnValue(deferred.promise);

      const { performUpdateCheck } = await import("@/hooks/use-updater");

      const firstCheck = performUpdateCheck();
      const secondCheck = performUpdateCheck();

      expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);

      deferred.resolve(Result.succeed(updateInfo("1.2.3")));

      const [firstResult, secondResult] = await Promise.all([firstCheck, secondCheck]);

      expect(firstResult).toEqual(updateInfo("1.2.3"));
      expect(secondResult).toEqual(updateInfo("1.2.3"));
    });

    it("clears the in-flight guard after a shared failure so later checks can retry", async () => {
      const failedCheck = createDeferred<ReturnType<typeof Result.fail<TestUserVisibleAppError>>>();
      mockCheckForUpdate.mockReturnValueOnce(failedCheck.promise);

      const { performUpdateCheckResult } = await import("@/hooks/use-updater");

      const firstCheck = performUpdateCheckResult();
      const secondCheck = performUpdateCheckResult();

      expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);

      failedCheck.resolve(Result.fail(testUserVisibleAppError("network down")));
      const [firstResult, secondResult] = await Promise.all([firstCheck, secondCheck]);

      expect(firstResult).toSatisfy(Result.isFailure);
      expect(secondResult).toSatisfy(Result.isFailure);

      mockCheckForUpdate.mockResolvedValueOnce(Result.succeed(null));

      const retryResult = await performUpdateCheckResult();

      expect(mockCheckForUpdate).toHaveBeenCalledTimes(2);
      expect(Result.isSuccess(retryResult)).toBe(true);
      expect(Result.unwrap(retryResult)).toBeNull();
    });

    it("returns a typed result when no update is available", async () => {
      mockCheckForUpdate.mockResolvedValue(Result.succeed(null));

      const { performUpdateCheckResult } = await import("@/hooks/use-updater");

      const result = await performUpdateCheckResult();

      expect(Result.isSuccess(result)).toBe(true);
      expect(Result.unwrap(result)).toBeNull();
    });

    it("returns a typed error and keeps the compatibility wrapper rejection on failure", async () => {
      const error = testRetryableAppError("network down");
      mockCheckForUpdate.mockResolvedValue(Result.fail(error));

      const { performUpdateCheck, performUpdateCheckResult } = await import("@/hooks/use-updater");

      const result = await performUpdateCheckResult();
      expect(Result.isFailure(result)).toBe(true);
      expect(Result.unwrapError(result)).toEqual(error);

      await expect(performUpdateCheck()).rejects.toEqual(error);
    });
  });

  describe("startup check starts a silent background download", () => {
    it("starts a download without showing any toast when the startup check finds an update", async () => {
      vi.useFakeTimers();
      mockCheckForUpdate.mockResolvedValue(Result.succeed(updateInfo("1.2.3")));
      mockDownloadUpdate.mockReturnValue(new Promise(() => {}));

      try {
        const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
        useUiStore.setState(useUiStore.getInitialState());

        renderHook(() => updaterModule.useUpdater());
        await vi.advanceTimersByTimeAsync(startupUpdateCheckDelayMs);
        await flushMicrotasksAndRealTimer();

        expect(mockDownloadUpdate).toHaveBeenCalledTimes(1);
        expect(useUiStore.getState().toastMessage).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("shows the ready-to-restart toast once a silent startup download completes", async () => {
      vi.useFakeTimers();
      mockCheckForUpdate.mockResolvedValue(Result.succeed(updateInfo("1.2.3")));
      const deferredDownload = createDeferred<ReturnType<typeof Result.succeed<null>>>();
      mockDownloadUpdate.mockReturnValue(deferredDownload.promise);

      try {
        const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
        useUiStore.setState(useUiStore.getInitialState());

        renderHook(() => updaterModule.useUpdater());
        await vi.advanceTimersByTimeAsync(startupUpdateCheckDelayMs);
        await flushMicrotasksAndRealTimer();

        deferredDownload.resolve(Result.succeed(null));
        await flushMicrotasksAndRealTimer();

        expect(useUiStore.getState().toastMessage).toMatchObject({
          message: "v1.2.3 の更新を準備しました。再起動後に適用されます",
          persistent: true,
          variant: "update",
        });
        expect(useUiStore.getState().toastMessage?.actions?.map((action) => action.label)).toEqual([
          "今すぐ再起動",
          "閉じる",
        ]);
      } finally {
        vi.useRealTimers();
      }
    });

    it("logs and suppresses the toast when a silent startup download fails", async () => {
      vi.useFakeTimers();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockCheckForUpdate.mockResolvedValue(Result.succeed(updateInfo("1.2.3")));
      mockDownloadUpdate.mockResolvedValue(Result.fail(testUserVisibleAppError("network down")));

      try {
        const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
        useUiStore.setState(useUiStore.getInitialState());

        renderHook(() => updaterModule.useUpdater());
        await vi.advanceTimersByTimeAsync(startupUpdateCheckDelayMs);
        await flushMicrotasksAndRealTimer();

        expect(warnSpy).toHaveBeenCalledWith("Silent update download failed:", "network down");
        expect(useUiStore.getState().toastMessage).toBeNull();
      } finally {
        warnSpy.mockRestore();
        vi.useRealTimers();
      }
    });

    it("does not surface progress toasts for a silent startup download", async () => {
      vi.useFakeTimers();
      const progressListeners: Array<(event: { payload: unknown }) => void> = [];
      mockCheckForUpdate.mockResolvedValue(Result.succeed(updateInfo("1.2.3")));
      mockDownloadUpdate.mockReturnValue(new Promise(() => {}));
      mockListen.mockImplementation(async (eventName: string, callback: (event: { payload: unknown }) => void) => {
        if (eventName === "update-download-progress") {
          progressListeners.push(callback);
        }
        return () => {};
      });

      try {
        const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
        useUiStore.setState(useUiStore.getInitialState());

        renderHook(() => updaterModule.useUpdater());
        await vi.advanceTimersByTimeAsync(startupUpdateCheckDelayMs);
        await flushMicrotasksAndRealTimer();

        progressListeners[0]?.({ payload: { session_id: 1, percent: 40 } });

        expect(useUiStore.getState().toastMessage).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("does not start a download when the startup check resolves after unmount", async () => {
      const deferred = createDeferred<ReturnType<typeof Result.succeed<UpdateInfo>>>();
      mockCheckForUpdate.mockReturnValue(deferred.promise);

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      const { unmount } = renderHook(() => updaterModule.useUpdater());
      unmount();

      deferred.resolve(Result.succeed(updateInfo("1.2.3")));
      await flushMicrotasksAndRealTimer();

      expect(mockDownloadUpdate).not.toHaveBeenCalled();
      expect(useUiStore.getState().toastMessage).toBeNull();
    });

    it("does not warn when the startup check fails after unmount", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const deferred = createDeferred<ReturnType<typeof Result.fail<TestUserVisibleAppError>>>();
      const error = testUserVisibleAppError("network down");
      mockCheckForUpdate.mockReturnValue(deferred.promise);

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      const { unmount } = renderHook(() => updaterModule.useUpdater());
      unmount();

      deferred.resolve(Result.fail(error));
      await flushMicrotasksAndRealTimer();

      expect(warnSpy).not.toHaveBeenCalledWith("Startup update check failed (silent):", error);

      warnSpy.mockRestore();
    });

    it("shares a single startup update check across React StrictMode double mount", async () => {
      vi.useFakeTimers();
      const deferred = createDeferred<ReturnType<typeof Result.succeed<UpdateInfo>>>();
      mockCheckForUpdate.mockReturnValue(deferred.promise);
      mockDownloadUpdate.mockReturnValue(new Promise(() => {}));

      try {
        const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
        useUiStore.setState(useUiStore.getInitialState());

        renderHook(() => updaterModule.useUpdater(), {
          wrapper: ({ children }: PropsWithChildren) => createElement(StrictMode, null, children),
        });

        expect(mockCheckForUpdate).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(startupUpdateCheckDelayMs);
        expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);

        deferred.resolve(Result.succeed(updateInfo("1.2.3")));
        await flushMicrotasksAndRealTimer();

        expect(mockDownloadUpdate).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("keeps startup update check failures silent while manual failures show a toast", async () => {
      vi.useFakeTimers();
      const error = testUserVisibleAppError("network down");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockCheckForUpdate.mockResolvedValue(Result.fail(error));

      try {
        const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
        useUiStore.setState(useUiStore.getInitialState());

        renderHook(() => updaterModule.useUpdater());
        expect(mockCheckForUpdate).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(startupUpdateCheckDelayMs);
        await flushMicrotasksAndRealTimer();

        expect(warnSpy).toHaveBeenCalledWith("Startup update check failed (silent):", error);
        expect(useUiStore.getState().toastMessage).toBeNull();

        await updaterModule.runManualUpdateCheck();

        expect(errorSpy).toHaveBeenCalledWith("Manual update check failed:", error);
        expect(useUiStore.getState().toastMessage?.message).toBe("アップデートの確認に失敗しました");
      } finally {
        warnSpy.mockRestore();
        errorSpy.mockRestore();
        vi.useRealTimers();
      }
    });

    it("skips the delayed startup check when a manual check already ran after reload", async () => {
      vi.useFakeTimers();
      mockCheckForUpdate.mockResolvedValue(Result.succeed(null));

      try {
        const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
        useUiStore.setState(useUiStore.getInitialState());

        renderHook(() => updaterModule.useUpdater());
        await updaterModule.runManualUpdateCheck();
        await vi.advanceTimersByTimeAsync(startupUpdateCheckDelayMs);
        await flushMicrotasksAndRealTimer();

        expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
        expect(useUiStore.getState().toastMessage?.message).toBe("最新バージョンです");
      } finally {
        vi.useRealTimers();
      }
    });

    it("skips update checks and downloads in browser dev mock preview", async () => {
      window.__DEV_BROWSER_MOCKS__ = true;
      window.__ULTRA_RSS_BROWSER_MOCKS__ = true;
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockCheckForUpdate.mockResolvedValue(Result.fail(testUserVisibleAppError("updater unavailable")));

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      renderHook(() => updaterModule.useUpdater());
      await flushMicrotasksAndRealTimer();

      expect(mockCheckForUpdate).not.toHaveBeenCalled();
      expect(mockDownloadUpdate).not.toHaveBeenCalled();

      await updaterModule.runManualUpdateCheck();

      expect(mockCheckForUpdate).not.toHaveBeenCalled();
      expect(useUiStore.getState().toastMessage).toBeNull();

      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe("manual update check", () => {
    it("immediately starts a non-silent download with progress feedback when an update is found", async () => {
      mockCheckForUpdate.mockResolvedValue(Result.succeed(updateInfo("1.2.3")));
      mockDownloadUpdate.mockReturnValue(new Promise(() => {}));

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      await updaterModule.runManualUpdateCheck();

      expect(mockDownloadUpdate).toHaveBeenCalledTimes(1);
      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "ダウンロード中… 0%",
        progress: 0,
        variant: "update",
      });
    });

    it("shows the ready-to-restart toast after a manual download completes", async () => {
      mockCheckForUpdate.mockResolvedValue(Result.succeed(updateInfo("1.2.4")));
      const deferredDownload = createDeferred<ReturnType<typeof Result.succeed<null>>>();
      mockDownloadUpdate.mockReturnValue(deferredDownload.promise);

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      await updaterModule.runManualUpdateCheck();
      deferredDownload.resolve(Result.succeed(null));
      await flushMicrotasksAndRealTimer();

      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "v1.2.4 の更新を準備しました。再起動後に適用されます",
        persistent: true,
        variant: "update",
      });
    });

    it("shows a fallback toast that keeps the current version when a manual download fails", async () => {
      mockCheckForUpdate.mockResolvedValue(Result.succeed(updateInfo("1.2.3")));
      mockDownloadUpdate.mockResolvedValue(Result.fail(testUserVisibleAppError("network down")));

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      await updaterModule.runManualUpdateCheck();
      await flushMicrotasksAndRealTimer();

      expect(useUiStore.getState().toastMessage?.message).toContain("現在のバージョンを引き続き使用します");
      expect(useUiStore.getState().toastMessage?.persistent).toBe(true);
      expect(useUiStore.getState().toastMessage?.variant).toBe("update");
      expect(useUiStore.getState().toastMessage?.actions?.some((action) => action.label === "もう一度確認")).toBe(true);
    });

    it("surfaces the shared sync maintenance busy state when a manual download is guarded", async () => {
      mockCheckForUpdate.mockResolvedValue(Result.succeed(updateInfo("1.2.3")));
      mockDownloadUpdate.mockResolvedValue(Result.fail(testUserVisibleAppError(sharedOperationBusyMessage)));

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      await updaterModule.runManualUpdateCheck();
      await flushMicrotasksAndRealTimer();

      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: sharedOperationBusyMessageJa,
        persistent: true,
        variant: "update",
      });
      expect(useUiStore.getState().toastMessage?.actions?.map((action) => action.label)).toEqual([
        "もう一度確認",
        "閉じる",
      ]);
    });

    it("starts the update download even while sync is active", async () => {
      // Contract: the download only transfers bytes; the native install step is
      // guarded separately (SyncInstallGuard), so sync and download coexist.
      mockCheckForUpdate.mockResolvedValue(Result.succeed(updateInfo("1.2.3")));
      mockDownloadUpdate.mockReturnValue(new Promise(() => {}));

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState({
        ...useUiStore.getInitialState(),
        syncProgress: {
          active: true,
          sessionId: 1,
          kind: "manual_all",
          stage: "started",
          total: 2,
          completed: 0,
          currentAccountName: null,
          activeAccountIds: new Set(),
        },
      });

      await updaterModule.runManualUpdateCheck();

      expect(mockDownloadUpdate).toHaveBeenCalledTimes(1);
      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "ダウンロード中… 0%",
        progress: 0,
        variant: "update",
      });
    });

    it("re-checks updates from the fallback toast instead of auto-retrying the download", async () => {
      mockDownloadUpdate.mockResolvedValueOnce(Result.fail(testUserVisibleAppError("network down")));
      mockCheckForUpdate
        .mockResolvedValueOnce(Result.succeed(updateInfo("1.2.3")))
        .mockResolvedValueOnce(Result.succeed(updateInfo("1.2.4")));

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      await updaterModule.runManualUpdateCheck();
      await flushMicrotasksAndRealTimer();

      expect(useUiStore.getState().toastMessage?.message).toContain("現在のバージョンを引き続き使用します");

      mockDownloadUpdate.mockResolvedValueOnce(Result.succeed(null));
      useUiStore
        .getState()
        .toastMessage?.actions?.find((action) => action.label === "もう一度確認")
        ?.onClick();
      await flushMicrotasksAndRealTimer();

      expect(mockCheckForUpdate).toHaveBeenCalledTimes(2);
      expect(mockDownloadUpdate).toHaveBeenCalledTimes(2);
    });

    it("ignores a second manual trigger while a download from the first is in flight", async () => {
      mockCheckForUpdate.mockResolvedValue(Result.succeed(updateInfo("1.2.4")));
      const deferredDownload = createDeferred<ReturnType<typeof Result.succeed<null>>>();
      mockDownloadUpdate.mockReturnValue(deferredDownload.promise);

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      const firstCheck = updaterModule.runManualUpdateCheck();
      const secondCheck = updaterModule.runManualUpdateCheck();
      await Promise.all([firstCheck, secondCheck]);

      expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
      expect(mockDownloadUpdate).toHaveBeenCalledTimes(1);

      deferredDownload.resolve(Result.succeed(null));
    });

    it("uses the current locale for manual update check failure and no-update toasts", async () => {
      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await changeTestLanguage("en");
      mockCheckForUpdate.mockResolvedValueOnce(Result.fail(testUserVisibleAppError("network down")));
      await updaterModule.runManualUpdateCheck();
      expect(useUiStore.getState().toastMessage?.message).toBe("Failed to check for updates");

      await changeTestLanguage("ja");
      mockCheckForUpdate.mockResolvedValueOnce(Result.succeed(null));
      await updaterModule.runManualUpdateCheck();
      expect(useUiStore.getState().toastMessage?.message).toBe("最新バージョンです");

      errorSpy.mockRestore();
    });

    it("uses locale keys for the ready toast and up-to-date copy", async () => {
      await changeTestLanguage("en");
      mockCheckForUpdate.mockResolvedValueOnce(Result.succeed(updateInfo("1.2.3")));
      mockDownloadUpdate.mockResolvedValueOnce(Result.succeed(null));

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      await updaterModule.runManualUpdateCheck();
      await flushMicrotasksAndRealTimer();

      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "Update v1.2.3 is ready and will apply after restart",
        variant: "update",
      });
      expect(useUiStore.getState().toastMessage?.actions?.map((action) => action.label)).toEqual([
        "Restart now",
        "Close",
      ]);

      mockCheckForUpdate.mockResolvedValueOnce(Result.succeed(null));
      await updaterModule.runManualUpdateCheck();
      expect(useUiStore.getState().toastMessage?.message).toBe("You're up to date");
    });

    it("surfaces updater runtime and endpoint failures through the manual check recovery toast", async () => {
      const initError = testRetryableAppError("Updater unavailable during manual update check: plugin missing");
      const endpointError = testRetryableAppError(
        "Update endpoint unavailable during manual update check: endpoint refused connection",
      );
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockCheckForUpdate
        .mockResolvedValueOnce(Result.fail(initError))
        .mockResolvedValueOnce(Result.fail(endpointError));

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      await updaterModule.runManualUpdateCheck();

      expect(errorSpy).toHaveBeenCalledWith("Manual update check failed:", initError);
      expect(useUiStore.getState().toastMessage?.message).toBe("アップデートの確認に失敗しました");

      await updaterModule.runManualUpdateCheck();

      expect(errorSpy).toHaveBeenCalledWith("Manual update check failed:", endpointError);
      expect(mockCheckForUpdate).toHaveBeenCalledTimes(2);
      expect(useUiStore.getState().toastMessage?.message).toBe("アップデートの確認に失敗しました");

      errorSpy.mockRestore();
    });
  });

  describe("restart-now (no confirm dialog)", () => {
    it("restarts immediately without a confirm dialog when restart-now is clicked", async () => {
      mockRestartApp.mockResolvedValue(Result.succeed(null));

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      updaterModule.showRestartToast("1.2.3");
      useUiStore
        .getState()
        .toastMessage?.actions?.find((action) => action.label === "今すぐ再起動")
        ?.onClick();

      expect(useUiStore.getState().confirmDialog.open).toBe(false);
      expect(mockRestartApp).toHaveBeenCalledTimes(1);
    });

    it("keeps the prepared update pending when restart command fails", async () => {
      mockRestartApp.mockResolvedValue(Result.fail(testUserVisibleAppError("restart failed")));

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      updaterModule.showRestartToast("1.2.3");
      expect(useUiStore.getState().toastMessage?.variant).toBe("update");
      useUiStore
        .getState()
        .toastMessage?.actions?.find((action) => action.label === "今すぐ再起動")
        ?.onClick();
      expect(mockRestartApp).toHaveBeenCalledTimes(1);
      expect(useUiStore.getState().confirmDialog.open).toBe(false);
      await flushMicrotasksAndRealTimer();

      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "再起動に失敗しました。更新の準備は完了しています。",
        persistent: true,
        variant: "update",
      });
      expect(useUiStore.getState().toastMessage?.actions?.map((action) => action.label)).toEqual([
        "もう一度再起動",
        "後で",
      ]);
    });

    it("retries restart directly without a confirm dialog from the restart-failed toast", async () => {
      mockRestartApp
        .mockResolvedValueOnce(Result.fail(testUserVisibleAppError("restart failed")))
        .mockResolvedValueOnce(Result.succeed(null));

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      updaterModule.showRestartToast("1.2.3");
      useUiStore
        .getState()
        .toastMessage?.actions?.find((action) => action.label === "今すぐ再起動")
        ?.onClick();
      await flushMicrotasksAndRealTimer();

      useUiStore
        .getState()
        .toastMessage?.actions?.find((action) => action.label === "もう一度再起動")
        ?.onClick();

      expect(mockRestartApp).toHaveBeenCalledTimes(2);
      expect(useUiStore.getState().confirmDialog.open).toBe(false);
    });

    it("surfaces the shared sync maintenance busy state when prepared update restart is guarded", async () => {
      mockRestartApp.mockResolvedValue(Result.fail(testUserVisibleAppError(sharedOperationBusyMessage)));

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      updaterModule.showRestartToast("1.2.3");
      useUiStore
        .getState()
        .toastMessage?.actions?.find((action) => action.label === "今すぐ再起動")
        ?.onClick();
      await flushMicrotasksAndRealTimer();

      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: sharedOperationBusyMessageJa,
        persistent: true,
        variant: "update",
      });
      expect(useUiStore.getState().toastMessage?.actions?.map((action) => action.label)).toEqual([
        "もう一度再起動",
        "後で",
      ]);
    });

    it("blocks prepared update restart while settings have dirty or pending changes", async () => {
      mockRestartApp.mockResolvedValue(Result.succeed(null));

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      const { SettingsDirtyStateRegistryProvider, useRegisterSettingsDirtyState } = await import(
        "@/components/settings/hooks/use-settings-dirty-state-registry"
      );
      useUiStore.setState({
        ...useUiStore.getInitialState(),
        settingsOpen: true,
      });

      const wrapper = ({ children }: PropsWithChildren) =>
        createElement(SettingsDirtyStateRegistryProvider, null, children);
      const registryHook = renderHook(
        () =>
          useRegisterSettingsDirtyState({
            owner: "account",
            dirty: true,
            pending: false,
            blockingReason: "account-credentials-dirty",
          }),
        { wrapper },
      );

      updaterModule.showRestartToast("1.2.3");
      useUiStore
        .getState()
        .toastMessage?.actions?.find((action) => action.label === "今すぐ再起動")
        ?.onClick();

      expect(mockRestartApp).not.toHaveBeenCalled();
      expect(useUiStore.getState().confirmDialog.open).toBe(false);
      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "編集中または保存中の変更があるため、再起動できません。",
        persistent: true,
        variant: "update",
      });

      registryHook.unmount();
    });

    it("blocks prepared update restart while visible account setup is verifying or syncing", async () => {
      mockRestartApp.mockResolvedValue(Result.succeed(null));

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState({
        ...useUiStore.getInitialState(),
        settingsOpen: true,
        settingsCategory: "accounts",
        settingsAddAccount: true,
      });
      useUiStore.getState().startAccountSetupVerification();

      updaterModule.showRestartToast("1.2.3");
      useUiStore
        .getState()
        .toastMessage?.actions?.find((action) => action.label === "今すぐ再起動")
        ?.onClick();

      expect(mockRestartApp).not.toHaveBeenCalled();
      expect(useUiStore.getState().confirmDialog.open).toBe(false);
      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "編集中または保存中の変更があるため、再起動できません。",
        persistent: true,
        variant: "update",
      });

      useUiStore.setState({
        ...useUiStore.getInitialState(),
        settingsOpen: true,
        settingsCategory: "accounts",
        settingsAccountId: "acc-setup",
      });
      useUiStore.getState().startAccountSetup("acc-setup", { owner: "account-detail" });
      updaterModule.showRestartToast("1.2.3");
      useUiStore
        .getState()
        .toastMessage?.actions?.find((action) => action.label === "今すぐ再起動")
        ?.onClick();

      expect(mockRestartApp).not.toHaveBeenCalled();
      expect(useUiStore.getState().confirmDialog.open).toBe(false);
    });

    it("allows prepared update restart after settings dirty state unmounts cleanly", async () => {
      mockRestartApp.mockResolvedValue(Result.succeed(null));

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      const { SettingsDirtyStateRegistryProvider, useRegisterSettingsDirtyState } = await import(
        "@/components/settings/hooks/use-settings-dirty-state-registry"
      );
      useUiStore.setState({
        ...useUiStore.getInitialState(),
        settingsOpen: true,
      });

      const wrapper = ({ children }: PropsWithChildren) =>
        createElement(SettingsDirtyStateRegistryProvider, null, children);
      const registryHook = renderHook(
        () =>
          useRegisterSettingsDirtyState({
            owner: "preferences",
            dirty: false,
            pending: true,
            blockingReason: "preferences-save-pending",
          }),
        { wrapper },
      );
      registryHook.unmount();

      updaterModule.showRestartToast("1.2.3");
      useUiStore
        .getState()
        .toastMessage?.actions?.find((action) => action.label === "今すぐ再起動")
        ?.onClick();

      expect(mockRestartApp).toHaveBeenCalledTimes(1);
      expect(useUiStore.getState().confirmDialog.open).toBe(false);
    });

    it("blocks prepared update restart while add feed is dirty or pending", async () => {
      mockRestartApp.mockResolvedValue(Result.succeed(null));

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      const { useAddFeedDialogActions } = await import(
        "@/components/reader/hooks/feed-dialogs/use-add-feed-dialog-actions"
      );
      const { default: i18n } = await import("@/lib/i18n");
      useUiStore.setState({
        ...useUiStore.getInitialState(),
        isAddFeedDialogOpen: true,
      });

      const addFeedHook = renderHook(() =>
        useAddFeedDialogActions({
          accountId: "account-1",
          open: true,
          state: {
            url: "https://example.com/feed.xml",
            error: null,
            successMessage: null,
            loading: false,
            discovering: false,
            discoveryRequestId: null,
            discoveredFeeds: [],
            selectedFeedUrl: null,
          },
          dispatch: vi.fn(),
          derived: {
            hasManualUrl: true,
            isManualUrlValid: true,
            urlHint: null,
            urlHintTone: "muted",
            isSubmitDisabled: false,
            isDiscoverDisabled: false,
            discoveredFeedOptions: [],
          },
          trimmedUrl: "https://example.com/feed.xml",
          folderSelection: {
            selectedFolderId: null,
            isCreatingFolder: false,
            newFolderName: "",
          },
          availableFolderIds: [],
          queryClient: new QueryClient(),
          onOpenChange: vi.fn(),
          showToast: vi.fn(),
          t: i18n.getFixedT("en", "reader"),
        }),
      );

      updaterModule.showRestartToast("1.2.3");
      useUiStore
        .getState()
        .toastMessage?.actions?.find((action) => action.label === "今すぐ再起動")
        ?.onClick();

      expect(mockRestartApp).not.toHaveBeenCalled();
      expect(useUiStore.getState().confirmDialog.open).toBe(false);
      expect(useUiStore.getState().toastMessage?.message).toBe(
        "編集中または保存中の変更があるため、再起動できません。",
      );

      addFeedHook.unmount();
    });

    it("keeps the prepared update pending when restart runtime is unavailable", async () => {
      const runtimeError = {
        type: "RuntimeUnavailable",
        message: "restart command unavailable",
      };
      mockRestartApp.mockResolvedValue(Result.fail(runtimeError));

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      updaterModule.showRestartToast("1.2.3");
      useUiStore
        .getState()
        .toastMessage?.actions?.find((action) => action.label === "今すぐ再起動")
        ?.onClick();
      expect(mockRestartApp).toHaveBeenCalledTimes(1);
      await flushMicrotasksAndRealTimer();

      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "再起動に失敗しました。更新の準備は完了しています。",
        persistent: true,
        variant: "update",
      });
      expect(useUiStore.getState().toastMessage?.progress).toBeUndefined();
    });

    it("does not let a stale restart failure overwrite a newer ready toast", async () => {
      const restart = createDeferred<ReturnType<typeof Result.fail<TestUserVisibleAppError>>>();
      mockRestartApp.mockReturnValue(restart.promise);

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      updaterModule.showRestartToast("1.2.3");
      useUiStore
        .getState()
        .toastMessage?.actions?.find((action) => action.label === "今すぐ再起動")
        ?.onClick();

      updaterModule.showRestartToast("1.2.4");

      restart.resolve(Result.fail(testUserVisibleAppError("restart failed")));
      await flushMicrotasksAndRealTimer();

      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "v1.2.4 の更新を準備しました。再起動後に適用されます",
        variant: "update",
      });
    });
  });

  describe("download progress and session scoping", () => {
    it("normalizes download progress event percent before updating the toast", async () => {
      const deferredDownload = createDeferred<ReturnType<typeof Result.succeed<null>>>();
      const progressListeners: Array<(event: { payload: unknown }) => void> = [];
      mockCheckForUpdate.mockResolvedValue(Result.succeed(updateInfo("1.2.3")));
      mockDownloadUpdate.mockReturnValue(deferredDownload.promise);
      mockListen.mockImplementation(async (eventName: string, callback: (event: { payload: unknown }) => void) => {
        if (eventName === "update-download-progress") {
          progressListeners.push(callback);
        }
        return () => {};
      });

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      renderHook(() => updaterModule.useUpdater());
      await flushMicrotasksAndRealTimer();

      await updaterModule.runManualUpdateCheck();

      progressListeners[0]?.({ payload: { session_id: 1, percent: null } });
      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "ダウンロード中…",
        progress: null,
        variant: "update",
      });

      progressListeners[0]?.({ payload: { session_id: 1, percent: 0 } });
      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "ダウンロード中… 0%",
        progress: 0,
      });

      progressListeners[0]?.({ payload: { session_id: 1, percent: 100 } });
      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "インストール準備中…",
        progress: 100,
      });

      progressListeners[0]?.({ payload: { session_id: 1, percent: -12 } });
      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "インストール準備中…",
        progress: 100,
      });

      progressListeners[0]?.({ payload: { session_id: 1, percent: 120 } });
      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "インストール準備中…",
        progress: 100,
      });

      progressListeners[0]?.({ payload: { session_id: 1, percent: 42.4 } });
      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "インストール準備中…",
        progress: 100,
      });

      deferredDownload.resolve(Result.succeed(null));
    });

    it("ignores malformed download progress events", async () => {
      const progressListeners: Array<(event: { payload: unknown }) => void> = [];
      mockCheckForUpdate.mockResolvedValue(Result.succeed(null));
      mockListen.mockImplementation(async (eventName: string, callback: (event: { payload: unknown }) => void) => {
        if (eventName === "update-download-progress") {
          progressListeners.push(callback);
        }
        return () => {};
      });

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState({
        ...useUiStore.getInitialState(),
        toastMessage: {
          message: "Existing update state",
          persistent: true,
          progress: 42,
          variant: "update",
        },
      });

      renderHook(() => updaterModule.useUpdater());
      await flushMicrotasksAndRealTimer();

      progressListeners[0]?.({ payload: null });
      progressListeners[0]?.({ payload: [] });
      progressListeners[0]?.({ payload: { session_id: 1, percent: "50" } });
      progressListeners[0]?.({ payload: { session_id: 1, percent: Number.NaN } });
      progressListeners[0]?.({
        payload: { session_id: 1, percent: Number.POSITIVE_INFINITY },
      });
      progressListeners[0]?.({ payload: { loaded: 1 } });

      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "Existing update state",
        progress: 42,
        variant: "update",
      });
    });

    it("keeps updater progress and ready events scoped to the active download session", async () => {
      const deferredDownload = createDeferred<ReturnType<typeof Result.succeed<null>>>();
      const progressListeners: Array<(event: { payload: unknown }) => void> = [];
      const readyListeners: Array<(event: { payload: unknown }) => void> = [];
      mockCheckForUpdate.mockResolvedValue(Result.succeed(updateInfo("1.2.3")));
      mockDownloadUpdate.mockReturnValue(deferredDownload.promise);
      mockListen.mockImplementation(async (eventName: string, callback: (event: { payload: unknown }) => void) => {
        if (eventName === "update-download-progress") {
          progressListeners.push(callback);
        }
        if (eventName === "update-ready") {
          readyListeners.push(callback);
        }
        return () => {};
      });

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      renderHook(() => updaterModule.useUpdater());
      await flushMicrotasksAndRealTimer();

      await updaterModule.runManualUpdateCheck();

      progressListeners[0]?.({ payload: { session_id: 7, percent: 10 } });
      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "ダウンロード中… 10%",
        progress: 10,
      });

      progressListeners[0]?.({ payload: { session_id: 8, percent: 90 } });
      readyListeners[0]?.({ payload: { session_id: 8 } });
      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "ダウンロード中… 10%",
        progress: 10,
      });

      readyListeners[0]?.({ payload: { session_id: 7 } });
      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "v1.2.3 の更新を準備しました。再起動後に適用されます",
        variant: "update",
      });

      progressListeners[0]?.({ payload: { session_id: 7, percent: 99 } });
      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "v1.2.3 の更新を準備しました。再起動後に適用されます",
        variant: "update",
      });

      deferredDownload.resolve(Result.succeed(null));
    });

    it("recovers the ready-to-restart session when the ready event is not delivered", async () => {
      mockCheckForUpdate.mockResolvedValue(Result.succeed(updateInfo("1.2.3")));
      const deferredDownload = createDeferred<ReturnType<typeof Result.succeed<null>>>();
      mockDownloadUpdate.mockReturnValue(deferredDownload.promise);

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      await updaterModule.runManualUpdateCheck();

      deferredDownload.resolve(Result.succeed(null));
      await flushMicrotasksAndRealTimer();

      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "v1.2.3 の更新を準備しました。再起動後に適用されます",
        variant: "update",
      });
    });

    it("does not let a stale download failure overwrite the ready-to-restart toast", async () => {
      const deferredDownload = createDeferred<ReturnType<typeof Result.fail<TestUserVisibleAppError>>>();
      const readyListeners: Array<(event: { payload: unknown }) => void> = [];
      mockCheckForUpdate.mockResolvedValue(Result.succeed(updateInfo("1.2.3")));
      mockDownloadUpdate.mockReturnValue(deferredDownload.promise);
      mockListen.mockImplementation(async (eventName: string, callback: (event: { payload: unknown }) => void) => {
        if (eventName === "update-ready") {
          readyListeners.push(callback);
        }
        return () => {};
      });

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      renderHook(() => updaterModule.useUpdater());
      await flushMicrotasksAndRealTimer();

      await updaterModule.runManualUpdateCheck();

      readyListeners[0]?.({ payload: { session_id: 9 } });
      expect(useUiStore.getState().toastMessage?.message).toBe("v1.2.3 の更新を準備しました。再起動後に適用されます");

      deferredDownload.resolve(Result.fail(testUserVisibleAppError("late download failure")));
      await flushMicrotasksAndRealTimer();

      expect(useUiStore.getState().toastMessage?.message).toBe("v1.2.3 の更新を準備しました。再起動後に適用されます");
    });

    it("does not bind stale progress from a failed session to a retried download", async () => {
      const firstDownload = createDeferred<ReturnType<typeof Result.fail<TestUserVisibleAppError>>>();
      const secondDownload = createDeferred<ReturnType<typeof Result.succeed<null>>>();
      const progressListeners: Array<(event: { payload: unknown }) => void> = [];
      mockCheckForUpdate
        .mockResolvedValueOnce(Result.succeed(updateInfo("1.2.3")))
        .mockResolvedValueOnce(Result.succeed(updateInfo("1.2.4")));
      mockDownloadUpdate.mockReturnValueOnce(firstDownload.promise).mockReturnValueOnce(secondDownload.promise);
      mockListen.mockImplementation(async (eventName: string, callback: (event: { payload: unknown }) => void) => {
        if (eventName === "update-download-progress") {
          progressListeners.push(callback);
        }
        return () => {};
      });

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      renderHook(() => updaterModule.useUpdater());
      await flushMicrotasksAndRealTimer();

      await updaterModule.runManualUpdateCheck();
      progressListeners[0]?.({ payload: { session_id: 10, percent: 25 } });

      firstDownload.resolve(Result.fail(testUserVisibleAppError("network down")));
      await flushMicrotasksAndRealTimer();
      expect(useUiStore.getState().toastMessage?.message).toContain("現在のバージョンを引き続き使用します");

      await updaterModule.runManualUpdateCheck();

      progressListeners[0]?.({ payload: { session_id: 10, percent: 90 } });
      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "ダウンロード中… 0%",
        progress: 0,
      });

      progressListeners[0]?.({ payload: { session_id: 11, percent: 40 } });
      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "ダウンロード中… 40%",
        progress: 40,
      });

      secondDownload.resolve(Result.succeed(null));
    });

    it("ignores stale ready events from a failed install session during a retried download", async () => {
      const firstDownload = createDeferred<ReturnType<typeof Result.fail<TestUserVisibleAppError>>>();
      const secondDownload = createDeferred<ReturnType<typeof Result.succeed<null>>>();
      const progressListeners: Array<(event: { payload: unknown }) => void> = [];
      const readyListeners: Array<(event: { payload: unknown }) => void> = [];
      mockCheckForUpdate
        .mockResolvedValueOnce(Result.succeed(updateInfo("1.2.3")))
        .mockResolvedValueOnce(Result.succeed(updateInfo("1.2.4")));
      mockDownloadUpdate.mockReturnValueOnce(firstDownload.promise).mockReturnValueOnce(secondDownload.promise);
      mockListen.mockImplementation(async (eventName: string, callback: (event: { payload: unknown }) => void) => {
        if (eventName === "update-download-progress") {
          progressListeners.push(callback);
        }
        if (eventName === "update-ready") {
          readyListeners.push(callback);
        }
        return () => {};
      });

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      renderHook(() => updaterModule.useUpdater());
      await flushMicrotasksAndRealTimer();

      await updaterModule.runManualUpdateCheck();
      progressListeners[0]?.({ payload: { session_id: 20, percent: 100 } });

      firstDownload.resolve(Result.fail(testUserVisibleAppError("install failed after download")));
      await flushMicrotasksAndRealTimer();

      await updaterModule.runManualUpdateCheck();

      readyListeners[0]?.({ payload: { session_id: 20 } });
      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "ダウンロード中… 0%",
        progress: 0,
        variant: "update",
      });

      progressListeners[0]?.({ payload: { session_id: 21, percent: 100 } });
      readyListeners[0]?.({ payload: { session_id: 21 } });
      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "v1.2.4 の更新を準備しました。再起動後に適用されます",
        variant: "update",
      });

      secondDownload.resolve(Result.succeed(null));
    });

    it("ignores updater events after listener disposal", async () => {
      const deferredDownload = createDeferred<ReturnType<typeof Result.succeed<null>>>();
      const progressListeners: Array<(event: { payload: unknown }) => void> = [];
      const readyListeners: Array<(event: { payload: unknown }) => void> = [];
      mockCheckForUpdate.mockResolvedValue(Result.succeed(updateInfo("1.2.3")));
      mockDownloadUpdate.mockReturnValue(deferredDownload.promise);
      mockListen.mockImplementation(async (eventName: string, callback: (event: { payload: unknown }) => void) => {
        if (eventName === "update-download-progress") {
          progressListeners.push(callback);
        }
        if (eventName === "update-ready") {
          readyListeners.push(callback);
        }
        return () => {};
      });

      const { updaterModule, useUiStore } = await getUpdaterModuleAndUiStore();
      useUiStore.setState(useUiStore.getInitialState());

      const { unmount } = renderHook(() => updaterModule.useUpdater());
      await flushMicrotasksAndRealTimer();

      await updaterModule.runManualUpdateCheck();
      unmount();

      progressListeners[0]?.({ payload: { session_id: 12, percent: 60 } });
      readyListeners[0]?.({ payload: { session_id: 12 } });

      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "ダウンロード中… 0%",
        progress: 0,
      });

      deferredDownload.resolve(Result.succeed(null));
    });

    it("disposes updater event listeners on unmount", async () => {
      const disposeProgressListener = vi.fn();
      const disposeReadyListener = vi.fn();
      mockCheckForUpdate.mockResolvedValue(Result.succeed(null));
      mockListen.mockImplementation(async (eventName: string) => {
        if (eventName === "update-download-progress") {
          return disposeProgressListener;
        }
        if (eventName === "update-ready") {
          return disposeReadyListener;
        }
        return () => {};
      });

      const { updaterModule } = await getUpdaterModuleAndUiStore();

      const { unmount } = renderHook(() => updaterModule.useUpdater());
      await flushMicrotasksAndRealTimer();

      expect(mockListen).toHaveBeenCalledWith("update-download-progress", expect.any(Function));
      expect(mockListen).toHaveBeenCalledWith("update-ready", expect.any(Function));

      unmount();

      expect(disposeProgressListener).toHaveBeenCalledTimes(1);
      expect(disposeReadyListener).toHaveBeenCalledTimes(1);
    });

    it("surfaces updater listener registration failures with the listener owner", async () => {
      setTauriRuntimePresent();
      const error = new Error("updater listener failed");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const onFailure = vi.fn();
      mockCheckForUpdate.mockResolvedValue(Result.succeed(null));
      mockListen.mockRejectedValue(error);
      window.addEventListener(TAURI_EVENT_LISTENER_FAILURE_EVENT, onFailure);

      const { updaterModule } = await getUpdaterModuleAndUiStore();

      renderHook(() => updaterModule.useUpdater());
      await flushMicrotasksAndRealTimer();

      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(onFailure).toHaveBeenCalledTimes(2);
      expect(onFailure).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          detail: { owner: "updater:download-progress" },
        }),
      );
      expect(onFailure).toHaveBeenNthCalledWith(2, expect.objectContaining({ detail: { owner: "updater:ready" } }));
      window.removeEventListener(TAURI_EVENT_LISTENER_FAILURE_EVENT, onFailure);
      warnSpy.mockRestore();
    });
  });
});
