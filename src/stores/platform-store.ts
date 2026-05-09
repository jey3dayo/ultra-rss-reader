import { Result } from "@praha/byethrow";
import { create } from "zustand";
import type { PlatformInfo } from "@/api/schemas";
import { getPlatformInfo } from "@/api/tauri-commands";
import { DEFAULT_PLATFORM_INFO } from "@/constants/platform";
import { logRuntimeDiagnostic } from "@/lib/runtime/diagnostics";

type PlatformState = {
  platform: PlatformInfo;
  loaded: boolean;
  loadError: boolean;
  inFlightLoad: Promise<void> | null;
};

type PlatformActions = {
  loadPlatformInfo: () => Promise<void>;
};

export function supportsReadingListNativeMenu(platform: PlatformInfo): boolean {
  return platform.kind === "macos" && platform.capabilities.supports_reading_list;
}

export const usePlatformStore = create<PlatformState & PlatformActions>()((set, getState) => ({
  platform: DEFAULT_PLATFORM_INFO,
  loaded: false,
  loadError: false,
  inFlightLoad: null,

  loadPlatformInfo: () => {
    // UI structure must still gate on runtime presence first. Browser preview can
    // legitimately resolve to `unknown` here, and components should not treat that
    // as a desktop platform by itself.
    const state = getState();
    if (state.loaded && !state.loadError) {
      return Promise.resolve();
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
            logRuntimeDiagnostic("platform-info-load", "Failed to load platform info:", error);
            set({
              platform: DEFAULT_PLATFORM_INFO,
              loaded: true,
              loadError: true,
            });
          }),
        );
      })
      .catch((error: unknown) => {
        logRuntimeDiagnostic("platform-info-load", "Failed to load platform info:", error);
        set({
          platform: DEFAULT_PLATFORM_INFO,
          loaded: true,
          loadError: true,
        });
      })
      .finally(() => {
        set({ inFlightLoad: null });
      });

    set({ inFlightLoad: request });
    return request;
  },
}));
