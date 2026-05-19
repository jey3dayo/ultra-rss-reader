import { Result } from "@praha/byethrow";
import { useCallback, useEffect, useRef } from "react";
import { closeBrowserWebview } from "@/api/tauri-commands";
import { flushPendingBrowserCloseAction } from "@/lib/actions";
import { emitDebugInputTrace } from "@/lib/debug/debug-input-trace";
import { scheduleReaderFocusFrame } from "@/lib/reader-focus";
import { useUiStore } from "@/stores/ui-store";

const BROWSER_WEBVIEW_CLOSE_TIMEOUT_MS = 2_000;

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

async function closeBrowserWebviewBeforeReaderMode(): Promise<void> {
  let timeoutId: number | null = null;
  const closeCommand = closeBrowserWebview()
    .then((result) => {
      Result.pipe(
        result,
        Result.inspectError((error) => {
          console.error("Failed to close embedded browser webview before returning to reader mode:", error);
        }),
      );
      return "closed" as const;
    })
    .catch((error: unknown) => {
      console.error("Embedded browser webview close command rejected before returning to reader mode:", error);
      return "closed" as const;
    });

  const timeout = new Promise<"timeout">((resolve) => {
    try {
      timeoutId = window.setTimeout(() => resolve("timeout"), BROWSER_WEBVIEW_CLOSE_TIMEOUT_MS);
    } catch (error) {
      console.warn("Failed to schedule embedded browser webview close timeout.", error);
      resolve("timeout");
    }
  });

  const result = await Promise.race([closeCommand, timeout]);
  if (timeoutId !== null) {
    try {
      window.clearTimeout(timeoutId);
    } catch (error) {
      console.warn("Failed to clear embedded browser webview close timeout.", error);
    }
  }
  if (result === "timeout") {
    console.warn("Timed out closing embedded browser webview before returning to reader mode.");
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
    });
    if (mountedRef.current) {
      closeInFlightByHookRef.current = false;
      finalizeCloseBrowserOverlay();
    }
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
