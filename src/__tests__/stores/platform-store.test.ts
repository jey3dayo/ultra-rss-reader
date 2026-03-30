import { Result } from "@praha/byethrow";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("usePlatformStore", () => {
  beforeEach(() => {
    usePlatformStore.setState(usePlatformStore.getInitialState());
    mockGetPlatformInfo.mockReset();
  });

  it("loads platform info once and stores it", async () => {
    mockGetPlatformInfo.mockResolvedValue(
      Result.succeed({
        kind: "windows",
        capabilities: {
          ...defaultCapabilities,
          supports_runtime_window_icon_replacement: true,
          supports_native_browser_navigation: true,
        },
      }),
    );

    await usePlatformStore.getState().loadPlatformInfo();
    await usePlatformStore.getState().loadPlatformInfo();

    const state = usePlatformStore.getState();
    expect(state.platform.kind).toBe("windows");
    expect(state.loaded).toBe(true);
    expect(mockGetPlatformInfo).toHaveBeenCalledTimes(1);
  });

  it("uses safe non-macos defaults before loading", () => {
    const state = usePlatformStore.getState();

    expect(state.platform.kind).toBe("unknown");
    expect(state.platform.capabilities.supports_reading_list).toBe(false);
  });
});
