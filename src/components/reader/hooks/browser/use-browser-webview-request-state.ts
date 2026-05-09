import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useEffect } from "react";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { resolveBrowserStateForRequestedUrl, updateBrowserStateWithRef } from "../../browser-webview-state";

type UseBrowserWebviewRequestStateParams = {
  browserUrl: string | null;
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  fallbackInFlightRef: MutableRefObject<boolean>;
  resetBrowserWebviewSyncState: () => void;
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
  clearSurfaceIssue: () => void;
};

export function useBrowserWebviewRequestState({
  browserUrl,
  browserStateRef,
  fallbackInFlightRef,
  resetBrowserWebviewSyncState,
  setBrowserState,
  clearSurfaceIssue,
}: UseBrowserWebviewRequestStateParams) {
  // Keep this separate from the similar lifecycle hooks: it resets request
  // state synchronously and intentionally has no async cleanup.
  useEffect(() => {
    fallbackInFlightRef.current = false;
    resetBrowserWebviewSyncState();

    if (!browserUrl) {
      return;
    }

    updateBrowserStateWithRef(browserStateRef, setBrowserState, (state) =>
      resolveBrowserStateForRequestedUrl(state, browserUrl),
    );
    clearSurfaceIssue();
  }, [
    browserStateRef,
    browserUrl,
    clearSurfaceIssue,
    fallbackInFlightRef,
    resetBrowserWebviewSyncState,
    setBrowserState,
  ]);
}
