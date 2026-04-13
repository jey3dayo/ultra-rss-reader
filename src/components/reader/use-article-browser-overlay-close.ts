import { Result } from "@praha/byethrow";
import { useCallback } from "react";
import { closeBrowserWebview } from "@/api/tauri-commands";
import { flushPendingBrowserCloseAction } from "@/lib/actions";
import { emitDebugInputTrace } from "@/lib/debug-input-trace";
import { useUiStore } from "@/stores/ui-store";

type UseArticleBrowserOverlayCloseParams = {
  closeBrowser: () => void;
  focusSelectedArticleRow: () => void;
  setBrowserCloseInFlight: (inFlight: boolean) => void;
  setBrowserOverlayClosedPreference: () => void;
};

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
        finalizeCloseBrowserOverlay();
      });
  }, [finalizeCloseBrowserOverlay, setBrowserCloseInFlight]);
}
