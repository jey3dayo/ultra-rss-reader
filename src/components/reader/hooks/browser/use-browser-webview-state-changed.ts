import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback } from "react";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { mergeBrowserState, setBrowserStateWithRef } from "../../browser-webview-state";

type UseBrowserWebviewStateChangedParams = {
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  fallbackInFlightRef: MutableRefObject<boolean>;
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
  clearSurfaceIssue: () => void;
  getRequestedUrl: () => string;
};

export function useBrowserWebviewStateChanged({
  browserStateRef,
  fallbackInFlightRef,
  setBrowserState,
  clearSurfaceIssue,
  getRequestedUrl,
}: UseBrowserWebviewStateChangedParams) {
  return useCallback(
    (payload: BrowserWebviewState) => {
      const nextState = mergeBrowserState(browserStateRef.current, payload, getRequestedUrl());
      setBrowserStateWithRef(browserStateRef, setBrowserState, nextState);
      clearSurfaceIssue();
      fallbackInFlightRef.current = false;
    },
    [browserStateRef, clearSurfaceIssue, fallbackInFlightRef, getRequestedUrl, setBrowserState],
  );
}
