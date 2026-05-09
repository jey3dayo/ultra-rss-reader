import type { RefObject } from "react";
import type { AppError } from "@/api/tauri-commands";
import { useBrowserUrlLayoutEffect } from "@/components/reader/hooks/browser/use-browser-url-effect";
import { bindWindowEvents } from "@/lib/window/window-events";

type UseBrowserWebviewBoundsSyncParams = {
  browserUrl: string | null;
  hostRef: RefObject<HTMLDivElement | null>;
  waitForBrowserWebviewListeners: () => Promise<void>;
  syncBrowserWebview: (requestedUrl: string, mode: "create" | "resize") => Promise<void>;
  showSurfaceFailure: (error: AppError) => void;
};

export function useBrowserWebviewBoundsSync({
  browserUrl,
  hostRef,
  waitForBrowserWebviewListeners,
  syncBrowserWebview,
  showSurfaceFailure,
}: UseBrowserWebviewBoundsSyncParams) {
  // Keep this separate from the similar lifecycle hooks: it owns layout reads,
  // ResizeObserver cleanup, and native webview create/resize sync ordering.
  useBrowserUrlLayoutEffect(
    browserUrl,
    ({ browserUrl: activeBrowserUrl, isCurrent }) => {
      if (!hostRef.current) {
        return undefined;
      }

      let cancelled = false;

      const syncBounds = (mode: "create" | "resize") => {
        void waitForBrowserWebviewListeners()
          .then(() => {
            if (cancelled || !isCurrent()) {
              return;
            }

            void syncBrowserWebview(activeBrowserUrl, mode);
          })
          .catch((error: AppError) => {
            if (cancelled || !isCurrent()) {
              return;
            }

            console.error("Failed to initialize embedded browser listeners:", error);
            showSurfaceFailure(error);
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
    [hostRef, showSurfaceFailure, syncBrowserWebview, waitForBrowserWebviewListeners],
  );
}
