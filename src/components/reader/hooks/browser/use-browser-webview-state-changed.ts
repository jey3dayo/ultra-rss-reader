import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback } from "react";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import {
  mergeBrowserState,
  setBrowserStateWithRef,
  shouldIgnoreBrowserWebviewStateChangedPayload,
} from "../../browser-webview-state";

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
      const requestedUrl = getRequestedUrl();
      if (shouldIgnoreBrowserWebviewStateChangedPayload(browserStateRef.current, payload, requestedUrl)) {
        return;
      }

      const nextState = mergeBrowserState(browserStateRef.current, payload, requestedUrl);
      setBrowserStateWithRef(browserStateRef, setBrowserState, nextState);
      clearSurfaceIssue();
      fallbackInFlightRef.current = false;
    },
    [browserStateRef, clearSurfaceIssue, fallbackInFlightRef, getRequestedUrl, setBrowserState],
  );
}
