import { type RefObject, useLayoutEffect } from "react";
import { useUiStore } from "@/stores/ui-store";

type UseBrowserWebviewBoundsSyncParams = {
  browserUrl: string | null;
  hostRef: RefObject<HTMLDivElement | null>;
  waitForBrowserWebviewListeners: () => Promise<void>;
  syncBrowserWebview: (requestedUrl: string, mode: "create" | "resize") => Promise<void>;
};

export function useBrowserWebviewBoundsSync({
  browserUrl,
  hostRef,
  waitForBrowserWebviewListeners,
  syncBrowserWebview,
}: UseBrowserWebviewBoundsSyncParams) {
  useLayoutEffect(() => {
    if (!browserUrl || !hostRef.current) {
      return undefined;
    }

    let cancelled = false;

    const syncBounds = (mode: "create" | "resize") => {
      void waitForBrowserWebviewListeners().then(() => {
        if (cancelled || useUiStore.getState().browserUrl !== browserUrl) {
          return;
        }

        void syncBrowserWebview(browserUrl, mode);
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
  }, [browserUrl, hostRef, syncBrowserWebview, waitForBrowserWebviewListeners]);
}
