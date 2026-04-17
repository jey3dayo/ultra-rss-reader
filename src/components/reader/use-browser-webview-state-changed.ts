import { useCallback } from "react";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import type { UseBrowserWebviewStateChangedParams } from "./browser-view.types";
import { mergeBrowserState, setBrowserStateWithRef } from "./browser-webview-state";

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
