import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useEffect, useReducer, useRef } from "react";
import type { AppError, BrowserWebviewState } from "@/api/tauri-commands";
import {
  type BrowserSurfaceIssue,
  createBrowserSurfaceFailure,
  createBrowserSurfaceFallback,
  resolveRuntimeUnavailableSurfaceIssue,
} from "@/lib/browser/browser-surface-issue";
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
  clearSurfaceIssue: () => void;
  handleLostEmbeddedBrowserWebview: (error: AppError) => void;
  handleBrowserWebviewFallback: (payload: BrowserWebviewFallbackPayload) => void;
  showSurfaceFailure: (error: AppError) => void;
  activeSurfaceIssue: BrowserSurfaceIssue | null;
};

type SurfaceIssueAction = { type: "clear" } | { type: "set"; issue: BrowserSurfaceIssue };

function surfaceIssueReducer(_state: BrowserSurfaceIssue | null, action: SurfaceIssueAction) {
  switch (action.type) {
    case "clear":
      return null;
    case "set":
      return action.issue;
  }
}

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
  const [surfaceIssue, dispatchSurfaceIssue] = useReducer(surfaceIssueReducer, null);
  const currentBrowserUrl = browserStateRef.current?.url ?? null;
  const currentBrowserIsLoading = browserStateRef.current?.is_loading ?? false;
  const previousBrowserUrlRef = useRef<string | null>(currentBrowserUrl);
  const previousBrowserIsLoadingRef = useRef(currentBrowserIsLoading);
  const previousSurfaceIssueRef = useRef<BrowserSurfaceIssue | null>(surfaceIssue);

  const clearSurfaceIssue = useCallback(() => {
    dispatchSurfaceIssue({ type: "clear" });
  }, []);

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
    clearSurfaceIssue();
  }, [clearSurfaceIssue, currentBrowserIsLoading, currentBrowserUrl, fallbackInFlightRef, surfaceIssue]);

  const handleLostEmbeddedBrowserWebview = useCallback(
    (error: AppError) => {
      console.warn("Embedded browser webview disappeared while overlay was open:", error.message);
      fallbackInFlightRef.current = false;
      setBrowserStateWithRef(browserStateRef, setBrowserState, null);
      clearSurfaceIssue();
      onCloseOverlay();
    },
    [browserStateRef, clearSurfaceIssue, fallbackInFlightRef, onCloseOverlay, setBrowserState],
  );

  const showSurfaceFailure = useCallback(
    (error: AppError) => {
      if (fallbackInFlightRef.current) {
        return;
      }
      fallbackInFlightRef.current = true;
      console.error("Failed to open embedded browser webview:", error);
      dispatchSurfaceIssue({
        type: "set",
        issue: createBrowserSurfaceFailure(error.message, {
          failed,
          failedHint,
        }),
      });
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
      dispatchSurfaceIssue({
        type: "set",
        issue: createBrowserSurfaceFallback(payload.error_message, {
          failed,
          failedHint,
          blocked,
          blockedHint,
        }),
      });
      updateBrowserStateWithRef(browserStateRef, setBrowserState, (currentState) => {
        if (!currentState) {
          return currentState;
        }
        return { ...currentState, is_loading: false };
      });
    },
    [blocked, blockedHint, browserStateRef, failed, failedHint, setBrowserState],
  );

  const activeSurfaceIssue =
    surfaceIssue ??
    resolveRuntimeUnavailableSurfaceIssue({
      runtimeUnavailable,
      isLoading,
      labels: {
        browserMode,
        browserModeHint,
      },
    });

  return {
    surfaceIssue,
    clearSurfaceIssue,
    handleLostEmbeddedBrowserWebview,
    handleBrowserWebviewFallback,
    showSurfaceFailure,
    activeSurfaceIssue,
  };
}
