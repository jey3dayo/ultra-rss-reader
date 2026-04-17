import { useEffect } from "react";
import type { UseBrowserWebviewRequestStateParams } from "./browser-view.types";
import { resolveBrowserStateForRequestedUrl, updateBrowserStateWithRef } from "./browser-webview-state";

export function useBrowserWebviewRequestState({
  browserUrl,
  browserStateRef,
  fallbackInFlightRef,
  resetBrowserWebviewSyncState,
  setBrowserState,
  setSurfaceIssue,
}: UseBrowserWebviewRequestStateParams) {
  useEffect(() => {
    fallbackInFlightRef.current = false;
    resetBrowserWebviewSyncState();

    if (!browserUrl) {
      return;
    }

    updateBrowserStateWithRef(browserStateRef, setBrowserState, (state) =>
      resolveBrowserStateForRequestedUrl(state, browserUrl),
    );
    setSurfaceIssue(null);
  }, [
    browserStateRef,
    browserUrl,
    fallbackInFlightRef,
    resetBrowserWebviewSyncState,
    setBrowserState,
    setSurfaceIssue,
  ]);
}
