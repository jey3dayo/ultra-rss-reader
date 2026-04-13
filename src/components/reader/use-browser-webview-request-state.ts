import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useEffect } from "react";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { resolveBrowserStateForRequestedUrl } from "./browser-webview-state";

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
