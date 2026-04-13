import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import type { BrowserDebugGeometryNativeDiagnostics } from "@/lib/browser-debug-geometry";
import { useUiStore } from "@/stores/ui-store";
import { type BrowserWebviewFallbackPayload } from "./browser-webview-state";
import { useBrowserViewSurfaceController } from "./use-browser-view-surface-controller";
import { useBrowserWebviewEvents } from "./use-browser-webview-events";
import { useBrowserWebviewStateChanged } from "./use-browser-webview-state-changed";

type UseBrowserViewEventBridgeParams = {
  showDiagnostics: boolean;
  isLoading: boolean;
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  fallbackInFlightRef: MutableRefObject<boolean>;
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
  onCloseOverlay: () => void;
  onDiagnostics: (payload: BrowserDebugGeometryNativeDiagnostics) => void;
};

export function useBrowserViewEventBridge({
  showDiagnostics,
  isLoading,
  browserStateRef,
  fallbackInFlightRef,
  setBrowserState,
  onCloseOverlay,
  onDiagnostics,
}: UseBrowserViewEventBridgeParams) {
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
  } as const;
}
