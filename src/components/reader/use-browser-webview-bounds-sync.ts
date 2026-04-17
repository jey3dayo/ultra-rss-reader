import { useUiStore } from "@/stores/ui-store";
import type { UseBrowserWebviewBoundsSyncParams } from "./browser-view.types";
import { bindWindowEvents, useBrowserUrlLayoutEffect } from "./use-browser-url-effect";

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
      const removeWindowEvents = bindWindowEvents([{ type: "resize", listener: handleResize }]);

      return () => {
        cancelled = true;
        observer?.disconnect();
        removeWindowEvents();
      };
    },
    [hostRef, syncBrowserWebview, waitForBrowserWebviewListeners],
  );
}
