import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback } from "react";
import type { AppError, BrowserWebviewState } from "@/api/tauri-commands";
import { useBrowserViewSurfaceController } from "@/components/reader/hooks/browser/use-browser-view-surface-controller";
import { useBrowserWebviewEvents } from "@/components/reader/hooks/browser/use-browser-webview-events";
import { useBrowserWebviewStateChanged } from "@/components/reader/hooks/browser/use-browser-webview-state-changed";
import { useUiStore } from "@/stores/ui-store";
import type { BrowserSurfaceIssue } from "../../browser-surface-issue";
import type { BrowserWebviewDiagnosticsPayload } from "../../browser-view.types";
import type { BrowserWebviewFallbackPayload } from "../../browser-webview-state";

type UseBrowserViewEventBridgeParams = {
  showDiagnostics: boolean;
  isLoading: boolean;
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  fallbackInFlightRef: MutableRefObject<boolean>;
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
  onCloseOverlay: () => void;
  onDiagnostics: (payload: BrowserWebviewDiagnosticsPayload) => void;
};

type UseBrowserViewEventBridgeResult = {
  setSurfaceIssue: (issue: BrowserSurfaceIssue | null) => void;
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
