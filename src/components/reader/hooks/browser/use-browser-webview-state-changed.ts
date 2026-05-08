import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback } from "react";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { mergeBrowserState, setBrowserStateWithRef } from "../../browser-webview-state";

type UseBrowserWebviewStateChangedParams = {
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  fallbackInFlightRef: MutableRefObject<boolean>;
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
  setSurfaceIssue: (issue: null) => void;
  getRequestedUrl: () => string;
};

export function useBrowserWebviewStateChanged({
  browserStateRef,
  fallbackInFlightRef,
  setBrowserState,
  setSurfaceIssue,
  getRequestedUrl,
}: UseBrowserWebviewStateChangedParams) {
  return useCallback(
    (payload: BrowserWebviewState) => {
      const nextState = mergeBrowserState(browserStateRef.current, payload, getRequestedUrl());
      setBrowserStateWithRef(browserStateRef, setBrowserState, nextState);
      setSurfaceIssue(null);
      fallbackInFlightRef.current = false;
    },
    [browserStateRef, fallbackInFlightRef, getRequestedUrl, setBrowserState, setSurfaceIssue],
  );
}
