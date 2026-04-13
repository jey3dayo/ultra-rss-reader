import { useCallback } from "react";
import { useUiStore } from "@/stores/ui-store";
import type { UseBrowserViewEventBridgeParams, UseBrowserViewEventBridgeResult } from "./browser-view.types";
import type { BrowserWebviewFallbackPayload } from "./browser-webview-state";
import { useBrowserViewSurfaceController } from "./use-browser-view-surface-controller";
import { useBrowserWebviewEvents } from "./use-browser-webview-events";
import { useBrowserWebviewStateChanged } from "./use-browser-webview-state-changed";

export function useBrowserViewEventBridge({
  showDiagnostics,
  isLoading,
  browserStateRef,
  fallbackInFlightRef,
  setBrowserState,
  onCloseOverlay,
  onDiagnostics,
}: UseBrowserViewEventBridgeParams): UseBrowserViewEventBridgeResult {
  const {
    setSurfaceIssue,
    handleLostEmbeddedBrowserWebview,
    handleBrowserWebviewFallback,
    showSurfaceFailure,
    activeSurfaceIssue,
  } = useBrowserViewSurfaceController({
    browserStateRef,
    fallbackInFlightRef,
    isLoading,
    onCloseOverlay,
    setBrowserState,
  });

  const handleBrowserWebviewStateChanged = useBrowserWebviewStateChanged({
    browserStateRef,
    fallbackInFlightRef,
    setBrowserState,
    setSurfaceIssue,
    getRequestedUrl: () => useUiStore.getState().browserUrl ?? "",
  });

  const waitForBrowserWebviewListeners = useBrowserWebviewEvents({
    showDiagnostics,
    onStateChanged: handleBrowserWebviewStateChanged,
    onFallback: useCallback(
      (payload: BrowserWebviewFallbackPayload) => {
        handleBrowserWebviewFallback(payload);
      },
      [handleBrowserWebviewFallback],
    ),
    onClosed: onCloseOverlay,
    onDiagnostics,
  });

  return {
    setSurfaceIssue,
    handleLostEmbeddedBrowserWebview,
    showSurfaceFailure,
    activeSurfaceIssue,
    waitForBrowserWebviewListeners,
  };
}
