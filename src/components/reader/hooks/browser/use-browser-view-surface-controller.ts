import { useTranslation } from "react-i18next";
import {
  type UseBrowserViewSurfaceStateResult,
  useBrowserViewSurfaceState,
} from "@/components/reader/hooks/browser/use-browser-view-surface-state";
import { isBrowserRuntimeUnavailable } from "../../browser-runtime-availability";
import type { BrowserWebviewStateBinding } from "../../browser-view.types";

type UseBrowserViewSurfaceControllerParams = BrowserWebviewStateBinding & {
  isLoading: boolean;
  onCloseOverlay: () => void;
};

export function useBrowserViewSurfaceController({
  browserStateRef,
  fallbackInFlightRef,
  isLoading,
  onCloseOverlay,
  setBrowserState,
}: UseBrowserViewSurfaceControllerParams): UseBrowserViewSurfaceStateResult {
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
