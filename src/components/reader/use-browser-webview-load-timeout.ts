import { BROWSER_WINDOW_LOAD_TIMEOUT_MS } from "@/constants/browser";
import { useUiStore } from "@/stores/ui-store";
import type { UseBrowserWebviewLoadTimeoutParams } from "./browser-view.types";
import { useBrowserUrlEffect } from "./use-browser-url-effect";

export function useBrowserWebviewLoadTimeout({
  browserUrl,
  isLoading,
  isStillLoading,
  showSurfaceFailure,
}: UseBrowserWebviewLoadTimeoutParams) {
  useBrowserUrlEffect(
    browserUrl,
    (activeBrowserUrl) => {
      if (!isLoading) {
        return undefined;
      }

      const timeoutId = window.setTimeout(() => {
        const activeUrl = useUiStore.getState().browserUrl;
        if (activeUrl !== activeBrowserUrl || !isStillLoading()) {
          return;
        }

        showSurfaceFailure({
          type: "UserVisible",
          message: `Timed out waiting for embedded browser webview to finish loading: ${activeBrowserUrl}`,
        });
      }, BROWSER_WINDOW_LOAD_TIMEOUT_MS);

      return () => {
        window.clearTimeout(timeoutId);
      };
    },
    [isLoading, isStillLoading, showSurfaceFailure],
  );
}
