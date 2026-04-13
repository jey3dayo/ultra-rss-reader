import { Result } from "@praha/byethrow";
import { useCallback } from "react";
import { openInBrowser } from "@/api/tauri-commands";
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

    const result = await openInBrowser(browserUrl, false);
    Result.pipe(
      result,
      Result.inspectError((error) => {
        console.error("Failed to open preview in external browser:", error);
        showToast(error.message);
      }),
    );
  }, [browserUrl, showToast]);

  return {
    handleRetry,
    handleOpenExternal,
  } as const;
}
