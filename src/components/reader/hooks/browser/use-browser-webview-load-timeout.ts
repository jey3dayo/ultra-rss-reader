import { useBrowserUrlEffect } from "@/components/reader/hooks/browser/use-browser-url-effect";
import {
  clearBrowserWebviewLoadTimeout,
  scheduleBrowserWebviewLoadTimeout,
} from "@/lib/browser/browser-webview-load-timeout";

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
  // Keep this separate from the similar lifecycle hooks: it owns only the
  // requested-URL timeout window and stale-loading guard.
  useBrowserUrlEffect(
    browserUrl,
    ({ isCurrent }) => {
      if (!isLoading) {
        return undefined;
      }

      const timeoutId = scheduleBrowserWebviewLoadTimeout(() => {
        if (!isCurrent() || !isStillLoading()) {
          return;
        }

        showSurfaceFailure({
          type: "UserVisible",
          message: "Timed out waiting for embedded browser webview to finish loading.",
        });
      });

      return () => {
        clearBrowserWebviewLoadTimeout(timeoutId);
      };
    },
    [isLoading, isStillLoading, showSurfaceFailure],
  );
}
