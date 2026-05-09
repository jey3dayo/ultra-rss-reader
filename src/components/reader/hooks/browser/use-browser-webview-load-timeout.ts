import { useBrowserUrlEffect } from "@/components/reader/hooks/browser/use-browser-url-effect";
import { BROWSER_WINDOW_LOAD_TIMEOUT_MS } from "@/constants/browser";

type UseBrowserWebviewLoadTimeoutParams = {
  browserUrl: string | null;
  isLoading: boolean;
  isStillLoading: () => boolean;
  showSurfaceFailure: (error: { type: "UserVisible"; message: string }) => void;
};

function scheduleBrowserWebviewLoadTimeout(callback: () => void): number | null {
  if (typeof window === "undefined" || typeof window.setTimeout !== "function") {
    console.warn("Browser webview load timeout timer is unavailable.");
    return null;
  }

  try {
    return window.setTimeout(callback, BROWSER_WINDOW_LOAD_TIMEOUT_MS);
  } catch (error) {
    console.warn("Failed to schedule browser webview load timeout.", error);
    return null;
  }
}

function clearBrowserWebviewLoadTimeout(timeoutId: number | null): void {
  if (timeoutId === null) {
    return;
  }

  try {
    window.clearTimeout(timeoutId);
  } catch (error) {
    console.warn("Failed to clear browser webview load timeout.", error);
  }
}

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
