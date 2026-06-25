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
const mockDownloadAndInstallUpdate = vi.hoisted(() => vi.fn());
const mockRestartApp = vi.hoisted(() => vi.fn());
const mockListen = vi.hoisted(() => vi.fn());

vi.mock("@/api/tauri-commands", () => ({
  checkForUpdate: mockCheckForUpdate,
  downloadAndInstallUpdate: mockDownloadAndInstallUpdate,
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

describe("performUpdateCheck", () => {
  beforeEach(async () => {
    vi.resetModules();
    mockCheckForUpdate.mockReset();
    mockDownloadAndInstallUpdate.mockReset();
    mockRestartApp.mockReset();
    mockListen.mockReset().mockResolvedValue(() => {});
    delete window.__DEV_BROWSER_MOCKS__;
    delete window.__ULTRA_RSS_BROWSER_MOCKS__;
    resetTauriRuntimeFlags();
    await changeTestLanguage("ja");
  });

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

  it("shares a single in-flight update check between startup and manual triggers", async () => {
    const deferred = createDeferred<ReturnType<typeof Result.succeed<UpdateInfo>>>();
    mockCheckForUpdate.mockReturnValue(deferred.promise);

    const {
      updaterModule: { runManualUpdateCheck, useUpdater },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    renderHook(() => useUpdater());
    const manualCheck = runManualUpdateCheck();

    expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);

    deferred.resolve(Result.succeed(updateInfo("1.2.3")));
    await manualCheck;

    expect(useUiStore.getState().toastMessage?.message).toBe("v1.2.3 が利用可能です");
  });

  it("shares a single startup update check across React StrictMode double mount", async () => {
    const deferred = createDeferred<ReturnType<typeof Result.succeed<UpdateInfo>>>();
    mockCheckForUpdate.mockReturnValue(deferred.promise);

    const {
      updaterModule: { useUpdater },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    renderHook(() => useUpdater(), {
      wrapper: ({ children }: PropsWithChildren) => createElement(StrictMode, null, children),
    });

    expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);

    deferred.resolve(Result.succeed(updateInfo("1.2.3")));
    await flushMicrotasksAndRealTimer();

    expect(useUiStore.getState().toastMessage?.message).toBe("v1.2.3 が利用可能です");
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

  it("shows a fallback toast that keeps the current version when download fails", async () => {
    mockDownloadAndInstallUpdate.mockResolvedValue(Result.fail(testUserVisibleAppError("network down")));

    const {
      updaterModule: { showUpdateAvailableToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showUpdateAvailableToast("1.2.3");
    expect(useUiStore.getState().toastMessage?.variant).toBe("update");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();
    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "ダウンロード中… 0%",
      progress: 0,
      variant: "update",
    });
    await flushMicrotasksAndRealTimer();

    expect(useUiStore.getState().toastMessage?.message).toContain("現在のバージョンを引き続き使用します");
    expect(useUiStore.getState().toastMessage?.persistent).toBe(true);
    expect(useUiStore.getState().toastMessage?.variant).toBe("update");
    expect(useUiStore.getState().toastMessage?.actions?.some((action) => action.label === "もう一度確認")).toBe(true);
  });

  it("surfaces the shared sync maintenance busy state when update install is guarded", async () => {
    mockDownloadAndInstallUpdate.mockResolvedValue(Result.fail(testUserVisibleAppError(sharedOperationBusyMessage)));

    const {
      updaterModule: { showUpdateAvailableToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showUpdateAvailableToast("1.2.3");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();
    await flushMicrotasksAndRealTimer();

    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: sharedOperationBusyMessage,
      persistent: true,
      variant: "update",
    });
    expect(useUiStore.getState().toastMessage?.actions?.map((action) => action.label)).toEqual([
      "もう一度確認",
      "閉じる",
    ]);
  });

  it("disables update download while sync is active", async () => {
    mockDownloadAndInstallUpdate.mockResolvedValue(Result.succeed(null));

    const {
      updaterModule: { showUpdateAvailableToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
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

    showUpdateAvailableToast("1.2.3");
    const updateAction = useUiStore.getState().toastMessage?.actions?.find((action) => action.label === "今すぐ更新");

    expect(updateAction?.disabled).toBeTypeOf("function");
    expect(typeof updateAction?.disabled === "function" ? updateAction.disabled() : updateAction?.disabled).toBe(true);
    updateAction?.onClick();

    expect(mockDownloadAndInstallUpdate).not.toHaveBeenCalled();
    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "v1.2.3 が利用可能です",
      variant: "update",
    });
  });

  it("cleans up the pending download when the download command rejects", async () => {
    mockDownloadAndInstallUpdate
      .mockRejectedValueOnce(new Error("download command rejected"))
      .mockResolvedValueOnce(Result.fail(testUserVisibleAppError("network down")));
    mockCheckForUpdate.mockResolvedValue(Result.succeed(updateInfo("1.2.4")));

    const {
      updaterModule: { showUpdateAvailableToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showUpdateAvailableToast("1.2.3");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();
    await flushMicrotasksAndRealTimer();

    expect(useUiStore.getState().toastMessage?.message).toContain("現在のバージョンを引き続き使用します");

    showUpdateAvailableToast("1.2.3");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();
    await flushMicrotasksAndRealTimer();

    expect(mockDownloadAndInstallUpdate).toHaveBeenCalledTimes(2);

    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "もう一度確認")
      ?.onClick();
    await flushMicrotasksAndRealTimer();

    expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().toastMessage?.message).toBe("v1.2.4 が利用可能です");
  });

  it("uses locale keys for updater toast and action copy", async () => {
    await changeTestLanguage("en");
    mockCheckForUpdate.mockResolvedValue(Result.succeed(null));

    const {
      updaterModule: { runManualUpdateCheck, showRestartToast, showUpdateAvailableToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showUpdateAvailableToast("1.2.3");
    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "v1.2.3 is available",
      variant: "update",
    });
    expect(useUiStore.getState().toastMessage?.actions?.map((action) => action.label)).toEqual(["Update now", "Later"]);

    showRestartToast();
    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "Update is ready",
      variant: "update",
    });
    expect(useUiStore.getState().toastMessage?.actions?.map((action) => action.label)).toEqual(["Restart", "Later"]);

    await runManualUpdateCheck();
    expect(useUiStore.getState().toastMessage?.message).toBe("You're up to date");
  });

  it("uses the current locale for manual update check failure and no-update toasts", async () => {
    const {
      updaterModule: { runManualUpdateCheck },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await changeTestLanguage("en");
    mockCheckForUpdate.mockResolvedValueOnce(Result.fail(testUserVisibleAppError("network down")));
    await runManualUpdateCheck();
    expect(useUiStore.getState().toastMessage?.message).toBe("Failed to check for updates");

    await changeTestLanguage("ja");
    mockCheckForUpdate.mockResolvedValueOnce(Result.succeed(null));
    await runManualUpdateCheck();
    expect(useUiStore.getState().toastMessage?.message).toBe("最新バージョンです");

    errorSpy.mockRestore();
  });

  it("ignores duplicate download clicks while one update download is pending", async () => {
    const deferred = createDeferred<ReturnType<typeof Result.succeed<null>>>();
    mockDownloadAndInstallUpdate.mockReturnValue(deferred.promise);

    const {
      updaterModule: { showUpdateAvailableToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showUpdateAvailableToast("1.2.3");
    const startAction = useUiStore.getState().toastMessage?.actions?.find((action) => action.label === "今すぐ更新");

    startAction?.onClick();
    startAction?.onClick();

    expect(mockDownloadAndInstallUpdate).toHaveBeenCalledTimes(1);

    deferred.resolve(Result.succeed(null));
  });

  it("keeps manual update checks from clearing the pending update while a download is pending", async () => {
    const deferredDownload = createDeferred<ReturnType<typeof Result.succeed<null>>>();
    mockDownloadAndInstallUpdate.mockReturnValue(deferredDownload.promise);
    mockCheckForUpdate.mockResolvedValue(Result.succeed(updateInfo("1.2.4")));

    const {
      updaterModule: { runManualUpdateCheck, showUpdateAvailableToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showUpdateAvailableToast("1.2.3");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();

    await runManualUpdateCheck();

    expect(mockCheckForUpdate).not.toHaveBeenCalled();
    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "ダウンロード中… 0%",
      progress: 0,
      variant: "update",
    });

    deferredDownload.resolve(Result.succeed(null));
  });

  it("keeps download clicks from racing an in-flight manual update check", async () => {
    const deferredCheck = createDeferred<ReturnType<typeof Result.succeed<UpdateInfo>>>();
    mockCheckForUpdate.mockReturnValue(deferredCheck.promise);
    mockDownloadAndInstallUpdate.mockResolvedValue(Result.succeed(null));

    const {
      updaterModule: { runManualUpdateCheck, showUpdateAvailableToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    const manualCheck = runManualUpdateCheck();
    showUpdateAvailableToast("1.2.3");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();

    expect(mockDownloadAndInstallUpdate).not.toHaveBeenCalled();

    deferredCheck.resolve(Result.succeed(updateInfo("1.2.4")));
    await manualCheck;

    expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().toastMessage?.message).toBe("v1.2.4 が利用可能です");
  });

  it("keeps startup update check failures silent while manual failures show a toast", async () => {
    const error = testUserVisibleAppError("network down");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCheckForUpdate.mockResolvedValue(Result.fail(error));

    const {
      updaterModule: { runManualUpdateCheck, useUpdater },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    renderHook(() => useUpdater());
    await flushMicrotasksAndRealTimer();

    expect(warnSpy).toHaveBeenCalledWith("Startup update check failed (silent):", error);
    expect(useUiStore.getState().toastMessage).toBeNull();

    await runManualUpdateCheck();

    expect(errorSpy).toHaveBeenCalledWith("Manual update check failed:", error);
    expect(useUiStore.getState().toastMessage?.message).toBe("アップデートの確認に失敗しました");

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("surfaces updater runtime and endpoint failures through the manual check recovery toast", async () => {
    const initError = testRetryableAppError("Updater unavailable during manual update check: plugin missing");
    const endpointError = testRetryableAppError(
      "Update endpoint unavailable during manual update check: endpoint refused connection",
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCheckForUpdate.mockResolvedValueOnce(Result.fail(initError)).mockResolvedValueOnce(Result.fail(endpointError));

    const {
      updaterModule: { runManualUpdateCheck },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    await runManualUpdateCheck();

    expect(errorSpy).toHaveBeenCalledWith("Manual update check failed:", initError);
    expect(useUiStore.getState().toastMessage?.message).toBe("アップデートの確認に失敗しました");

    await runManualUpdateCheck();

    expect(errorSpy).toHaveBeenCalledWith("Manual update check failed:", endpointError);
    expect(mockCheckForUpdate).toHaveBeenCalledTimes(2);
    expect(useUiStore.getState().toastMessage?.message).toBe("アップデートの確認に失敗しました");

    errorSpy.mockRestore();
  });

  it("keeps manual failure feedback when sharing the startup in-flight check", async () => {
    const error = testUserVisibleAppError("network down");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const deferred = createDeferred<ReturnType<typeof Result.fail<TestUserVisibleAppError>>>();
    mockCheckForUpdate.mockReturnValue(deferred.promise);

    const {
      updaterModule: { runManualUpdateCheck, useUpdater },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    renderHook(() => useUpdater());
    const manualCheck = runManualUpdateCheck();

    expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);

    deferred.resolve(Result.fail(error));
    await manualCheck;
    await flushMicrotasksAndRealTimer();

    expect(warnSpy).toHaveBeenCalledWith("Startup update check failed (silent):", error);
    expect(errorSpy).toHaveBeenCalledWith("Manual update check failed:", error);
    expect(useUiStore.getState().toastMessage?.message).toBe("アップデートの確認に失敗しました");

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("keeps manual success feedback for each caller while sharing the in-flight check", async () => {
    const deferred = createDeferred<ReturnType<typeof Result.succeed<UpdateInfo>>>();
    mockCheckForUpdate.mockReturnValue(deferred.promise);

    const {
      updaterModule: { runManualUpdateCheck },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());
    const showToast = vi.fn(useUiStore.getState().showToast);
    useUiStore.setState({ showToast });

    const firstManualCheck = runManualUpdateCheck();
    const secondManualCheck = runManualUpdateCheck();

    expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);

    deferred.resolve(Result.succeed(null));
    await Promise.all([firstManualCheck, secondManualCheck]);

    expect(showToast).toHaveBeenCalledTimes(2);
    expect(showToast).toHaveBeenNthCalledWith(1, "最新バージョンです");
    expect(showToast).toHaveBeenNthCalledWith(2, "最新バージョンです");
    expect(useUiStore.getState().toastMessage?.message).toBe("最新バージョンです");
  });

  it("does not show an update toast when the startup check resolves after unmount", async () => {
    const deferred = createDeferred<ReturnType<typeof Result.succeed<UpdateInfo>>>();
    mockCheckForUpdate.mockReturnValue(deferred.promise);

    const {
      updaterModule: { useUpdater },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());
    const showToast = vi.fn();
    useUiStore.setState({ showToast });

    const { unmount } = renderHook(() => useUpdater());
    unmount();

    deferred.resolve(Result.succeed(updateInfo("1.2.3")));
    await flushMicrotasksAndRealTimer();

    expect(showToast).not.toHaveBeenCalled();
    expect(useUiStore.getState().toastMessage).toBeNull();
  });

  it("does not warn when the startup check fails after unmount", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const deferred = createDeferred<ReturnType<typeof Result.fail<TestUserVisibleAppError>>>();
    const error = testUserVisibleAppError("network down");
    mockCheckForUpdate.mockReturnValue(deferred.promise);

    const {
      updaterModule: { useUpdater },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    const { unmount } = renderHook(() => useUpdater());
    unmount();

    deferred.resolve(Result.fail(error));
    await flushMicrotasksAndRealTimer();

    expect(warnSpy).not.toHaveBeenCalledWith("Startup update check failed (silent):", error);

    warnSpy.mockRestore();
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

    const {
      updaterModule: { useUpdater },
    } = await getUpdaterModuleAndUiStore();

    const { unmount } = renderHook(() => useUpdater());
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

    const {
      updaterModule: { useUpdater },
    } = await getUpdaterModuleAndUiStore();

    renderHook(() => useUpdater());
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
  });

  it("skips update checks in browser dev mock preview", async () => {
    window.__DEV_BROWSER_MOCKS__ = true;
    window.__ULTRA_RSS_BROWSER_MOCKS__ = true;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCheckForUpdate.mockResolvedValue(Result.fail(testUserVisibleAppError("updater unavailable")));

    const {
      updaterModule: { runManualUpdateCheck, useUpdater },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    renderHook(() => useUpdater());
    await flushMicrotasksAndRealTimer();

    expect(mockCheckForUpdate).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalledWith(
      "Startup update check failed (silent):",
      expect.objectContaining({ message: "updater unavailable" }),
    );

    await runManualUpdateCheck();

    expect(mockCheckForUpdate).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalledWith(
      "Manual update check failed:",
      expect.objectContaining({ message: "updater unavailable" }),
    );
    expect(useUiStore.getState().toastMessage).toBeNull();

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("re-checks updates from the fallback toast instead of auto-retrying the download", async () => {
    mockDownloadAndInstallUpdate.mockResolvedValue(Result.fail(testUserVisibleAppError("network down")));
    mockCheckForUpdate.mockResolvedValue(Result.succeed(updateInfo("1.2.4")));

    const {
      updaterModule: { showUpdateAvailableToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showUpdateAvailableToast("1.2.3");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();
    await flushMicrotasksAndRealTimer();

    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "もう一度確認")
      ?.onClick();
    await flushMicrotasksAndRealTimer();

    expect(mockDownloadAndInstallUpdate).toHaveBeenCalledTimes(1);
    expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().toastMessage?.message).toBe("v1.2.4 が利用可能です");
  });

  it("treats cancelling the available update toast as a no-op before any artifact download starts", async () => {
    mockDownloadAndInstallUpdate.mockResolvedValue(Result.succeed(null));

    const {
      updaterModule: { showUpdateAvailableToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showUpdateAvailableToast("1.2.3");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "後で")
      ?.onClick();
    await flushMicrotasksAndRealTimer();

    expect(mockDownloadAndInstallUpdate).not.toHaveBeenCalled();
    expect(useUiStore.getState().toastMessage).toBeNull();

    showUpdateAvailableToast("1.2.4");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();
    await flushMicrotasksAndRealTimer();

    expect(mockDownloadAndInstallUpdate).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().toastMessage?.message).toBe("更新の準備ができました");
  });

  it("keeps the prepared update pending when restart command fails", async () => {
    mockRestartApp.mockResolvedValue(Result.fail(testUserVisibleAppError("restart failed")));

    const {
      updaterModule: { showRestartToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showRestartToast();
    expect(useUiStore.getState().toastMessage?.variant).toBe("update");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "再起動")
      ?.onClick();
    expect(mockRestartApp).not.toHaveBeenCalled();
    expect(useUiStore.getState().confirmDialog).toMatchObject({
      open: true,
      message: "更新の準備ができました",
      actionLabel: "再起動",
      variant: "warning",
    });
    await useUiStore.getState().confirmDialog.onConfirm?.();
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

  it("keeps the prepared update pending when restart is requested before native install exits", async () => {
    const deferredRestart = createDeferred<ReturnType<typeof Result.fail<TestUserVisibleAppError>>>();
    mockRestartApp.mockReturnValue(deferredRestart.promise);

    const {
      updaterModule: { showRestartToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showRestartToast();
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "再起動")
      ?.onClick();
    await useUiStore.getState().confirmDialog.onConfirm?.();

    expect(mockRestartApp).toHaveBeenCalledTimes(1);

    deferredRestart.resolve(Result.fail(testUserVisibleAppError("restart failed before install exit")));
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

  it("surfaces the shared sync maintenance busy state when prepared update restart is guarded", async () => {
    mockRestartApp.mockResolvedValue(Result.fail(testUserVisibleAppError(sharedOperationBusyMessage)));

    const {
      updaterModule: { showRestartToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showRestartToast();
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "再起動")
      ?.onClick();
    await useUiStore.getState().confirmDialog.onConfirm?.();
    await flushMicrotasksAndRealTimer();

    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: sharedOperationBusyMessage,
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

    const {
      updaterModule: { showRestartToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
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

    showRestartToast();
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "再起動")
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

    const {
      updaterModule: { showRestartToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      settingsOpen: true,
      settingsCategory: "accounts",
      settingsAddAccount: true,
    });
    useUiStore.getState().startAccountSetupVerification();

    showRestartToast();
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "再起動")
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
    showRestartToast();
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "再起動")
      ?.onClick();

    expect(mockRestartApp).not.toHaveBeenCalled();
    expect(useUiStore.getState().confirmDialog.open).toBe(false);
  });

  it("allows prepared update restart after settings dirty state unmounts cleanly", async () => {
    mockRestartApp.mockResolvedValue(Result.succeed(null));

    const {
      updaterModule: { showRestartToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
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

    showRestartToast();
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "再起動")
      ?.onClick();

    expect(useUiStore.getState().confirmDialog.open).toBe(true);
  });

  it("blocks prepared update restart while add feed is dirty or pending", async () => {
    mockRestartApp.mockResolvedValue(Result.succeed(null));

    const {
      updaterModule: { showRestartToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
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

    showRestartToast();
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "再起動")
      ?.onClick();

    expect(mockRestartApp).not.toHaveBeenCalled();
    expect(useUiStore.getState().confirmDialog.open).toBe(false);
    expect(useUiStore.getState().toastMessage?.message).toBe("編集中または保存中の変更があるため、再起動できません。");

    addFeedHook.unmount();
  });

  it("keeps the prepared update pending when restart runtime is unavailable", async () => {
    const runtimeError = {
      type: "RuntimeUnavailable",
      message: "restart command unavailable",
    };
    mockRestartApp.mockResolvedValue(Result.fail(runtimeError));

    const {
      updaterModule: { showRestartToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showRestartToast();
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "再起動")
      ?.onClick();
    expect(mockRestartApp).not.toHaveBeenCalled();
    await useUiStore.getState().confirmDialog.onConfirm?.();
    await flushMicrotasksAndRealTimer();

    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "再起動に失敗しました。更新の準備は完了しています。",
      persistent: true,
      variant: "update",
    });
    expect(useUiStore.getState().toastMessage?.progress).toBeUndefined();
    expect(mockRestartApp).toHaveBeenCalledTimes(1);
  });

  it("does not let a stale restart failure overwrite a newer update toast", async () => {
    const restart = createDeferred<ReturnType<typeof Result.fail<TestUserVisibleAppError>>>();
    mockRestartApp.mockReturnValue(restart.promise);

    const {
      updaterModule: { showRestartToast, showUpdateAvailableToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showRestartToast();
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "再起動")
      ?.onClick();
    await useUiStore.getState().confirmDialog.onConfirm?.();

    showUpdateAvailableToast("1.2.4");

    restart.resolve(Result.fail(testUserVisibleAppError("restart failed")));
    await flushMicrotasksAndRealTimer();

    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "v1.2.4 が利用可能です",
      variant: "update",
    });
  });

  it("normalizes download progress event percent before updating the toast", async () => {
    const deferredDownload = createDeferred<ReturnType<typeof Result.succeed<null>>>();
    const progressListeners: Array<(event: { payload: unknown }) => void> = [];
    mockCheckForUpdate.mockResolvedValue(Result.succeed(null));
    mockDownloadAndInstallUpdate.mockReturnValue(deferredDownload.promise);
    mockListen.mockImplementation(async (eventName: string, callback: (event: { payload: unknown }) => void) => {
      if (eventName === "update-download-progress") {
        progressListeners.push(callback);
      }
      return () => {};
    });

    const {
      updaterModule: { showUpdateAvailableToast, useUpdater },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    renderHook(() => useUpdater());
    await flushMicrotasksAndRealTimer();

    showUpdateAvailableToast("1.2.3");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();

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

    const {
      updaterModule: { useUpdater },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      toastMessage: {
        message: "Existing update state",
        persistent: true,
        progress: 42,
        variant: "update",
      },
    });

    renderHook(() => useUpdater());
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
    mockCheckForUpdate.mockResolvedValue(Result.succeed(null));
    mockDownloadAndInstallUpdate.mockReturnValue(deferredDownload.promise);
    mockListen.mockImplementation(async (eventName: string, callback: (event: { payload: unknown }) => void) => {
      if (eventName === "update-download-progress") {
        progressListeners.push(callback);
      }
      if (eventName === "update-ready") {
        readyListeners.push(callback);
      }
      return () => {};
    });

    const {
      updaterModule: { showUpdateAvailableToast, useUpdater },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    renderHook(() => useUpdater());
    await flushMicrotasksAndRealTimer();

    showUpdateAvailableToast("1.2.3");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();

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
      message: "更新の準備ができました",
      variant: "update",
    });

    progressListeners[0]?.({ payload: { session_id: 7, percent: 99 } });
    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "更新の準備ができました",
      variant: "update",
    });

    deferredDownload.resolve(Result.succeed(null));
  });

  it("recovers the ready-to-restart session when the ready event is not delivered", async () => {
    const deferredDownload = createDeferred<ReturnType<typeof Result.succeed<null>>>();
    mockDownloadAndInstallUpdate.mockReturnValue(deferredDownload.promise);

    const {
      updaterModule: { showUpdateAvailableToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showUpdateAvailableToast("1.2.3");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();

    deferredDownload.resolve(Result.succeed(null));
    await flushMicrotasksAndRealTimer();

    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "更新の準備ができました",
      variant: "update",
    });
  });

  it("ignores stale update toast actions after a newer update toast replaces them", async () => {
    const firstDownload = createDeferred<ReturnType<typeof Result.succeed<null>>>();
    mockDownloadAndInstallUpdate.mockReturnValue(firstDownload.promise);

    const {
      updaterModule: { showUpdateAvailableToast },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showUpdateAvailableToast("1.2.3");
    const staleStartAction = useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新");

    showUpdateAvailableToast("1.2.4");
    staleStartAction?.onClick();

    expect(mockDownloadAndInstallUpdate).not.toHaveBeenCalled();
    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "v1.2.4 が利用可能です",
      variant: "update",
    });

    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();

    expect(mockDownloadAndInstallUpdate).toHaveBeenCalledTimes(1);

    firstDownload.resolve(Result.succeed(null));
  });

  it("does not let a stale download failure overwrite the ready-to-restart toast", async () => {
    const deferredDownload = createDeferred<ReturnType<typeof Result.fail<TestUserVisibleAppError>>>();
    const readyListeners: Array<(event: { payload: unknown }) => void> = [];
    mockCheckForUpdate.mockResolvedValue(Result.succeed(null));
    mockDownloadAndInstallUpdate.mockReturnValue(deferredDownload.promise);
    mockListen.mockImplementation(async (eventName: string, callback: (event: { payload: unknown }) => void) => {
      if (eventName === "update-ready") {
        readyListeners.push(callback);
      }
      return () => {};
    });

    const {
      updaterModule: { showUpdateAvailableToast, useUpdater },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    renderHook(() => useUpdater());
    await flushMicrotasksAndRealTimer();

    showUpdateAvailableToast("1.2.3");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();

    readyListeners[0]?.({ payload: { session_id: 9 } });
    expect(useUiStore.getState().toastMessage?.message).toBe("更新の準備ができました");

    deferredDownload.resolve(Result.fail(testUserVisibleAppError("late download failure")));
    await flushMicrotasksAndRealTimer();

    expect(useUiStore.getState().toastMessage?.message).toBe("更新の準備ができました");
  });

  it("does not bind stale progress from a failed session to a retried download", async () => {
    const firstDownload = createDeferred<ReturnType<typeof Result.fail<TestUserVisibleAppError>>>();
    const secondDownload = createDeferred<ReturnType<typeof Result.succeed<null>>>();
    const progressListeners: Array<(event: { payload: unknown }) => void> = [];
    mockCheckForUpdate.mockResolvedValue(Result.succeed(null));
    mockDownloadAndInstallUpdate.mockReturnValueOnce(firstDownload.promise).mockReturnValueOnce(secondDownload.promise);
    mockListen.mockImplementation(async (eventName: string, callback: (event: { payload: unknown }) => void) => {
      if (eventName === "update-download-progress") {
        progressListeners.push(callback);
      }
      return () => {};
    });

    const {
      updaterModule: { showUpdateAvailableToast, useUpdater },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    renderHook(() => useUpdater());
    await flushMicrotasksAndRealTimer();

    showUpdateAvailableToast("1.2.3");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();
    progressListeners[0]?.({ payload: { session_id: 10, percent: 25 } });

    firstDownload.resolve(Result.fail(testUserVisibleAppError("network down")));
    await flushMicrotasksAndRealTimer();
    expect(useUiStore.getState().toastMessage?.message).toContain("現在のバージョンを引き続き使用します");

    showUpdateAvailableToast("1.2.4");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();

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
    mockCheckForUpdate.mockResolvedValue(Result.succeed(null));
    mockDownloadAndInstallUpdate.mockReturnValueOnce(firstDownload.promise).mockReturnValueOnce(secondDownload.promise);
    mockListen.mockImplementation(async (eventName: string, callback: (event: { payload: unknown }) => void) => {
      if (eventName === "update-download-progress") {
        progressListeners.push(callback);
      }
      if (eventName === "update-ready") {
        readyListeners.push(callback);
      }
      return () => {};
    });

    const {
      updaterModule: { showUpdateAvailableToast, useUpdater },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    renderHook(() => useUpdater());
    await flushMicrotasksAndRealTimer();

    showUpdateAvailableToast("1.2.3");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();
    progressListeners[0]?.({ payload: { session_id: 20, percent: 100 } });

    firstDownload.resolve(Result.fail(testUserVisibleAppError("install failed after download")));
    await flushMicrotasksAndRealTimer();

    showUpdateAvailableToast("1.2.4");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();

    readyListeners[0]?.({ payload: { session_id: 20 } });
    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "ダウンロード中… 0%",
      progress: 0,
      variant: "update",
    });

    progressListeners[0]?.({ payload: { session_id: 21, percent: 100 } });
    readyListeners[0]?.({ payload: { session_id: 21 } });
    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "更新の準備ができました",
      variant: "update",
    });

    secondDownload.resolve(Result.succeed(null));
  });

  it("ignores updater events after listener disposal", async () => {
    const deferredDownload = createDeferred<ReturnType<typeof Result.succeed<null>>>();
    const progressListeners: Array<(event: { payload: unknown }) => void> = [];
    const readyListeners: Array<(event: { payload: unknown }) => void> = [];
    mockCheckForUpdate.mockResolvedValue(Result.succeed(null));
    mockDownloadAndInstallUpdate.mockReturnValue(deferredDownload.promise);
    mockListen.mockImplementation(async (eventName: string, callback: (event: { payload: unknown }) => void) => {
      if (eventName === "update-download-progress") {
        progressListeners.push(callback);
      }
      if (eventName === "update-ready") {
        readyListeners.push(callback);
      }
      return () => {};
    });

    const {
      updaterModule: { showUpdateAvailableToast, useUpdater },
      useUiStore,
    } = await getUpdaterModuleAndUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    const { unmount } = renderHook(() => useUpdater());
    await flushMicrotasksAndRealTimer();

    showUpdateAvailableToast("1.2.3");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();
    unmount();

    progressListeners[0]?.({ payload: { session_id: 12, percent: 60 } });
    readyListeners[0]?.({ payload: { session_id: 12 } });

    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "ダウンロード中… 0%",
      progress: 0,
    });

    deferredDownload.resolve(Result.succeed(null));
  });
});
