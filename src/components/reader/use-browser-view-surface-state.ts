import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useMemo, useState } from "react";
import type { AppError, BrowserWebviewState } from "@/api/tauri-commands";
import {
  type BrowserSurfaceIssue,
  createBrowserSurfaceFailure,
  resolveRuntimeUnavailableSurfaceIssue,
} from "./browser-surface-issue";

type UseBrowserViewSurfaceStateParams = {
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  fallbackInFlightRef: MutableRefObject<boolean>;
  isLoading: boolean;
  runtimeUnavailable: boolean;
  onCloseOverlay: () => void;
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
  browserModeLabels: {
    browserMode: string;
    browserModeHint: string;
  };
  failureLabels: {
    failed: string;
    failedHint: string;
  };
};

export function useBrowserViewSurfaceState({
  browserStateRef,
  fallbackInFlightRef,
  isLoading,
  runtimeUnavailable,
  onCloseOverlay,
  setBrowserState,
  browserModeLabels,
  failureLabels,
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
      setSurfaceIssue(createBrowserSurfaceFailure(error.message, failureLabels));
      setBrowserState((currentState) => {
        if (!currentState) {
          return currentState;
        }
        const nextState = { ...currentState, is_loading: false };
        browserStateRef.current = nextState;
        return nextState;
      });
    },
    [browserStateRef, failureLabels, fallbackInFlightRef, setBrowserState],
  );

  const activeSurfaceIssue = useMemo(
    () =>
      surfaceIssue ??
      resolveRuntimeUnavailableSurfaceIssue({
        runtimeUnavailable,
        isLoading,
        labels: browserModeLabels,
      }),
    [browserModeLabels, isLoading, runtimeUnavailable, surfaceIssue],
  );

  return {
    surfaceIssue,
    setSurfaceIssue,
    handleLostEmbeddedBrowserWebview,
    showSurfaceFailure,
    activeSurfaceIssue,
  } as const;
}
