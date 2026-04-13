import { useTranslation } from "react-i18next";
import { isBrowserRuntimeUnavailable } from "./browser-runtime-availability";
import type {
  UseBrowserViewSurfaceControllerParams,
  UseBrowserViewSurfaceControllerResult,
} from "./browser-view.types";
import { useBrowserViewSurfaceState } from "./use-browser-view-surface-state";

export function useBrowserViewSurfaceController({
  browserStateRef,
  fallbackInFlightRef,
  isLoading,
  onCloseOverlay,
  setBrowserState,
}: UseBrowserViewSurfaceControllerParams): UseBrowserViewSurfaceControllerResult {
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
