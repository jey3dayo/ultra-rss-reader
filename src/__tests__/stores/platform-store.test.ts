import { Result } from "@praha/byethrow";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlatformInfo } from "@/api/schemas";
import {
  DEFAULT_PLATFORM_CAPABILITIES,
  DEFAULT_PLATFORM_INFO,
  SHORTCUT_MODIFIER_BY_PLATFORM,
} from "@/constants/platform";

const mockGetPlatformInfo = vi.hoisted(() => vi.fn());

vi.mock("@/api/tauri-commands", () => ({
  getPlatformInfo: mockGetPlatformInfo,
}));

import { supportsReadingListNativeMenu, usePlatformStore } from "@/stores/platform-store";

const windowsPlatformInfo: PlatformInfo = {
  kind: "windows",
  capabilities: {
    ...DEFAULT_PLATFORM_CAPABILITIES,
    supports_runtime_window_icon_replacement: true,
    supports_native_browser_navigation: true,
  },
};

const macosPlatformInfo: PlatformInfo = {
  kind: "macos",
  capabilities: {
    ...DEFAULT_PLATFORM_CAPABILITIES,
    supports_reading_list: true,
    supports_background_browser_open: true,
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

    expect(state.platform).toEqual(DEFAULT_PLATFORM_INFO);
    expect(state.platform.capabilities).toEqual(DEFAULT_PLATFORM_INFO.capabilities);
    expect(SHORTCUT_MODIFIER_BY_PLATFORM).toHaveProperty(state.platform.kind);
  });

  it("keeps Reading List native menu capability limited to macOS platform info", () => {
    expect(supportsReadingListNativeMenu(macosPlatformInfo)).toBe(true);
    expect(supportsReadingListNativeMenu(windowsPlatformInfo)).toBe(false);
    expect(supportsReadingListNativeMenu(DEFAULT_PLATFORM_INFO)).toBe(false);
    expect(
      supportsReadingListNativeMenu({
        ...macosPlatformInfo,
        capabilities: {
          ...macosPlatformInfo.capabilities,
          supports_reading_list: false,
        },
      }),
    ).toBe(false);
  });

  it("retries after failure and updates platform when retry succeeds", async () => {
    mockGetPlatformInfo
      .mockResolvedValueOnce(Result.fail({ type: "UserVisible", message: "temporary failure" }))
      .mockResolvedValueOnce(Result.succeed(windowsPlatformInfo));

    await usePlatformStore.getState().loadPlatformInfo();

    expect(usePlatformStore.getState().loaded).toBe(true);
    expect(usePlatformStore.getState().loadError).toBe(true);
    expect(usePlatformStore.getState().platform).toEqual(DEFAULT_PLATFORM_INFO);

    await usePlatformStore.getState().loadPlatformInfo();

    expect(usePlatformStore.getState().loaded).toBe(true);
    expect(usePlatformStore.getState().loadError).toBe(false);
    expect(usePlatformStore.getState().platform.kind).toBe("windows");
    expect(mockGetPlatformInfo).toHaveBeenCalledTimes(2);
  });

  it("falls back to defaults and allows retry after platform info load rejects", async () => {
    mockGetPlatformInfo
      .mockRejectedValueOnce(new Error("transport failure"))
      .mockResolvedValueOnce(Result.succeed(windowsPlatformInfo));

    await usePlatformStore.getState().loadPlatformInfo();

    expect(usePlatformStore.getState().platform).toEqual(DEFAULT_PLATFORM_INFO);
    expect(usePlatformStore.getState().loaded).toBe(true);
    expect(usePlatformStore.getState().loadError).toBe(true);
    expect(usePlatformStore.getState().inFlightLoad).toBeNull();

    await usePlatformStore.getState().loadPlatformInfo();

    expect(usePlatformStore.getState().platform.kind).toBe("windows");
    expect(usePlatformStore.getState().loadError).toBe(false);
    expect(mockGetPlatformInfo).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent load calls", async () => {
    const deferred = createDeferred<ReturnType<typeof Result.succeed<PlatformInfo>>>();
    mockGetPlatformInfo.mockReturnValue(deferred.promise);

    const firstLoad = usePlatformStore.getState().loadPlatformInfo();
    const secondLoad = usePlatformStore.getState().loadPlatformInfo();

    expect(mockGetPlatformInfo).toHaveBeenCalledTimes(1);
    expect(firstLoad).toBe(secondLoad);
    expect(usePlatformStore.getState().inFlightLoad).toBe(firstLoad);

    deferred.resolve(Result.succeed(windowsPlatformInfo));
    await Promise.all([firstLoad, secondLoad]);

    expect(usePlatformStore.getState().platform.kind).toBe("windows");
    expect(usePlatformStore.getState().loadError).toBe(false);
    expect(usePlatformStore.getState().inFlightLoad).toBeNull();
  });
});
