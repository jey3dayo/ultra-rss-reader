import { useCallback } from "react";
import { openUrlInExternalBrowser } from "./article-browser-actions";
import type { UseBrowserViewActionsParams } from "./browser-view.types";

export function useBrowserViewActions({
  browserUrl,
  browserStateRef,
  setBrowserState,
  resetBrowserWebviewSyncState,
  setSurfaceIssue,
  showToast,
  syncBrowserWebview,
  initialBrowserState,
  fallbackInFlightRef,
}: UseBrowserViewActionsParams) {
  const handleRetry = useCallback(() => {
    fallbackInFlightRef.current = false;
    resetBrowserWebviewSyncState();
    setSurfaceIssue(null);
    const nextState = initialBrowserState(browserUrl ?? "");
    browserStateRef.current = nextState;
    setBrowserState(nextState);
    void syncBrowserWebview(browserUrl ?? "", "create");
  }, [
    browserStateRef,
    browserUrl,
    fallbackInFlightRef,
    initialBrowserState,
    resetBrowserWebviewSyncState,
    setBrowserState,
    setSurfaceIssue,
    syncBrowserWebview,
  ]);

  const handleOpenExternal = useCallback(async () => {
    if (!browserUrl) {
      return;
    }

    await openUrlInExternalBrowser(browserUrl, {
      background: false,
      showToast,
      errorLabel: "Failed to open preview in external browser",
    });
  }, [browserUrl, showToast]);

  return {
    handleRetry,
    handleOpenExternal,
  } as const;
}
