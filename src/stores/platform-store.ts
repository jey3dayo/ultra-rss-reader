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
};

type PlatformActions = {
  loadPlatformInfo: () => Promise<void>;
};

let inFlightLoad: Promise<void> | null = null;

export const usePlatformStore = create<PlatformState & PlatformActions>()((set, getState) => ({
  platform: defaultPlatformInfo,
  loaded: false,

  loadPlatformInfo: async () => {
    if (getState().loaded) {
      return;
    }
    if (inFlightLoad) {
      return inFlightLoad;
    }

    inFlightLoad = getPlatformInfo()
      .then((result) => {
        Result.pipe(
          result,
          Result.inspect((platform) => {
            set({ platform, loaded: true });
          }),
          Result.inspectError((error) => {
            console.error("Failed to load platform info:", error);
            set({ platform: defaultPlatformInfo, loaded: true });
          }),
        );
      })
      .finally(() => {
        inFlightLoad = null;
      });

    return inFlightLoad;
  },
}));
