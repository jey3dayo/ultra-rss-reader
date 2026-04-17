import { Result } from "@praha/byethrow";
import type { z } from "zod";
import { create } from "zustand";
import type { PlatformInfoSchema } from "@/api/schemas";
import { getPlatformInfo } from "@/api/tauri-commands";

type PlatformInfo = z.infer<typeof PlatformInfoSchema>;

const defaultPlatformInfo: PlatformInfo = {
  kind: "unknown",
  capabilities: {
    supports_reading_list: false,
    supports_background_browser_open: false,
    supports_runtime_window_icon_replacement: false,
    supports_native_browser_navigation: false,
    uses_dev_file_credentials: false,
  },
};

type PlatformState = {
  platform: PlatformInfo;
  loaded: boolean;
  loadError: boolean;
  inFlightLoad: Promise<void> | null;
};

type PlatformActions = {
  loadPlatformInfo: () => Promise<void>;
};

export const usePlatformStore = create<PlatformState & PlatformActions>()((set, getState) => ({
  platform: defaultPlatformInfo,
  loaded: false,
  loadError: false,
  inFlightLoad: null,

  loadPlatformInfo: async () => {
    // UI structure must still gate on runtime presence first. Browser preview can
    // legitimately resolve to `unknown` here, and components should not treat that
    // as a desktop platform by itself.
    const state = getState();
    if (state.loaded && !state.loadError) {
      return;
    }
    if (state.inFlightLoad) {
      return state.inFlightLoad;
    }

    const request = getPlatformInfo()
      .then((result) => {
        Result.pipe(
          result,
          Result.inspect((platform) => {
            set({ platform, loaded: true, loadError: false });
          }),
          Result.inspectError((error) => {
            console.error("Failed to load platform info:", error);
            set({ platform: defaultPlatformInfo, loaded: true, loadError: true });
          }),
        );
      })
      .finally(() => {
        set({ inFlightLoad: null });
      });

    set({ inFlightLoad: request });
    return request;
  },
}));
