import { useEffect } from "react";
import type { UseBrowserWebviewRequestStateParams } from "./browser-view.types";
import { resolveBrowserStateForRequestedUrl } from "./browser-webview-state";

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

    setBrowserState((state) => {
      const nextState = resolveBrowserStateForRequestedUrl(state, browserUrl);
      browserStateRef.current = nextState;
      return nextState;
    });
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
