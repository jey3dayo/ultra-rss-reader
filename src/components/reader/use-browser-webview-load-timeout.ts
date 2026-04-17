import { BROWSER_WINDOW_LOAD_TIMEOUT_MS } from "@/constants/browser";
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
    ({ browserUrl: activeBrowserUrl, isCurrent }) => {
      if (!isLoading) {
        return undefined;
      }

      const timeoutId = window.setTimeout(() => {
        if (!isCurrent() || !isStillLoading()) {
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
