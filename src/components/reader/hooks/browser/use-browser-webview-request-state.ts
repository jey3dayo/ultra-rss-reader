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
  setSurfaceIssue: (issue: null) => void;
};

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
