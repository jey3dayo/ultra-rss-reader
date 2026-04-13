import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { isBrowserRuntimeUnavailable } from "./browser-runtime-availability";
import { useBrowserViewSurfaceState } from "./use-browser-view-surface-state";

type UseBrowserViewSurfaceControllerParams = {
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  fallbackInFlightRef: MutableRefObject<boolean>;
  isLoading: boolean;
  onCloseOverlay: () => void;
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
};

export function useBrowserViewSurfaceController({
  browserStateRef,
  fallbackInFlightRef,
  isLoading,
  onCloseOverlay,
  setBrowserState,
}: UseBrowserViewSurfaceControllerParams) {
  const { t } = useTranslation("reader");
  const runtimeUnavailable = isBrowserRuntimeUnavailable();

  return useBrowserViewSurfaceState({
    browserStateRef,
    fallbackInFlightRef,
    isLoading,
    runtimeUnavailable,
    onCloseOverlay,
    setBrowserState,
    browserMode: t("browser_embed_browser_mode"),
    browserModeHint: t("browser_embed_browser_mode_hint"),
    failed: t("browser_embed_failed"),
    failedHint: t("browser_embed_failed_hint"),
    blocked: t("browser_embed_blocked"),
    blockedHint: t("browser_embed_blocked_hint"),
  });
}
