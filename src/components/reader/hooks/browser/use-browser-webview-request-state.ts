import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useEffect, useRef } from "react";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { initialBrowserState, resolveBrowserStateForRequestedUrl } from "@/lib/browser/browser-webview-state";
import { updateBrowserStateWithRef } from "../../browser-webview-state";

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
  const previousBrowserUrlRef = useRef<string | null>(browserUrl);

  // Keep this separate from the similar lifecycle hooks: it resets request
  // state synchronously and intentionally has no async cleanup.
  useEffect(() => {
    const previousBrowserUrl = previousBrowserUrlRef.current;
    previousBrowserUrlRef.current = browserUrl;
    fallbackInFlightRef.current = false;
    resetBrowserWebviewSyncState();

    if (!browserUrl) {
      return;
    }

    updateBrowserStateWithRef(browserStateRef, setBrowserState, (state) => {
      if (previousBrowserUrl === null && state?.url === browserUrl) {
        return initialBrowserState(browserUrl, state.load_generation + 1);
      }

      return resolveBrowserStateForRequestedUrl(state, browserUrl);
    });
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
