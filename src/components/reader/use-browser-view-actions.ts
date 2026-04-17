import { Result } from "@praha/byethrow";
import { useCallback } from "react";
import {
  type BrowserWebviewState,
  goBackBrowserWebview,
  goForwardBrowserWebview,
  reloadBrowserWebview,
} from "@/api/tauri-commands";
import { openUrlInExternalBrowser } from "./article-browser-actions";
import type { UseBrowserViewActionsParams } from "./browser-view.types";
import { isMissingEmbeddedBrowserWebviewError, setBrowserStateWithRef } from "./browser-webview-state";

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
  const applyBrowserState = useCallback(
    (nextState: BrowserWebviewState) => {
      setBrowserStateWithRef(browserStateRef, setBrowserState, nextState);
      setSurfaceIssue(null);
      fallbackInFlightRef.current = false;
    },
    [browserStateRef, fallbackInFlightRef, setBrowserState, setSurfaceIssue],
  );

  const recoverMissingEmbeddedBrowserWebview = useCallback(async () => {
    const requestedUrl = browserStateRef.current?.url ?? browserUrl;
    if (!requestedUrl) {
      return false;
    }

    fallbackInFlightRef.current = false;
    resetBrowserWebviewSyncState();
    setSurfaceIssue(null);
    const nextState = initialBrowserState(requestedUrl);
    setBrowserStateWithRef(browserStateRef, setBrowserState, nextState);
    await syncBrowserWebview(requestedUrl, "create");
    return true;
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

  const handleGoBack = useCallback(async () => {
    if (!browserStateRef.current?.can_go_back) {
      return;
    }

    Result.pipe(
      await goBackBrowserWebview(),
      Result.inspect(applyBrowserState),
      Result.inspectError(async (error) => {
        if (isMissingEmbeddedBrowserWebviewError(error)) {
          await recoverMissingEmbeddedBrowserWebview();
          return;
        }
        console.error("Failed to go back in browser webview:", error);
        showToast(error.message);
      }),
    );
  }, [applyBrowserState, browserStateRef, recoverMissingEmbeddedBrowserWebview, showToast]);

  const handleGoForward = useCallback(async () => {
    if (!browserStateRef.current?.can_go_forward) {
      return;
    }

    Result.pipe(
      await goForwardBrowserWebview(),
      Result.inspect(applyBrowserState),
      Result.inspectError(async (error) => {
        if (isMissingEmbeddedBrowserWebviewError(error)) {
          await recoverMissingEmbeddedBrowserWebview();
          return;
        }
        console.error("Failed to go forward in browser webview:", error);
        showToast(error.message);
      }),
    );
  }, [applyBrowserState, browserStateRef, recoverMissingEmbeddedBrowserWebview, showToast]);

  const handleRetry = useCallback(() => {
    fallbackInFlightRef.current = false;
    resetBrowserWebviewSyncState();
    setSurfaceIssue(null);
    const nextState = initialBrowserState(browserUrl ?? "");
    setBrowserStateWithRef(browserStateRef, setBrowserState, nextState);
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

  const handleReload = useCallback(async () => {
    if (!browserUrl) {
      return;
    }

    Result.pipe(
      await reloadBrowserWebview(),
      Result.inspect(applyBrowserState),
      Result.inspectError(async (error) => {
        if (isMissingEmbeddedBrowserWebviewError(error)) {
          await recoverMissingEmbeddedBrowserWebview();
          return;
        }
        console.error("Failed to reload browser webview:", error);
        showToast(error.message);
      }),
    );
  }, [applyBrowserState, browserUrl, recoverMissingEmbeddedBrowserWebview, showToast]);

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
    handleGoBack,
    handleGoForward,
    handleRetry,
    handleReload,
    handleOpenExternal,
  } as const;
}
