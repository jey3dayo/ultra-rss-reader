import { Result } from "@praha/byethrow";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useRef } from "react";
import {
  type BrowserWebviewState,
  focusBrowserWebview,
  goBackBrowserWebview,
  goForwardBrowserWebview,
  reloadBrowserWebview,
} from "@/api/tauri-commands";
import { isMissingEmbeddedBrowserWebviewError } from "@/lib/browser/browser-webview-state";
import { resolvePreferenceValue } from "@/schemas/preferences";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { openUrlInExternalBrowser } from "../../article-browser-actions";
import type { BrowserViewController } from "../../browser-view.types";
import { setBrowserStateWithRef } from "../../browser-webview-state";

type BrowserWebviewCommand = typeof goBackBrowserWebview;

type UseBrowserViewActionsParams = {
  browserUrl: string | null;
  browserStateRef: MutableRefObject<BrowserWebviewState | null>;
  setBrowserState: Dispatch<SetStateAction<BrowserWebviewState | null>>;
  resetBrowserWebviewSyncState: () => void;
  clearSurfaceIssue: () => void;
  showToast: (message: string) => void;
  syncBrowserWebview: (requestedUrl: string, mode: "create" | "resize") => Promise<void>;
  initialBrowserState: (url: string) => BrowserWebviewState;
  fallbackInFlightRef: MutableRefObject<boolean>;
};

type UseBrowserViewActionsResult = Pick<
  BrowserViewController,
  "handleGoBack" | "handleGoForward" | "handleRetry" | "handleReload" | "handleOpenExternal"
>;

export function useBrowserViewActions({
  browserUrl,
  browserStateRef,
  setBrowserState,
  resetBrowserWebviewSyncState,
  clearSurfaceIssue,
  showToast,
  syncBrowserWebview,
  initialBrowserState,
  fallbackInFlightRef,
}: UseBrowserViewActionsParams): UseBrowserViewActionsResult {
  const browserWebviewCommandGenerationRef = useRef(0);
  const keepWebPreviewFocus = usePreferencesStore(
    (state) => resolvePreferenceValue(state.prefs, "web_preview_keep_focus") === "true",
  );

  const applyBrowserState = useCallback(
    (nextState: BrowserWebviewState) => {
      setBrowserStateWithRef(browserStateRef, setBrowserState, nextState);
      clearSurfaceIssue();
      fallbackInFlightRef.current = false;
    },
    [browserStateRef, clearSurfaceIssue, fallbackInFlightRef, setBrowserState],
  );

  const recoverMissingEmbeddedBrowserWebview = useCallback(async () => {
    const requestedUrl = browserStateRef.current?.url ?? browserUrl;
    if (!requestedUrl) {
      return false;
    }

    fallbackInFlightRef.current = false;
    resetBrowserWebviewSyncState();
    clearSurfaceIssue();
    const nextState = initialBrowserState(requestedUrl);
    setBrowserStateWithRef(browserStateRef, setBrowserState, nextState);
    await syncBrowserWebview(requestedUrl, "create");
    return true;
  }, [
    browserStateRef,
    browserUrl,
    clearSurfaceIssue,
    fallbackInFlightRef,
    initialBrowserState,
    resetBrowserWebviewSyncState,
    setBrowserState,
    syncBrowserWebview,
  ]);

  const runBrowserWebviewCommand = useCallback(
    async (command: BrowserWebviewCommand, errorLabel: string) => {
      const commandGeneration = browserWebviewCommandGenerationRef.current + 1;
      browserWebviewCommandGenerationRef.current = commandGeneration;
      const result = await command();
      if (browserWebviewCommandGenerationRef.current !== commandGeneration) {
        return;
      }

      if (Result.isSuccess(result)) {
        applyBrowserState(Result.unwrap(result));
        if (keepWebPreviewFocus) {
          const focusResult = await focusBrowserWebview();
          if (browserWebviewCommandGenerationRef.current !== commandGeneration) {
            return;
          }
          if (Result.isFailure(focusResult)) {
            console.error("Failed to restore embedded browser focus:", Result.unwrapError(focusResult));
          }
        }
        return;
      }

      const error = Result.unwrapError(result);
      if (isMissingEmbeddedBrowserWebviewError(error)) {
        await recoverMissingEmbeddedBrowserWebview();
        return;
      }

      console.error(errorLabel, error);
      showToast(error.message);
    },
    [applyBrowserState, keepWebPreviewFocus, recoverMissingEmbeddedBrowserWebview, showToast],
  );

  const handleGoBack = useCallback(async () => {
    if (browserStateRef.current?.can_go_back) {
      await runBrowserWebviewCommand(goBackBrowserWebview, "Failed to go back in browser webview:");
    }
  }, [browserStateRef, runBrowserWebviewCommand]);

  const handleGoForward = useCallback(async () => {
    if (browserStateRef.current?.can_go_forward) {
      await runBrowserWebviewCommand(goForwardBrowserWebview, "Failed to go forward in browser webview:");
    }
  }, [browserStateRef, runBrowserWebviewCommand]);

  const handleRetry = useCallback(() => {
    if (!browserUrl) {
      return;
    }

    browserWebviewCommandGenerationRef.current += 1;
    const retryGeneration = browserWebviewCommandGenerationRef.current;
    const requestedUrl = browserUrl;
    fallbackInFlightRef.current = false;
    resetBrowserWebviewSyncState();
    clearSurfaceIssue();
    const nextState = initialBrowserState(requestedUrl);
    setBrowserStateWithRef(browserStateRef, setBrowserState, nextState);
    void syncBrowserWebview(requestedUrl, "create").catch((error: unknown) => {
      if (
        browserWebviewCommandGenerationRef.current !== retryGeneration ||
        useUiStore.getState().browserUrl !== requestedUrl
      ) {
        return;
      }

      console.error("Failed to retry embedded browser webview:", error);
      showToast(error instanceof Error ? error.message : "Failed to retry embedded browser webview.");
    });
  }, [
    browserStateRef,
    browserUrl,
    clearSurfaceIssue,
    fallbackInFlightRef,
    initialBrowserState,
    resetBrowserWebviewSyncState,
    setBrowserState,
    showToast,
    syncBrowserWebview,
  ]);

  const handleReload = useCallback(async () => {
    if (!browserUrl) {
      return;
    }

    await runBrowserWebviewCommand(reloadBrowserWebview, "Failed to reload browser webview:");
  }, [browserUrl, runBrowserWebviewCommand]);

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
  };
}
