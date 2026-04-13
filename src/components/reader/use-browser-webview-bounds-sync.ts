import { useUiStore } from "@/stores/ui-store";
import type { UseBrowserWebviewBoundsSyncParams } from "./browser-view.types";
import { useBrowserUrlLayoutEffect } from "./use-browser-url-effect";

export function useBrowserWebviewBoundsSync({
  browserUrl,
  hostRef,
  waitForBrowserWebviewListeners,
  syncBrowserWebview,
}: UseBrowserWebviewBoundsSyncParams) {
  useBrowserUrlLayoutEffect(
    browserUrl,
    (activeBrowserUrl) => {
      if (!hostRef.current) {
        return undefined;
      }

      let cancelled = false;

      const syncBounds = (mode: "create" | "resize") => {
        void waitForBrowserWebviewListeners().then(() => {
          if (cancelled || useUiStore.getState().browserUrl !== activeBrowserUrl) {
            return;
          }

          void syncBrowserWebview(activeBrowserUrl, mode);
        });
      };

      syncBounds("create");

      const observer =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(() => {
              syncBounds("resize");
            });
      observer?.observe(hostRef.current);

      const handleResize = () => {
        syncBounds("resize");
      };
      window.addEventListener("resize", handleResize);

      return () => {
        cancelled = true;
        observer?.disconnect();
        window.removeEventListener("resize", handleResize);
      };
    },
    [hostRef, syncBrowserWebview, waitForBrowserWebviewListeners],
  );
}
