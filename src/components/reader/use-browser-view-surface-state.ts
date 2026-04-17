import { useCallback, useMemo, useState } from "react";
import type { AppError } from "@/api/tauri-commands";
import {
  type BrowserSurfaceIssue,
  createBrowserSurfaceFailure,
  createBrowserSurfaceFallback,
  resolveRuntimeUnavailableSurfaceIssue,
} from "./browser-surface-issue";
import type { UseBrowserViewSurfaceStateParams, UseBrowserViewSurfaceStateResult } from "./browser-view.types";
import {
  type BrowserWebviewFallbackPayload,
  setBrowserStateWithRef,
  updateBrowserStateWithRef,
} from "./browser-webview-state";

export function useBrowserViewSurfaceState({
  browserStateRef,
  fallbackInFlightRef,
  isLoading,
  runtimeUnavailable,
  onCloseOverlay,
  setBrowserState,
  browserMode,
  browserModeHint,
  failed,
  failedHint,
  blocked,
  blockedHint,
}: UseBrowserViewSurfaceStateParams): UseBrowserViewSurfaceStateResult {
  const [surfaceIssue, setSurfaceIssue] = useState<BrowserSurfaceIssue | null>(null);

  const handleLostEmbeddedBrowserWebview = useCallback(
    (error: AppError) => {
      console.warn("Embedded browser webview disappeared while overlay was open:", error.message);
      fallbackInFlightRef.current = false;
      setBrowserStateWithRef(browserStateRef, setBrowserState, null);
      setSurfaceIssue(null);
      onCloseOverlay();
    },
    [browserStateRef, fallbackInFlightRef, onCloseOverlay, setBrowserState],
  );

  const showSurfaceFailure = useCallback(
    (error: AppError) => {
      if (fallbackInFlightRef.current) {
        return;
      }
      fallbackInFlightRef.current = true;
      console.error("Failed to open embedded browser webview:", error);
      setSurfaceIssue(
        createBrowserSurfaceFailure(error.message, {
          failed,
          failedHint,
        }),
      );
      updateBrowserStateWithRef(browserStateRef, setBrowserState, (currentState) => {
        if (!currentState) {
          return currentState;
        }
        return { ...currentState, is_loading: false };
      });
    },
    [browserStateRef, failed, failedHint, fallbackInFlightRef, setBrowserState],
  );

  const handleBrowserWebviewFallback = useCallback(
    (payload: BrowserWebviewFallbackPayload) => {
      setSurfaceIssue(
        createBrowserSurfaceFallback(payload.error_message, {
          failed,
          failedHint,
          blocked,
          blockedHint,
        }),
      );
      updateBrowserStateWithRef(browserStateRef, setBrowserState, (currentState) => {
        if (!currentState) {
          return currentState;
        }
        return { ...currentState, is_loading: false };
      });
    },
    [blocked, blockedHint, browserStateRef, failed, failedHint, setBrowserState],
  );

  const activeSurfaceIssue = useMemo(
    () =>
      surfaceIssue ??
      resolveRuntimeUnavailableSurfaceIssue({
        runtimeUnavailable,
        isLoading,
        labels: {
          browserMode,
          browserModeHint,
        },
      }),
    [browserMode, browserModeHint, isLoading, runtimeUnavailable, surfaceIssue],
  );

  return {
    surfaceIssue,
    setSurfaceIssue,
    handleLostEmbeddedBrowserWebview,
    handleBrowserWebviewFallback,
    showSurfaceFailure,
    activeSurfaceIssue,
  };
}
