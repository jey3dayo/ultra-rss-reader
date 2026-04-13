import { useCallback } from "react";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { mergeBrowserState } from "./browser-webview-state";

type UseBrowserWebviewStateChangedParams = {
  browserStateRef: { current: BrowserWebviewState | null };
  fallbackInFlightRef: { current: boolean };
  setBrowserState: (state: BrowserWebviewState) => void;
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
      browserStateRef.current = nextState;
      setBrowserState(nextState);
      setSurfaceIssue(null);
      fallbackInFlightRef.current = false;
    },
    [browserStateRef, fallbackInFlightRef, getRequestedUrl, setBrowserState, setSurfaceIssue],
  );
}
