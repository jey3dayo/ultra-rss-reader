import { Result } from "@praha/byethrow";
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

describe("performUpdateCheck", () => {
  beforeEach(() => {
    vi.resetModules();
    mockCheckForUpdate.mockReset();
    mockDownloadAndInstallUpdate.mockReset();
    mockRestartApp.mockReset();
    mockListen.mockReset().mockResolvedValue(() => {});
  });

  it("reuses the in-flight update check result for concurrent callers", async () => {
    const deferred = createDeferred<ReturnType<typeof Result.succeed<UpdateInfo>>>();
    mockCheckForUpdate.mockReturnValue(deferred.promise);

    const { performUpdateCheck } = await import("@/hooks/use-updater");

    const firstCheck = performUpdateCheck();
    const secondCheck = performUpdateCheck();

    expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);

    deferred.resolve(Result.succeed({ version: "1.2.3", body: null }));

    await expect(firstCheck).resolves.toEqual({ version: "1.2.3", body: null });
    await expect(secondCheck).resolves.toEqual({ version: "1.2.3", body: null });
  });

  it("shows a fallback toast that keeps the current version when download fails", async () => {
    mockDownloadAndInstallUpdate.mockResolvedValue(Result.fail({ type: "UserVisible", message: "network down" }));

    const { showUpdateAvailableToast } = await import("@/hooks/use-updater");
    const useUiStore = await getUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showUpdateAvailableToast("1.2.3");
    useUiStore
      .getState()
      .toastMessage?.actions?.find((action) => action.label === "今すぐ更新")
      ?.onClick();
    await flushAsyncWork();

    expect(useUiStore.getState().toastMessage?.message).toContain("現在のバージョンを引き続き使用します");
    expect(useUiStore.getState().toastMessage?.persistent).toBe(true);
    expect(useUiStore.getState().toastMessage?.actions?.some((action) => action.label === "もう一度確認")).toBe(true);
  });

  it("re-checks updates from the fallback toast instead of auto-retrying the download", async () => {
    mockDownloadAndInstallUpdate.mockResolvedValue(Result.fail({ type: "UserVisible", message: "network down" }));
    mockCheckForUpdate.mockResolvedValue(Result.succeed({ version: "1.2.4", body: null }));

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
    expect(useUiStore.getState().toastMessage?.message).toBe("v1.2.4 が利用可能です");
  });

  it("shows a toast when restart fails", async () => {
    mockRestartApp.mockResolvedValue(Result.fail({ type: "UserVisible", message: "restart failed" }));

    const { showRestartToast } = await import("@/hooks/use-updater");
    const useUiStore = await getUiStore();
    useUiStore.setState(useUiStore.getInitialState());

    showRestartToast();
    useUiStore.getState().toastMessage?.actions?.find((action) => action.label === "再起動")?.onClick();
    await flushAsyncWork();

    expect(useUiStore.getState().toastMessage?.message).toBe("再起動に失敗しました");
  });
});
