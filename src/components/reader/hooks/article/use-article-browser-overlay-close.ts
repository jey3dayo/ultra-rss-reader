import { useCallback, useEffect, useRef } from "react";
import { flushPendingBrowserCloseAction } from "@/lib/actions";
import { closeBrowserWebviewBeforeReaderMode } from "@/lib/browser/close-browser-webview-before-reader-mode";
import { emitDebugInputTrace } from "@/lib/debug/debug-input-trace";
import { scheduleReaderFocusFrame } from "@/lib/reader-focus";
import { useUiStore } from "@/stores/ui-store";

type UseArticleBrowserOverlayCloseParams = {
  closeBrowser: () => void;
  focusSelectedArticleRow: () => void;
  setBrowserCloseInFlight: (inFlight: boolean) => void;
  setBrowserOverlayClosedPreference: () => void;
};

function focusSelectedArticleRowAfterClose(focusSelectedArticleRow: () => void): void {
  try {
    focusSelectedArticleRow();
  } catch (error) {
    console.warn("Failed to restore article row focus after closing browser overlay.", error);
  }
}

export function useArticleBrowserOverlayClose({
  closeBrowser,
  focusSelectedArticleRow,
  setBrowserCloseInFlight,
  setBrowserOverlayClosedPreference,
}: UseArticleBrowserOverlayCloseParams) {
  const mountedRef = useRef(true);
  const closeInFlightByHookRef = useRef(false);
  const closeFinalizedRef = useRef(false);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (closeInFlightByHookRef.current && useUiStore.getState().browserCloseInFlight) {
        setBrowserCloseInFlight(false);
      }
    };
  }, [setBrowserCloseInFlight]);

  const finalizeCloseBrowserOverlay = useCallback(() => {
    if (closeFinalizedRef.current) {
      return;
    }

    closeFinalizedRef.current = true;
    const pendingActions = [...useUiStore.getState().pendingBrowserCloseActionQueue];
    setBrowserOverlayClosedPreference();
    closeBrowser();
    useUiStore.getState().setFocusedPane("list");
    focusSelectedArticleRowAfterClose(focusSelectedArticleRow);
    flushPendingBrowserCloseAction(pendingActions);
    scheduleReaderFocusFrame(() => {
      useUiStore.getState().setFocusedPane("list");
      focusSelectedArticleRowAfterClose(focusSelectedArticleRow);
    });
  }, [closeBrowser, focusSelectedArticleRow, setBrowserOverlayClosedPreference]);

  const closeBrowserOverlay = useCallback(() => {
    const store = useUiStore.getState();
    if (store.browserCloseInFlight || store.contentMode !== "browser") {
      emitDebugInputTrace("close-browser ignored (in-flight)");
      return;
    }

    emitDebugInputTrace("close-browser start");
    closeFinalizedRef.current = false;
    closeInFlightByHookRef.current = true;
    setBrowserCloseInFlight(true);
    void closeBrowserWebviewBeforeReaderMode().finally(() => {
      emitDebugInputTrace("close-browser finalize");
      closeInFlightByHookRef.current = false;
      finalizeCloseBrowserOverlay();
    });
  }, [finalizeCloseBrowserOverlay, setBrowserCloseInFlight]);

  const finalizeClosedBrowserOverlay = useCallback(() => {
    emitDebugInputTrace("close-browser native-closed");
    closeInFlightByHookRef.current = false;
    finalizeCloseBrowserOverlay();
  }, [finalizeCloseBrowserOverlay]);

  return {
    closeBrowserOverlay,
    finalizeClosedBrowserOverlay,
  };
}
