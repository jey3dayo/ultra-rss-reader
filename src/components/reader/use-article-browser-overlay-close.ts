import { Result } from "@praha/byethrow";
import { useCallback } from "react";
import { closeBrowserWebview } from "@/api/tauri-commands";
import { BROWSER_OVERLAY_CLOSE_DELAY_MS } from "@/constants/motion";
import { flushPendingBrowserCloseAction } from "@/lib/actions";
import { emitDebugInputTrace } from "@/lib/debug-input-trace";
import { useUiStore } from "@/stores/ui-store";
import type { UseArticleBrowserOverlayCloseParams } from "./article-view.types";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function waitForBrowserOverlayCloseMotion() {
  if (prefersReducedMotion()) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, BROWSER_OVERLAY_CLOSE_DELAY_MS);
  });
}

export function useArticleBrowserOverlayClose({
  closeBrowser,
  focusSelectedArticleRow,
  setBrowserCloseInFlight,
  setBrowserOverlayClosedPreference,
}: UseArticleBrowserOverlayCloseParams) {
  const finalizeCloseBrowserOverlay = useCallback(() => {
    useUiStore.getState().setFocusedPane("list");
    focusSelectedArticleRow();
    setBrowserOverlayClosedPreference();
    closeBrowser();
    requestAnimationFrame(() => {
      focusSelectedArticleRow();
      flushPendingBrowserCloseAction();
    });
  }, [closeBrowser, focusSelectedArticleRow, setBrowserOverlayClosedPreference]);

  return useCallback(() => {
    if (useUiStore.getState().browserCloseInFlight) {
      emitDebugInputTrace("close-browser ignored (in-flight)");
      return;
    }

    emitDebugInputTrace("close-browser start");
    setBrowserCloseInFlight(true);
    void closeBrowserWebview()
      .then((result) =>
        Result.pipe(
          result,
          Result.inspectError((error) => {
            console.error("Failed to close embedded browser webview before returning to reader mode:", error);
          }),
        ),
      )
      .finally(() => {
        emitDebugInputTrace("close-browser finalize");
        void waitForBrowserOverlayCloseMotion().then(finalizeCloseBrowserOverlay);
      });
  }, [finalizeCloseBrowserOverlay, setBrowserCloseInFlight]);
}
