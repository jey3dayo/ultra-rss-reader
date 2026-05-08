import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { AppError, BrowserWebviewState } from "@/api/tauri-commands";
import { useBrowserViewSurfaceState } from "@/components/reader/hooks/browser/use-browser-view-surface-state";
import { isBrowserRuntimeUnavailable } from "../../browser-runtime-availability";
import type { BrowserSurfaceIssue } from "../../browser-surface-issue";
import type { BrowserWebviewFallbackPayload } from "../../browser-webview-state";

type UseBrowserViewSurfaceControllerParams = {
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  fallbackInFlightRef: MutableRefObject<boolean>;
  isLoading: boolean;
  onCloseOverlay: () => void;
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
};

type UseBrowserViewSurfaceControllerResult = {
  surfaceIssue: BrowserSurfaceIssue | null;
  setSurfaceIssue: (issue: BrowserSurfaceIssue | null) => void;
  handleLostEmbeddedBrowserWebview: (error: AppError) => void;
  handleBrowserWebviewFallback: (payload: BrowserWebviewFallbackPayload) => void;
  showSurfaceFailure: (error: AppError) => void;
  activeSurfaceIssue: BrowserSurfaceIssue | null;
};

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
