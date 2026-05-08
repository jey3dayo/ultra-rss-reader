import { useBrowserUrlEffect } from "@/components/reader/hooks/browser/use-browser-url-effect";
import { BROWSER_WINDOW_LOAD_TIMEOUT_MS } from "@/constants/browser";

type UseBrowserWebviewLoadTimeoutParams = {
  browserUrl: string | null;
  isLoading: boolean;
  isStillLoading: () => boolean;
  showSurfaceFailure: (error: { type: "UserVisible"; message: string }) => void;
};

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
