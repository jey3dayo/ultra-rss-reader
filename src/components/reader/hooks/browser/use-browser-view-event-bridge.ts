import { useCallback } from "react";
import type { AppError } from "@/api/tauri-commands";
import { useBrowserViewSurfaceController } from "@/components/reader/hooks/browser/use-browser-view-surface-controller";
import { useBrowserWebviewEvents } from "@/components/reader/hooks/browser/use-browser-webview-events";
import { useBrowserWebviewStateChanged } from "@/components/reader/hooks/browser/use-browser-webview-state-changed";
import type { BrowserSurfaceIssue } from "@/lib/browser/browser-surface-issue";
import { useUiStore } from "@/stores/ui-store";
import type { BrowserWebviewDiagnosticsPayload, BrowserWebviewStateBinding } from "../../browser-view.types";
import type { BrowserWebviewFallbackPayload } from "../../browser-webview-state";

type UseBrowserViewEventBridgeParams = BrowserWebviewStateBinding & {
  showDiagnostics: boolean;
  isLoading: boolean;
  onCloseOverlay: () => void;
  onDiagnostics: (payload: BrowserWebviewDiagnosticsPayload) => void;
};

type UseBrowserViewEventBridgeResult = {
  clearSurfaceIssue: () => void;
  handleLostEmbeddedBrowserWebview: (error: AppError) => void;
  showSurfaceFailure: (error: AppError) => void;
  activeSurfaceIssue: BrowserSurfaceIssue | null;
  waitForBrowserWebviewListeners: () => Promise<void>;
};

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
    clearSurfaceIssue,
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
    clearSurfaceIssue,
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
    isClosedEventCurrent: useCallback(
      (payload) => {
        const currentState = browserStateRef.current;
        const requestedUrl = useUiStore.getState().browserUrl;
        return (
          requestedUrl === payload.url &&
          currentState?.url === payload.url &&
          currentState.load_generation === payload.load_generation
        );
      },
      [browserStateRef],
    ),
    onDiagnostics,
  });

  return {
    clearSurfaceIssue,
    handleLostEmbeddedBrowserWebview,
    showSurfaceFailure,
    activeSurfaceIssue,
    waitForBrowserWebviewListeners,
  };
}
