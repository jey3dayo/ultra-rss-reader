import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useMemo, useState } from "react";
import type { AppError, BrowserWebviewState } from "@/api/tauri-commands";
import {
  type BrowserSurfaceIssue,
  createBrowserSurfaceFailure,
  createBrowserSurfaceFallback,
  resolveRuntimeUnavailableSurfaceIssue,
} from "./browser-surface-issue";
import type { BrowserWebviewFallbackPayload } from "./browser-webview-state";

type UseBrowserViewSurfaceStateParams = {
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  fallbackInFlightRef: MutableRefObject<boolean>;
  isLoading: boolean;
  runtimeUnavailable: boolean;
  onCloseOverlay: () => void;
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
  browserMode: string;
  browserModeHint: string;
  failed: string;
  failedHint: string;
  blocked: string;
  blockedHint: string;
};

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
}: UseBrowserViewSurfaceStateParams) {
  const [surfaceIssue, setSurfaceIssue] = useState<BrowserSurfaceIssue | null>(null);

  const handleLostEmbeddedBrowserWebview = useCallback(
    (error: AppError) => {
      console.warn("Embedded browser webview disappeared while overlay was open:", error.message);
      fallbackInFlightRef.current = false;
      browserStateRef.current = null;
      setBrowserState(null);
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
      setBrowserState((currentState) => {
        if (!currentState) {
          return currentState;
        }
        const nextState = { ...currentState, is_loading: false };
        browserStateRef.current = nextState;
        return nextState;
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
      setBrowserState((currentState) => {
        if (!currentState) {
          return currentState;
        }
        const nextState = { ...currentState, is_loading: false };
        browserStateRef.current = nextState;
        return nextState;
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
  } as const;
}
