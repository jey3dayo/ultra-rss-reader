import type { RefObject } from "react";
import type { AppError } from "@/api/tauri-commands";
import { useBrowserUrlLayoutEffect } from "@/components/reader/hooks/browser/use-browser-url-effect";
import { bindWindowEvents } from "@/lib/window/window-events";

const BROWSER_WEBVIEW_BOUNDS_SYNC_FAILED_MESSAGE =
  "Webプレビューの表示位置を更新できませんでした。再試行してください。";
const BROWSER_WEBVIEW_LISTENER_READY_TIMEOUT_MS = 1_500;
const BROWSER_WEBVIEW_LISTENER_READY_TIMEOUT_MESSAGE =
  "Webプレビューの初期化に時間がかかっています。再試行してください。";

type UseBrowserWebviewBoundsSyncParams = {
  browserUrl: string | null;
  hostRef: RefObject<HTMLDivElement | null>;
  waitForBrowserWebviewListeners: () => Promise<void>;
  syncBrowserWebview: (requestedUrl: string, mode: "create" | "resize") => Promise<void>;
  showSurfaceFailure: (error: AppError) => void;
};

function isAppError(error: unknown): error is AppError {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    "message" in error &&
    (error.type === "UserVisible" || error.type === "Retryable") &&
    typeof error.message === "string" &&
    error.message.trim().length > 0
  );
}

function toBrowserWebviewBoundsSyncError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  return {
    type: "UserVisible",
    message: BROWSER_WEBVIEW_BOUNDS_SYNC_FAILED_MESSAGE,
  };
}

function createBrowserWebviewListenerReadyTimeout(): AppError {
  return {
    type: "Retryable",
    message: BROWSER_WEBVIEW_LISTENER_READY_TIMEOUT_MESSAGE,
  };
}

function waitWithBrowserWebviewListenerReadyTimeout(waitForBrowserWebviewListeners: () => Promise<void>) {
  let timeoutId: number | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(createBrowserWebviewListenerReadyTimeout());
    }, BROWSER_WEBVIEW_LISTENER_READY_TIMEOUT_MS);
  });

  return Promise.race([waitForBrowserWebviewListeners(), timeout]).finally(() => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  });
}

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
      let latestResizeRequestId = 0;

      const syncBounds = (mode: "create" | "resize") => {
        const resizeRequestId = mode === "resize" ? latestResizeRequestId + 1 : null;
        if (resizeRequestId !== null) {
          latestResizeRequestId = resizeRequestId;
        }

        void (async () => {
          await waitWithBrowserWebviewListenerReadyTimeout(waitForBrowserWebviewListeners);
          if (resizeRequestId !== null && latestResizeRequestId !== resizeRequestId) {
            return;
          }
          if (cancelled || !isCurrent()) {
            return;
          }

          await syncBrowserWebview(activeBrowserUrl, mode);
        })().catch((caughtError: unknown) => {
          if (resizeRequestId !== null && latestResizeRequestId !== resizeRequestId) {
            return;
          }
          if (cancelled || !isCurrent()) {
            return;
          }

          const error = toBrowserWebviewBoundsSyncError(caughtError);
          console.error("Failed to sync embedded browser bounds:", error);
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
