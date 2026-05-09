import { Result } from "@praha/byethrow";
import { renderHook } from "@testing-library/react";
import {
  type TestUserVisibleAppError,
  testUserVisibleAppError,
} from "@tests/helpers/app-error";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

type UpdateInfo = { version: string; body: string | null } | null;

async function getUiStore() {
  const { useUiStore } = await import("@/stores/ui-store");
  return useUiStore;
}

async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
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
    await changeTestLanguage("ja");
  });

  it("reuses the in-flight update check result for concurrent callers", async () => {
    const deferred =
      createDeferred<ReturnType<typeof Result.succeed<UpdateInfo>>>();
    mockCheckForUpdate.mockReturnValue(deferred.promise);

    const { performUpdateCheck } = await import("@/hooks/use-updater");

    const firstCheck = performUpdateCheck();
    const secondCheck = performUpdateCheck();

    expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);

    deferred.resolve(Result.succeed({ version: "1.2.3", body: null }));

    const [firstResult, secondResult] = await Promise.all([
      firstCheck,
      secondCheck,
    ]);

    expect(firstResult).toEqual({ version: "1.2.3", body: null });
    expect(secondResult).toEqual({ version: "1.2.3", body: null });
  });

  it("shares a single in-flight update check between startup and manual triggers", async () => {
    const deferred =
      createDeferred<ReturnType<typeof Result.succeed<UpdateInfo>>>();
    mockCheckForUpdate.mockReturnValue(deferred.promise);

    const { runManualUpdateCheck, useUpdater } =
      await import("@/hooks/use-updater");
    const useUiStore = await getUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    renderHook(() => useUpdater());
    const manualCheck = runManualUpdateCheck();

    expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);

    deferred.resolve(Result.succeed({ version: "1.2.3", body: null }));
    await manualCheck;

    expect(useUiStore.getState().toastMessage?.message).toBe(
      "v1.2.3 が利用可能です",
    );
  });

  it("clears the in-flight guard after a shared failure so later checks can retry", async () => {
    const failedCheck =
      createDeferred<ReturnType<typeof Result.fail<TestUserVisibleAppError>>>();
    mockCheckForUpdate.mockReturnValueOnce(failedCheck.promise);

    const { performUpdateCheckResult } = await import("@/hooks/use-updater");

    const firstCheck = performUpdateCheckResult();
    const secondCheck = performUpdateCheckResult();

    expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);

    failedCheck.resolve(Result.fail(testUserVisibleAppError("network down")));
    const [firstResult, secondResult] = await Promise.all([
      firstCheck,
      secondCheck,
    ]);

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
    const error = testUserVisibleAppError("network down");
    mockCheckForUpdate.mockResolvedValue(Result.fail(error));

    const { performUpdateCheck, performUpdateCheckResult } =
      await import("@/hooks/use-updater");

    const result = await performUpdateCheckResult();
    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toEqual(error);

    await expect(performUpdateCheck()).rejects.toEqual(error);
  });

  it("shows a fallback toast that keeps the current version when download fails", async () => {
    mockDownloadAndInstallUpdate.mockResolvedValue(
      Result.fail(testUserVisibleAppError("network down")),
    );

    const { showUpdateAvailableToast } = await import("@/hooks/use-updater");
    const useUiStore = await getUiStore();
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
    await flushAsyncWork();

    expect(useUiStore.getState().toastMessage?.message).toContain(
      "現在のバージョンを引き続き使用します",
    );
    expect(useUiStore.getState().toastMessage?.persistent).toBe(true);
    expect(useUiStore.getState().toastMessage?.variant).toBe("update");
    expect(
      useUiStore
        .getState()
        .toastMessage?.actions?.some(
          (action) => action.label === "もう一度確認",
        ),
    ).toBe(true);
  });

  it("cleans up the pending download when the download command rejects", async () => {
    mockDownloadAndInstallUpdate
      .mockRejectedValueOnce(new Error("download command rejected"))
      .mockResolvedValueOnce(
        Result.fail(testUserVisibleAppError("network down")),
      );
    mockCheckForUpdate.mockResolvedValue(
      Result.succeed({ version: "1.2.4", body: null }),
    );

    const { showUpdateAvailableToast } = await import("@/hooks/use-updater");
    const useUiStore = await getUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showUpdateAvailableToast("1.2.3");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();
    await flushAsyncWork();

    expect(useUiStore.getState().toastMessage?.message).toContain(
      "現在のバージョンを引き続き使用します",
    );

    showUpdateAvailableToast("1.2.3");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();
    await flushAsyncWork();

    expect(mockDownloadAndInstallUpdate).toHaveBeenCalledTimes(2);

    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "もう一度確認")
      ?.onClick();
    await flushAsyncWork();

    expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().toastMessage?.message).toBe(
      "v1.2.4 が利用可能です",
    );
  });

  it("uses locale keys for updater toast and action copy", async () => {
    await changeTestLanguage("en");
    mockCheckForUpdate.mockResolvedValue(Result.succeed(null));

    const { runManualUpdateCheck, showRestartToast, showUpdateAvailableToast } =
      await import("@/hooks/use-updater");
    const useUiStore = await getUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showUpdateAvailableToast("1.2.3");
    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "v1.2.3 is available",
      variant: "update",
    });
    expect(
      useUiStore
        .getState()
        .toastMessage?.actions?.map((action) => action.label),
    ).toEqual(["Update now", "Later"]);

    showRestartToast();
    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "Update is ready",
      variant: "update",
    });
    expect(
      useUiStore
        .getState()
        .toastMessage?.actions?.map((action) => action.label),
    ).toEqual(["Restart", "Later"]);

    await runManualUpdateCheck();
    expect(useUiStore.getState().toastMessage?.message).toBe(
      "You're up to date",
    );
  });

  it("ignores duplicate download clicks while one update download is pending", async () => {
    const deferred = createDeferred<ReturnType<typeof Result.succeed<null>>>();
    mockDownloadAndInstallUpdate.mockReturnValue(deferred.promise);

    const { showUpdateAvailableToast } = await import("@/hooks/use-updater");
    const useUiStore = await getUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showUpdateAvailableToast("1.2.3");
    const startAction = useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新");

    startAction?.onClick();
    startAction?.onClick();

    expect(mockDownloadAndInstallUpdate).toHaveBeenCalledTimes(1);

    deferred.resolve(Result.succeed(null));
  });

  it("keeps startup update check failures silent while manual failures show a toast", async () => {
    const error = testUserVisibleAppError("network down");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCheckForUpdate.mockResolvedValue(Result.fail(error));

    const { runManualUpdateCheck, useUpdater } =
      await import("@/hooks/use-updater");
    const useUiStore = await getUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    renderHook(() => useUpdater());
    await flushAsyncWork();

    expect(warnSpy).toHaveBeenCalledWith(
      "Startup update check failed (silent):",
      error,
    );
    expect(useUiStore.getState().toastMessage).toBeNull();

    await runManualUpdateCheck();

    expect(errorSpy).toHaveBeenCalledWith("Manual update check failed:", error);
    expect(useUiStore.getState().toastMessage?.message).toBe(
      "アップデートの確認に失敗しました",
    );

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("does not show an update toast when the startup check resolves after unmount", async () => {
    const deferred =
      createDeferred<ReturnType<typeof Result.succeed<UpdateInfo>>>();
    mockCheckForUpdate.mockReturnValue(deferred.promise);

    const { useUpdater } = await import("@/hooks/use-updater");
    const useUiStore = await getUiStore();
    useUiStore.setState(useUiStore.getInitialState());
    const showToast = vi.fn();
    useUiStore.setState({ showToast });

    const { unmount } = renderHook(() => useUpdater());
    unmount();

    deferred.resolve(Result.succeed({ version: "1.2.3", body: null }));
    await flushAsyncWork();

    expect(showToast).not.toHaveBeenCalled();
    expect(useUiStore.getState().toastMessage).toBeNull();
  });

  it("does not warn when the startup check fails after unmount", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const deferred =
      createDeferred<ReturnType<typeof Result.fail<TestUserVisibleAppError>>>();
    const error = testUserVisibleAppError("network down");
    mockCheckForUpdate.mockReturnValue(deferred.promise);

    const { useUpdater } = await import("@/hooks/use-updater");
    const useUiStore = await getUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    const { unmount } = renderHook(() => useUpdater());
    unmount();

    deferred.resolve(Result.fail(error));
    await flushAsyncWork();

    expect(warnSpy).not.toHaveBeenCalledWith(
      "Startup update check failed (silent):",
      error,
    );

    warnSpy.mockRestore();
  });

  it("skips update checks in browser dev mock preview", async () => {
    window.__DEV_BROWSER_MOCKS__ = true;
    window.__ULTRA_RSS_BROWSER_MOCKS__ = true;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCheckForUpdate.mockResolvedValue(
      Result.fail(testUserVisibleAppError("updater unavailable")),
    );

    const { runManualUpdateCheck, useUpdater } =
      await import("@/hooks/use-updater");
    const useUiStore = await getUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    renderHook(() => useUpdater());
    await flushAsyncWork();

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
    mockDownloadAndInstallUpdate.mockResolvedValue(
      Result.fail(testUserVisibleAppError("network down")),
    );
    mockCheckForUpdate.mockResolvedValue(
      Result.succeed({ version: "1.2.4", body: null }),
    );

    const { showUpdateAvailableToast } = await import("@/hooks/use-updater");
    const useUiStore = await getUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showUpdateAvailableToast("1.2.3");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();
    await flushAsyncWork();

    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "もう一度確認")
      ?.onClick();
    await flushAsyncWork();

    expect(mockDownloadAndInstallUpdate).toHaveBeenCalledTimes(1);
    expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().toastMessage?.message).toBe(
      "v1.2.4 が利用可能です",
    );
  });

  it("keeps the prepared update pending when restart command fails", async () => {
    mockRestartApp.mockResolvedValue(
      Result.fail(testUserVisibleAppError("restart failed")),
    );

    const { showRestartToast } = await import("@/hooks/use-updater");
    const useUiStore = await getUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showRestartToast();
    expect(useUiStore.getState().toastMessage?.variant).toBe("update");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "再起動")
      ?.onClick();
    await flushAsyncWork();

    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "再起動に失敗しました。更新の準備は完了しています。",
      persistent: true,
      variant: "update",
    });
    expect(
      useUiStore
        .getState()
        .toastMessage?.actions?.map((action) => action.label),
    ).toEqual(["もう一度再起動", "後で"]);
  });

  it("keeps the prepared update pending when restart runtime is unavailable", async () => {
    const runtimeError = {
      type: "RuntimeUnavailable",
      message: "restart command unavailable",
    };
    mockRestartApp.mockResolvedValue(Result.fail(runtimeError));

    const { showRestartToast } = await import("@/hooks/use-updater");
    const useUiStore = await getUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showRestartToast();
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "再起動")
      ?.onClick();
    await flushAsyncWork();

    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "再起動に失敗しました。更新の準備は完了しています。",
      persistent: true,
      variant: "update",
    });
    expect(useUiStore.getState().toastMessage?.progress).toBeUndefined();
    expect(mockRestartApp).toHaveBeenCalledTimes(1);
  });

  it("normalizes download progress event percent before updating the toast", async () => {
    const progressListeners: Array<(event: { payload: unknown }) => void> = [];
    mockCheckForUpdate.mockResolvedValue(Result.succeed(null));
    mockListen.mockImplementation(
      async (
        eventName: string,
        callback: (event: { payload: unknown }) => void,
      ) => {
        if (eventName === "update-download-progress") {
          progressListeners.push(callback);
        }
        return () => {};
      },
    );

    const { useUpdater } = await import("@/hooks/use-updater");
    const useUiStore = await getUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    renderHook(() => useUpdater());
    await flushAsyncWork();

    progressListeners[0]?.({ payload: { percent: null } });
    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "ダウンロード中…",
      progress: null,
      variant: "update",
    });

    progressListeners[0]?.({ payload: { percent: 0 } });
    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "ダウンロード中… 0%",
      progress: 0,
    });

    progressListeners[0]?.({ payload: { percent: 100 } });
    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "ダウンロード中… 100%",
      progress: 100,
    });

    progressListeners[0]?.({ payload: { percent: -12 } });
    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "ダウンロード中… 0%",
      progress: 0,
    });

    progressListeners[0]?.({ payload: { percent: 120 } });
    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "ダウンロード中… 100%",
      progress: 100,
    });

    progressListeners[0]?.({ payload: { percent: 42.4 } });
    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "ダウンロード中… 42%",
      progress: 42,
    });
  });

  it("ignores malformed download progress events", async () => {
    const progressListeners: Array<(event: { payload: unknown }) => void> = [];
    mockCheckForUpdate.mockResolvedValue(Result.succeed(null));
    mockListen.mockImplementation(
      async (
        eventName: string,
        callback: (event: { payload: unknown }) => void,
      ) => {
        if (eventName === "update-download-progress") {
          progressListeners.push(callback);
        }
        return () => {};
      },
    );

    const { useUpdater } = await import("@/hooks/use-updater");
    const useUiStore = await getUiStore();
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
    await flushAsyncWork();

    progressListeners[0]?.({ payload: null });
    progressListeners[0]?.({ payload: [] });
    progressListeners[0]?.({ payload: { percent: "50" } });
    progressListeners[0]?.({ payload: { percent: Number.NaN } });
    progressListeners[0]?.({ payload: { percent: Number.POSITIVE_INFINITY } });
    progressListeners[0]?.({ payload: { loaded: 1 } });

    expect(useUiStore.getState().toastMessage).toMatchObject({
      message: "Existing update state",
      progress: 42,
      variant: "update",
    });
  });
});
