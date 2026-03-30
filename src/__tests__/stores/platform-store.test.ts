import { Result } from "@praha/byethrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformInfo } from "@/api/schemas";

const mockGetPlatformInfo = vi.hoisted(() => vi.fn());

vi.mock("@/api/tauri-commands", () => ({
  getPlatformInfo: mockGetPlatformInfo,
}));

import { usePlatformStore } from "@/stores/platform-store";

const defaultCapabilities = {
  supports_reading_list: false,
  supports_background_browser_open: false,
  supports_runtime_window_icon_replacement: false,
  supports_native_browser_navigation: false,
  uses_dev_file_credentials: false,
};

const windowsPlatformInfo: PlatformInfo = {
  kind: "windows",
  capabilities: {
    ...defaultCapabilities,
    supports_runtime_window_icon_replacement: true,
    supports_native_browser_navigation: true,
  },
};

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

describe("usePlatformStore", () => {
  beforeEach(() => {
    usePlatformStore.setState(usePlatformStore.getInitialState());
    mockGetPlatformInfo.mockReset();
  });

  it("loads platform info once and stores it", async () => {
    mockGetPlatformInfo.mockResolvedValue(Result.succeed(windowsPlatformInfo));

    await usePlatformStore.getState().loadPlatformInfo();
    await usePlatformStore.getState().loadPlatformInfo();

    const state = usePlatformStore.getState();
    expect(state.platform.kind).toBe("windows");
    expect(state.loaded).toBe(true);
    expect(state.loadError).toBe(false);
    expect(mockGetPlatformInfo).toHaveBeenCalledTimes(1);
  });

  it("uses safe non-macos defaults before loading", () => {
    const state = usePlatformStore.getState();

    expect(state.platform.kind).toBe("unknown");
    expect(state.platform.capabilities.supports_reading_list).toBe(false);
  });

  it("retries after failure and updates platform when retry succeeds", async () => {
    mockGetPlatformInfo
      .mockResolvedValueOnce(Result.fail({ type: "UserVisible", message: "temporary failure" }))
      .mockResolvedValueOnce(Result.succeed(windowsPlatformInfo));

    await usePlatformStore.getState().loadPlatformInfo();

    expect(usePlatformStore.getState().loaded).toBe(true);
    expect(usePlatformStore.getState().loadError).toBe(true);
    expect(usePlatformStore.getState().platform.kind).toBe("unknown");

    await usePlatformStore.getState().loadPlatformInfo();

    expect(usePlatformStore.getState().loaded).toBe(true);
    expect(usePlatformStore.getState().loadError).toBe(false);
    expect(usePlatformStore.getState().platform.kind).toBe("windows");
    expect(mockGetPlatformInfo).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent load calls", async () => {
    const deferred = createDeferred<ReturnType<typeof Result.succeed<PlatformInfo>>>();
    mockGetPlatformInfo.mockReturnValue(deferred.promise);

    const firstLoad = usePlatformStore.getState().loadPlatformInfo();
    const secondLoad = usePlatformStore.getState().loadPlatformInfo();

    expect(mockGetPlatformInfo).toHaveBeenCalledTimes(1);
    expect(usePlatformStore.getState().inFlightLoad).not.toBeNull();

    deferred.resolve(Result.succeed(windowsPlatformInfo));
    await Promise.all([firstLoad, secondLoad]);

    expect(usePlatformStore.getState().platform.kind).toBe("windows");
    expect(usePlatformStore.getState().loadError).toBe(false);
    expect(usePlatformStore.getState().inFlightLoad).toBeNull();
  });
});
