import { useBrowserUrlLayoutEffect } from "@/components/reader/hooks/browser/use-browser-url-effect";
import { bindWindowEvents } from "@/lib/window-events";
import type { UseBrowserWebviewBoundsSyncParams } from "../../browser-view.types";

export function useBrowserWebviewBoundsSync({
  browserUrl,
  hostRef,
  waitForBrowserWebviewListeners,
  syncBrowserWebview,
}: UseBrowserWebviewBoundsSyncParams) {
  useBrowserUrlLayoutEffect(
    browserUrl,
    ({ browserUrl: activeBrowserUrl, isCurrent }) => {
      if (!hostRef.current) {
        return undefined;
      }

      let cancelled = false;

      const syncBounds = (mode: "create" | "resize") => {
        void waitForBrowserWebviewListeners().then(() => {
          if (cancelled || !isCurrent()) {
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
