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
});
