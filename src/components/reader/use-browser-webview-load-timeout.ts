import { useEffect } from "react";
import { BROWSER_WINDOW_LOAD_TIMEOUT_MS } from "@/constants/browser";
import { useUiStore } from "@/stores/ui-store";

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
  useEffect(() => {
    if (!browserUrl || !isLoading) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      const activeUrl = useUiStore.getState().browserUrl;
      if (activeUrl !== browserUrl || !isStillLoading()) {
        return;
      }

      showSurfaceFailure({
        type: "UserVisible",
        message: `Timed out waiting for embedded browser webview to finish loading: ${browserUrl}`,
      });
    }, BROWSER_WINDOW_LOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [browserUrl, isLoading, isStillLoading, showSurfaceFailure]);
}
