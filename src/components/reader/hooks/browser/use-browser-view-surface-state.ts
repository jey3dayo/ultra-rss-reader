import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppError, BrowserWebviewState } from "@/api/tauri-commands";
import {
  type BrowserSurfaceIssue,
  createBrowserSurfaceFailure,
  createBrowserSurfaceFallback,
  resolveRuntimeUnavailableSurfaceIssue,
} from "../../browser-surface-issue";
import {
  type BrowserWebviewFallbackPayload,
  setBrowserStateWithRef,
  updateBrowserStateWithRef,
} from "../../browser-webview-state";

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

export type UseBrowserViewSurfaceStateResult = {
  surfaceIssue: BrowserSurfaceIssue | null;
  setSurfaceIssue: (issue: BrowserSurfaceIssue | null) => void;
  handleLostEmbeddedBrowserWebview: (error: AppError) => void;
  handleBrowserWebviewFallback: (payload: BrowserWebviewFallbackPayload) => void;
  showSurfaceFailure: (error: AppError) => void;
  activeSurfaceIssue: BrowserSurfaceIssue | null;
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
}: UseBrowserViewSurfaceStateParams): UseBrowserViewSurfaceStateResult {
  const [surfaceIssue, setSurfaceIssue] = useState<BrowserSurfaceIssue | null>(null);
  const currentBrowserUrl = browserStateRef.current?.url ?? null;
  const currentBrowserIsLoading = browserStateRef.current?.is_loading ?? false;
  const previousBrowserUrlRef = useRef<string | null>(currentBrowserUrl);
  const previousBrowserIsLoadingRef = useRef(currentBrowserIsLoading);
  const previousSurfaceIssueRef = useRef<BrowserSurfaceIssue | null>(surfaceIssue);

  useEffect(() => {
    const previousBrowserUrl = previousBrowserUrlRef.current;
    const previousBrowserIsLoading = previousBrowserIsLoadingRef.current;
    const previousSurfaceIssue = previousSurfaceIssueRef.current;
    const browserClosed = previousBrowserUrl !== null && currentBrowserUrl === null;
    const browserUrlChanged =
      previousBrowserUrl !== null && currentBrowserUrl !== null && previousBrowserUrl !== currentBrowserUrl;
    const retryFinished =
      previousSurfaceIssue !== null &&
      previousBrowserUrl === currentBrowserUrl &&
      previousBrowserIsLoading &&
      !currentBrowserIsLoading;

    previousBrowserUrlRef.current = currentBrowserUrl;
    previousBrowserIsLoadingRef.current = currentBrowserIsLoading;
    previousSurfaceIssueRef.current = surfaceIssue;

    if (!surfaceIssue || (!browserClosed && !browserUrlChanged && !retryFinished)) {
      return;
    }

    fallbackInFlightRef.current = false;
    setSurfaceIssue(null);
  }, [currentBrowserIsLoading, currentBrowserUrl, fallbackInFlightRef, surfaceIssue]);

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
